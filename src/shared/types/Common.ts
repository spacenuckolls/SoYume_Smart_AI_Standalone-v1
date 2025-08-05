/**
 * Common types and interfaces used across the application
 */

// Window API extensions for Electron
declare global {
  interface Window {
    electronAPI: {
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
    };
  }
}

// Common error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AppError;
}

// Event types
export interface AppEvent {
  type: string;
  payload?: any;
  timestamp: Date;
}

// Configuration types
export interface AppConfig {
  version: string;
  environment: 'development' | 'production' | 'test';
  features: {
    [key: string]: boolean;
  };
  settings: {
    [key: string]: any;
  };
}

// User preference types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  accessibility: AccessibilityPreferences;
  ai: AIPreferences;
  editor: EditorPreferences;
  privacy: PrivacyPreferences;
}

export interface AccessibilityPreferences {
  screenReader: boolean;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  keyboardNavigation: boolean;
  voiceCommands: boolean;
}

export interface AIPreferences {
  defaultProvider: string;
  fallbackEnabled: boolean;
  cacheResponses: boolean;
  maxTokens: number;
  temperature: number;
}

export interface EditorPreferences {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  autoSave: boolean;
}

export interface PrivacyPreferences {
  dataCollection: boolean;
  analytics: boolean;
  crashReporting: boolean;
  cloudSync: boolean;
}

// Plugin types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: string[];
  dependencies?: { [key: string]: string };
}

export interface PluginContext {
  api: any;
  config: any;
  logger: any;
}

// Test types
export interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestResult[];
  success: boolean;
  duration: number;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Export empty object to make this a module
export {};