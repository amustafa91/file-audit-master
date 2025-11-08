const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const fsSync = require('fs');
const Store = require('electron-store');
const diff = require('diff');
const crypto = require('crypto');
const { fork } = require('child_process');
const { createInterface } = require('readline');
const { createReadStream } = require('fs');
const chokidar = require('chokidar');

// By setting the app name explicitly, we ensure that app.getPath('userData')
// resolves to a predictable location (.../AppData/Roaming/file-audit-master).
// This is crucial for the background service to find the same config file.
app.setName('file-audit-master');

const store = new Store();
let mainWindow = null;
let watcherService = null; // Holds the child process instance for the current session
let logFileWatcher = null; // Holds the chokidar instance for watching the active log file
let logHistory = [];

const LOG_FILE_NAME = 'change_log.json';
const SNAPSHOTS_DIR_NAME = 'snapshots';
const pidFilePath = path.join(app.getPath('userData'), 'service.pid');
const STORE_KEY_AUTO_START = 'settings.autoStartServiceOnLogin';

// === Centralized Logging ===
function addLog(source, type, message) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        source,
        type,
        message,
    };
    logHistory.push(logEntry);
    if (logHistory.length > 500) {
        logHistory.shift(); // Keep buffer from growing indefinitely
    }
    if (mainWindow) {
        mainWindow.webContents.send('on-log-message', logEntry);
    }
}

// Override console methods to capture logs from the main process
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    addLog('Main', 'log', message);
    originalConsoleLog.apply(console, args);
};
console.error = (...args) => {
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    addLog('Main', 'error', message);
    originalConsoleError.apply(console, args);
};

/**
 * Checks if a log file is in the legacy JSON array format and migrates it to NDJSON.
 * This is a one-time operation per file to ensure backward compatibility.
 * @param {string} logPath The full path to the log file.
 */
async function migrateLogFileIfNeeded(logPath) {
    if (!fsSync.existsSync(logPath)) {
        return; // File doesn't exist, nothing to migrate.
    }
    if (fsSync.statSync(logPath).size === 0) {
        return; // File is empty.
    }

    let fileHandle;
    try {
        fileHandle = await fs.open(logPath, 'r');
        const buffer = Buffer.alloc(1);
        await fileHandle.read(buffer, 0, 1, 0);
        const firstChar = buffer.toString('utf8').trim();
        
        // If the file starts with '{', it's already NDJSON.
        if (firstChar !== '[') {
            return;
        }
    } catch (e) {
        console.error(`Error checking log format for ${logPath}:`, e);
        return; // Can't read the file, so we can't migrate it.
    } finally {
        if (fileHandle) await fileHandle.close();
    }

    console.log(`Legacy log format detected at ${logPath}. Migrating to NDJSON...`);
    const backupPath = logPath + '.bak';
    const corruptPath = logPath + '.corrupt';

    try {
        // 1. Securely back up the old file.
        await fs.rename(logPath, backupPath);

        // 2. Read the entire old file and parse it.
        const oldContent = await fs.readFile(backupPath, 'utf8');
        const oldLogs = JSON.parse(oldContent);
        if (!Array.isArray(oldLogs)) {
            throw new Error('Legacy log is not a valid JSON array.');
        }

        // 3. Convert to NDJSON and write to the original file path.
        const ndjsonContent = oldLogs.map(log => JSON.stringify(log)).join('\n') + (oldLogs.length > 0 ? '\n' : '');
        await fs.writeFile(logPath, ndjsonContent, 'utf8');

        console.log(`Successfully migrated ${oldLogs.length} records for ${path.basename(logPath)}.`);
    } catch (err) {
        console.error(`Failed to migrate log file. Original file moved to ${corruptPath}`, err);
        // If migration fails, move the bad backup file to a .corrupt file to prevent retrying on a bad file.
        try {
            await fs.rename(backupPath, corruptPath);
        } catch (renameErr) {
            console.error(`Could not move backup to corrupt path:`, renameErr);
        }
    }
}


