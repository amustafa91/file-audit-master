import React, { useState } from 'react';
import { FileSystemNode, Project } from '/types.ts';
import Icon from '/components/Icon.tsx';
import ServiceStatus from '/components/ServiceStatus.tsx';

interface SidebarProps {
  projects: Project[];
  activeProjectPath: string | null;
  onSetActiveProject: (path: string) => void;
  onRemoveProject: (path: string) => void;
  onAddProject: () => void;
  focusedPath: string | null;
  onFocusNode: (path: string) => void;
}

interface TreeNodeProps {
  node: FileSystemNode;
  focusedPath: string | null;
  onFocusNode: (path: string) => void;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, focusedPath, onFocusNode, level }) => {
  const [isOpen, setIsOpen] = useState(level < 1);

  const isFolder = node.type === 'folder';
  const isFocused = node.path === focusedPath;

  const handleToggle = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    }
  };
  
  const handleFocus = () => {
    onFocusNode(node.path);
  }

  const iconName = isFolder ? (isOpen ? 'folder-open' : 'folder') : 'file';
  const chevronIcon = isOpen ? 'chevron-down' : 'chevron-right';

  return (
    <div>
      <div
        className={`flex items-center p-1.5 rounded-md cursor-pointer transition-colors duration-150 group ${
          isFocused ? 'bg-primary/90 text-white' : 'hover:bg-black/5'
        }`}
        style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
        onClick={handleFocus}
      >
        {isFolder && node.children && node.children.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); handleToggle(); }} className="mr-1 p-0.5 rounded hover:bg-black/10">
            <Icon name={chevronIcon} className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
          </button>
        )}
        {/* FIX: Corrected a condition that was comparing a boolean to a number (`!node.children.length === 0`), which is a type error. The logic now correctly checks if the folder has no children (`node.children.length === 0`). */}
        {(!isFolder || !node.children || node.children.length === 0) && <div className="w-5 mr-1"></div>}
        <Icon name={iconName} className={`w-5 h-5 mr-2 ${isFolder ? 'text-primary' : 'text-text-secondary'} ${isFocused ? 'text-white' : ''}`} />
        <span className="flex-1 truncate text-sm">{node.name}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} focusedPath={focusedPath} onFocusNode={onFocusNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ projects, activeProjectPath, onSetActiveProject, onRemoveProject, onAddProject, focusedPath, onFocusNode }) => {
  const activeProject = projects.find(p => p.path === activeProjectPath);
  return (
    <aside className="w-72 bg-base-200 border-r border-border flex-shrink-0 flex flex-col">
      {/* Container for all content that needs to scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="flex items-center justify-between p-2 mb-1">
          <h2 className="text-sm font-semibold text-text-primary">Projects</h2>
          <button onClick={onAddProject} className="p-1 rounded text-text-secondary hover:bg-black/10 hover:text-text-primary" title="Add project folder">
            <Icon name="plus-circle" className="w-5 h-5"/>
          </button>
        </div>

        <div className="mb-2">
          {projects.length > 0 ? (
            projects.map(project => (
              <div 
                key={project.path}
                onClick={() => onSetActiveProject(project.path)}
                className={`flex items-center p-2 rounded-md cursor-pointer group text-sm font-medium ${activeProjectPath === project.path ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-black/5 hover:text-text-primary'}`}
              >
                <Icon name="folder" className="w-5 h-5 mr-2 flex-shrink-0"/>
                <span className="truncate flex-1">{project.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveProject(project.path); }}
                  className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 text-text-secondary hover:bg-red-100 hover:text-red-600"
                  title="Remove project"
                >
                  <Icon name="trash" className="w-4 h-4"/>
                </button>
              </div>
            ))
          ) : (
            <div className="px-2 py-4 text-sm text-center text-text-secondary">
                Add a project to begin.
            </div>
          )}
        </div>
        
        {activeProject && (
          <>
              <div className="border-t border-border mx-2 my-2"></div>
              <TreeNode node={activeProject.rootNode} focusedPath={focusedPath} onFocusNode={onFocusNode} level={0} />
          </>
        )}
      </div>
      
      {/* This component is now a "sticky footer" outside the scrollable area */}
      <ServiceStatus />
    </aside>
  );
};

export default Sidebar;
