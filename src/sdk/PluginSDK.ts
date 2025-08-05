/**
 * AI Creative Assistant Plugin SDK
 * 
 * This SDK provides the tools and interfaces needed to create plugins
 * for the AI Creative Assistant application.
 */

import { EventEmitter } from 'events';

// Re-export types from the main application
export { Story, Scene, Character } from '../shared/types/Story';
export { 
  PluginManifest, 
  PluginPermission, 
  PluginCategory, 
  PluginContext, 
  PluginAPI 
} from '../main/plugin/PluginManager';

/**
 * Base class for all plugins
 */
export abstract class BasePlugin extends EventEmitter {
  protected context: PluginContext;
  protected api: PluginAPI;
  protected config: any = {};
  protected isActive = false;

  constructor(context: PluginContext) {
    super();
    this.context = context;
    this.api = context.api;
    this.loadConfig();
  }

  /**
   * Plugin lifecycle methods
   */
  abstract activate(): Promise<void>;
  abstract deactivate(): Promise<void>;
  
  async cleanup(): Promise<void> {
    // Default cleanup implementation
    this.removeAllListeners();
  }

  /**
   * Configuration management
   */
  protected async loadConfig(): Promise<void> {
    this.config = this.api.config.getAll();
  }

  protected async saveConfig(): Promise<void> {
    for (const [key, value] of Object.entries(this.config)) {
      await this.api.config.set(key, value);
    }
  }

  protected getConfig<T>(key: string, defaultValue?: T): T {
    return this.api.config.get(key, defaultValue);
  }

  protected async setConfig(key: string, value: any): Promise<void> {
    this.config[key] = value;
    await this.api.config.set(key, value);
  }

  /**
   * Logging utilities
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    this.api.utils.log(level, message, ...args);
  }

  protected debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  protected info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  protected warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  protected error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * UI utilities
   */
  protected showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.api.ui.showNotification(message, type);
  }

  protected async showDialog(options: DialogOptions): Promise<any> {
    return this.api.ui.showDialog(options);
  }

  protected registerCommand(id: string, handler: CommandHandler): void {
    this.api.ui.registerCommand(id, handler);
  }

  protected registerMenuItem(menu: MenuItem): void {
    this.api.ui.registerMenuItem(menu);
  }

  protected async createPanel(options: PanelOptions): Promise<string> {
    return this.api.ui.createPanel(options);
  }

  protected updatePanel(id: string, content: any): void {
    this.api.ui.updatePanel(id, content);
  }

  /**
   * Data access utilities
   */
  protected async getStory(id: string) {
    return this.api.data.getStory(id);
  }

  protected async saveStory(story: any) {
    return this.api.data.saveStory(story);
  }

  protected async deleteStory(id: string) {
    return this.api.data.deleteStory(id);
  }

  protected async listStories() {
    return this.api.data.listStories();
  }

  protected async searchStories(query: string) {
    return this.api.data.searchStories(query);
  }

  /**
   * AI utilities
   */
  protected async generateText(prompt: string, options?: any): Promise<string> {
    return this.api.ai.generateText(prompt, options);
  }

  protected async analyzeStory(story: any) {
    return this.api.ai.analyzeStory(story);
  }

  protected async analyzeScene(scene: any) {
    return this.api.ai.analyzeScene(scene);
  }

  protected async analyzeCharacter(character: any) {
    return this.api.ai.analyzeCharacter(character);
  }

  protected async generateSuggestions(context: any) {
    return this.api.ai.generateSuggestions(context);
  }

  /**
   * File system utilities
   */
  protected async readFile(path: string): Promise<string> {
    return this.api.fs.readFile(path);
  }

  protected async writeFile(path: string, content: string): Promise<void> {
    return this.api.fs.writeFile(path, content);
  }

  protected async fileExists(path: string): Promise<boolean> {
    return this.api.fs.exists(path);
  }

  protected async createDirectory(path: string): Promise<void> {
    return this.api.fs.mkdir(path);
  }

  protected async listDirectory(path: string): Promise<string[]> {
    return this.api.fs.readdir(path);
  }

  /**
   * Event utilities
   */
  protected onEvent(event: string, handler: Function): void {
    this.api.events.on(event, handler);
  }

  protected offEvent(event: string, handler: Function): void {
    this.api.events.off(event, handler);
  }

  protected emitEvent(event: string, ...args: any[]): void {
    this.api.events.emit(event, ...args);
  }

  protected onceEvent(event: string, handler: Function): void {
    this.api.events.once(event, handler);
  }

  /**
   * Utility methods
   */
  protected hash(data: string): string {
    return this.api.utils.hash(data);
  }

  protected encrypt(data: string, key: string): string {
    return this.api.utils.encrypt(data, key);
  }

  protected decrypt(data: string, key: string): string {
    return this.api.utils.decrypt(data, key);
  }

  protected validateSchema(data: any, schema: any): boolean {
    return this.api.utils.validateSchema(data, schema);
  }
}

