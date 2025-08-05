import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain } from 'electron';
import { ConfigManager } from '../config/ConfigManager';
import * as path from 'path';
import * as fs from 'fs/promises';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  required: boolean;
  completed: boolean;
}

interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
}

interface TutorialProgress {
  completedTutorials: string[];
  currentTutorial?: string;
  tutorialPreferences: {
    autoStart: boolean;
    showHints: boolean;
    skipAnimations: boolean;
  };
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  accessibility: {
    screenReader: boolean;
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
  };
  aiProvider: string;
  writingGenre: string[];
}

/**
 * Manages user onboarding process and tutorial system
 * Guides new users through initial setup and feature discovery
 */
export class OnboardingManager extends EventEmitter {
  private configManager: ConfigManager;
  private onboardingSteps: OnboardingStep[];
  private progress: OnboardingProgress;
  private tutorialProgress: TutorialProgress;
  private isOnboardingActive: boolean;
  private onboardingWindow?: BrowserWindow;

  constructor(configManager: ConfigManager) {
    super();
    
    this.configManager = configManager;
    this.onboardingSteps = [];
    this.progress = {
      currentStep: 0,
      totalSteps: 0,
      completedSteps: [],
      skippedSteps: [],
      startedAt: new Date()
    };
    this.tutorialProgress = {
      completedTutorials: [],
      tutorialPreferences: {
        autoStart: true,
        showHints: true,
        skipAnimations: false
      }
    };
    this.isOnboardingActive = false;
    
    this.initializeOnboardingSteps();
    this.setupIpcHandlers();
  }

  /**
   * Initialize onboarding steps
   */
  private initializeOnboardingSteps(): void {
    this.onboardingSteps = [
      {
        id: 'welcome',
        title: 'Welcome',
        description: 'Welcome to AI Creative Assistant',
        component: 'WelcomeStep',
        required: true,
        completed: false
      },
      {
        id: 'accessibility',
        title: 'Accessibility Setup',
        description: 'Configure accessibility preferences',
        component: 'AccessibilityStep',
        required: false,
        completed: false
      },
      {
        id: 'ai-setup',
        title: 'AI Provider Setup',
        description: 'Choose and configure your AI provider',
        component: 'AISetupStep',
        required: true,
        completed: false
      },
      {
        id: 'writing-preferences',
        title: 'Writing Preferences',
        description: 'Set up your writing preferences',
        component: 'WritingPreferencesStep',
        required: false,
        completed: false
      },
      {
        id: 'tutorial',
        title: 'Quick Tutorial',
        description: 'Learn the basics',
        component: 'TutorialStep',
        required: false,
        completed: false
      },
      {
        id: 'complete',
        title: 'Setup Complete',
        description: 'Finish onboarding',
        component: 'CompletionStep',
        required: true,
        completed: false
      }
    ];

    this.progress.totalSteps = this.onboardingSteps.length;
  }

  /**
   * Setup IPC handlers for onboarding communication
   */
  private setupIpcHandlers(): void {
    ipcMain.handle('onboarding:isRequired', async () => {
      return await this.isOnboardingRequired();
    });

    ipcMain.handle('onboarding:getProgress', async () => {
      return this.getProgress();
    });

    ipcMain.handle('onboarding:start', async () => {
      return await this.startOnboarding();
    });

    ipcMain.handle('onboarding:complete', async (_, data: any) => {
      return await this.completeOnboarding(data);
    });

    ipcMain.handle('onboarding:skipStep', async (_, stepId: string) => {
      return await this.skipStep(stepId);
    });

    ipcMain.handle('onboarding:saveUserSettings', async (_, settings: UserPreferences) => {
      return await this.saveUserSettings(settings);
    });

    ipcMain.handle('tutorial:getCompleted', async () => {
      return this.tutorialProgress.completedTutorials;
    });

    ipcMain.handle('tutorial:markCompleted', async (_, tutorialId: string) => {
      return await this.markTutorialCompleted(tutorialId);
    });

    ipcMain.handle('tutorial:getPreferences', async () => {
      return this.tutorialProgress.tutorialPreferences;
    });

    ipcMain.handle('tutorial:updatePreferences', async (_, preferences: any) => {
      return await this.updateTutorialPreferences(preferences);
    });
  }

  /**
   * Check if onboarding is required for the user
   */
  async isOnboardingRequired(): Promise<boolean> {
    try {
      const config = await this.configManager.getConfig();
      return !config.onboardingCompleted;
    } catch (error) {
      console.error('Failed to check onboarding requirement:', error);
      return true; // Default to requiring onboarding
    }
  }

