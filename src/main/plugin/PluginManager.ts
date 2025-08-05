import { EventEmitter } from 'events';
import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AIEngine } from '../ai/AIEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { Story, Scene, Character } from '../../shared/types/Story';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  main: string;
  permissions: PluginPermission[];
  dependencies?: Record<string, string>;
  engines: {
    'ai-creative-assistant': string;
  };
  keywords?: string[];
  categories?: PluginCategory[];
}

export interface PluginPermission {
  type: 'ai' | 'database' | 'filesystem' | 'network' | 'ui' | 'system';
  scope: string[];
  description: string;
}

export type PluginCategory = 'writing' | 'analysis' | 'export' | 'collaboration' | 'accessibility' | 'utility';

export interface PluginContext {
  id: string;
  name: string;
  version: string;
  dataPath: string;
  configPath: string;
  permissions: PluginPermission[];
  api: PluginAPI;
}

export interface PluginAPI {
  // AI Services
  ai: {
    generateText: (prompt: string, options?: any) => Promise<string>;
    analyzeStory: (story: Story) => Promise<any>;
    analyzeScene: (scene: Scene) => Promise<any>;
    analyzeCharacter: (character: Character) => Promise<any>;
    generateSuggestions: (context: any) => Promise<any[]>;
  };
  
  // Data Services
  data: {
    getStory: (id: string) => Promise<Story | null>;
    saveStory: (story: Story) => Promise<void>;
    deleteStory: (id: string) => Promise<void>;
    listStories: () => Promise<Story[]>;
    searchStories: (query: string) => Promise<Story[]>;
  };
  
  // UI Services
  ui: {
    showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    showDialog: (options: any) => Promise<any>;
    registerCommand: (id: string, handler: Function) => void;
    registerMenuItem: (menu: any) => void;
    createPanel: (options: any) => Promise<string>;
    updatePanel: (id: string, content: any) => void;
  };
  
  // File System Services
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
  };
  
  // Configuration Services
  config: {
    get: (key: string, defaultValue?: any) => any;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    getAll: () => Record<string, any>;
  };
  
  // Event Services
  events: {
    on: (event: string, handler: Function) => void;
    off: (event: string, handler: Function) => void;
    emit: (event: string, ...args: any[]) => void;
    once: (event: string, handler: Function) => void;
  };
  
  // Utility Services
  utils: {
    log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => void;
    hash: (data: string) => string;
    encrypt: (data: string, key: string) => string;
    decrypt: (data: string, key: string) => string;
    validateSchema: (data: any, schema: any) => boolean;
  };
}

export interface Plugin {
  manifest: PluginManifest;
  context: PluginContext;
  instance: any;
  isActive: boolean;
  isLoaded: boolean;
  loadTime?: Date;
  errorCount: number;
  lastError?: Error;
}

export interface PluginLoadOptions {
  autoActivate?: boolean;
  validatePermissions?: boolean;
  sandboxed?: boolean;
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private pluginPaths: string[] = [];
  private aiEngine: AIEngine;
  private dbManager: DatabaseManager;
  private configManager: ConfigManager;
  private isInitialized = false;
  private securityPolicy: PluginSecurityPolicy;