function getProjectId(folderPath) {
    return crypto.createHash('sha256').update(folderPath).digest('hex');
}

function getProjectDataPath(projectPath) {
    const projectId = getProjectId(projectPath);
    return path.join(app.getPath('userData'), 'projects', projectId);
}

function getSnapshotsPath(projectPath) {
    return path.join(getProjectDataPath(projectPath), SNAPSHOTS_DIR_NAME);
}

function getSnapshotFilePath(projectPath, snapshotId) {
    return path.join(getSnapshotsPath(projectPath), `${snapshotId}.txt`);
}

async function ensureProjectDirsExist(projectPath) {
    const snapshotsPath = getSnapshotsPath(projectPath);
    try {
        await fs.mkdir(snapshotsPath, { recursive: true });
    } catch (error) {
        console.error("Could not create project directories:", error);
    }
}

function getLogPath(projectPath) {
    return path.join(getProjectDataPath(projectPath), LOG_FILE_NAME);
}

async function getFileContent(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes('\u0000')) {
            return '[Binary file content not shown]';
        }
        return content;
    } catch (e) {
        return null;
    }
}

async function buildTree(dirPath, name) {
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            return { name: name || path.basename(dirPath), type: 'file', path: dirPath };
        }
        let children = [];
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const childPath = path.join(dirPath, file);
            children.push(await buildTree(childPath, file));
        }
        return {
            name: name || path.basename(dirPath),
            type: 'folder',
            path: dirPath,
            children: children.sort((a, b) => a.name.localeCompare(b.name)),
        };
    } catch (err) {
        console.error(`Could not read or stat path: ${dirPath}`, err);
        // Return a file node as a fallback if stat fails, e.g. due to permissions
        return { name: name || path.basename(dirPath), type: 'file', path: dirPath };
    }
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build/icon.ico');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false, 
    titleBarStyle: 'hidden',
    // FEAT: Explicitly set the window icon for consistency across dev and prod.
    icon: fsSync.existsSync(iconPath) ? iconPath : undefined,
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // If launched with '--hidden', start minimized.
  if (process.argv.includes('--hidden')) {
    mainWindow.minimize();
  }

  mainWindow.on('closed', () => {
    if (logFileWatcher) {
      logFileWatcher.close();
      logFileWatcher = null;
    }
    mainWindow = null;
  });
}

// === Service Management using a detached child_process ===

// A helper function to stop the service using its stored PID.
const stopServiceLogic = async () => {
    try {
        if (fsSync.existsSync(pidFilePath)) {
            const pid = parseInt(await fs.readFile(pidFilePath, 'utf8'));
            if (pid) {
                // process.kill will throw an error if the process doesn't exist.
                process.kill(pid); 
                console.log(`Sent kill signal to service with PID: ${pid}`);
            }
        }
    } catch (e) {
        console.log("Could not kill service process (may have already been stopped):", e.message);
    } finally {
        // Clean up the PID file regardless of success.
        try {
            if (fsSync.existsSync(pidFilePath)) {
                await fs.unlink(pidFilePath);
            }
        } catch (e) {
            console.error("Could not remove pidfile:", e.message);
        }
    }
    if (watcherService) {
        watcherService.kill();
        watcherService = null;
    }
    return { success: true };
};