/**
 * Specialized plugin types
 */

/**
 * Writing Assistant Plugin
 * For plugins that provide writing assistance and suggestions
 */
export abstract class WritingAssistantPlugin extends BasePlugin {
  abstract provideSuggestions(context: WritingContext): Promise<WritingSuggestion[]>;
  abstract enhanceText(text: string, options?: TextEnhancementOptions): Promise<string>;
  
  protected async registerAsWritingAssistant(): Promise<void> {
    this.registerCommand('provide-suggestions', this.provideSuggestions.bind(this));
    this.registerCommand('enhance-text', this.enhanceText.bind(this));
  }
}

/**
 * Analysis Plugin
 * For plugins that analyze stories, scenes, or characters
 */
export abstract class AnalysisPlugin extends BasePlugin {
  abstract analyzeContent(content: AnalysisContent): Promise<AnalysisResult>;
  abstract getAnalysisTypes(): string[];
  
  protected async registerAsAnalyzer(): Promise<void> {
    this.registerCommand('analyze-content', this.analyzeContent.bind(this));
    this.registerCommand('get-analysis-types', this.getAnalysisTypes.bind(this));
  }
}

/**
 * Export Plugin
 * For plugins that export stories to different formats
 */
export abstract class ExportPlugin extends BasePlugin {
  abstract exportStory(story: any, options: ExportOptions): Promise<ExportResult>;
  abstract getSupportedFormats(): ExportFormat[];
  
  protected async registerAsExporter(): Promise<void> {
    this.registerCommand('export-story', this.exportStory.bind(this));
    this.registerCommand('get-supported-formats', this.getSupportedFormats.bind(this));
  }
}

/**
 * Import Plugin
 * For plugins that import stories from different sources
 */
export abstract class ImportPlugin extends BasePlugin {
  abstract importStory(source: ImportSource, options: ImportOptions): Promise<any>;
  abstract getSupportedSources(): ImportSource[];
  
  protected async registerAsImporter(): Promise<void> {
    this.registerCommand('import-story', this.importStory.bind(this));
    this.registerCommand('get-supported-sources', this.getSupportedSources.bind(this));
  }
}

/**
 * Collaboration Plugin
 * For plugins that enable collaboration features
 */
export abstract class CollaborationPlugin extends BasePlugin {
  abstract startCollaboration(options: CollaborationOptions): Promise<CollaborationSession>;
  abstract joinCollaboration(sessionId: string): Promise<void>;
  abstract leaveCollaboration(): Promise<void>;
  
  protected async registerAsCollaborationProvider(): Promise<void> {
    this.registerCommand('start-collaboration', this.startCollaboration.bind(this));
    this.registerCommand('join-collaboration', this.joinCollaboration.bind(this));
    this.registerCommand('leave-collaboration', this.leaveCollaboration.bind(this));
  }
}

/**
 * Type definitions for plugin development
 */

export interface DialogOptions {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'question';
  buttons?: string[];
  defaultButton?: number;
  cancelButton?: number;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  accelerator?: string;
  submenu?: MenuItem[];
  click?: () => void;
}

export interface PanelOptions {
  title: string;
  content: string | React.ComponentType;
  width?: number;
  height?: number;
  resizable?: boolean;
  position?: 'left' | 'right' | 'bottom' | 'center';
}

export interface CommandHandler {
  (...args: any[]): any;
}

