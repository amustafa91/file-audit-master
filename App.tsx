import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '/components/Sidebar.tsx';
import Header from '/components/Header.tsx';
import ChangeLog from '/components/ChangeLog.tsx';
import ReportView from '/components/ReportView.tsx';
import Icon from '/components/Icon.tsx';
import TitleBar from '/components/TitleBar.tsx';
import ChangeDetailModal from '/components/ChangeDetailModal.tsx';
import { FileChangeEvent, Project, ReportSummary, UserSummary } from '/types.ts';
import Spinner from '/components/Spinner.tsx';
import LogViewerModal from '/components/LogViewerModal.tsx';
import SettingsModal from '/components/SettingsModal.tsx';

const getISODate = (date: Date) => date.toISOString().split('T')[0];
const PAGE_SIZE = 50;

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  
  const [displayedLogs, setDisplayedLogs] = useState<FileChangeEvent[]>([]);
  
  const [startDate, setStartDate] = useState(getISODate(new Date()));
  const [endDate, setEndDate] = useState(getISODate(new Date()));
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [systemUser, setSystemUser] = useState<string | null>(null);
  const [viewingChange, setViewingChange] = useState<FileChangeEvent | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [reportSummary, setReportSummary] = useState<ReportSummary>({ CREATED: 0, MODIFIED: 0, DELETED: 0 });
  const [userSummary, setUserSummary] = useState<UserSummary>({});

  const fetchLogs = useCallback(async () => {
    if (!activeProjectPath) {
      setDisplayedLogs([]);
      setTotalLogs(0);
      setReportSummary({ CREATED: 0, MODIFIED: 0, DELETED: 0 });
      setUserSummary({});
      return;
    }
    setIsLoadingLogs(true);
    try {
      const { logs, totalCount, summary, userSummary } = await window.electronAPI.getFilteredLogs({
        projectPath: activeProjectPath,
        startDate,
        endDate,
        searchTerm,
        focusedPath,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      const parsedLogs = logs.map(log => ({ ...log, timestamp: new Date(log.timestamp) }));
      setDisplayedLogs(parsedLogs);
      setTotalLogs(totalCount);
      setReportSummary(summary);
      setUserSummary(userSummary);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setDisplayedLogs([]);
      setTotalLogs(0);
      setReportSummary({ CREATED: 0, MODIFIED: 0, DELETED: 0 });
      setUserSummary({});
    } finally {
      setIsLoadingLogs(false);
    }
  }, [activeProjectPath, startDate, endDate, searchTerm, focusedPath, currentPage]);
  
  // FIX: Use a ref to hold the latest `fetchLogs` function. This prevents race conditions
  // where the file change listener fires with a stale closure over an old `fetchLogs` function
  // that contains outdated filter state, causing new logs to appear and then disappear.
  const fetchLogsRef = useRef(fetchLogs);
  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
  });

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const loadInitialData = async () => {
      const user = await window.electronAPI.getCurrentUser();
      setSystemUser(user);

      const { projects: initialProjects } = await window.electronAPI.getInitialData();
      
      setProjects(initialProjects);
      
      if (initialProjects.length > 0) {
        const lastActive = sessionStorage.getItem('lastActiveProject');
        const newActivePath = lastActive && initialProjects.some(p => p.path === lastActive) ? lastActive : initialProjects[0].path;
        setActiveProjectPath(newActivePath);
        setFocusedPath(newActivePath);
      }
      
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const removeListener = window.electronAPI.onFileChange((event) => {
        // The listener's closure might be stale, so we use a ref to always
        // call the *latest* version of the fetchLogs function.
        if (event.projectPath === activeProjectPath) {
            fetchLogsRef.current();
        }
    });

    return () => removeListener();
  }, [activeProjectPath]); // Re-subscribe only when the active project changes.

  useEffect(() => {
    if (activeProjectPath) {
        sessionStorage.setItem('lastActiveProject', activeProjectPath);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    // Notify the main process about the active project so it can
    // set up the correct real-time log watcher.
    window.electronAPI.setActiveProject(activeProjectPath);
  }, [activeProjectPath]);
  
  const createFilterChangeHandler = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleSetActiveProject = createFilterChangeHandler(setActiveProjectPath);
  const handleFocusNode = createFilterChangeHandler(setFocusedPath);
  const handleStartDateChange = createFilterChangeHandler(setStartDate);
  const handleEndDateChange = createFilterChangeHandler(setEndDate);
  const handleSearchTermChange = createFilterChangeHandler(setSearchTerm);


  const handleAddFolder = async () => {
    const result = await window.electronAPI.addFolder();
    if (result) {
        if ('isExisting' in result) {
            handleSetActiveProject(result.path);
            handleFocusNode(result.path);
        } else if ('project' in result) {
            setProjects(prev => [...prev, result.project]);
            handleSetActiveProject(result.project.path);
            handleFocusNode(result.project.path);
        }
    }
  };

  const handleRemoveProject = async (pathToRemove: string) => {
    await window.electronAPI.removeFolder(pathToRemove);
    
    setProjects(prev => prev.filter(p => p.path !== pathToRemove));

    if (activeProjectPath === pathToRemove) {
        setProjects(prevProjects => {
            const newActive = prevProjects.length > 0 ? prevProjects[0].path : null;
            if(newActive) {
              handleSetActiveProject(newActive);
              handleFocusNode(newActive);
            } else {
              setActiveProjectPath(null);
              setFocusedPath(null);
            }
            return prevProjects;
        });
    }
  };
  
  const handleExport = async () => {
    if (!activeProjectPath || isExporting) return;
    setIsExporting(true);
    try {
        const result = await window.electronAPI.exportFilteredLogs({
            projectPath: activeProjectPath,
            startDate,
            endDate,
            searchTerm,
            focusedPath,
        });
        if (result.error) {
            console.error('Export failed:', result.error);
        } else if (result.success && result.path) {
            console.log('Export successful:', result.path);
        } else {
            console.log('Export canceled by user.');
        }
    } catch (error) {
        console.error("Failed to export logs:", error);
    } finally {
        setIsExporting(false);
    }
  };

  const activeProject = projects.find(p => p.path === activeProjectPath);

  return (
    <>
      <div className="flex flex-col h-screen w-screen bg-secondary overflow-hidden border border-border rounded-lg shadow-2xl">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar 
            projects={projects}
            activeProjectPath={activeProjectPath}
            onSetActiveProject={handleSetActiveProject}
            onRemoveProject={handleRemoveProject}
            onAddProject={handleAddFolder}
            focusedPath={focusedPath} 
            onFocusNode={handleFocusNode}
            onViewLogs={() => setIsLogModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
          <main className="flex-1 flex flex-col overflow-hidden bg-base-100">
            <Header 
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              selectedFolder={activeProject?.path ?? null}
              systemUser={systemUser}
            />
            <div className="flex-1 flex flex-col p-4 gap-4 bg-secondary overflow-y-auto min-h-0">
              {projects.length > 0 && activeProject ? (
                <>
                  <ChangeLog 
                    changes={displayedLogs} 
                    onViewDetails={setViewingChange}
                    searchTerm={searchTerm}
                    onSearchTermChange={handleSearchTermChange}
                    isLoading={isLoadingLogs}
                    currentPage={currentPage}
                    totalLogs={totalLogs}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                  />
                  <ReportView 
                    totalChanges={totalLogs}
                    summary={reportSummary}
                    userSummary={userSummary}
                    className="flex-1 min-h-0"
                    isExporting={isExporting}
                    onExport={handleExport}
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-center text-text-secondary bg-base-100 rounded-lg border border-border">
                  {isLoading ? (
                      <Spinner size={12} text="Loading session..." />
                  ) : (
                    <div>
                      <Icon name="folder-open" className="w-16 h-16 mx-auto text-primary opacity-50 mb-4" />
                      <h2 className="text-xl font-semibold mb-2">Welcome to File Audit Master</h2>
                      <p className="mb-6">Add a project folder to begin monitoring for file changes.</p>
                      <button
                          onClick={handleAddFolder}
                          className="px-6 py-2 bg-primary text-white font-medium text-sm rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center justify-center mx-auto"
                      >
                        Add Project Folder
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      <ChangeDetailModal event={viewingChange} onClose={() => setViewingChange(null)} />
      <LogViewerModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </>
  );
}

export default App;