  /**
   * Start the onboarding process
   */
  async startOnboarding(): Promise<boolean> {
    if (this.isOnboardingActive) {
      return false;
    }

    try {
      this.isOnboardingActive = true;
      this.progress.startedAt = new Date();
      this.progress.currentStep = 0;
      this.progress.completedSteps = [];
      this.progress.skippedSteps = [];

      // Load previous progress if exists
      await this.loadProgress();

      this.emit('onboardingStarted', this.progress);
      return true;
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      this.isOnboardingActive = false;
      return false;
    }
  }

  /**
   * Complete the onboarding process
   */
  async completeOnboarding(data: any): Promise<boolean> {
    try {
      this.progress.completedAt = new Date();
      this.progress.currentStep = this.onboardingSteps.length;

      // Save onboarding completion
      await this.configManager.updateConfig({
        onboardingCompleted: true,
        onboardingCompletedAt: this.progress.completedAt.toISOString(),
        userPreferences: data.userPreferences || {}
      });

      // Save progress
      await this.saveProgress();

      this.isOnboardingActive = false;
      this.emit('onboardingCompleted', this.progress);

      return true;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      return false;
    }
  }

  /**
   * Skip a specific onboarding step
   */
  async skipStep(stepId: string): Promise<boolean> {
    try {
      const step = this.onboardingSteps.find(s => s.id === stepId);
      if (!step) {
        return false;
      }

      if (step.required) {
        return false; // Cannot skip required steps
      }

      if (!this.progress.skippedSteps.includes(stepId)) {
        this.progress.skippedSteps.push(stepId);
      }

      await this.saveProgress();
      this.emit('stepSkipped', { stepId, step });

      return true;
    } catch (error) {
      console.error('Failed to skip step:', error);
      return false;
    }
  }

  /**
   * Mark a step as completed
   */
  async completeStep(stepId: string, data?: any): Promise<boolean> {
    try {
      const step = this.onboardingSteps.find(s => s.id === stepId);
      if (!step) {
        return false;
      }

      step.completed = true;
      
      if (!this.progress.completedSteps.includes(stepId)) {
        this.progress.completedSteps.push(stepId);
      }

      // Move to next step
      const currentIndex = this.onboardingSteps.findIndex(s => s.id === stepId);
      if (currentIndex >= 0 && currentIndex < this.onboardingSteps.length - 1) {
        this.progress.currentStep = currentIndex + 1;
      }

      await this.saveProgress();
      this.emit('stepCompleted', { stepId, step, data });

      return true;
    } catch (error) {
      console.error('Failed to complete step:', error);
      return false;
    }
  }

  /**
   * Save user settings from onboarding
   */
  async saveUserSettings(settings: UserPreferences): Promise<boolean> {
    try {
      await this.configManager.updateConfig({
        userPreferences: settings,
        theme: settings.theme,
        accessibility: settings.accessibility
      });

      // Apply settings immediately
      this.emit('settingsUpdated', settings);
      return true;
    } catch (error) {
      console.error('Failed to save user settings:', error);
      return false;
    }
  }

  /**
   * Get current onboarding progress
   */
  getProgress(): OnboardingProgress {
    return { ...this.progress };
  }

  /**
   * Get onboarding steps
   */
  getSteps(): OnboardingStep[] {
    return [...this.onboardingSteps];
  }

  /**
   * Check if onboarding is currently active
   */
  isActive(): boolean {
    return this.isOnboardingActive;
  }

