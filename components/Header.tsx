import React from 'react';
import Icon from '/components/Icon.tsx';

interface HeaderProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    selectedFolder: string | null;
    systemUser: string | null;
}

const Header: React.FC<HeaderProps> = ({ startDate, endDate, onStartDateChange, onEndDateChange, selectedFolder, systemUser }) => {
    return (
        <header className="flex items-center justify-between p-3 bg-base-200 border-b border-border">
            <div className="flex items-center gap-4">
                <p className="text-sm text-text-secondary truncate max-w-xs md:max-w-md">
                    {selectedFolder ? `Watching: ${selectedFolder}` : 'No folder selected'}
                </p>
                {systemUser && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="font-medium">User:</span>
                        <span className="bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded">{systemUser}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="startDate" className="text-sm font-medium text-text-secondary">From:</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="p-1.5 border border-border rounded-md bg-base-100 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                        disabled={!selectedFolder}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="endDate" className="text-sm font-medium text-text-secondary">To:</label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="p-1.5 border border-border rounded-md bg-base-100 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                        disabled={!selectedFolder}
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;