import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div 
        className={`bg-base-100 rounded-lg border border-border w-full ${maxWidth} m-4 flex flex-col max-h-[80vh] transform transition-all shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary truncate">{title}</h2>
        </div>
        <div className="p-6 pt-4 text-sm overflow-y-auto">
          {children}
        </div>
        <div className="flex justify-end p-4 bg-base-200 rounded-b-lg border-t border-border flex-shrink-0">
            <button
                onClick={onClose}
                className="px-6 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;