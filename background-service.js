// Headless Node.js service for file watching
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar =require('chokidar');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { createInterface } = require('readline');
const { createReadStream } = require('fs');

// This service is now completely decoupled from Electron and electron-store.
// It receives all necessary configuration via environment variables.

const LOG_FILE_NAME = 'change_log.json';
const SNAPSHOTS_DIR_NAME = 'snapshots';

/**
 * Sends a log message to the parent process via the IPC channel if it's connected.
 * This prevents the service from crashing due to a broken pipe when the parent exits.
 * @param {'log' | 'error'} type The type of log.
 * @param {string} message The log message.
 */
const serviceLog = (type, message) => {
  // Only try to send a message if the IPC channel is still connected.
  // This prevents the service from crashing with an EPIPE error when the
  // main application closes.
  if (process.connected) {
    process.send({
      type: 'log',
      payload: { type, message }
    });
  }
};


// FIX: Replaced the memory-intensive `inMemoryLogs` map with a lightweight cache.
// This cache only stores the *most recent* event for each unique file path,
// dramatically reducing memory usage from being proportional to the total number of log entries
// to being proportional to the number of unique file paths.
let lastKnownStateCache = new Map(); // Map<projectPath, Map<relativePath, latestEvent>>

// This will be populated from the USER_DATA_PATH environment variable on startup.
let USER_DATA_PATH;

const defaultUser = os.userInfo().username;

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
        serviceLog('error', `Error checking log format for ${logPath}: ${e}`);
        return; // Can't read the file, so we can't migrate it.
    } finally {
        if (fileHandle) await fileHandle.close();
    }

    serviceLog('log', `Legacy log format detected at ${logPath}. Migrating to NDJSON...`);
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

        serviceLog('log', `Successfully migrated ${oldLogs.length} records for ${path.basename(logPath)}.`);
    } catch (err) {
        serviceLog('error', `Failed to migrate log file. Original file moved to ${corruptPath}. Error: ${err}`);
        // If migration fails, move the bad backup file to a .corrupt file to prevent retrying on a bad file.
        try {
            await fs.rename(backupPath, corruptPath);
        } catch (renameErr) {
            serviceLog('error', `Could not move backup to corrupt path: ${renameErr}`);
        }
    }
}


/**
 * Gets the owner of a file using a reliable, one-shot PowerShell command.
 * @param {string} filePath The absolute path to the file.
 * @returns {Promise<string>} The username of the file's owner.
 */
function getFileOwner(filePath) {
    return new Promise((resolve) => {
        // This stateless, one-shot command is more robust than a persistent process.
        // It avoids the stdin/stdout pipe fragility that caused the restart loop.
        execFile('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            // Escape single quotes in the path for PowerShell.
            '-Command', `(Get-Acl -Path '${filePath.replace(/'/g, "''")}' -ErrorAction SilentlyContinue).Owner`
        ], 
        { detached: true }, // Launch in a new process group to survive parent exit.
        (error, stdout, stderr) => {
            if (error) {
                // Errors are expected if a file is deleted before the check runs. Fall back gracefully.
                resolve(defaultUser);
                return;
            }
            if (stderr) {
                // Log stderr for debugging but don't treat it as a fatal error.
                serviceLog('log', `PowerShell stderr for ${filePath}: ${stderr.trim()}`);
            }

            // The output is typically 'DOMAIN\Username'. We want just 'Username'.
            const user = stdout.trim().split('\\').pop();
            resolve(user || defaultUser);
        });
    });
}


function getProjectId(folderPath) {
    return crypto.createHash('sha256').update(folderPath).digest('hex');
}

function getProjectDataPath(projectPath) {
    if (!USER_DATA_PATH) {
        throw new Error("USER_DATA_PATH is not initialized.");
    }
    const projectId = getProjectId(projectPath);
    return path.join(USER_DATA_PATH, 'projects', projectId);
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
        serviceLog('error', `Could not create project directories for ${projectPath}: ${error}`);
    }
}

function getLogPath(projectPath) {
    return path.join(getProjectDataPath(projectPath), LOG_FILE_NAME);
}

/**
 * Appends a log entry to the project's log file in NDJSON format.
 * This is highly efficient as it doesn't require reading the existing file.
 * @param {string} projectPath The path of the project.
 * @param {object} event The event object to log.
 */