const startOrRestartService = async () => {
    await stopServiceLogic();

    const watchedProjects = store.get('watchedProjects', []);
    if (watchedProjects.length === 0) {
        console.log('No projects to watch. Service will not be started.');
        return { success: true, message: "No projects to watch." };
    }

    const serviceScriptName = 'dist-service/background.js';
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', serviceScriptName)
      : path.join(__dirname, serviceScriptName);

    // FIX: Add a critical check to ensure the service script exists before trying to fork it.
    // This prevents silent failures if the packaging process fails.
    if (!fsSync.existsSync(scriptPath)) {
        const errorMsg = `The background monitoring service script could not be found. Please try reinstalling the application.\n\nExpected path: ${scriptPath}`;
        console.error(errorMsg);
        dialog.showErrorBox('Service Error', errorMsg);
        return { success: false, message: 'Service script not found.' };
    }

    const userDataPath = app.getPath('userData');

    console.log(`Attempting to start service from: ${scriptPath}`);
    // Fork the service as a detached process so it can outlive the parent.
    watcherService = fork(scriptPath, [], {
        env: {
            ...process.env,
            WATCHED_PROJECTS: JSON.stringify(watchedProjects),
            USER_DATA_PATH: userDataPath
        },
        detached: true,
        // FIX: Use 'ignore' for stdio pipes but keep 'ipc' for log messages.
        // This is a robust way to communicate that prevents the service from
        // crashing with an EPIPE error when the parent application exits.
        stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });

    // FIX: Added comprehensive error and exit listeners for robust diagnostics.
    watcherService.on('error', (err) => {
        console.error('Failed to start watcher service process:', err);
    });

    watcherService.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
            console.error(`Watcher service exited unexpectedly with code: ${code}`);
        } else if (signal) {
            console.log(`Watcher service exited with signal: ${signal}`);
        } else {
            console.log(`Watcher service exited cleanly with code: ${code}`);
        }
    });

    // FIX: Listen for log messages over the resilient IPC channel instead of stdout/stderr.
    watcherService.on('message', (message) => {
        if (message.type === 'log' && message.payload) {
            addLog('Service', message.payload.type, message.payload.message);
        }
    });
    
    // Store the PID to manage the process later.
    await fs.writeFile(pidFilePath, watcherService.pid.toString());
    console.log(`Service started with PID: ${watcherService.pid} and detached.`);

    // Unreference the child process, allowing the parent to exit independently.
    watcherService.unref();

    return { success: true };
};

// === IPC Handlers ===
ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.on('close-window', () => mainWindow.close());
ipcMain.handle('get-current-user', () => os.userInfo().username);

// This handler sets up a watcher on the active project's log file for real-time updates.
ipcMain.on('set-active-project', (event, projectPath) => {
    if (logFileWatcher) {
        logFileWatcher.close();
        logFileWatcher = null;
    }

    if (!projectPath || !mainWindow) {
        return;
    }
    
    const logPath = getLogPath(projectPath);
    console.log(`Main process is now watching log file for real-time updates: ${logPath}`);

    // FIX: Use polling to ensure file changes are detected reliably, especially
    // for files within the AppData directory where native events can be flaky.
    logFileWatcher = chokidar.watch(logPath, { 
        persistent: true, 
        ignoreInitial: true,
        disableGlobbing: true,
        usePolling: true,
        interval: 1000,
    });

    // An 'add' event fires when the file is first created.
    // A 'change' event fires on subsequent writes.
    logFileWatcher.on('all', (event, path) => {
        console.log(`Log file event '${event}' detected for ${projectPath}. Notifying UI.`);
        if (mainWindow) {
            mainWindow.webContents.send('file-change-event', { projectPath });
        }
    });

    logFileWatcher.on('error', error => console.error(`Log Watcher error: ${error}`));
});

ipcMain.handle('get-initial-data', async () => {
    const watchedProjects = store.get('watchedProjects', []);
    const initialData = {
        projects: [],
    };

    for (const project of watchedProjects) {
        if (fsSync.existsSync(project.path)) {
            await ensureProjectDirsExist(project.path);
            const rootNode = await buildTree(project.path, project.name);
            initialData.projects.push({ ...project, rootNode });
        }
    }
    return initialData;
});

ipcMain.handle('add-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) return null;
    
    const folderPath = filePaths[0];
    const watchedProjects = store.get('watchedProjects', []);

    if (watchedProjects.some(p => p.path === folderPath)) {
        return { isExisting: true, path: folderPath };
    }
    
    await ensureProjectDirsExist(folderPath);
    const projectName = path.basename(folderPath);
    const newProject = { path: folderPath, name: projectName };

    watchedProjects.push(newProject);
    store.set('watchedProjects', watchedProjects);

    const rootNode = await buildTree(folderPath, projectName);
    
    await startOrRestartService();

    return {
        project: { ...newProject, rootNode },
    };
});

