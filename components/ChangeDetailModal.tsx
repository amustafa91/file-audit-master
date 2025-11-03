import React, { useState, useEffect } from 'react';
import Modal from '/components/Modal.tsx';
import { FileChangeEvent, ChangeDetails, StructuredPatch } from '/types.ts';
import * as diff from 'diff';

interface ChangeDetailModalProps {
  event: FileChangeEvent | null;
  onClose: () => void;
}

const StructuredDiff: React.FC<{ patch: StructuredPatch }> = ({ patch }) => {
  return (
    <div className="border border-border rounded-md bg-white font-mono text-xs leading-5">
      {patch.hunks.map((hunk, hunkIndex) => {
        let oldLineNum = hunk.oldStart;
        let newLineNum = hunk.newStart;

        const lines = [];
        for (let i = 0; i < hunk.lines.length; i++) {
          const line = hunk.lines[i];
          const lineType = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'context';

          if (lineType === 'del' && i + 1 < hunk.lines.length && hunk.lines[i + 1].startsWith('+')) {
            // A modification (delete followed by add)
            const oldContent = line.substring(1);
            const newContent = hunk.lines[i + 1].substring(1);
            const wordDiff = diff.diffWordsWithSpace(oldContent, newContent);

            lines.push(
              <div key={`${i}-del`} className="flex bg-red-50/60">
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50 bg-red-50/30">{oldLineNum++}</span>
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50 bg-red-50/30"></span>
                <span className="pl-1 flex-1 whitespace-pre-wrap break-all">
                  <span className="px-1 select-none">-</span>
                  {wordDiff.map((part, partIndex) => !part.added && (
                    <span key={partIndex} className={part.removed ? 'bg-red-200' : ''}>{part.value}</span>
                  ))}
                </span>
              </div>
            );
            lines.push(
              <div key={`${i}-add`} className="flex bg-green-50/60 border-b border-border/50">
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50 bg-green-50/30"></span>
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50 bg-green-50/30">{newLineNum++}</span>
                <span className="pl-1 flex-1 whitespace-pre-wrap break-all">
                  <span className="px-1 select-none">+</span>
                  {wordDiff.map((part, partIndex) => !part.removed && (
                    <span key={partIndex} className={part.added ? 'bg-green-200' : ''}>{part.value}</span>
                  ))}
                </span>
              </div>
            );
            i++; // Skip next line
          } else {
            // A simple add, delete, or context line
            const content = line.substring(1);
            const bgColor = lineType === 'add' ? 'bg-green-50/60' : lineType === 'del' ? 'bg-red-50/60' : '';
            const prefix = lineType === 'add' ? '+' : lineType === 'del' ? '-' : ' ';
            
            lines.push(
              <div key={i} className={`flex ${bgColor}`}>
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50">{lineType !== 'add' ? oldLineNum++ : ''}</span>
                <span className="w-10 text-right pr-2 select-none text-text-secondary/60 flex-shrink-0 border-r border-border/50">{lineType !== 'del' ? newLineNum++ : ''}</span>
                <span className="pl-1 flex-1 whitespace-pre-wrap break-all">
                  <span className="px-1 select-none">{prefix}</span>
                  {content}
                </span>
              </div>
            );
          }
        }

        return (
          <React.Fragment key={hunkIndex}>
            <div className="px-4 py-1 bg-base-200 text-text-secondary border-y border-border text-xs select-none sticky top-0">
              {hunk.header}
            </div>
            {lines}
          </React.Fragment>
        );
      })}
    </div>
  );
};


const DiffViewer: React.FC<{ details: ChangeDetails }> = ({ details }) => {
  if (details.type === 'MODIFIED' && details.patch) {
    return <StructuredDiff patch={details.patch} />;
  }

  return (
    <div>
      <h4 className="font-semibold text-text-primary mb-2">
        {details.type === 'CREATED' ? 'File Created with Content:' : 'File Deleted with Content:'}
      </h4>
      <pre className="bg-base-200 p-3 rounded-md text-xs font-mono overflow-auto border border-border">
        <code>{details.content}</code>
      </pre>
    </div>
  );
};

const ChangeDetailModal: React.FC<ChangeDetailModalProps> = ({ event, onClose }) => {
  const [details, setDetails] = useState<ChangeDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setIsLoading(true);
      setDetails(null);
      window.electronAPI.getChangeDetails(event.id, event.projectPath)
        .then(data => {
          setDetails(data);
        })
        .catch(console.error)
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [event]);

  if (!event) return null;

  return (
    <Modal
      isOpen={!!event}
      onClose={onClose}
      title={`Details for: ${event.path}`}
      maxWidth="max-w-4xl"
    >
      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {details && <DiffViewer details={details} />}
      {!isLoading && !details && (
        <div className="text-center text-text-secondary h-48 flex items-center justify-center">
            Could not load change details.
        </div>
      )}
    </Modal>
  );
};

export default ChangeDetailModal;