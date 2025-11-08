const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // New APIs for backend-driven file watching
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  addFolder: () => ipcRenderer.invoke('add-folder'),
  removeFolder: (folderPath) => ipcRenderer.invoke('remove-folder', folderPath),
  getFilteredLogs: (filters) => ipcRenderer.invoke('get-filtered-logs', filters),
  onFileChange: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('file-change-event', listener);

    // Return a cleanup function to be used in React's useEffect
    return () => ipcRenderer.removeListener('file-change-event', listener);
  },
  getChangeDetails: (eventId, projectPath) => ipcRenderer.invoke('get-change-details', { eventId, projectPath }),
  
  // Allows the UI to tell the main process which project's log file to watch.
  setActiveProject: (projectPath) => ipcRenderer.send('set-active-project', projectPath),

  // APIs for managing the background service
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  startService: () => ipcRenderer.invoke('start-service'),
  stopService: () => ipcRenderer.invoke('stop-service'),
  exportFilteredLogs: (filters) => ipcRenderer.invoke('export-filtered-logs', filters),
  
  // New logging APIs for diagnostics
  getLogHistory: () => ipcRenderer.invoke('get-log-history'),
  clearLogHistory: () => ipcRenderer.invoke('clear-log-history'),
  onLogMessage: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('on-log-message', listener);
    return () => ipcRenderer.removeListener('on-log-message', listener);
  },

  // New settings APIs
  getAutoStartSettings: () => ipcRenderer.invoke('get-auto-start-settings'),
  setAutoStartSettings: (isEnabled) => ipcRenderer.invoke('set-auto-start-settings', isEnabled),

  // New AI Feature
  analyzeChange: (diff) => ipcRenderer.invoke('analyze-change', diff),
});