const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const fsSync = require('fs');
const Store = require('electron-store');
const diff = require('diff');
const crypto = require('crypto');
const { fork } = require('child_process');

// By setting the app name explicitly, we ensure that app.getPath('userData')
// resolves to a predictable location (.../AppData/Roaming/file-audit-master).
// This is crucial for the background service to find the same config file.
app.setName('file-audit-master');

const store = new Store();
let mainWindow = null;
let watcherService = null; // Holds the child process instance for the current session

const LOG_FILE_NAME = 'change_log.json';
const SNAPSHOTS_DIR_NAME = 'snapshots';
const pidFilePath = path.join(app.getPath('userData'), 'service.pid');

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

async function readLogs(projectPath) {
    try {
        const logPath = getLogPath(projectPath);
        const data = await fs.readFile(logPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error(`Error reading log file for ${projectPath}:`, error);
        return [];
    }
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
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
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
        stdio: 'ignore' // Detach stdio to allow parent to exit cleanly
    });

    // Store the PID to manage the process later.
    await fs.writeFile(pidFilePath, watcherService.pid.toString());
    console.log(`Service started with PID: ${watcherService.pid} and detached.`);

    // Unreference the child process, allowing the parent to exit independently.
    watcherService.unref();
    
    // The handle to the child process (`watcherService`) is only for the current app session.
    // If the app is closed and reopened, this handle will be lost, but the process
    // will continue running. It can be stopped using the stored PID.
    // Live updates to the UI will work for the current session.
    watcherService.on('message', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('file-change-event', event);
        }
    });

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
    
    startOrRestartService();

    return {
        project: { ...newProject, rootNode },
    };
});

ipcMain.handle('remove-folder', async (event, folderPath) => {
    const watchedProjects = store.get('watchedProjects', []);
    const updatedProjects = watchedProjects.filter(p => p.path !== folderPath);
    store.set('watchedProjects', updatedProjects);
    
    startOrRestartService();
});

ipcMain.handle('get-filtered-logs', async (ipcEvent, { projectPath, startDate, endDate, searchTerm, focusedPath }) => {
    const allLogs = await readLogs(projectPath);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const term = searchTerm.toLowerCase();

    const pathPrefix = (focusedPath && focusedPath !== projectPath && focusedPath.startsWith(projectPath))
      ? focusedPath.substring(projectPath.length).replace(/^\\|^\//, '')
      : null;

    return allLogs.filter(change => {
      const changeDate = new Date(change.timestamp);
      const isDateMatch = changeDate >= start && changeDate <= end;
      if (!isDateMatch) return false;

      if (pathPrefix && !change.path.startsWith(pathPrefix)) {
        return false;
      }

      if (term) {
        const isPathMatch = change.path.toLowerCase().includes(term);
        const isUserMatch = change.user.toLowerCase().includes(term);
        return isPathMatch || isUserMatch;
      }
      
      return true;
    });
});

ipcMain.handle('get-change-details', async (ipcEvent, { eventId, projectPath }) => {
    // FIX: Read logs from disk instead of relying on an in-memory cache to reduce memory usage.
    const projectLogs = await readLogs(projectPath);
    if (!projectLogs) return null;
    
    const event = projectLogs.find(log => log.id === eventId);
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

// === Service Management IPC Handlers ===
ipcMain.handle('start-service', () => startOrRestartService());

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


// === App Lifecycle ===
app.whenReady().then(() => {
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