ipcMain.handle('remove-folder', async (event, folderPath) => {
    const watchedProjects = store.get('watchedProjects', []);
    const updatedProjects = watchedProjects.filter(p => p.path !== folderPath);
    store.set('watchedProjects', updatedProjects);
    
    await startOrRestartService();
});

ipcMain.handle('get-filtered-logs', async (ipcEvent, { projectPath, startDate, endDate, searchTerm, focusedPath, page, pageSize }) => {
    const logPath = getLogPath(projectPath);
    await migrateLogFileIfNeeded(logPath);

    try {
        await fs.access(logPath);
    } catch (e) {
        // File doesn't exist, return empty results.
        return { logs: [], totalCount: 0, summary: { CREATED: 0, MODIFIED: 0, DELETED: 0 }, userSummary: {} };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const term = searchTerm.toLowerCase();

    const pathPrefix = (focusedPath && focusedPath !== projectPath && focusedPath.startsWith(projectPath))
      ? path.relative(projectPath, focusedPath)
      : null;

    const filteredLogs = [];
    const summary = { CREATED: 0, MODIFIED: 0, DELETED: 0 };
    const userSummary = {};
    
    const rl = createInterface({
        input: createReadStream(logPath),
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim() === '') continue;

        try {
            const change = JSON.parse(line);
            const changeDate = new Date(change.timestamp);

            // Apply filters
            if (changeDate < start || changeDate > end) continue;

            if (pathPrefix && !change.path.startsWith(pathPrefix)) continue;
            
            if (term) {
                const isPathMatch = change.path.toLowerCase().includes(term);
                const isUserMatch = change.user.toLowerCase().includes(term);
                if (!isPathMatch && !isUserMatch) continue;
            }

            // If it passes all filters, process it
            filteredLogs.push(change);
            summary[change.type] = (summary[change.type] || 0) + 1;
            userSummary[change.user] = (userSummary[change.user] || 0) + 1;

        } catch (e) {
            console.error('Failed to parse log line:', line, e);
        }
    }

    // Sort newest-first, as the file is oldest-first (append-only).
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalCount = filteredLogs.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);
    
    return { logs: paginatedLogs, totalCount, summary, userSummary };
});

