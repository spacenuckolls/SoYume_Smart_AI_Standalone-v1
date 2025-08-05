import React from 'react';

interface ImportWizardProps {
  onImport: (data: any) => void;
  onClose: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({
  onImport,
  onClose
}) => {
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Mock import functionality
      const mockData = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        content: "Imported content placeholder"
      };
      onImport(mockData);
    }
  };

  return (
    <div className="import-wizard">
      <h3>Import Story</h3>
      <input type="file" onChange={handleFileImport} accept=".txt,.docx,.md" />
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};