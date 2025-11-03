// Headless Node.js service for file watching
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const chokidar =require('chokidar');
const crypto = require('crypto');
const { spawn } = require('child_process');

// This service is now completely decoupled from Electron and electron-store.
// It receives all necessary configuration via environment variables.

const LOG_FILE_NAME = 'change_log.json';
const SNAPSHOTS_DIR_NAME = 'snapshots';

let inMemoryLogs = new Map(); // Map<projectPath, event[]>

// This will be populated from the USER_DATA_PATH environment variable on startup.
let USER_DATA_PATH;
const defaultUser = os.userInfo().username;
let psProcess = null;
let commandQueue = [];

/**
 * Spawns a single, persistent PowerShell process to efficiently query file owners.
 * This avoids the massive overhead of starting a new process for every file change.
 */
function startOwnerProcess() {
    // This script reads file paths from stdin, one per line,
    // and writes the owner to stdout, one per line.
    const psScript = `
        $OutputEncoding = [System.Text.Encoding]::UTF8
        while ($line = [Console]::In.ReadLine()) {
            try {
                if ([System.IO.File]::Exists($line) -or [System.IO.Directory]::Exists($line)) {
                    $owner = (Get-Acl -Path $line -ErrorAction Stop).Owner
                    [Console]::Out.WriteLine($owner)
                } else {
                    [Console]::Out.WriteLine("ENOENT") # File not found
                }
            } catch {
                [Console]::Out.WriteLine("ERROR") # Indicate an error occurred
            }
        }
    `;

    psProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript]);

    psProcess.stdout.on('data', (data) => {
        const lines = data.toString().trim().split(/\r?\n/);
        for (const line of lines) {
            const request = commandQueue.shift();
            if (request) {
                if (line === 'ERROR' || line === 'ENOENT') {
                    request.resolve(defaultUser);
                } else {
                    const user = line.split('\\').pop();
                    request.resolve(user || defaultUser);
                }
            }
        }
    });

    psProcess.stderr.on('data', (data) => {
        console.error(`PowerShell stderr: ${data}`);
        while (commandQueue.length > 0) {
            commandQueue.shift().resolve(defaultUser);
        }
    });

    psProcess.on('close', (code) => {
        console.log(`PowerShell process exited with code ${code}. Restarting...`);
        while (commandQueue.length > 0) {
            commandQueue.shift().resolve(defaultUser);
        }
        setTimeout(startOwnerProcess, 1000);
    });
}


/**
 * Gets the owner of a file by sending a request to the persistent PowerShell process.
 * @param {string} filePath The absolute path to the file.
 * @returns {Promise<string>} The username of the file's owner.
 */
function getFileOwner(filePath) {
    return new Promise((resolve) => {
        commandQueue.push({ path: filePath, resolve });
        psProcess.stdin.write(filePath + '\n');
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
        console.error(`Could not create project directories for ${projectPath}:`, error);
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
        if (error.code === 'ENOENT') return [];
        console.error(`Error reading log file for ${projectPath}:`, error);
        return [];
    }
}

async function appendLog(projectPath, event) {
    const projectLogs = inMemoryLogs.get(projectPath) || [];
    projectLogs.unshift(event);
    inMemoryLogs.set(projectPath, projectLogs);
    await fs.writeFile(getLogPath(projectPath), JSON.stringify(projectLogs, null, 2));
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
    console.log(`Starting to watch project: ${projectPath}`);
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
        console.log(`[${eventType}] detected for: ${filePath}`);
        const relativePath = path.relative(projectPath, filePath);
        const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const projectLogs = inMemoryLogs.get(projectPath) || [];
        const beforeEvent = projectLogs.find(log => log.path === relativePath);

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

        await appendLog(projectPath, event);

        if (process.send) {
            process.send(event);
        }

        console.log(`Logged event ${eventId} for ${relativePath} by ${author}`);
    };
    
    watcher
        .on('add', (path) => logChange('CREATED', path))
        .on('change', (path) => logChange('MODIFIED', path))
        .on('unlink', (path) => logChange('DELETED', path))
        .on('error', (error) => console.error(`Watcher error in ${projectPath}: ${error}`));
}

async function main() {
    console.log("File Audit Master Service Started");

    if (process.platform === 'win32') {
        startOwnerProcess();
    }

    const userDataPath = process.env.USER_DATA_PATH;
    const watchedProjectsRaw = process.env.WATCHED_PROJECTS;

    if (!userDataPath || !watchedProjectsRaw) {
        console.error("Missing critical environment variables (USER_DATA_PATH or WATCHED_PROJECTS). Service cannot start.");
        process.exit(1);
    }

    USER_DATA_PATH = userDataPath;
    console.log(`Service using user data path: ${USER_DATA_PATH}`);

    let watchedProjects;
    try {
        watchedProjects = JSON.parse(watchedProjectsRaw);
    } catch (e) {
        console.error("Could not parse WATCHED_PROJECTS environment variable.", e);
        process.exit(1);
    }

    if (watchedProjects.length === 0) {
        console.log("No projects configured to watch. Service will now exit.");
        return;
    }

    console.log(`Found ${watchedProjects.length} projects to monitor.`);

    for (const project of watchedProjects) {
        await ensureProjectDirsExist(project.path);
        const logs = await readLogs(project.path);
        inMemoryLogs.set(project.path, logs);
        startWatchingProject(project);
    }
}

main().catch(err => {
    console.error("A critical error occurred in the background service:", err);
    process.exit(1);
});