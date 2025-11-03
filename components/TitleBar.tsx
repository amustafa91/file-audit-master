import React from 'react';
import Icon from '/components/Icon.tsx';

const TitleBar: React.FC = () => {
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <header className="flex items-center justify-between h-10 bg-base-200 border-b border-border flex-shrink-0 draggable">
      <div className="flex items-center px-3">
        <Icon name="app" className="w-5 h-5 text-primary mr-2" />
        <h1 className="text-sm font-semibold text-text-primary">File Audit Master</h1>
      </div>
      <div className="flex items-center h-full not-draggable">
        <button onClick={handleMinimize} className="px-3 h-full hover:bg-black/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14 8v1H3V8h11z"/>
          </svg>
        </button>
        <button onClick={handleMaximize} className="px-3 h-full hover:bg-black/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z"/>
          </svg>
        </button>
        <button onClick={handleClose} className="px-3 h-full hover:bg-red-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.854 4.146a.5.5 0 0 1 0 .708L8.707 8l3.147 3.146a.5.5 0 0 1-.708.708L8 8.707l-3.146 3.147a.5.5 0 0 1-.708-.708L7.293 8 4.146 4.854a.5.5 0 1 1 .708-.708L8 7.293l3.146-3.147a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
      </div>
    </header>
  );
};

export default TitleBar;