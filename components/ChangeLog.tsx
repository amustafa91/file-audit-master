import React from 'react';
import { FileChangeEvent, ChangeType } from '/types.ts';
import Icon from '/components/Icon.tsx';
import Pagination from '/components/Pagination.tsx';
import Spinner from '/components/Spinner.tsx';

interface ChangeLogProps {
  changes: FileChangeEvent[];
  onViewDetails: (event: FileChangeEvent) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  isLoading: boolean;
  currentPage: number;
  totalLogs: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const ChangeTypePill: React.FC<{ type: ChangeType }> = ({ type }) => {
  const styles = {
    [ChangeType.CREATED]: 'bg-green-100 text-green-800',
    [ChangeType.MODIFIED]: 'bg-blue-100 text-blue-800',
    [ChangeType.DELETED]: 'bg-red-100 text-red-800',
  };
  const icons = {
    [ChangeType.CREATED]: <Icon name="plus-circle" className="w-4 h-4 mr-1.5" />,
    [ChangeType.MODIFIED]: <Icon name="pencil" className="w-4 h-4 mr-1.5" />,
    [ChangeType.DELETED]: <Icon name="trash" className="w-4 h-4 mr-1.5" />,
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type]}`}>
      {icons[type]}
      {type}
    </span>
  );
};

const ChangeLogHeader = () => (
    <div className="grid grid-cols-changelog gap-x-4 bg-base-200 border-b-2 border-border sticky top-0 z-10 flex-shrink-0 px-4">
        <div className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Timestamp</div>
        <div className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Type</div>
        <div className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Author</div>
        <div className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Path</div>
        <div className="py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</div>
    </div>
);

const ChangeLog: React.FC<ChangeLogProps> = ({ changes, onViewDetails, searchTerm, onSearchTermChange, isLoading, currentPage, totalLogs, pageSize, onPageChange }) => {
  return (
    <div className="bg-base-100 rounded-lg border border-border p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-text-primary">Change Log</h3>
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="search" className="h-5 w-5 text-text-secondary/60" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search by path or author..."
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-base-100 text-sm placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>
      <div className="border rounded-md overflow-auto relative" style={{ minHeight: '200px', maxHeight: '40vh' }}>
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
              <Spinner size={8} />
            </div>
          )}
          {changes.length > 0 ? (
            <div className="min-w-[700px]">
              <ChangeLogHeader />
              <div className="divide-y divide-border">
                {changes.map(event => (
                  <div key={event.id} className="grid grid-cols-changelog gap-x-4 items-center hover:bg-base-200 transition-colors duration-150 text-sm px-4">
                    <div className="py-3 whitespace-nowrap text-text-secondary">{event.timestamp.toLocaleString()}</div>
                    <div className="py-3 whitespace-nowrap"><ChangeTypePill type={event.type} /></div>
                    <div className="py-3 whitespace-nowrap text-text-primary">{event.user}</div>
                    <div className="py-3 whitespace-nowrap text-text-primary font-mono truncate">{event.path}</div>
                    <div className="py-3 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => onViewDetails(event)}
                        className="text-primary hover:text-accent font-medium text-xs"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center text-center text-text-secondary h-full">
              <p>
                  {!isLoading && (
                    searchTerm 
                      ? "No changes match your search."
                      : "No changes recorded for the selected period."
                  )}
              </p>
            </div>
          )}
      </div>
      {totalLogs > pageSize && (
         <Pagination 
            currentPage={currentPage}
            totalItems={totalLogs}
            pageSize={pageSize}
            onPageChange={onPageChange}
        />
      )}
    </div>
  );
};

export default ChangeLog;