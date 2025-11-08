import React, { useState, useEffect } from 'react';
import Modal from '/components/Modal.tsx';
import Spinner from '/components/Spinner.tsx';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange }) => {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
        checked ? 'bg-primary' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [isAutoStartEnabled, setIsAutoStartEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      window.electronAPI.getAutoStartSettings().then(settings => {
        setIsAutoStartEnabled(settings.isEnabled);
        setIsLoading(false);
      }).catch(err => {
        console.error("Failed to get auto-start settings:", err);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const handleToggleChange = async (enabled: boolean) => {
    setIsAutoStartEnabled(enabled);
    await window.electronAPI.setAutoStartSettings(enabled);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Application Settings" maxWidth="max-w-xl">
      {isLoading ? (
        <div className="flex justify-center items-center h-24">
          <Spinner size={6} />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="auto-start-toggle" className="font-medium text-text-primary select-none">
                Launch monitoring service on system startup
              </label>
              <ToggleSwitch
                id="auto-start-toggle"
                checked={isAutoStartEnabled}
                onChange={handleToggleChange}
              />
            </div>
            <p className="text-xs text-text-secondary mt-1">
              When enabled, the application will start minimized when you log in to Windows, and the monitoring service will begin automatically.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default SettingsModal;
