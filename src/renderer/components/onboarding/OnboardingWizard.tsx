import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './OnboardingWizard.css';
import '../../types/electron';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  canSkip?: boolean;
  isRequired?: boolean;
}

interface OnboardingStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  onComplete: (data: any) => void;
  stepData: any;
}

interface OnboardingData {
  userPreferences: {
    theme: 'light' | 'dark' | 'auto';
    accessibility: {
      screenReader: boolean;
      highContrast: boolean;
      largeText: boolean;
      reducedMotion: boolean;
    };
    aiProvider: string;
    writingGenre: string[];
  };
  setupComplete: boolean;
}

/**
 * Comprehensive onboarding wizard for new users
 * Guides users through initial setup and feature discovery
 */
export const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    userPreferences: {
      theme: 'auto',
      accessibility: {
        screenReader: false,
        highContrast: false,
        largeText: false,
        reducedMotion: false
      },
      aiProvider: '',
      writingGenre: []
    },
    setupComplete: false
  });
  const [isVisible, setIsVisible] = useState(true);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to AI Creative Assistant',
      description: 'Let\'s get you set up for creative writing success',
      component: WelcomeStep,
      canSkip: false,
      isRequired: true
    },
    {
      id: 'accessibility',
      title: 'Accessibility Preferences',
      description: 'Configure accessibility features for your needs',
      component: AccessibilityStep,
      canSkip: true
    },
    {
      id: 'ai-setup',
      title: 'AI Provider Setup',
      description: 'Choose and configure your AI writing assistant',
      component: AISetupStep,
      canSkip: false,
      isRequired: true
    },
    {
      id: 'writing-preferences',
      title: 'Writing Preferences',
      description: 'Tell us about your writing style and genres',
      component: WritingPreferencesStep,
      canSkip: true
    },
    {
      id: 'tutorial',
      title: 'Quick Tutorial',
      description: 'Learn the basics of using AI Creative Assistant',
      component: TutorialStep,
      canSkip: true
    },
    {
      id: 'complete',
      title: 'Setup Complete',
      description: 'You\'re ready to start writing!',
      component: CompletionStep,
      canSkip: false
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (steps[currentStep].canSkip) {
      handleNext();
    }
  };

  const handleStepComplete = (stepData: any) => {
    setOnboardingData(prev => ({
      ...prev,
      ...stepData
    }));
    
    // Auto-advance to next step
    setTimeout(() => {
      handleNext();
    }, 500);
  };

  const handleFinish = async () => {
    try {
      // Save onboarding data to settings
      await window.electronAPI.saveUserSettings({
        ...onboardingData,
        setupComplete: true,
        onboardingCompletedAt: new Date().toISOString()
      });

      // Hide onboarding wizard
      setIsVisible(false);
      
      // Notify main process that onboarding is complete
      window.electronAPI.onboardingComplete();
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData.component;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-labelledby="onboarding-title">
      <div className="onboarding-container">
        {/* Progress indicator */}
        <div className="onboarding-progress" role="progressbar" 
             aria-valuenow={currentStep + 1} 
             aria-valuemin={1} 
             aria-valuemax={steps.length}>
          <div className="progress-steps">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`progress-step ${index <= currentStep ? 'completed' : ''} ${index === currentStep ? 'active' : ''}`}
                aria-label={`Step ${index + 1}: ${step.title}`}
              >
                <div className="step-indicator">
                  {index < currentStep ? '✓' : index + 1}
                </div>
                <span className="step-label">{step.title}</span>
              </div>
            ))}
          </div>
          <div 
            className="progress-bar"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="onboarding-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="step-content"
            >
              <h1 id="onboarding-title" className="step-title">
                {currentStepData.title}
              </h1>
              <p className="step-description">
                {currentStepData.description}
              </p>
              
              <StepComponent
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSkip={currentStepData.canSkip ? handleSkip : undefined}
                onComplete={handleStepComplete}
                stepData={onboardingData}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="onboarding-navigation">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="nav-button secondary"
            aria-label="Go to previous step"
          >
            Previous
          </button>
          
          <div className="nav-center">
            {currentStepData.canSkip && (
              <button
                onClick={handleSkip}
                className="nav-button tertiary"
                aria-label="Skip this step"
              >
                Skip
              </button>
            )}
          </div>
          
          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleFinish}
              className="nav-button primary"
              aria-label="Complete setup"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="nav-button primary"
              aria-label="Go to next step"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Individual step components
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  useEffect(() => {
    // Auto-complete welcome step after showing animation
    const timer = setTimeout(() => {
      onComplete({});
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="welcome-step">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="welcome-content"
      >
        <div className="app-logo" aria-hidden="true">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="35" fill="#4F46E5" />
            <path d="M25 35 L35 45 L55 25" stroke="white" strokeWidth="3" fill="none" />
          </svg>
        </div>
        
        <h2>Welcome to AI Creative Assistant</h2>
        <p>Your intelligent companion for creative writing, designed with accessibility and creativity in mind.</p>
        
        <div className="feature-highlights">
          <div className="feature">
            <span className="feature-icon" aria-hidden="true">🤖</span>
            <span>AI-powered writing assistance</span>
          </div>
          <div className="feature">
            <span className="feature-icon" aria-hidden="true">♿</span>
            <span>Full accessibility support</span>
          </div>
          <div className="feature">
            <span className="feature-icon" aria-hidden="true">🔒</span>
            <span>Privacy-first design</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AccessibilityStep: React.FC<OnboardingStepProps> = ({ onComplete, stepData }) => {
  const [preferences, setPreferences] = useState(stepData.userPreferences.accessibility);

  const handlePreferenceChange = (key: string, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
  };

  const handleContinue = () => {
    onComplete({
      userPreferences: {
        ...stepData.userPreferences,
        accessibility: preferences
      }
    });
  };

  return (
    <div className="accessibility-step">
      <div className="accessibility-options">
        <div className="option-group">
          <h3>Visual Accessibility</h3>
          
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(e) => handlePreferenceChange('highContrast', e.target.checked)}
              aria-describedby="high-contrast-desc"
            />
            <span className="checkbox-label">High Contrast Mode</span>
            <p id="high-contrast-desc" className="option-description">
              Increases contrast for better visibility
            </p>
          </label>
          
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={preferences.largeText}
              onChange={(e) => handlePreferenceChange('largeText', e.target.checked)}
              aria-describedby="large-text-desc"
            />
            <span className="checkbox-label">Large Text</span>
            <p id="large-text-desc" className="option-description">
              Increases text size throughout the application
            </p>
          </label>
        </div>

        <div className="option-group">
          <h3>Motion and Animation</h3>
          
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(e) => handlePreferenceChange('reducedMotion', e.target.checked)}
              aria-describedby="reduced-motion-desc"
            />
            <span className="checkbox-label">Reduced Motion</span>
            <p id="reduced-motion-desc" className="option-description">
              Minimizes animations and transitions
            </p>
          </label>
        </div>

        <div className="option-group">
          <h3>Assistive Technology</h3>
          
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={preferences.screenReader}
              onChange={(e) => handlePreferenceChange('screenReader', e.target.checked)}
              aria-describedby="screen-reader-desc"
            />
            <span className="checkbox-label">Screen Reader Optimization</span>
            <p id="screen-reader-desc" className="option-description">
              Optimizes interface for screen reader users
            </p>
          </label>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={handleContinue} className="primary-button">
          Continue
        </button>
      </div>
    </div>
  );
};

const AISetupStep: React.FC<OnboardingStepProps> = ({ onComplete, stepData }) => {
  const [selectedProvider, setSelectedProvider] = useState(stepData.userPreferences.aiProvider);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const providers = [
    {
      id: 'cowriter',
      name: 'SoYume Co-writer AI',
      description: 'Specialized AI for creative writing (Recommended)',
      type: 'local',
      icon: '✍️'
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'Powerful cloud-based AI (Requires API key)',
      type: 'cloud',
      icon: '🤖'
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Advanced reasoning AI (Requires API key)',
      type: 'cloud',
      icon: '🧠'
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      description: 'Run AI models locally on your computer',
      type: 'local',
      icon: '🏠'
    }
  ];

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  const handleConfigure = async () => {
    setIsConfiguring(true);
    
    try {
      // Launch provider-specific configuration
      await window.electronAPI.configureAIProvider(selectedProvider);
      
      onComplete({
        userPreferences: {
          ...stepData.userPreferences,
          aiProvider: selectedProvider
        }
      });
    } catch (error) {
      console.error('Failed to configure AI provider:', error);
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <div className="ai-setup-step">
      <div className="provider-selection">
        <h3>Choose Your AI Writing Assistant</h3>
        
        <div className="provider-grid">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`provider-card ${selectedProvider === provider.id ? 'selected' : ''}`}
              onClick={() => handleProviderSelect(provider.id)}
              role="button"
              tabIndex={0}
              aria-pressed={selectedProvider === provider.id}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleProviderSelect(provider.id);
                }
              }}
            >
              <div className="provider-icon" aria-hidden="true">
                {provider.icon}
              </div>
              <h4>{provider.name}</h4>
              <p>{provider.description}</p>
              <span className={`provider-type ${provider.type}`}>
                {provider.type === 'local' ? 'Local' : 'Cloud'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="step-actions">
        <button
          onClick={handleConfigure}
          disabled={!selectedProvider || isConfiguring}
          className="primary-button"
        >
          {isConfiguring ? 'Configuring...' : 'Configure & Continue'}
        </button>
      </div>
    </div>
  );
};

