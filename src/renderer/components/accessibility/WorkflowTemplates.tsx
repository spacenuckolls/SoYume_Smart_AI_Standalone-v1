import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AccessibilityManager } from '../../../main/accessibility/AccessibilityManager';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'writing' | 'editing' | 'analysis' | 'organization' | 'custom';
  steps: WorkflowStep[];
  estimatedTime: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  isDefault: boolean;
  isUserCreated: boolean;
  accessibility: {
    supportedNeeds: AutismSupportNeed[];
    sensoryConsiderations: SensoryConsideration[];
    cognitiveSupports: CognitiveSupport[];
  };
  customizations: WorkflowCustomization[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  type: 'action' | 'decision' | 'input' | 'review' | 'break';
  estimatedTime: number;
  isOptional: boolean;
  prerequisites?: string[];
  instructions: StepInstruction[];
  validation?: StepValidation;
  sensoryBreak?: SensoryBreak;
  cognitiveSupport?: CognitiveSupport;
}

export interface StepInstruction {
  type: 'text' | 'visual' | 'audio' | 'interactive';
  content: string;
  media?: string; // URL to image, video, or audio
  alternatives?: string[]; // Alternative ways to complete the step
}

export interface StepValidation {
  type: 'automatic' | 'manual' | 'peer';
  criteria: string[];
  feedback: ValidationFeedback;
}

export interface ValidationFeedback {
  success: string;
  partial: string;
  failure: string;
  suggestions: string[];
}

export interface SensoryBreak {
  duration: number; // in minutes
  type: 'visual' | 'auditory' | 'tactile' | 'movement';
  activities: string[];
  isRequired: boolean;
}

export interface AutismSupportNeed {
  type: 'routine' | 'predictability' | 'sensory' | 'social' | 'communication' | 'executive';
  level: 'low' | 'medium' | 'high';
  description: string;
}

export interface SensoryConsideration {
  type: 'visual' | 'auditory' | 'tactile' | 'vestibular' | 'proprioceptive';
  sensitivity: 'hypo' | 'hyper' | 'mixed';
  accommodations: string[];
}

export interface CognitiveSupport {
  type: 'memory' | 'attention' | 'executive' | 'processing' | 'organization';
  strategies: string[];
  tools: string[];
}

export interface WorkflowCustomization {
  id: string;
  name: string;
  type: 'step-order' | 'timing' | 'sensory' | 'cognitive' | 'interface';
  options: CustomizationOption[];
}

export interface CustomizationOption {
  id: string;
  label: string;
  description: string;
  value: any;
  isDefault: boolean;
}

export interface WorkflowTemplatesProps {
  availableTemplates: WorkflowTemplate[];
  currentTemplate?: WorkflowTemplate;
  userProfile: AutismProfile;
  onTemplateSelect: (template: WorkflowTemplate) => void;
  onTemplateCustomize: (template: WorkflowTemplate, customizations: any) => void;
  onTemplateCreate: (template: WorkflowTemplate) => void;
  onWorkflowStart: (template: WorkflowTemplate) => void;
}

export interface AutismProfile {
  sensoryProfile: {
    visual: 'hypo' | 'hyper' | 'typical';
    auditory: 'hypo' | 'hyper' | 'typical';
    tactile: 'hypo' | 'hyper' | 'typical';
    vestibular: 'hypo' | 'hyper' | 'typical';
    proprioceptive: 'hypo' | 'hyper' | 'typical';
  };
  cognitiveProfile: {
    executiveFunction: 'low' | 'medium' | 'high';
    workingMemory: 'low' | 'medium' | 'high';
    processingSpeed: 'slow' | 'average' | 'fast';
    attentionSpan: 'short' | 'medium' | 'long';
  };
  communicationPreferences: {
    instructions: 'text' | 'visual' | 'audio' | 'multimodal';
    feedback: 'immediate' | 'delayed' | 'summary';
    social: 'minimal' | 'moderate' | 'high';
  };
  routinePreferences: {
    structure: 'rigid' | 'flexible' | 'mixed';
    predictability: 'high' | 'medium' | 'low';
    changeAdaptation: 'difficult' | 'moderate' | 'easy';
  };
  supportNeeds: AutismSupportNeed[];
}