ipcMain.handle('get-change-details', async (ipcEvent, { eventId, projectPath }) => {
    const logPath = getLogPath(projectPath);
    await migrateLogFileIfNeeded(logPath);
    let event = null;

    try {
        const rl = createInterface({
            input: createReadStream(logPath),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (line.includes(eventId)) {
                const parsedLine = JSON.parse(line);
                if (parsedLine.id === eventId) {
                    event = parsedLine;
                    rl.close(); // Stop reading once found
                    break;
                }
            }
        }
    } catch (e) {
        if (e.code !== 'ENOENT') console.error('Error reading log for details:', e);
        return null;
    }

    if (!event) return null;

    let contentAfter = null;
    let contentBefore = null;

    if (event.snapshotId) {
        contentAfter = await getFileContent(getSnapshotFilePath(projectPath, event.snapshotId));
    }
    if (event.previousSnapshotId) {
        contentBefore = await getFileContent(getSnapshotFilePath(projectPath, event.previousSnapshotId));
    }
    
    const result = { type: event.type, content: contentAfter || contentBefore || '' };
    
    if (event.type === 'MODIFIED' && contentBefore !== null && contentAfter !== null) {
        result.patch = diff.structuredPatch(event.path, event.path, contentBefore, contentAfter, '', '', { context: 3 });
    }
    
    return result;
});

function logsToCsv(logs) {
    if (logs.length === 0) return '';
    const headers = ['id', 'type', 'path', 'timestamp', 'user', 'projectPath'];
    const csvRows = [headers.join(',')];
    for (const log of logs) {
        const values = headers.map(header => {
            const escaped = ('' + log[header]).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

ipcMain.handle('export-filtered-logs', async (ipcEvent, { projectPath, startDate, endDate, searchTerm, focusedPath }) => {
    const logPath = getLogPath(projectPath);
    await migrateLogFileIfNeeded(logPath);

    try {
        await fs.access(logPath);
    } catch (e) {
        return { success: false, error: 'No log file found.' };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const term = searchTerm.toLowerCase();

    const pathPrefix = (focusedPath && focusedPath !== projectPath && focusedPath.startsWith(projectPath))
      ? path.relative(projectPath, focusedPath)
      : null;

    const filteredLogs = [];
    
    const rl = createInterface({
        input: createReadStream(logPath),
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim() === '') continue;
        try {
            const change = JSON.parse(line);
            const changeDate = new Date(change.timestamp);
            if (changeDate < start || changeDate > end) continue;
            if (pathPrefix && !change.path.startsWith(pathPrefix)) continue;
            if (term) {
                const isPathMatch = change.path.toLowerCase().includes(term);
                const isUserMatch = change.user.toLowerCase().includes(term);
                if (!isPathMatch && !isUserMatch) continue;
            }
            filteredLogs.push(change);
        } catch (e) {
            console.error('Failed to parse log line during export:', line, e);
        }
    }
    
    filteredLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const csvContent = logsToCsv(filteredLogs);
    
    const defaultFileName = `FileAuditReport_${new Date().toISOString().split('T')[0]}.csv`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Report to CSV',
        defaultPath: defaultFileName,
        filters: [
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: true, path: null };
    }

    try {
        await fs.writeFile(filePath, csvContent, 'utf8');
        return { success: true, path: filePath };
    } catch (error) {
        console.error('Failed to save CSV file:', error);
        return { success: false, error: error.message };
    }
});

// === Service Management IPC Handlers ===
ipcMain.handle('start-service', async () => {
    return await startOrRestartService();
});

ipcMain.handle('stop-service', () => stopServiceLogic());

ipcMain.handle('get-service-status', async () => {
    try {
        if (fsSync.existsSync(pidFilePath)) {
            const pid = parseInt(await fs.readFile(pidFilePath, 'utf8'));
            // process.kill with signal 0 is a cross-platform way to check if a process exists.
            // It doesn't kill the process, but throws an error if it's not found.
            process.kill(pid, 0); 
            return { status: 'running' };
        }
    } catch (e) {
        // If the process doesn't exist, the PID file is stale. Clean it up.
        console.log("Service not running, cleaning up stale PID file.");
        try {
            if (fsSync.existsSync(pidFilePath)) {
                await fs.unlink(pidFilePath);
            }
        } catch (unlinkErr) {
            console.error("Could not remove stale pidfile:", unlinkErr.message);
        }
    }
    return { status: 'stopped' };
});

// === Auto-Start Settings IPC Handlers ===
ipcMain.handle('get-auto-start-settings', () => {
    return { isEnabled: store.get(STORE_KEY_AUTO_START, false) };
});

ipcMain.handle('set-auto-start-settings', (event, isEnabled) => {
    store.set(STORE_KEY_AUTO_START, isEnabled);
    app.setLoginItemSettings({
        openAtLogin: isEnabled,
        // Pass '--hidden' to start minimized if enabled. This is crucial.
        args: isEnabled ? ['--hidden'] : []
    });
});

// === Logging IPC Handlers ===
ipcMain.handle('get-log-history', () => logHistory);
ipcMain.handle('clear-log-history', () => {
    logHistory = [];
});

// === App Lifecycle ===
app.whenReady().then(() => {
  // Apply auto-start setting on launch, before creating the window
  const isAutoStartEnabled = store.get(STORE_KEY_AUTO_START, false);
  app.setLoginItemSettings({
      openAtLogin: isAutoStartEnabled,
      args: isAutoStartEnabled ? ['--hidden'] : []
  });

  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// The 'before-quit' handler is no longer needed to kill the service,
// as it's now a detached process managed by the user via the UI.
// app.on('before-quit', () => { ... });