  /**
   * Load onboarding progress from storage
   */
  private async loadProgress(): Promise<void> {
    try {
      const config = await this.configManager.getConfig();
      if (config.onboardingProgress) {
        this.progress = {
          ...this.progress,
          ...config.onboardingProgress,
          startedAt: new Date(config.onboardingProgress.startedAt),
          completedAt: config.onboardingProgress.completedAt 
            ? new Date(config.onboardingProgress.completedAt) 
            : undefined
        };
      }

      if (config.tutorialProgress) {
        this.tutorialProgress = {
          ...this.tutorialProgress,
          ...config.tutorialProgress
        };
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
    }
  }

  /**
   * Save onboarding progress to storage
   */
  private async saveProgress(): Promise<void> {
    try {
      await this.configManager.updateConfig({
        onboardingProgress: this.progress,
        tutorialProgress: this.tutorialProgress
      });
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
    }
  }

  /**
   * Mark a tutorial as completed
   */
  async markTutorialCompleted(tutorialId: string): Promise<boolean> {
    try {
      if (!this.tutorialProgress.completedTutorials.includes(tutorialId)) {
        this.tutorialProgress.completedTutorials.push(tutorialId);
        await this.saveProgress();
        this.emit('tutorialCompleted', tutorialId);
      }
      return true;
    } catch (error) {
      console.error('Failed to mark tutorial as completed:', error);
      return false;
    }
  }

  /**
   * Update tutorial preferences
   */
  async updateTutorialPreferences(preferences: Partial<TutorialProgress['tutorialPreferences']>): Promise<boolean> {
    try {
      this.tutorialProgress.tutorialPreferences = {
        ...this.tutorialProgress.tutorialPreferences,
        ...preferences
      };
      await this.saveProgress();
      this.emit('tutorialPreferencesUpdated', this.tutorialProgress.tutorialPreferences);
      return true;
    } catch (error) {
      console.error('Failed to update tutorial preferences:', error);
      return false;
    }
  }

  /**
   * Get tutorial progress
   */
  getTutorialProgress(): TutorialProgress {
    return { ...this.tutorialProgress };
  }

  /**
   * Reset onboarding progress (for testing or re-onboarding)
   */
  async resetOnboarding(): Promise<boolean> {
    try {
      this.progress = {
        currentStep: 0,
        totalSteps: this.onboardingSteps.length,
        completedSteps: [],
        skippedSteps: [],
        startedAt: new Date()
      };

      this.onboardingSteps.forEach(step => {
        step.completed = false;
      });

      await this.configManager.updateConfig({
        onboardingCompleted: false,
        onboardingProgress: this.progress
      });

      this.isOnboardingActive = false;
      this.emit('onboardingReset');

      return true;
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
      return false;
    }
  }

  /**
   * Show tutorial for specific feature
   */
  async showTutorial(tutorialId: string): Promise<boolean> {
    try {
      this.tutorialProgress.currentTutorial = tutorialId;
      await this.saveProgress();
      this.emit('tutorialStarted', tutorialId);
      return true;
    } catch (error) {
      console.error('Failed to show tutorial:', error);
      return false;
    }
  }

  /**
   * Hide current tutorial
   */
  async hideTutorial(): Promise<boolean> {
    try {
      this.tutorialProgress.currentTutorial = undefined;
      await this.saveProgress();
      this.emit('tutorialHidden');
      return true;
    } catch (error) {
      console.error('Failed to hide tutorial:', error);
      return false;
    }
  }

  /**
   * Get recommended next tutorial based on user progress
   */
  getRecommendedTutorial(): string | null {
    const completed = this.tutorialProgress.completedTutorials;
    
    // Recommend getting started if no tutorials completed
    if (completed.length === 0) {
      return 'getting-started';
    }

    // Recommend AI features after getting started
    if (completed.includes('getting-started') && !completed.includes('ai-features')) {
      return 'ai-features';
    }

    // Recommend accessibility features if user has accessibility preferences
    if (!completed.includes('accessibility-features')) {
      return 'accessibility-features';
    }

    // Recommend advanced features for experienced users
    if (completed.length >= 2 && !completed.includes('advanced-writing')) {
      return 'advanced-writing';
    }

    return null;
  }

  /**
   * Create onboarding window (if needed for standalone onboarding)
   */
  async createOnboardingWindow(): Promise<BrowserWindow | null> {
    try {
      if (this.onboardingWindow && !this.onboardingWindow.isDestroyed()) {
        this.onboardingWindow.focus();
        return this.onboardingWindow;
      }

      this.onboardingWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        center: true,
        resizable: true,
        maximizable: false,
        fullscreenable: false,
        title: 'AI Creative Assistant - Setup',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../preload.js')
        }
      });

      // Load onboarding page
      await this.onboardingWindow.loadFile(path.join(__dirname, '../../renderer/onboarding.html'));

      this.onboardingWindow.on('closed', () => {
        this.onboardingWindow = undefined;
      });

      return this.onboardingWindow;
    } catch (error) {
      console.error('Failed to create onboarding window:', error);
      return null;
    }
  }

  /**
   * Close onboarding window
   */
  closeOnboardingWindow(): void {
    if (this.onboardingWindow && !this.onboardingWindow.isDestroyed()) {
      this.onboardingWindow.close();
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      // Save final progress
      await this.saveProgress();

      // Close onboarding window
      this.closeOnboardingWindow();

      // Remove all listeners
      this.removeAllListeners();

      // Remove IPC handlers
      ipcMain.removeHandler('onboarding:isRequired');
      ipcMain.removeHandler('onboarding:getProgress');
      ipcMain.removeHandler('onboarding:start');
      ipcMain.removeHandler('onboarding:complete');
      ipcMain.removeHandler('onboarding:skipStep');
      ipcMain.removeHandler('onboarding:saveUserSettings');
      ipcMain.removeHandler('tutorial:getCompleted');
      ipcMain.removeHandler('tutorial:markCompleted');
      ipcMain.removeHandler('tutorial:getPreferences');
      ipcMain.removeHandler('tutorial:updatePreferences');

    } catch (error) {
      console.error('Failed to cleanup onboarding manager:', error);
    }
  }
}

export default OnboardingManager;