export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
  header: string;
}

export interface StructuredPatch {
  oldFileName: string;
  newFileName: string;
  oldHeader: string;
  newHeader: string;
  hunks: Hunk[];
}

export interface ChangeDetails {
  type: ChangeType;
  content: string;
  patch?: StructuredPatch;
}

export interface Project {
  path: string;
  name: string;
  rootNode: FileSystemNode;
}

export type ServiceStatus = 'running' | 'stopped' | 'error' | 'checking';

export interface GetFilteredLogsParams {
  projectPath: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
  focusedPath: string | null;
  page: number;
  pageSize: number;
}

export interface ReportSummary {
  [ChangeType.CREATED]: number;
  [ChangeType.MODIFIED]: number;
  [ChangeType.DELETED]: number;
}

export interface UserSummary {
  [key: string]: number;
}

export interface GetFilteredLogsResponse {
  logs: FileChangeEvent[];
  totalCount: number;
  summary: ReportSummary;
  userSummary: UserSummary;
}

export interface LogMessage {
  timestamp: string;
  source: 'Main' | 'Service';
  type: 'log' | 'error';
  message: string;
}


export interface IElectronAPI {
  getCurrentUser: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  getInitialData: () => Promise<{ projects: Project[] }>;
  addFolder: () => Promise<{ project: Project } | { isExisting: boolean, path: string } | null>;
  removeFolder: (folderPath: string) => Promise<void>;
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void;
  getFilteredLogs: (params: GetFilteredLogsParams) => Promise<GetFilteredLogsResponse>;
  getChangeDetails: (eventId: string, projectPath: string) => Promise<ChangeDetails | null>;
  // FIX: Add `setActiveProject` to the interface to match the implementation in `preload.js` and fix the compile error in `App.tsx`.
  setActiveProject: (projectPath: string | null) => void;
  getServiceStatus: () => Promise<{ status: ServiceStatus }>;
  startService: () => Promise<{ success: boolean }>;
  stopService: () => Promise<{ success: boolean }>;
  exportFilteredLogs: (params: Omit<GetFilteredLogsParams, 'page' | 'pageSize'>) => Promise<{ success: boolean; path?: string; error?: string }>;
  
  // New logging APIs
  getLogHistory: () => Promise<LogMessage[]>;
  clearLogHistory: () => Promise<void>;
  onLogMessage: (callback: (message: LogMessage) => void) => () => void;

  // New settings APIs
  getAutoStartSettings: () => Promise<{ isEnabled: boolean }>;
  setAutoStartSettings: (isEnabled: boolean) => Promise<void>;

  // New AI Feature
  analyzeChange: (diff: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
export interface FileSystemNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: FileSystemNode[];
}

export enum ChangeType {
  CREATED = 'CREATED',
  MODIFIED = 'MODIFIED',
  DELETED = 'DELETED',
}

export interface FileChangeEvent {
  id: string;
  type: ChangeType;
  path: string;
  timestamp: Date | string; // Allow string for IPC transfer
  user: string;
  projectPath: string;
  snapshotId?: string;
  previousSnapshotId?: string;
}