async function appendLogEntry(projectPath, event) {
    const logPath = getLogPath(projectPath);
    const logLine = JSON.stringify(event) + '\n';
    await fs.appendFile(logPath, logLine);
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

function startWatchingProject(project) {
    const projectPath = project.path;
    serviceLog('log', `Starting to watch project: ${projectPath}`);
    const watcher = chokidar.watch(projectPath, {
        ignored: /(^|[\/\\])\..*|node_modules|dist|build/,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        },
        // By removing usePolling, chokidar will use native fs.watch events,
        // which is vastly more efficient and should resolve high CPU usage.
        // This relies on the service having permissions to receive FS events for the watched paths.
    });

    const logChange = async (eventType, filePath) => {
        serviceLog('log', `[${eventType}] detected for: ${filePath}`);
        const relativePath = path.relative(projectPath, filePath);
        const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        // FIX: Retrieve the before event from the lightweight cache (fast Map.get)
        // instead of doing an expensive Array.find on the entire log history.
        const projectCache = lastKnownStateCache.get(projectPath);
        const beforeEvent = projectCache ? projectCache.get(relativePath) : undefined;
        
        let author = defaultUser;

        if (process.platform === 'win32') {
             if (eventType === 'CREATED' || eventType === 'MODIFIED') {
                author = await getFileOwner(filePath);
            } else if (eventType === 'DELETED' && beforeEvent) {
                author = beforeEvent.user;
            }
        }

        const event = {
            id: eventId,
            type: eventType,
            path: relativePath,
            timestamp: new Date(),
            user: author,
            projectPath: projectPath,
        };

        if (eventType === 'CREATED' || eventType === 'MODIFIED') {
            const content = await getFileContent(filePath);
            if (content !== null) {
              await fs.writeFile(getSnapshotFilePath(projectPath, eventId), content);
              event.snapshotId = eventId;
            }
            if (eventType === 'MODIFIED' && beforeEvent) {
                event.previousSnapshotId = beforeEvent.snapshotId;
            }
        } else if (eventType === 'DELETED' && beforeEvent) {
            event.previousSnapshotId = beforeEvent.snapshotId;
        }

        // 1. Efficiently append the new log entry to the file on disk for persistence.
        await appendLogEntry(projectPath, event);

        // 2. Update the lightweight in-memory cache with the new event.
        if (projectCache) {
             if (eventType === 'DELETED') {
                projectCache.delete(relativePath);
            } else {
                projectCache.set(relativePath, event);
            }
        }
        
        serviceLog('log', `Logged event ${eventId} for ${relativePath} by ${author}`);
    };
    
    watcher
        .on('add', (path) => logChange('CREATED', path))
        .on('change', (path) => logChange('MODIFIED', path))
        .on('unlink', (path) => logChange('DELETED', path))
        .on('error', (error) => serviceLog('error', `Watcher error in ${projectPath}: ${error}`));
}

async function main() {
    serviceLog('log', "File Audit Master Service Started");

    const userDataPath = process.env.USER_DATA_PATH;
    const watchedProjectsRaw = process.env.WATCHED_PROJECTS;

    if (!userDataPath || !watchedProjectsRaw) {
        serviceLog('error', "Missing critical environment variables (USER_DATA_PATH or WATCHED_PROJECTS). Service cannot start.");
        process.exit(1);
    }

    USER_DATA_PATH = userDataPath;
    serviceLog('log', `Service using user data path: ${USER_DATA_PATH}`);

    let watchedProjects;
    try {
        watchedProjects = JSON.parse(watchedProjectsRaw);
    } catch (e) {
        serviceLog('error', `Could not parse WATCHED_PROJECTS environment variable. ${e}`);
        process.exit(1);
    }

    if (watchedProjects.length === 0) {
        serviceLog('log', "No projects configured to watch. Service will now exit.");
        return;
    }

    serviceLog('log', `Found ${watchedProjects.length} projects to monitor.`);

    for (const project of watchedProjects) {
        await ensureProjectDirsExist(project.path);
        
        const projectCache = new Map();
        const logPath = getLogPath(project.path);
        await migrateLogFileIfNeeded(logPath);

        try {
            // FIX: Build the cache by streaming the log file line-by-line instead of loading it all into memory.
            const rl = createInterface({
                input: createReadStream(logPath),
                crlfDelay: Infinity
            });
    
            for await (const line of rl) {
                if (line.trim() === '') continue;
                try {
                    const log = JSON.parse(line);
                    // Since we read from the start, later entries for the same path will correctly overwrite older ones.
                    if (log.type !== 'DELETED') {
                        projectCache.set(log.path, log);
                    } else {
                        projectCache.delete(log.path);
                    }
                } catch(e) {
                    serviceLog('error', `Could not parse log line: ${line}. Error: ${e}`);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                serviceLog('error', `Error building cache for ${project.path}: ${error}`);
            }
        }
        
        lastKnownStateCache.set(project.path, projectCache);
        
        startWatchingProject(project);
    }
}

main().catch(err => {
    serviceLog('error', `A critical error occurred in the background service: ${err}`);
    process.exit(1);
});
