import React, { useState, useEffect, useRef } from 'react';
import Modal from '/components/Modal.tsx';
import { LogMessage } from '/types.ts';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogViewerModal: React.FC<LogViewerModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchHistory = async () => {
        const history = await window.electronAPI.getLogHistory();
        setLogs(history);
      };
      fetchHistory();

      const removeListener = window.electronAPI.onLogMessage((message) => {
        setLogs(prevLogs => [...prevLogs, message]);
      });

      return () => {
        removeListener();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    const logText = logs.map(log => `[${log.timestamp}] [${log.source}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleClear = async () => {
    await window.electronAPI.clearLogHistory();
    setLogs([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Application Log Viewer"
      maxWidth="max-w-4xl"
    >
      <div className="flex justify-end gap-2 mb-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-base-200 text-text-primary text-xs font-medium rounded-md hover:bg-border"
        >
          {isCopied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-md hover:bg-red-200"
        >
          Clear Logs
        </button>
      </div>
      <div
        ref={logContainerRef}
        className="bg-black text-white font-mono text-xs p-4 rounded-md h-96 overflow-y-auto border border-gray-700"
      >
        {logs.map((log, index) => {
            const sourceColor = log.source === 'Service' ? 'text-cyan-400' : 'text-purple-400';
            const messageColor = log.type === 'error' ? 'text-red-400' : 'text-gray-200';
            return (
                <div key={index} className="flex">
                    <span className="text-gray-500 mr-2 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`${sourceColor} mr-2 font-bold w-16 flex-shrink-0`}>[{log.source}]</span>
                    <p className={`${messageColor} whitespace-pre-wrap break-words`}>{log.message}</p>
                </div>
            )
        })}
         {logs.length === 0 && <p className="text-gray-500">No log messages yet. Start the service or perform an action to see logs.</p>}
      </div>
    </Modal>
  );
};

export default LogViewerModal;