  constructor(
    aiEngine: AIEngine,
    dbManager: DatabaseManager,
    configManager: ConfigManager
  ) {
    super();
    this.aiEngine = aiEngine;
    this.dbManager = dbManager;
    this.configManager = configManager;
    this.securityPolicy = new PluginSecurityPolicy();
    
    this.setupIpcHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set up plugin directories
      const userDataPath = app.getPath('userData');
      const pluginsPath = path.join(userDataPath, 'plugins');
      const builtinPluginsPath = path.join(__dirname, '../../plugins');
      
      this.pluginPaths = [pluginsPath, builtinPluginsPath];
      
      // Ensure plugin directories exist
      for (const pluginPath of this.pluginPaths) {
        try {
          await fs.mkdir(pluginPath, { recursive: true });
        } catch (error) {
          // Directory might already exist
        }
      }
      
      // Load plugin configurations
      await this.loadPluginConfigurations();
      
      // Discover and load plugins
      await this.discoverPlugins();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize plugin manager:', error);
      throw error;
    }
  }

  async loadPlugin(pluginPath: string, options: PluginLoadOptions = {}): Promise<Plugin> {
    try {
      // Read and validate manifest
      const manifestPath = path.join(pluginPath, 'package.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);
      
      // Validate manifest
      this.validateManifest(manifest);
      
      // Check if plugin already loaded
      if (this.plugins.has(manifest.id)) {
        throw new Error(`Plugin ${manifest.id} is already loaded`);
      }
      
      // Validate permissions
      if (options.validatePermissions !== false) {
        await this.validatePermissions(manifest);
      }
      
      // Create plugin context
      const context = await this.createPluginContext(manifest, pluginPath);
      
      // Load plugin module
      const mainPath = path.join(pluginPath, manifest.main);
      const PluginClass = require(mainPath);
      
      // Create plugin instance
      const instance = new PluginClass(context);
      
      // Create plugin object
      const plugin: Plugin = {
        manifest,
        context,
        instance,
        isActive: false,
        isLoaded: true,
        loadTime: new Date(),
        errorCount: 0
      };
      
      // Store plugin
      this.plugins.set(manifest.id, plugin);
      
      // Auto-activate if requested
      if (options.autoActivate !== false) {
        await this.activatePlugin(manifest.id);
      }
      
      this.emit('pluginLoaded', plugin);
      return plugin;
      
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    try {
      // Deactivate if active
      if (plugin.isActive) {
        await this.deactivatePlugin(pluginId);
      }
      
      // Call plugin cleanup if available
      if (plugin.instance && typeof plugin.instance.cleanup === 'function') {
        await plugin.instance.cleanup();
      }
      
      // Remove from registry
      this.plugins.delete(pluginId);
      
      this.emit('pluginUnloaded', plugin);
      
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      plugin.errorCount++;
      plugin.lastError = error as Error;
      throw error;
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    if (plugin.isActive) {
      return; // Already active
    }
    
    try {
      // Call plugin activate method if available
      if (plugin.instance && typeof plugin.instance.activate === 'function') {
        await plugin.instance.activate();
      }
      
      plugin.isActive = true;
      this.emit('pluginActivated', plugin);
      
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginId}:`, error);
      plugin.errorCount++;
      plugin.lastError = error as Error;
      throw error;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    if (!plugin.isActive) {
      return; // Already inactive
    }
    
    try {
      // Call plugin deactivate method if available
      if (plugin.instance && typeof plugin.instance.deactivate === 'function') {
        await plugin.instance.deactivate();
      }
      
      plugin.isActive = false;
      this.emit('pluginDeactivated', plugin);
      
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error);
      plugin.errorCount++;
      plugin.lastError = error as Error;
      throw error;
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): Plugin[] {
    return this.getAllPlugins().filter(plugin => plugin.isActive);
  }

  async installPlugin(pluginPackage: string | Buffer): Promise<Plugin> {
    // Implementation for installing plugins from packages
    // This would handle .zip files, npm packages, etc.
    throw new Error('Plugin installation not yet implemented');
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    // Implementation for uninstalling plugins
    // This would remove files and clean up
    throw new Error('Plugin uninstallation not yet implemented');
  }

  private async discoverPlugins(): Promise<void> {
    for (const pluginPath of this.pluginPaths) {
      try {
        const entries = await fs.readdir(pluginPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(pluginPath, entry.name);
            const manifestPath = path.join(fullPath, 'package.json');
            
            try {
              await fs.access(manifestPath);
              await this.loadPlugin(fullPath, { autoActivate: false });
            } catch (error) {
              console.warn(`Skipping invalid plugin directory: ${fullPath}`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan plugin directory: ${pluginPath}`, error);
      }
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const required = ['id', 'name', 'version', 'main', 'permissions', 'engines'];
    
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Plugin manifest missing required field: ${field}`);
      }
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Plugin version must follow semantic versioning');
    }
    
    // Validate engine compatibility
    const requiredEngine = manifest.engines['ai-creative-assistant'];
    if (!this.isEngineCompatible(requiredEngine)) {
      throw new Error(`Plugin requires AI Creative Assistant ${requiredEngine}, but current version is incompatible`);
    }
  }

  private async validatePermissions(manifest: PluginManifest): Promise<void> {
    for (const permission of manifest.permissions) {
      if (!this.securityPolicy.isPermissionAllowed(permission)) {
        throw new Error(`Plugin permission not allowed: ${permission.type}:${permission.scope.join(',')}`);
      }
    }
  }

  private async createPluginContext(manifest: PluginManifest, pluginPath: string): Promise<PluginContext> {
    const userDataPath = app.getPath('userData');
    const dataPath = path.join(userDataPath, 'plugins', manifest.id, 'data');
    const configPath = path.join(userDataPath, 'plugins', manifest.id, 'config');
    
    // Ensure directories exist
    await fs.mkdir(dataPath, { recursive: true });
    await fs.mkdir(configPath, { recursive: true });
    
    // Create API instance
    const api = this.createPluginAPI(manifest);
    
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      dataPath,
      configPath,
      permissions: manifest.permissions,
      api
    };
  }

  private createPluginAPI(manifest: PluginManifest): PluginAPI {
    const hasPermission = (type: string, scope?: string) => {
      return manifest.permissions.some(p => 
        p.type === type && (!scope || p.scope.includes(scope))
      );
    };

    return {
      ai: {
        generateText: async (prompt: string, options?: any) => {
          if (!hasPermission('ai', 'generate')) {
            throw new Error('Plugin does not have permission to generate text');
          }
          return this.aiEngine.generateText(prompt, options);
        },
        
        analyzeStory: async (story: Story) => {
          if (!hasPermission('ai', 'analyze')) {
            throw new Error('Plugin does not have permission to analyze stories');
          }
          return this.aiEngine.analyzeStory(story);
        },
        
        analyzeScene: async (scene: Scene) => {
          if (!hasPermission('ai', 'analyze')) {
            throw new Error('Plugin does not have permission to analyze scenes');
          }
          return this.aiEngine.analyzeScene(scene);
        },
        
        analyzeCharacter: async (character: Character) => {
          if (!hasPermission('ai', 'analyze')) {
            throw new Error('Plugin does not have permission to analyze characters');
          }
          return this.aiEngine.analyzeCharacter(character);
        },
        
        generateSuggestions: async (context: any) => {
          if (!hasPermission('ai', 'suggest')) {
            throw new Error('Plugin does not have permission to generate suggestions');
          }
          return this.aiEngine.generateSuggestions(context);
        }
      },
      
      data: {
        getStory: async (id: string) => {
          if (!hasPermission('database', 'read')) {
            throw new Error('Plugin does not have permission to read stories');
          }
          return this.dbManager.getStory(id);
        },
        
        saveStory: async (story: Story) => {
          if (!hasPermission('database', 'write')) {
            throw new Error('Plugin does not have permission to save stories');
          }
          return this.dbManager.saveStory(story);
        },
        
        deleteStory: async (id: string) => {
          if (!hasPermission('database', 'delete')) {
            throw new Error('Plugin does not have permission to delete stories');
          }
          return this.dbManager.deleteStory(id);
        },
        
        listStories: async () => {
          if (!hasPermission('database', 'read')) {
            throw new Error('Plugin does not have permission to list stories');
          }
          return this.dbManager.getAllStories();
        },
        
        searchStories: async (query: string) => {
          if (!hasPermission('database', 'read')) {
            throw new Error('Plugin does not have permission to search stories');
          }
          return this.dbManager.searchStories(query);
        }
      },
      
      ui: {
        showNotification: (message: string, type = 'info') => {
          if (!hasPermission('ui', 'notify')) {
            throw new Error('Plugin does not have permission to show notifications');
          }
          this.emit('showNotification', { message, type, pluginId: manifest.id });
        },
        
        showDialog: async (options: any) => {
          if (!hasPermission('ui', 'dialog')) {
            throw new Error('Plugin does not have permission to show dialogs');
          }
          return new Promise((resolve) => {
            this.emit('showDialog', { options, pluginId: manifest.id, resolve });
          });
        },
        
        registerCommand: (id: string, handler: Function) => {
          if (!hasPermission('ui', 'commands')) {
            throw new Error('Plugin does not have permission to register commands');
          }
          this.emit('registerCommand', { id: `${manifest.id}.${id}`, handler, pluginId: manifest.id });
        },
        
        registerMenuItem: (menu: any) => {
          if (!hasPermission('ui', 'menu')) {
            throw new Error('Plugin does not have permission to register menu items');
          }
          this.emit('registerMenuItem', { menu, pluginId: manifest.id });
        },
        
        createPanel: async (options: any) => {
          if (!hasPermission('ui', 'panels')) {
            throw new Error('Plugin does not have permission to create panels');
          }
          return new Promise((resolve) => {
            const panelId = `${manifest.id}.${Date.now()}`;
            this.emit('createPanel', { id: panelId, options, pluginId: manifest.id, resolve });
          });
        },
        
        updatePanel: (id: string, content: any) => {
          if (!hasPermission('ui', 'panels')) {
            throw new Error('Plugin does not have permission to update panels');
          }
          this.emit('updatePanel', { id, content, pluginId: manifest.id });
        }
      },
      
      fs: {
        readFile: async (filePath: string) => {
          if (!hasPermission('filesystem', 'read')) {
            throw new Error('Plugin does not have permission to read files');
          }
          // Validate path is within allowed scope
          this.validateFilePath(filePath, manifest);
          return fs.readFile(filePath, 'utf-8');
        },
        
        writeFile: async (filePath: string, content: string) => {
          if (!hasPermission('filesystem', 'write')) {
            throw new Error('Plugin does not have permission to write files');
          }
          this.validateFilePath(filePath, manifest);
          return fs.writeFile(filePath, content, 'utf-8');
        },
        
        exists: async (filePath: string) => {
          if (!hasPermission('filesystem', 'read')) {
            throw new Error('Plugin does not have permission to check file existence');
          }
          this.validateFilePath(filePath, manifest);
          try {
            await fs.access(filePath);
            return true;
          } catch {
            return false;
          }
        },
        
        mkdir: async (dirPath: string) => {
          if (!hasPermission('filesystem', 'write')) {
            throw new Error('Plugin does not have permission to create directories');
          }
          this.validateFilePath(dirPath, manifest);
          return fs.mkdir(dirPath, { recursive: true });
        },
        
        readdir: async (dirPath: string) => {
          if (!hasPermission('filesystem', 'read')) {
            throw new Error('Plugin does not have permission to read directories');
          }
          this.validateFilePath(dirPath, manifest);
          return fs.readdir(dirPath);
        }
      },
      
      config: {
        get: (key: string, defaultValue?: any) => {
          return this.configManager.get(`plugins.${manifest.id}.${key}`, defaultValue);
        },
        
        set: async (key: string, value: any) => {
          return this.configManager.set(`plugins.${manifest.id}.${key}`, value);
        },
        
        delete: async (key: string) => {
          return this.configManager.delete(`plugins.${manifest.id}.${key}`);
        },
        
        getAll: () => {
          return this.configManager.get(`plugins.${manifest.id}`, {});
        }
      },
      
      events: {
        on: (event: string, handler: Function) => {
          this.on(`plugin.${manifest.id}.${event}`, handler);
        },
        
        off: (event: string, handler: Function) => {
          this.off(`plugin.${manifest.id}.${event}`, handler);
        },
        
        emit: (event: string, ...args: any[]) => {
          this.emit(`plugin.${manifest.id}.${event}`, ...args);
        },
        
        once: (event: string, handler: Function) => {
          this.once(`plugin.${manifest.id}.${event}`, handler);
        }
      },
      
      utils: {
        log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
          console[level](`[Plugin:${manifest.id}] ${message}`, ...args);
        },
        
        hash: (data: string) => {
          const crypto = require('crypto');
          return crypto.createHash('sha256').update(data).digest('hex');
        },
        
        encrypt: (data: string, key: string) => {
          const crypto = require('crypto');
          const cipher = crypto.createCipher('aes-256-cbc', key);
          let encrypted = cipher.update(data, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          return encrypted;
        },
        
        decrypt: (data: string, key: string) => {
          const crypto = require('crypto');
          const decipher = crypto.createDecipher('aes-256-cbc', key);
          let decrypted = decipher.update(data, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        },
        
        validateSchema: (data: any, schema: any) => {
          // Simple schema validation - could use ajv or similar
          return true; // Placeholder
        }
      }
    };
  }

  private validateFilePath(filePath: string, manifest: PluginManifest): void {
    const allowedPaths = [
      path.join(app.getPath('userData'), 'plugins', manifest.id),
      app.getPath('temp')
    ];
    
    const resolvedPath = path.resolve(filePath);
    const isAllowed = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(path.resolve(allowedPath))
    );
    
    if (!isAllowed) {
      throw new Error(`Plugin does not have permission to access path: ${filePath}`);
    }
  }

  private isEngineCompatible(requiredVersion: string): boolean {
    // Simple version compatibility check
    // In a real implementation, this would use semver
    return true; // Placeholder
  }

  private async loadPluginConfigurations(): Promise<void> {
    // Load plugin-specific configurations
    // This would read from config files, user preferences, etc.
  }

  private setupIpcHandlers(): void {
    // Set up IPC handlers for renderer process communication
    ipcMain.handle('plugin:list', () => {
      return this.getAllPlugins().map(plugin => ({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        isActive: plugin.isActive,
        isLoaded: plugin.isLoaded,
        errorCount: plugin.errorCount
      }));
    });
    
    ipcMain.handle('plugin:activate', async (event, pluginId: string) => {
      return this.activatePlugin(pluginId);
    });
    
    ipcMain.handle('plugin:deactivate', async (event, pluginId: string) => {
      return this.deactivatePlugin(pluginId);
    });
    
    ipcMain.handle('plugin:install', async (event, pluginPackage: string) => {
      return this.installPlugin(pluginPackage);
    });
    
    ipcMain.handle('plugin:uninstall', async (event, pluginId: string) => {
      return this.uninstallPlugin(pluginId);
    });
  }
}

class PluginSecurityPolicy {
  private allowedPermissions: Set<string> = new Set([
    'ai:generate',
    'ai:analyze',
    'ai:suggest',
    'database:read',
    'database:write',
    'database:delete',
    'ui:notify',
    'ui:dialog',
    'ui:commands',
    'ui:menu',
    'ui:panels',
    'filesystem:read',
    'filesystem:write',
    'network:http',
    'network:https'
  ]);

  isPermissionAllowed(permission: PluginPermission): boolean {
    return permission.scope.every(scope => 
      this.allowedPermissions.has(`${permission.type}:${scope}`)
    );
  }
}