export const WorkflowTemplates: React.FC<WorkflowTemplatesProps> = ({
  availableTemplates,
  currentTemplate,
  userProfile,
  onTemplateSelect,
  onTemplateCustomize,
  onTemplateCreate,
  onWorkflowStart
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(currentTemplate || null);
  const [customizations, setCustomizations] = useState<Record<string, any>>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'time' | 'difficulty'>('name');

  // Timer for step tracking
  const [stepTimer, setStepTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter templates based on user profile
  const recommendedTemplates = availableTemplates.filter(template => {
    return template.accessibility.supportedNeeds.some(need => 
      userProfile.supportNeeds.some(userNeed => 
        userNeed.type === need.type && userNeed.level >= need.level
      )
    );
  });

  const filteredTemplates = availableTemplates.filter(template => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'recommended') return recommendedTemplates.includes(template);
    return template.category === filterCategory;
  });

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case 'time':
        return a.estimatedTime - b.estimatedTime;
      case 'difficulty':
        const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Timer management
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setStepTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  const announceToScreenReader = (message: string) => {
    setAnnouncements(prev => [...prev, message]);
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTemplateRecommendationScore = (template: WorkflowTemplate): number => {
    let score = 0;
    
    // Match sensory considerations
    template.accessibility.sensoryConsiderations.forEach(consideration => {
      const userSensitivity = userProfile.sensoryProfile[consideration.type];
      if (userSensitivity === consideration.sensitivity) {
        score += 3;
      } else if (userSensitivity !== 'typical') {
        score += 1;
      }
    });
    
    // Match cognitive supports
    template.accessibility.cognitiveSupports.forEach(support => {
      const userLevel = userProfile.cognitiveProfile[support.type as keyof typeof userProfile.cognitiveProfile];
      if (userLevel === 'low' && support.strategies.length > 0) {
        score += 2;
      }
    });
    
    // Match support needs
    template.accessibility.supportedNeeds.forEach(need => {
      const userNeed = userProfile.supportNeeds.find(un => un.type === need.type);
      if (userNeed && userNeed.level >= need.level) {
        score += 4;
      }
    });
    
    return score;
  };

  const customizeTemplate = (template: WorkflowTemplate): WorkflowTemplate => {
    const customized = { ...template };
    
    // Apply user profile customizations
    customized.steps = template.steps.map(step => {
      const customizedStep = { ...step };
      
      // Adjust timing based on processing speed
      if (userProfile.cognitiveProfile.processingSpeed === 'slow') {
        customizedStep.estimatedTime = Math.ceil(step.estimatedTime * 1.5);
      } else if (userProfile.cognitiveProfile.processingSpeed === 'fast') {
        customizedStep.estimatedTime = Math.ceil(step.estimatedTime * 0.8);
      }
      
      // Add sensory breaks if needed
      if (userProfile.sensoryProfile.visual === 'hyper' || userProfile.sensoryProfile.auditory === 'hyper') {
        if (step.estimatedTime > 15 && !step.sensoryBreak) {
          customizedStep.sensoryBreak = {
            duration: 2,
            type: 'visual',
            activities: ['Close eyes', 'Look away from screen', 'Deep breathing'],
            isRequired: false
          };
        }
      }
      
      // Enhance instructions based on communication preferences
      if (userProfile.communicationPreferences.instructions === 'visual') {
        customizedStep.instructions = step.instructions.map(instruction => ({
          ...instruction,
          type: 'visual' as const,
          alternatives: [...(instruction.alternatives || []), 'Visual diagram available']
        }));
      }
      
      return customizedStep;
    });
    
    return customized;
  };

  const handleTemplateSelect = (template: WorkflowTemplate) => {
    const customizedTemplate = customizeTemplate(template);
    setSelectedTemplate(customizedTemplate);
    onTemplateSelect(customizedTemplate);
    announceToScreenReader(`Selected ${template.name} workflow template`);
  };

  const handleWorkflowStart = () => {
    if (!selectedTemplate) return;
    
    setCurrentStep(0);
    setStepTimer(0);
    setIsTimerRunning(true);
    setPreviewMode(true);
    onWorkflowStart(selectedTemplate);
    announceToScreenReader(`Started ${selectedTemplate.name} workflow`);
  };

  const handleStepComplete = () => {
    if (!selectedTemplate) return;
    
    const currentStepData = selectedTemplate.steps[currentStep];
    
    // Check if sensory break is needed
    if (currentStepData.sensoryBreak && stepTimer > currentStepData.estimatedTime * 60) {
      announceToScreenReader('Sensory break recommended');
      // Could trigger a break modal here
    }
    
    if (currentStep < selectedTemplate.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setStepTimer(0);
      announceToScreenReader(`Completed step ${currentStep + 1}. Moving to step ${currentStep + 2}`);
    } else {
      setIsTimerRunning(false);
      setPreviewMode(false);
      announceToScreenReader('Workflow completed successfully!');
    }
  };

  const renderTemplateCard = (template: WorkflowTemplate) => {
    const recommendationScore = getTemplateRecommendationScore(template);
    const isRecommended = recommendationScore > 5;
    
    return (
      <div
        key={template.id}
        className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => handleTemplateSelect(template)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTemplateSelect(template);
          }
        }}
        aria-label={`Select ${template.name} workflow template`}
        aria-describedby={`template-desc-${template.id}`}
      >
        {isRecommended && (
          <div className="recommendation-badge" aria-label="Recommended for you">
            ⭐ Recommended
          </div>
        )}
        
        <div className="template-header">
          <h3>{template.name}</h3>
          <div className="template-meta">
            <span className="category">{template.category}</span>
            <span className="difficulty">{template.difficulty}</span>
            <span className="time">{template.estimatedTime}min</span>
          </div>
        </div>
        
        <p id={`template-desc-${template.id}`} className="template-description">
          {template.description}
        </p>
        
        <div className="template-features">
          <div className="support-needs">
            <h4>Supports:</h4>
            <ul>
              {template.accessibility.supportedNeeds.slice(0, 3).map(need => (
                <li key={need.type}>{need.type} ({need.level})</li>
              ))}
              {template.accessibility.supportedNeeds.length > 3 && (
                <li>+{template.accessibility.supportedNeeds.length - 3} more</li>
              )}
            </ul>
          </div>
          
          <div className="sensory-considerations">
            <h4>Sensory:</h4>
            <div className="sensory-tags">
              {template.accessibility.sensoryConsiderations.map(consideration => (
                <span key={consideration.type} className={`sensory-tag ${consideration.sensitivity}`}>
                  {consideration.type}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="template-steps-preview">
          <span>{template.steps.length} steps</span>
          <div className="steps-breakdown">
            {template.steps.slice(0, 3).map((step, index) => (
              <span key={step.id} className="step-preview">
                {index + 1}. {step.title}
              </span>
            ))}
            {template.steps.length > 3 && <span>...</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderStepPreview = (step: WorkflowStep, index: number) => {
    const isCurrentStep = index === currentStep;
    const isCompleted = index < currentStep;
    
    return (
      <div
        key={step.id}
        className={`step-preview ${isCurrentStep ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
        role="listitem"
      >
        <div className="step-number">
          {isCompleted ? '✓' : index + 1}
        </div>
        
        <div className="step-content">
          <h4>{step.title}</h4>
          <p>{step.description}</p>
          
          <div className="step-meta">
            <span className="step-time">~{step.estimatedTime}min</span>
            <span className="step-type">{step.type}</span>
            {step.isOptional && <span className="optional">Optional</span>}
          </div>
          
          {step.sensoryBreak && (
            <div className="sensory-break-indicator">
              🧘 Sensory break available
            </div>
          )}
          
          {step.cognitiveSupport && (
            <div className="cognitive-support-indicator">
              🧠 Cognitive support included
            </div>
          )}
        </div>
        
        {isCurrentStep && previewMode && (
          <div className="step-timer">
            <span>Time: {formatTime(stepTimer)}</span>
            <span>Target: {step.estimatedTime}min</span>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStepDetails = () => {
    if (!selectedTemplate || !previewMode) return null;
    
    const step = selectedTemplate.steps[currentStep];
    
    return (
      <div className="current-step-details" role="region" aria-labelledby="current-step-title">
        <div className="step-header">
          <h3 id="current-step-title">{step.title}</h3>
          <div className="step-progress">
            Step {currentStep + 1} of {selectedTemplate.steps.length}
          </div>
        </div>
        
        <div className="step-description">
          {step.description}
        </div>
        
        <div className="step-instructions">
          <h4>Instructions:</h4>
          {step.instructions.map((instruction, index) => (
            <div key={index} className={`instruction instruction-${instruction.type}`}>
              <div className="instruction-content">
                {instruction.content}
              </div>
              
              {instruction.alternatives && instruction.alternatives.length > 0 && (
                <details className="instruction-alternatives">
                  <summary>Alternative approaches</summary>
                  <ul>
                    {instruction.alternatives.map((alt, altIndex) => (
                      <li key={altIndex}>{alt}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
        
        {step.sensoryBreak && stepTimer > step.estimatedTime * 60 * 0.8 && (
          <div className="sensory-break-suggestion" role="alert">
            <h4>Sensory Break Suggested</h4>
            <p>You've been working for a while. Consider taking a {step.sensoryBreak.duration}-minute break.</p>
            <div className="break-activities">
              <strong>Suggested activities:</strong>
              <ul>
                {step.sensoryBreak.activities.map((activity, index) => (
                  <li key={index}>{activity}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => {
                // Implement break timer
                announceToScreenReader('Starting sensory break');
              }}
              className="take-break-button"
            >
              Take Break
            </button>
          </div>
        )}
        
        <div className="step-actions">
          <button
            onClick={handleStepComplete}
            className="complete-step-button"
            disabled={stepTimer < 30} // Prevent rushing through steps
          >
            Complete Step
          </button>
          
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="previous-step-button"
            >
              Previous Step
            </button>
          )}
          
          <button
            onClick={() => {
              setIsTimerRunning(false);
              setPreviewMode(false);
              announceToScreenReader('Workflow paused');
            }}
            className="pause-workflow-button"
          >
            Pause Workflow
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="workflow-templates">
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      <div className="templates-header">
        <h2>Workflow Templates</h2>
        <p>Structured workflows designed to support different writing needs and preferences</p>
      </div>

      {/* Filters and sorting */}
      <div className="templates-controls" role="toolbar" aria-label="Template filters and sorting">
        <div className="filter-group">
          <label htmlFor="category-filter">Category:</label>
          <select
            id="category-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Templates</option>
            <option value="recommended">Recommended for You</option>
            <option value="writing">Writing</option>
            <option value="editing">Editing</option>
            <option value="analysis">Analysis</option>
            <option value="organization">Organization</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        <div className="sort-group">
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">Name</option>
            <option value="time">Duration</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </div>
        
        <button
          onClick={() => setIsCreatingTemplate(true)}
          className="create-template-button"
        >
          Create Custom Template
        </button>
      </div>

      {/* Template grid */}
      <div className="templates-grid" role="grid" aria-label="Available workflow templates">
        {sortedTemplates.map(template => renderTemplateCard(template))}
      </div>

      {/* Selected template details */}
      {selectedTemplate && !previewMode && (
        <div className="template-details" role="region" aria-labelledby="template-details-title">
          <div className="details-header">
            <h3 id="template-details-title">{selectedTemplate.name}</h3>
            <div className="template-actions">
              <button
                onClick={handleWorkflowStart}
                className="start-workflow-button"
              >
                Start Workflow
              </button>
              
              <button
                onClick={() => {
                  // Open customization modal
                  announceToScreenReader('Opening template customization');
                }}
                className="customize-template-button"
              >
                Customize
              </button>
            </div>
          </div>
          
          <div className="template-overview">
            <div className="overview-stats">
              <div className="stat">
                <span className="stat-label">Steps:</span>
                <span className="stat-value">{selectedTemplate.steps.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Estimated Time:</span>
                <span className="stat-value">{selectedTemplate.estimatedTime} minutes</span>
              </div>
              <div className="stat">
                <span className="stat-label">Difficulty:</span>
                <span className="stat-value">{selectedTemplate.difficulty}</span>
              </div>
            </div>
          </div>
          
          <div className="steps-overview" role="list" aria-label="Workflow steps">
            {selectedTemplate.steps.map((step, index) => renderStepPreview(step, index))}
          </div>
        </div>
      )}

      {/* Current workflow execution */}
      {previewMode && renderCurrentStepDetails()}
    </div>
  );
};

// Default templates for autism support
export const defaultAutismWorkflowTemplates: WorkflowTemplate[] = [
  {
    id: 'structured-writing-session',
    name: 'Structured Writing Session',
    description: 'A predictable, step-by-step approach to writing with built-in breaks and clear expectations',
    category: 'writing',
    estimatedTime: 45,
    difficulty: 'beginner',
    tags: ['routine', 'predictable', 'structured'],
    isDefault: true,
    isUserCreated: false,
    accessibility: {
      supportedNeeds: [
        { type: 'routine', level: 'high', description: 'Provides clear structure and predictable steps' },
        { type: 'executive', level: 'medium', description: 'Breaks down complex tasks into manageable steps' }
      ],
      sensoryConsiderations: [
        { type: 'visual', sensitivity: 'hyper', accommodations: ['Reduced visual clutter', 'Calm color scheme'] }
      ],
      cognitiveSupports: [
        { type: 'executive', strategies: ['Step-by-step breakdown', 'Clear timers'], tools: ['Visual progress tracker'] }
      ]
    },
    customizations: [],
    steps: [
      {
        id: 'setup',
        title: 'Set Up Writing Environment',
        description: 'Prepare your workspace for focused writing',
        type: 'action',
        estimatedTime: 5,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Clear your desk of distractions. Have water and any comfort items nearby.',
            alternatives: ['Use noise-canceling headphones', 'Dim harsh lighting']
          }
        ]
      },
      {
        id: 'goal-setting',
        title: 'Set Writing Goals',
        description: 'Define what you want to accomplish in this session',
        type: 'input',
        estimatedTime: 5,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Write down 1-3 specific, achievable goals for this session.',
            alternatives: ['Use voice recording instead of writing', 'Create a visual mind map']
          }
        ]
      },
      {
        id: 'writing-block-1',
        title: 'First Writing Block',
        description: 'Write for 15 minutes without editing',
        type: 'action',
        estimatedTime: 15,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Focus on getting ideas down. Don\'t worry about perfection.',
            alternatives: ['Use speech-to-text', 'Write by hand first']
          }
        ],
        sensoryBreak: {
          duration: 3,
          type: 'movement',
          activities: ['Stand and stretch', 'Walk around', 'Deep breathing'],
          isRequired: false
        }
      },
      {
        id: 'break-1',
        title: 'Sensory Break',
        description: 'Take a short break to reset',
        type: 'break',
        estimatedTime: 5,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Step away from your writing. Do something calming.',
            alternatives: ['Listen to music', 'Look out a window', 'Do gentle stretches']
          }
        ]
      },
      {
        id: 'review-and-continue',
        title: 'Review and Continue',
        description: 'Briefly review what you\'ve written and continue',
        type: 'review',
        estimatedTime: 10,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Read through your work. Make notes about what to develop next.',
            alternatives: ['Use text-to-speech to hear your writing', 'Create a quick outline']
          }
        ]
      },
      {
        id: 'session-wrap-up',
        title: 'Session Wrap-Up',
        description: 'Reflect on your progress and plan next steps',
        type: 'review',
        estimatedTime: 5,
        isOptional: false,
        instructions: [
          {
            type: 'text',
            content: 'Note what you accomplished and what you want to work on next time.',
            alternatives: ['Record a voice memo', 'Create a visual progress chart']
          }
        ]
      }
    ]
  }
];