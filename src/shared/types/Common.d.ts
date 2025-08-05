/**
 * Common types and interfaces used across the application
 */
declare global {
    interface Window {
        electronAPI: {
            isOnboardingRequired: () => Promise<boolean>;
            getOnboardingProgress: () => Promise<any>;
            startOnboarding: () => Promise<boolean>;
            completeOnboarding: (data: any) => Promise<boolean>;
            skipOnboardingStep: (stepId: string) => Promise<boolean>;
            saveUserSettings: (settings: any) => Promise<boolean>;
            onboardingComplete: () => void;
            getCompletedTutorials: () => Promise<string[]>;
            markTutorialCompleted: (tutorialId: string) => Promise<boolean>;
            getTutorialPreferences: () => Promise<any>;
            updateTutorialPreferences: (preferences: any) => Promise<boolean>;
            configureAIProvider: (providerId: string) => Promise<void>;
            getUserSettings: () => Promise<any>;
            updateUserSettings: (settings: any) => Promise<boolean>;
        };
    }
}
export interface AppError {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: AppError;
}
export interface AppEvent {
    type: string;
    payload?: any;
    timestamp: Date;
}
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
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    permissions: string[];
    dependencies?: {
        [key: string]: string;
    };
}
export interface PluginContext {
    api: any;
    config: any;
    logger: any;
}
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
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export {};
//# sourceMappingURL=Common.d.ts.map