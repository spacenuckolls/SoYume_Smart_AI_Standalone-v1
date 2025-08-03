import Store from 'electron-store';
import { ProviderConfig } from '../../shared/types/AI';

export interface UserPreferences {
  accessibility: AccessibilitySettings;
  aiProviders: ProviderPreference[];
  interface: InterfaceSettings;
  privacy: PrivacySettings;
  workflow: WorkflowSettings;
}

export interface AccessibilitySettings {
  screenReader: boolean;
  textToSpeech: TTSSettings;
  dyslexiaSupport: boolean;
  focusMode: FocusMode;
  keyboardNavigation: boolean;
  customLayout: LayoutConfig;
  highContrast: boolean;
  fontSize: number;
  lineSpacing: number;
}

export interface TTSSettings {
  enabled: boolean;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface FocusMode {
  enabled: boolean;
  hideDistractions: boolean;
  dimBackground: boolean;
  highlightCurrentSection: boolean;
}

export interface LayoutConfig {
  theme: 'light' | 'dark' | 'auto';
  colorScheme: string;
  panelLayout: 'default' | 'minimal' | 'custom';
  customPanels: PanelConfig[];
}

export interface PanelConfig {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
}

export interface ProviderPreference {
  name: string;
  type: 'cowriter' | 'local' | 'cloud';
  config: ProviderConfig;
  enabled: boolean;
  priority: number;
  taskPreferences: Record<string, boolean>; // Which tasks to use this provider for
}

export interface InterfaceSettings {
  language: string;
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  showWordCount: boolean;
  showReadingTime: boolean;
  enableSpellCheck: boolean;
  enableGrammarCheck: boolean;
}

export interface PrivacySettings {
  allowCloudAI: boolean;
  allowTelemetry: boolean;
  allowCrashReports: boolean;
  dataRetentionDays: number;
  encryptLocalData: boolean;
}

export interface WorkflowSettings {
  defaultStoryStructure: string;
  autoGenerateOutlines: boolean;
  enableRealTimeAnalysis: boolean;
  showWritingTips: boolean;
  enableFocusMode: boolean;
}

export class ConfigManager {
  private store: Store<UserPreferences>;
  private defaultConfig: UserPreferences;