export interface WritingContext {
  currentText: string;
  cursorPosition: number;
  selectedText?: string;
  scene?: any;
  story?: any;
  character?: any;
}

export interface WritingSuggestion {
  id: string;
  type: 'completion' | 'enhancement' | 'correction' | 'alternative';
  text: string;
  description: string;
  confidence: number;
  position?: number;
  length?: number;
}

export interface TextEnhancementOptions {
  type: 'grammar' | 'style' | 'clarity' | 'tone';
  strength: 'light' | 'medium' | 'strong';
  preserveStyle?: boolean;
}

export interface AnalysisContent {
  type: 'story' | 'scene' | 'character' | 'text';
  content: any;
  options?: any;
}

export interface AnalysisResult {
  type: string;
  score: number;
  insights: AnalysisInsight[];
  suggestions: WritingSuggestion[];
  metadata: any;
}

export interface AnalysisInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  data: any;
}

export interface ExportOptions {
  format: string;
  destination: string;
  includeMetadata?: boolean;
  customOptions?: any;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata?: any;
}

export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  description: string;
  options?: ExportFormatOption[];
}

export interface ExportFormatOption {
  id: string;
  name: string;
  type: 'boolean' | 'string' | 'number' | 'select';
  defaultValue: any;
  options?: string[];
}

export interface ImportSource {
  id: string;
  name: string;
  description: string;
  supportedFormats: string[];
}

export interface ImportOptions {
  source: string;
  format?: string;
  customOptions?: any;
}

export interface CollaborationOptions {
  type: 'realtime' | 'async';
  permissions: CollaborationPermission[];
  maxParticipants?: number;
}

export interface CollaborationSession {
  id: string;
  participants: CollaborationParticipant[];
  permissions: CollaborationPermission[];
  createdAt: Date;
}

export interface CollaborationParticipant {
  id: string;
  name: string;
  role: string;
  permissions: CollaborationPermission[];
  isOnline: boolean;
}

export interface CollaborationPermission {
  action: string;
  resource: string;
  allowed: boolean;
}

/**
 * Plugin development utilities
 */

export class PluginBuilder {
  private manifest: Partial<PluginManifest> = {};
  private pluginClass?: typeof BasePlugin;

  setId(id: string): this {
    this.manifest.id = id;
    return this;
  }

  setName(name: string): this {
    this.manifest.name = name;
    return this;
  }

  setVersion(version: string): this {
    this.manifest.version = version;
    return this;
  }

  setDescription(description: string): this {
    this.manifest.description = description;
    return this;
  }

  setAuthor(author: string): this {
    this.manifest.author = author;
    return this;
  }

  setHomepage(homepage: string): this {
    this.manifest.homepage = homepage;
    return this;
  }

  setLicense(license: string): this {
    this.manifest.license = license;
    return this;
  }

  setMain(main: string): this {
    this.manifest.main = main;
    return this;
  }

  addPermission(permission: PluginPermission): this {
    if (!this.manifest.permissions) {
      this.manifest.permissions = [];
    }
    this.manifest.permissions.push(permission);
    return this;
  }

  addCategory(category: PluginCategory): this {
    if (!this.manifest.categories) {
      this.manifest.categories = [];
    }
    this.manifest.categories.push(category);
    return this;
  }

  setEngineVersion(version: string): this {
    this.manifest.engines = {
      'ai-creative-assistant': version
    };
    return this;
  }

  setPluginClass(pluginClass: typeof BasePlugin): this {
    this.pluginClass = pluginClass;
    return this;
  }

  build(): { manifest: PluginManifest; pluginClass: typeof BasePlugin } {
    if (!this.manifest.id || !this.manifest.name || !this.manifest.version) {
      throw new Error('Plugin must have id, name, and version');
    }

    if (!this.pluginClass) {
      throw new Error('Plugin class must be set');
    }

    return {
      manifest: this.manifest as PluginManifest,
      pluginClass: this.pluginClass
    };
  }
}

/**
 * Plugin testing utilities
 */

export class PluginTester {
  private plugin: BasePlugin;
  private mockContext: PluginContext;

  constructor(PluginClass: typeof BasePlugin, manifest: PluginManifest) {
    this.mockContext = this.createMockContext(manifest);
    this.plugin = new PluginClass(this.mockContext);
  }

