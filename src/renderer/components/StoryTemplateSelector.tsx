import React from 'react';
import { StoryTemplate } from '../../shared/types/Story';

interface StoryTemplateSelectorProps {
  onSelect: (template: StoryTemplate) => void;
  onClose: () => void;
}

export const StoryTemplateSelector: React.FC<StoryTemplateSelectorProps> = ({
  onSelect,
  onClose
}) => {
  const mockTemplates: StoryTemplate[] = [
    {
      id: 'fantasy-adventure',
      name: 'Fantasy Adventure',
      description: 'A classic fantasy adventure story template',
      genre: [{ name: 'Fantasy', subgenres: ['High Fantasy'], conventions: [] }],
      structure: { type: 'three-act', acts: [] }
    }
  ];

  return (
    <div className="story-template-selector">
      <h3>Choose a Story Template</h3>
      {mockTemplates.map(template => (
        <div key={template.id} onClick={() => onSelect(template)}>
          <h4>{template.name}</h4>
          <p>{template.description}</p>
        </div>
      ))}
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};