  constructor() {
    this.defaultConfig = this.getDefaultConfig();
    
    this.store = new Store<UserPreferences>({
      name: 'soyume-config',
      defaults: this.defaultConfig,
      schema: {
        accessibility: {
          type: 'object',
          properties: {
            screenReader: { type: 'boolean' },
            textToSpeech: { type: 'object' },
            dyslexiaSupport: { type: 'boolean' },
            focusMode: { type: 'object' },
            keyboardNavigation: { type: 'boolean' },
            customLayout: { type: 'object' },
            highContrast: { type: 'boolean' },
            fontSize: { type: 'number', minimum: 8, maximum: 32 },
            lineSpacing: { type: 'number', minimum: 1, maximum: 3 }
          }
        },
        aiProviders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['cowriter', 'local', 'cloud'] },
              config: { type: 'object' },
              enabled: { type: 'boolean' },
              priority: { type: 'number' },
              taskPreferences: { type: 'object' }
            }
          }
        },
        interface: {
          type: 'object',
          properties: {
            language: { type: 'string' },
            autoSave: { type: 'boolean' },
            autoSaveInterval: { type: 'number', minimum: 10, maximum: 600 },
            showWordCount: { type: 'boolean' },
            showReadingTime: { type: 'boolean' },
            enableSpellCheck: { type: 'boolean' },
            enableGrammarCheck: { type: 'boolean' }
          }
        },
        privacy: {
          type: 'object',
          properties: {
            allowCloudAI: { type: 'boolean' },
            allowTelemetry: { type: 'boolean' },
            allowCrashReports: { type: 'boolean' },
            dataRetentionDays: { type: 'number', minimum: 1, maximum: 365 },
            encryptLocalData: { type: 'boolean' }
          }
        },
        workflow: {
          type: 'object',
          properties: {
            defaultStoryStructure: { type: 'string' },
            autoGenerateOutlines: { type: 'boolean' },
            enableRealTimeAnalysis: { type: 'boolean' },
            showWritingTips: { type: 'boolean' },
            enableFocusMode: { type: 'boolean' }
          }
        }
      }
    });
  }

  async initialize(): Promise<void> {
    // Migrate old config if needed
    await this.migrateConfig();
    
    // Validate current config
    this.validateConfig();
    
    console.log('Configuration manager initialized');
  }

  private getDefaultConfig(): UserPreferences {
    return {
      accessibility: {
        screenReader: false,
        textToSpeech: {
          enabled: false,
          voice: 'default',
          rate: 1.0,
          pitch: 1.0,
          volume: 0.8
        },
        dyslexiaSupport: false,
        focusMode: {
          enabled: false,
          hideDistractions: true,
          dimBackground: true,
          highlightCurrentSection: true
        },
        keyboardNavigation: true,
        customLayout: {
          theme: 'auto',
          colorScheme: 'default',
          panelLayout: 'default',
          customPanels: []
        },
        highContrast: false,
        fontSize: 14,
        lineSpacing: 1.5
      },
      aiProviders: [
        {
          name: 'SoYume Co-writer',
          type: 'cowriter',
          config: {
            modelName: 'soyume-cowriter-v1',
            localPath: './models/soyume-cowriter',
            temperature: 0.7,
            maxTokens: 2048
          },
          enabled: true,
          priority: 10,
          taskPreferences: {
            outline: true,
            character_analysis: true,
            scene_structure: true,
            story_analysis: true,
            plot_hole_detection: true,
            pacing_analysis: true,
            consistency_check: true,
            manuscript_analysis: true
          }
        }
      ],
      interface: {
        language: 'en',
        autoSave: true,
        autoSaveInterval: 30,
        showWordCount: true,
        showReadingTime: true,
        enableSpellCheck: true,
        enableGrammarCheck: false
      },
      privacy: {
        allowCloudAI: false,
        allowTelemetry: false,
        allowCrashReports: true,
        dataRetentionDays: 90,
        encryptLocalData: true
      },
      workflow: {
        defaultStoryStructure: 'save-the-cat',
        autoGenerateOutlines: false,
        enableRealTimeAnalysis: true,
        showWritingTips: true,
        enableFocusMode: false
      }
    };
  }

  // Get configuration values
  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.store.get(key);
  }

  getAll(): UserPreferences {
    return this.store.store;
  }

  // Set configuration values
  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.store.set(key, value);
  }

  setMultiple(values: Partial<UserPreferences>): void {
    for (const [key, value] of Object.entries(values)) {
      this.store.set(key as keyof UserPreferences, value);
    }
  }

  // AI Provider management
  getAIProviders(): ProviderPreference[] {
    return this.get('aiProviders');
  }

  addAIProvider(provider: ProviderPreference): void {
    const providers = this.getAIProviders();
    providers.push(provider);
    this.set('aiProviders', providers);
  }

  updateAIProvider(name: string, updates: Partial<ProviderPreference>): void {
    const providers = this.getAIProviders();
    const index = providers.findIndex(p => p.name === name);
    
    if (index !== -1) {
      providers[index] = { ...providers[index], ...updates };
      this.set('aiProviders', providers);
    }
  }

  removeAIProvider(name: string): void {
    const providers = this.getAIProviders().filter(p => p.name !== name);
    this.set('aiProviders', providers);
  }

  getEnabledProviders(): ProviderPreference[] {
    return this.getAIProviders().filter(p => p.enabled);
  }

  getProviderForTask(taskType: string): ProviderPreference | null {
    const providers = this.getEnabledProviders()
      .filter(p => p.taskPreferences[taskType])
      .sort((a, b) => b.priority - a.priority);
    
    return providers[0] || null;
  }

  // Accessibility helpers
  getAccessibilitySettings(): AccessibilitySettings {
    return this.get('accessibility');
  }

  updateAccessibilitySettings(updates: Partial<AccessibilitySettings>): void {
    const current = this.getAccessibilitySettings();
    this.set('accessibility', { ...current, ...updates });
  }

  isAccessibilityFeatureEnabled(feature: keyof AccessibilitySettings): boolean {
    const settings = this.getAccessibilitySettings();
    return Boolean(settings[feature]);
  }

  // Privacy helpers
  getPrivacySettings(): PrivacySettings {
    return this.get('privacy');
  }

  isCloudAIAllowed(): boolean {
    return this.getPrivacySettings().allowCloudAI;
  }

  isTelemetryAllowed(): boolean {
    return this.getPrivacySettings().allowTelemetry;
  }

  // Interface helpers
  getInterfaceSettings(): InterfaceSettings {
    return this.get('interface');
  }

  getTheme(): 'light' | 'dark' | 'auto' {
    return this.getAccessibilitySettings().customLayout.theme;
  }

  getFontSize(): number {
    return this.getAccessibilitySettings().fontSize;
  }

  // Workflow helpers
  getWorkflowSettings(): WorkflowSettings {
    return this.get('workflow');
  }

  getDefaultStoryStructure(): string {
    return this.getWorkflowSettings().defaultStoryStructure;
  }

  // Configuration validation
  private validateConfig(): void {
    const config = this.getAll();
    
    // Validate AI providers
    if (!config.aiProviders || config.aiProviders.length === 0) {
      console.warn('No AI providers configured, adding default Co-writer');
      this.set('aiProviders', this.defaultConfig.aiProviders);
    }

    // Validate accessibility settings
    const accessibility = config.accessibility;
    if (accessibility.fontSize < 8 || accessibility.fontSize > 32) {
      console.warn('Invalid font size, resetting to default');
      this.updateAccessibilitySettings({ fontSize: 14 });
    }

    if (accessibility.lineSpacing < 1 || accessibility.lineSpacing > 3) {
      console.warn('Invalid line spacing, resetting to default');
      this.updateAccessibilitySettings({ lineSpacing: 1.5 });
    }
  }

  // Configuration migration
  private async migrateConfig(): Promise<void> {
    const version = this.store.get('configVersion' as any, 0);
    
    if (version < 1) {
      // Migration from version 0 to 1
      console.log('Migrating configuration to version 1');
      
      // Add any new default settings
      const currentConfig = this.getAll();
      const mergedConfig = this.mergeWithDefaults(currentConfig, this.defaultConfig);
      
      for (const [key, value] of Object.entries(mergedConfig)) {
        this.set(key as keyof UserPreferences, value);
      }
      
      this.store.set('configVersion' as any, 1);
    }
  }

  private mergeWithDefaults(current: any, defaults: any): any {
    const result = { ...current };
    
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in result)) {
        result[key] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.mergeWithDefaults(result[key], value);
      }
    }
    
    return result;
  }

  // Export/Import configuration
  exportConfig(): UserPreferences {
    return this.getAll();
  }

  importConfig(config: Partial<UserPreferences>): void {
    // Validate imported config
    const validatedConfig = this.mergeWithDefaults(config, this.defaultConfig);
    
    for (const [key, value] of Object.entries(validatedConfig)) {
      this.set(key as keyof UserPreferences, value);
    }
  }

  // Reset configuration
  resetToDefaults(): void {
    this.store.clear();
    for (const [key, value] of Object.entries(this.defaultConfig)) {
      this.set(key as keyof UserPreferences, value);
    }
  }

  resetSection<K extends keyof UserPreferences>(section: K): void {
    this.set(section, this.defaultConfig[section]);
  }
}