  async testActivation(): Promise<boolean> {
    try {
      await this.plugin.activate();
      return true;
    } catch (error) {
      console.error('Plugin activation failed:', error);
      return false;
    }
  }

  async testDeactivation(): Promise<boolean> {
    try {
      await this.plugin.deactivate();
      return true;
    } catch (error) {
      console.error('Plugin deactivation failed:', error);
      return false;
    }
  }

  async testCleanup(): Promise<boolean> {
    try {
      await this.plugin.cleanup();
      return true;
    } catch (error) {
      console.error('Plugin cleanup failed:', error);
      return false;
    }
  }

  private createMockContext(manifest: PluginManifest): PluginContext {
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      dataPath: '/mock/data',
      configPath: '/mock/config',
      permissions: manifest.permissions,
      api: this.createMockAPI()
    };
  }

  private createMockAPI(): PluginAPI {
    return {
      ai: {
        generateText: async () => 'Mock generated text',
        analyzeStory: async () => ({}),
        analyzeScene: async () => ({}),
        analyzeCharacter: async () => ({}),
        generateSuggestions: async () => []
      },
      data: {
        getStory: async () => null,
        saveStory: async () => {},
        deleteStory: async () => {},
        listStories: async () => [],
        searchStories: async () => []
      },
      ui: {
        showNotification: () => {},
        showDialog: async () => ({}),
        registerCommand: () => {},
        registerMenuItem: () => {},
        createPanel: async () => 'mock-panel-id',
        updatePanel: () => {}
      },
      fs: {
        readFile: async () => 'Mock file content',
        writeFile: async () => {},
        exists: async () => true,
        mkdir: async () => {},
        readdir: async () => []
      },
      config: {
        get: () => undefined,
        set: async () => {},
        delete: async () => {},
        getAll: () => ({})
      },
      events: {
        on: () => {},
        off: () => {},
        emit: () => {},
        once: () => {}
      },
      utils: {
        log: () => {},
        hash: () => 'mock-hash',
        encrypt: () => 'mock-encrypted',
        decrypt: () => 'mock-decrypted',
        validateSchema: () => true
      }
    };
  }
}

/**
 * Plugin development helpers
 */

export function createPlugin(manifest: PluginManifest, pluginClass: typeof BasePlugin) {
  return { manifest, pluginClass };
}

export function definePermission(
  type: PluginPermission['type'],
  scope: string[],
  description: string
): PluginPermission {
  return { type, scope, description };
}

export function createManifest(options: {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  permissions: PluginPermission[];
  categories?: PluginCategory[];
  homepage?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
}): PluginManifest {
  return {
    engines: { 'ai-creative-assistant': '^1.0.0' },
    categories: [],
    ...options
  };
}

// Export commonly used permission definitions
export const CommonPermissions = {
  AI_GENERATE: definePermission('ai', ['generate'], 'Generate text using AI'),
  AI_ANALYZE: definePermission('ai', ['analyze'], 'Analyze content using AI'),
  DATA_READ: definePermission('database', ['read'], 'Read story data'),
  DATA_WRITE: definePermission('database', ['write'], 'Write story data'),
  UI_NOTIFY: definePermission('ui', ['notify'], 'Show notifications'),
  UI_DIALOG: definePermission('ui', ['dialog'], 'Show dialogs'),
  UI_COMMANDS: definePermission('ui', ['commands'], 'Register commands'),
  UI_MENU: definePermission('ui', ['menu'], 'Add menu items'),
  FS_READ: definePermission('filesystem', ['read'], 'Read files'),
  FS_WRITE: definePermission('filesystem', ['write'], 'Write files'),
  NETWORK_HTTP: definePermission('network', ['http'], 'Make HTTP requests'),
  NETWORK_HTTPS: definePermission('network', ['https'], 'Make HTTPS requests')
};

export default {
  BasePlugin,
  WritingAssistantPlugin,
  AnalysisPlugin,
  ExportPlugin,
  ImportPlugin,
  CollaborationPlugin,
  PluginBuilder,
  PluginTester,
  createPlugin,
  definePermission,
  createManifest,
  CommonPermissions
};