const WritingPreferencesStep: React.FC<OnboardingStepProps> = ({ onComplete, stepData }) => {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(stepData.userPreferences.writingGenre);

  const genres = [
    'Fantasy', 'Science Fiction', 'Romance', 'Mystery', 'Thriller',
    'Horror', 'Literary Fiction', 'Young Adult', 'Children\'s',
    'Non-fiction', 'Poetry', 'Screenplay', 'Light Novel', 'Manga'
  ];

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleContinue = () => {
    onComplete({
      userPreferences: {
        ...stepData.userPreferences,
        writingGenre: selectedGenres
      }
    });
  };

  return (
    <div className="writing-preferences-step">
      <div className="genre-selection">
        <h3>What do you like to write?</h3>
        <p>Select the genres you're interested in (optional)</p>
        
        <div className="genre-grid">
          {genres.map((genre) => (
            <button
              key={genre}
              className={`genre-tag ${selectedGenres.includes(genre) ? 'selected' : ''}`}
              onClick={() => handleGenreToggle(genre)}
              aria-pressed={selectedGenres.includes(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <div className="step-actions">
        <button onClick={handleContinue} className="primary-button">
          Continue
        </button>
      </div>
    </div>
  );
};

const TutorialStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  const [currentTutorial, setCurrentTutorial] = useState(0);

  const tutorials = [
    {
      title: 'Creating Your First Story',
      description: 'Learn how to start a new story project',
      content: 'Click the "New Story" button to create your first project. You can set the title, genre, and basic premise.'
    },
    {
      title: 'Using AI Assistance',
      description: 'Get help with writing and editing',
      content: 'Select any text and use AI commands to expand, rewrite, or analyze your content.'
    },
    {
      title: 'Character Development',
      description: 'Create and manage your characters',
      content: 'Use the Character Manager to create detailed character profiles and track relationships.'
    }
  ];

  const handleNext = () => {
    if (currentTutorial < tutorials.length - 1) {
      setCurrentTutorial(currentTutorial + 1);
    } else {
      onComplete({});
    }
  };

  const handleSkipTutorial = () => {
    onComplete({});
  };

  const currentTutorialData = tutorials[currentTutorial];

  return (
    <div className="tutorial-step">
      <div className="tutorial-content">
        <h3>{currentTutorialData.title}</h3>
        <p className="tutorial-description">{currentTutorialData.description}</p>
        
        <div className="tutorial-demo">
          <p>{currentTutorialData.content}</p>
        </div>
        
        <div className="tutorial-progress">
          {currentTutorial + 1} of {tutorials.length}
        </div>
      </div>

      <div className="step-actions">
        <button onClick={handleSkipTutorial} className="secondary-button">
          Skip Tutorial
        </button>
        <button onClick={handleNext} className="primary-button">
          {currentTutorial === tutorials.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
};

const CompletionStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  useEffect(() => {
    // Auto-complete after showing success message
    const timer = setTimeout(() => {
      onComplete({ setupComplete: true });
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="completion-step">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="completion-content"
      >
        <div className="success-icon" aria-hidden="true">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="25" fill="#10B981" />
            <path d="M20 30 L26 36 L40 22" stroke="white" strokeWidth="3" fill="none" />
          </svg>
        </div>
        
        <h2>Setup Complete!</h2>
        <p>You're all set to start your creative writing journey with AI assistance.</p>
        
        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>Create your first story project</li>
            <li>Explore AI writing features</li>
            <li>Customize your workspace</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;