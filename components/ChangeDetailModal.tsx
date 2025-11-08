import React, { useState, useEffect } from 'react';
import Modal from '/components/Modal.tsx';
import { FileChangeEvent, ChangeDetails, StructuredPatch } from '/types.ts';
import * as diff from 'diff';
import Icon from './Icon.tsx';

interface ChangeDetailModalProps {
  event: FileChangeEvent | null;
  onClose: () => void;
}

const patchToString = (patch: StructuredPatch): string => {
    let diffText = `--- ${patch.oldFileName}\n+++ ${patch.newFileName}\n`;
    patch.hunks.forEach(hunk => {
        diffText += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
        hunk.lines.forEach(line => {
            diffText += `${line}\n`;
        });
    });
    return diffText;
};

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
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (event) {
      setIsLoading(true);
      setDetails(null);
      setAiAnalysis(null);
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

  const handleAnalyze = async () => {
    if (!details?.patch || isAnalyzing) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
        const diffString = patchToString(details.patch);
        const analysis = await window.electronAPI.analyzeChange(diffString);
        setAiAnalysis(analysis);
    } catch (error) {
        console.error("AI Analysis failed:", error);
        setAiAnalysis("Failed to get analysis. Please check the application logs for more details.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  if (!event) return null;

  return (
    <Modal
      isOpen={!!event}
      onClose={onClose}
      title={`Details for: ${event.path}`}
      maxWidth="max-w-4xl"
      actions={
        details?.patch && (
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing}
            className="flex items-center justify-center px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="sparkles" className="w-4 h-4 mr-1.5" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        )
      }
    >
      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {details && <DiffViewer details={details} />}
      
      {isAnalyzing && (
        <div className="mt-4 flex items-center justify-center p-4 border-t border-border">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mr-3"></div>
          <span className="text-text-secondary">AI is analyzing the changes...</span>
        </div>
      )}
      {aiAnalysis && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-semibold text-text-primary mb-2 flex items-center">
            <Icon name="sparkles" className="w-5 h-5 mr-2 text-purple-500" />
            AI Analysis
          </h4>
          <div className="bg-purple-50 p-3 rounded-md text-sm text-text-primary border border-purple-200">
            <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">{aiAnalysis}</pre>
          </div>
        </div>
      )}

      {!isLoading && !details && (
        <div className="text-center text-text-secondary h-48 flex items-center justify-center">
            Could not load change details.
        </div>
      )}
    </Modal>
  );
};

export default ChangeDetailModal;