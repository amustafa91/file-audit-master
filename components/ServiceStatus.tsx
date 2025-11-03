import React, { useState, useEffect, useCallback } from 'react';
import { ServiceStatus as ServiceStatusType } from '/types.ts';

const ServiceStatus = () => {
  const [status, setStatus] = useState<ServiceStatusType>('checking');
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const checkStatus = useCallback(async () => {
    if (isActionInProgress) return;
    try {
      const result = await window.electronAPI.getServiceStatus();
      setStatus(result.status);
    } catch (err) {
      console.error("Failed to get service status", err);
      setStatus('error');
    }
  }, [isActionInProgress]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleStart = async () => {
    setIsActionInProgress(true);
    setStatus('checking');
    try {
      await window.electronAPI.startService();
      setTimeout(checkStatus, 1500);
    } catch (err) {
      console.error("Failed to start service", err);
      setStatus('error');
    } finally {
      setIsActionInProgress(false);
    }
  };
  
  const handleStop = async () => {
    setIsActionInProgress(true);
    setStatus('checking');
    try {
      await window.electronAPI.stopService();
      setTimeout(checkStatus, 1500);
    } catch (err) {
      console.error("Failed to stop service", err);
      setStatus('error');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const statusConfig: { [key in ServiceStatusType]: { text: string; icon: React.ReactElement } } = {
    running: { text: 'Running', icon: <span className="w-2 h-2 rounded-full bg-green-500"></span> },
    stopped: { text: 'Stopped', icon: <span className="w-2 h-2 rounded-full bg-gray-400"></span> },
    error: { text: 'Error', icon: <span className="w-2 h-2 rounded-full bg-red-500"></span> },
    checking: { text: 'Checking...', icon: <div className="w-2 h-2 rounded-full bg-yellow-500 animate-spin"></div> },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="p-2 border-t border-border flex-shrink-0">
      <h3 className="text-xs font-semibold text-text-secondary px-2 mb-2">Monitoring Service</h3>
      <div className="bg-black/5 rounded-md p-3 text-sm">
        <div className="flex items-center justify-between mb-3">
            <span className="text-text-primary font-medium">Status</span>
            <div className="flex items-center gap-2">
                {currentStatus.icon}
                <span className="text-text-secondary">{currentStatus.text}</span>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={handleStart} 
                disabled={status === 'running' || isActionInProgress}
                className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-accent disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
                Start
            </button>
            <button 
                onClick={handleStop}
                disabled={status !== 'running' || isActionInProgress}
                className="px-3 py-1.5 bg-base-300 text-text-primary text-xs font-medium rounded-md hover:bg-border disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
                Stop
            </button>
        </div>
        <p className="text-xs text-text-secondary/80 mt-2 text-center">
            Service runs in the background to track changes even when this app is closed.
        </p>
      </div>
    </div>
  );
};
export default ServiceStatus;