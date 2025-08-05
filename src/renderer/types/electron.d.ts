/**
 * Electron API type definitions for renderer process
 */

export interface ElectronAPI {
  // Onboarding APIs
  isOnboardingRequired: () => Promise<boolean>;
  getOnboardingProgress: () => Promise<any>;
  startOnboarding: () => Promise<boolean>;
  completeOnboarding: (data: any) => Promise<boolean>;
  skipOnboardingStep: (stepId: string) => Promise<boolean>;
  saveUserSettings: (settings: any) => Promise<boolean>;
  onboardingComplete: () => void;
  
  // Tutorial APIs
  getCompletedTutorials: () => Promise<string[]>;
  markTutorialCompleted: (tutorialId: string) => Promise<boolean>;
  getTutorialPreferences: () => Promise<any>;
  updateTutorialPreferences: (preferences: any) => Promise<boolean>;
  
  // AI Provider APIs
  configureAIProvider: (providerId: string) => Promise<void>;
  
  // General APIs
  getUserSettings: () => Promise<any>;
  updateUserSettings: (settings: any) => Promise<boolean>;
  
  // File system APIs
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  
  // Database APIs
  createStory: (story: any) => Promise<any>;
  getStory: (id: string) => Promise<any>;
  updateStory: (id: string, updates: any) => Promise<any>;
  deleteStory: (id: string) => Promise<boolean>;
  
  createScene: (scene: any) => Promise<any>;
  getScene: (id: string) => Promise<any>;
  updateScene: (id: string, updates: any) => Promise<any>;
  deleteScene: (id: string) => Promise<boolean>;
  
  createCharacter: (character: any) => Promise<any>;
  getCharacter: (id: string) => Promise<any>;
  updateCharacter: (id: string, updates: any) => Promise<any>;
  deleteCharacter: (id: string) => Promise<boolean>;
  
  // AI APIs
  generateText: (prompt: string, options?: any) => Promise<any>;
  analyzeStory: (content: string, options?: any) => Promise<any>;
  
  // System APIs
  getSystemInfo: () => Promise<any>;
  checkForUpdates: () => Promise<any>;
  
  // Event APIs
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  emit: (channel: string, ...args: any[]) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};