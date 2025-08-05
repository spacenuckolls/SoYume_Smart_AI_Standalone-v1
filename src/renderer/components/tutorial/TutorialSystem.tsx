import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TutorialSystem.css';
import '../../types/electron';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'type' | 'wait';
  waitFor?: string; // CSS selector to wait for
  skippable?: boolean;
}

interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  category: 'getting-started' | 'writing' | 'ai-features' | 'advanced';
  estimatedTime: number; // in minutes
  prerequisites?: string[]; // other tutorial IDs
}

interface TutorialSystemProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete: (tutorialId: string) => void;
  activeTutorial?: string;
}

/**
 * Interactive tutorial system with guided walkthroughs
 * Provides contextual help and feature discovery
 */
export const TutorialSystem: React.FC<TutorialSystemProps> = ({
  isVisible,
  onClose,
  onComplete,
  activeTutorial
}) => {
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const tutorials: Tutorial[] = [
    {
      id: 'getting-started',
      name: 'Getting Started',
      description: 'Learn the basics of AI Creative Assistant',
      category: 'getting-started',
      estimatedTime: 5,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to AI Creative Assistant',
          content: 'This tutorial will guide you through the main features of the application. You can pause or skip at any time.',
          skippable: true
        },
        {
          id: 'main-interface',
          title: 'Main Interface',
          content: 'This is your main workspace. The sidebar contains your projects, and the center area is where you\'ll write.',
          target: '.main-layout',
          position: 'right'
        },
        {
          id: 'new-story',
          title: 'Creating a New Story',
          content: 'Click the "New Story" button to start your first project.',
          target: '.new-story-button',
          position: 'bottom',
          action: 'click'
        },
        {
          id: 'ai-assistance',
          title: 'AI Writing Assistance',
          content: 'Select any text and right-click to access AI writing tools like expand, rewrite, or analyze.',
          target: '.editor-area',
          position: 'top'
        }
      ]
    },
    {
      id: 'ai-features',
      name: 'AI Writing Features',
      description: 'Discover how to use AI to enhance your writing',
      category: 'ai-features',
      estimatedTime: 8,
      prerequisites: ['getting-started'],
      steps: [
        {
          id: 'ai-providers',
          title: 'AI Providers',
          content: 'You can switch between different AI providers in the settings. Each has different strengths.',
          target: '.ai-provider-selector',
          position: 'bottom'
        },
        {
          id: 'story-analysis',
          title: 'Story Analysis',
          content: 'Use the analysis panel to get insights about your story structure, pacing, and character development.',
          target: '.analysis-panel',
          position: 'left'
        },
        {
          id: 'character-development',
          title: 'Character Development',
          content: 'The character manager helps you create detailed character profiles and track relationships.',
          target: '.character-manager',
          position: 'right'
        },
        {
          id: 'scene-generation',
          title: 'Scene Generation',
          content: 'AI can help generate scene descriptions, dialogue, and action sequences based on your prompts.',
          target: '.scene-generator',
          position: 'top'
        }
      ]
    },
    {
      id: 'accessibility-features',
      name: 'Accessibility Features',
      description: 'Learn about accessibility tools and customization options',
      category: 'advanced',
      estimatedTime: 6,
      steps: [
        {
          id: 'accessibility-menu',
          title: 'Accessibility Menu',
          content: 'Access accessibility options from the main menu or use Ctrl+Alt+A.',
          target: '.accessibility-menu',
          position: 'bottom'
        },
        {
          id: 'text-to-speech',
          title: 'Text-to-Speech',
          content: 'Select text and use Ctrl+Shift+S to have it read aloud.',
          target: '.editor-area',
          position: 'top'
        },
        {
          id: 'voice-commands',
          title: 'Voice Commands',
          content: 'Use voice commands to navigate and control the application hands-free.',
          target: '.voice-command-button',
          position: 'bottom'
        },
        {
          id: 'customization',
          title: 'Interface Customization',
          content: 'Customize colors, fonts, and layout to suit your needs in the accessibility settings.',
          target: '.customization-panel',
          position: 'left'
        }
      ]
    },
    {
      id: 'advanced-writing',
      name: 'Advanced Writing Techniques',
      description: 'Master advanced features for professional writing',
      category: 'advanced',
      estimatedTime: 12,
      prerequisites: ['getting-started', 'ai-features'],
      steps: [
        {
          id: 'plot-structure',
          title: 'Plot Structure Analysis',
          content: 'Analyze your story against classic structures like the Hero\'s Journey or Save the Cat.',
          target: '.plot-analyzer',
          position: 'right'
        },
        {
          id: 'pacing-analysis',
          title: 'Pacing Analysis',
          content: 'Visualize your story\'s pacing and tension curve to identify areas for improvement.',
          target: '.pacing-chart',
          position: 'top'
        },
        {
          id: 'cross-story-consistency',
          title: 'Cross-Story Consistency',
          content: 'Check for consistency across chapters and detect potential plot holes.',
          target: '.consistency-checker',
          position: 'left'
        },
        {
          id: 'export-options',
          title: 'Export and Publishing',
          content: 'Export your work in various formats for different publishing platforms.',
          target: '.export-menu',
          position: 'bottom'
        }
      ]
    }
  ];

  useEffect(() => {
    if (activeTutorial) {
      const tutorial = tutorials.find(t => t.id === activeTutorial);
      if (tutorial) {
        setCurrentTutorial(tutorial);
        setCurrentStep(0);
        setIsPlaying(true);
      }
    }
  }, [activeTutorial]);

  useEffect(() => {
    // Load completed tutorials from storage
    const loadCompletedTutorials = async () => {
      try {
        const completed = await window.electronAPI.getCompletedTutorials();
        setCompletedTutorials(completed || []);
      } catch (error) {
        console.error('Failed to load completed tutorials:', error);
      }
    };

    loadCompletedTutorials();
  }, []);

  useEffect(() => {
    if (currentTutorial && isPlaying) {
      const step = currentTutorial.steps[currentStep];
      if (step.target) {
        highlightElement(step.target);
      } else {
        clearHighlight();
      }
    } else {
      clearHighlight();
    }

    return () => clearHighlight();
  }, [currentTutorial, currentStep, isPlaying]);

  const highlightElement = (selector: string) => {
    try {
      const element = document.querySelector(selector);
      if (element) {
        setHighlightedElement(element);
        
        // Add highlight class
        element.classList.add('tutorial-highlight');
        
        // Scroll element into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      }
    } catch (error) {
      console.warn('Failed to highlight element:', selector, error);
    }
  };

  const clearHighlight = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('tutorial-highlight');
      setHighlightedElement(null);
    }
  };

  const handleNext = () => {
    if (!currentTutorial) return;

    if (currentStep < currentTutorial.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!currentTutorial) return;

    try {
      // Mark tutorial as completed
      const newCompleted = [...completedTutorials, currentTutorial.id];
      setCompletedTutorials(newCompleted);
      
      await window.electronAPI.markTutorialCompleted(currentTutorial.id);
      
      onComplete(currentTutorial.id);
      handleClose();
    } catch (error) {
      console.error('Failed to mark tutorial as completed:', error);
    }
  };

  const handleSkip = () => {
    if (currentTutorial?.steps[currentStep]?.skippable) {
      handleNext();
    }
  };

  const handleClose = () => {
    setIsPlaying(false);
    setCurrentTutorial(null);
    setCurrentStep(0);
    clearHighlight();
    onClose();
  };

  const handleTutorialSelect = (tutorial: Tutorial) => {
    // Check prerequisites
    if (tutorial.prerequisites) {
      const missingPrereqs = tutorial.prerequisites.filter(
        prereq => !completedTutorials.includes(prereq)
      );
      
      if (missingPrereqs.length > 0) {
        // Show prerequisite warning
        return;
      }
    }

    setCurrentTutorial(tutorial);
    setCurrentStep(0);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleResume = () => {
    setIsPlaying(true);
  };

  const getTooltipPosition = (step: TutorialStep) => {
    if (!step.target || !highlightedElement) return { top: '50%', left: '50%' };

    const rect = highlightedElement.getBoundingClientRect();
    const position = step.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          top: `${rect.top - 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, 0)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - 10}px`,
          transform: 'translate(-100%, -50%)'
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 10}px`,
          transform: 'translate(0, -50%)'
        };
      default:
        return {
          top: `${rect.bottom + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, 0)'
        };
    }
  };

  if (!isVisible) return null;

  return (
    <div className="tutorial-system" ref={overlayRef}>
      {/* Tutorial Selection */}
      {!currentTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-selection">
            <div className="tutorial-header">
              <h2>Interactive Tutorials</h2>
              <p>Learn how to use AI Creative Assistant effectively</p>
              <button
                className="close-button"
                onClick={handleClose}
                aria-label="Close tutorials"
              >
                ×
              </button>
            </div>

            <div className="tutorial-categories">
              {['getting-started', 'writing', 'ai-features', 'advanced'].map(category => (
                <div key={category} className="tutorial-category">
                  <h3>{category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                  <div className="tutorial-list">
                    {tutorials
                      .filter(t => t.category === category)
                      .map(tutorial => (
                        <div
                          key={tutorial.id}
                          className={`tutorial-card ${
                            completedTutorials.includes(tutorial.id) ? 'completed' : ''
                          }`}
                          onClick={() => handleTutorialSelect(tutorial)}
                        >
                          <div className="tutorial-info">
                            <h4>{tutorial.name}</h4>
                            <p>{tutorial.description}</p>
                            <div className="tutorial-meta">
                              <span className="duration">
                                {tutorial.estimatedTime} min
                              </span>
                              {tutorial.prerequisites && (
                                <span className="prerequisites">
                                  Requires: {tutorial.prerequisites.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="tutorial-status">
                            {completedTutorials.includes(tutorial.id) ? (
                              <span className="completed-badge">✓</span>
                            ) : (
                              <span className="start-button">Start</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Tutorial */}
      {currentTutorial && isPlaying && (
        <AnimatePresence>
          <motion.div
            className="tutorial-tooltip"
            style={getTooltipPosition(currentTutorial.steps[currentStep])}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="tooltip-content">
              <div className="tooltip-header">
                <h3>{currentTutorial.steps[currentStep].title}</h3>
                <div className="tutorial-progress">
                  {currentStep + 1} of {currentTutorial.steps.length}
                </div>
              </div>
              
              <div className="tooltip-body">
                <p>{currentTutorial.steps[currentStep].content}</p>
              </div>
              
              <div className="tooltip-actions">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="tutorial-button secondary"
                >
                  Previous
                </button>
                
                {currentTutorial.steps[currentStep].skippable && (
                  <button
                    onClick={handleSkip}
                    className="tutorial-button tertiary"
                  >
                    Skip
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  className="tutorial-button primary"
                >
                  {currentStep === currentTutorial.steps.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
            
            <div className="tooltip-arrow" />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Tutorial Controls */}
      {currentTutorial && (
        <div className="tutorial-controls">
          <div className="tutorial-info">
            <span className="tutorial-name">{currentTutorial.name}</span>
            <span className="tutorial-step">
              Step {currentStep + 1} of {currentTutorial.steps.length}
            </span>
          </div>
          
          <div className="tutorial-actions">
            {isPlaying ? (
              <button onClick={handlePause} className="control-button">
                Pause
              </button>
            ) : (
              <button onClick={handleResume} className="control-button">
                Resume
              </button>
            )}
            
            <button onClick={handleClose} className="control-button">
              Exit
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {currentTutorial && isPlaying && (
        <div className="tutorial-backdrop" onClick={handlePause} />
      )}
    </div>
  );
};

export default TutorialSystem;