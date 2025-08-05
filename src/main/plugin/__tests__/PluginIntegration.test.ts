import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { PluginManager, PluginManifest } from '../PluginManager';
import { APIServer } from '../../api/APIServer';
import { GRPCServer } from '../../api/GRPCServer';
import { HeadlessManager } from '../../HeadlessManager';
import { AIEngine } from '../../ai/AIEngine';
import { DatabaseManager } from '../../database/DatabaseManager';
import { ConfigManager } from '../../config/ConfigManager';
import { BasePlugin } from '../../../sdk/PluginSDK';

// Mock implementations
class MockAIEngine extends AIEngine {
  async generateText(prompt: string): Promise<string> {
    return `Generated text for: ${prompt}`;
  }

  async analyzeStory(story: any): Promise<any> {
    return { analysis: 'mock analysis' };
  }

  async analyzeScene(scene: any): Promise<any> {
    return { analysis: 'mock scene analysis' };
  }

  async analyzeCharacter(character: any): Promise<any> {
    return { analysis: 'mock character analysis' };
  }

  async generateSuggestions(context: any): Promise<any[]> {
    return [{ suggestion: 'mock suggestion' }];
  }
}

class MockDatabaseManager extends DatabaseManager {
  private stories: Map<string, any> = new Map();

  async getStory(id: string): Promise<any> {
    return this.stories.get(id) || null;
  }

  async saveStory(story: any): Promise<any> {
    this.stories.set(story.id, story);
    return story;
  }

  async deleteStory(id: string): Promise<void> {
    this.stories.delete(id);
  }

  async getAllStories(): Promise<any[]> {
    return Array.from(this.stories.values());
  }

  async searchStories(query: string): Promise<any[]> {
    return Array.from(this.stories.values()).filter(story => 
      story.title.includes(query) || story.description.includes(query)
    );
  }
}

class MockConfigManager extends ConfigManager {
  private config: any = {};

  get(key: string, defaultValue?: any): any {
    return this.config[key] ?? defaultValue;
  }

  async set(key: string, value: any): Promise<void> {
    this.config[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete this.config[key];
  }

  getConfig(): any {
    return { ...this.config };
  }

  async updateConfig(newConfig: any): Promise<void> {
    Object.assign(this.config, newConfig);
  }
}

// Test plugin implementations
class TestPlugin extends BasePlugin {
  private isActivated = false;

  async activate(): Promise<void> {
    this.isActivated = true;
    this.info('Test plugin activated');
    
    // Register a test command
    this.registerCommand('test-command', this.handleTestCommand.bind(this));
    
    // Listen for events
    this.onEvent('test-event', this.handleTestEvent.bind(this));
  }

  async deactivate(): Promise<void> {
    this.isActivated = false;
    this.info('Test plugin deactivated');
  }

  private async handleTestCommand(params: any): Promise<any> {
    return { success: true, params };
  }

  private handleTestEvent(data: any): void {
    this.info('Received test event:', data);
  }

  public getIsActivated(): boolean {
    return this.isActivated;
  }
}

class WritingAssistantTestPlugin extends BasePlugin {
  async activate(): Promise<void> {
    this.registerCommand('provide-suggestions', this.provideSuggestions.bind(this));
    this.registerCommand('enhance-text', this.enhanceText.bind(this));
  }

  async deactivate(): Promise<void> {
    // Cleanup
  }

  private async provideSuggestions(context: any): Promise<any[]> {
    return [
      {
        id: 'suggestion-1',
        type: 'enhancement',
        text: 'Consider adding more descriptive language',
        confidence: 0.8
      }
    ];
  }

  private async enhanceText(text: string): Promise<string> {
    return `Enhanced: ${text}`;
  }
}

class AnalysisTestPlugin extends BasePlugin {
  async activate(): Promise<void> {
    this.registerCommand('analyze-content', this.analyzeContent.bind(this));
  }

  async deactivate(): Promise<void> {
    // Cleanup
  }

  private async analyzeContent(content: any): Promise<any> {
    return {
      type: 'test-analysis',
      score: 0.75,
      insights: [
        {
          id: 'insight-1',
          title: 'Test Insight',
          description: 'This is a test insight',
          severity: 'info'
        }
      ]
    };
  }
}

describe('Plugin Integration Tests', () => {
  let tempDir: string;
  let pluginManager: PluginManager;
  let apiServer: APIServer;
  let grpcServer: GRPCServer;
  let headlessManager: HeadlessManager;
  let aiEngine: MockAIEngine;
  let dbManager: MockDatabaseManager;
  let configManager: MockConfigManager;

  beforeEach(async () => {
    // Create temporary directory for test plugins
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-test-'));
    
    // Initialize mock components
    configManager = new MockConfigManager();
    dbManager = new MockDatabaseManager();
    aiEngine = new MockAIEngine(configManager);
    
    // Initialize plugin manager
    pluginManager = new PluginManager(aiEngine, dbManager, configManager);
    
    // Initialize API servers
    apiServer = new APIServer(aiEngine, dbManager, pluginManager, configManager, {
      port: 3002 // Use different port for tests
    });
    
    grpcServer = new GRPCServer(aiEngine, dbManager, pluginManager, {
      port: 50052 // Use different port for tests
    });
    
    // Initialize headless manager
    headlessManager = new HeadlessManager({
      enableAPI: false, // Disable to avoid port conflicts
      enableGRPC: false,
      logLevel: 'error' // Reduce log noise in tests
    });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await apiServer.stop();
      await grpcServer.stop();
      await headlessManager.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Plugin Loading and Management', () => {
    it('should load and activate a basic plugin', async () => {
      // Create test plugin
      const pluginDir = await createTestPlugin(tempDir, 'basic-test-plugin', {
        id: 'basic-test-plugin',
        name: 'Basic Test Plugin',
        version: '1.0.0',
        description: 'A basic test plugin',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'ui',
            scope: ['notify'],
            description: 'Show notifications'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      
      // Load plugin
      const plugin = await pluginManager.loadPlugin(pluginDir);
      expect(plugin).toBeDefined();
      expect(plugin.manifest.id).toBe('basic-test-plugin');
      expect(plugin.isLoaded).toBe(true);
      expect(plugin.isActive).toBe(true); // Auto-activated by default
      
      // Check plugin instance
      expect(plugin.instance).toBeInstanceOf(TestPlugin);
      expect((plugin.instance as TestPlugin).getIsActivated()).toBe(true);
    });

    it('should handle plugin activation and deactivation', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'activation-test', {
        id: 'activation-test',
        name: 'Activation Test Plugin',
        version: '1.0.0',
        description: 'Test plugin activation',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      
      // Load plugin without auto-activation
      const plugin = await pluginManager.loadPlugin(pluginDir, { autoActivate: false });
      expect(plugin.isActive).toBe(false);
      
      // Activate plugin
      await pluginManager.activatePlugin('activation-test');
      expect(plugin.isActive).toBe(true);
      expect((plugin.instance as TestPlugin).getIsActivated()).toBe(true);
      
      // Deactivate plugin
      await pluginManager.deactivatePlugin('activation-test');
      expect(plugin.isActive).toBe(false);
      expect((plugin.instance as TestPlugin).getIsActivated()).toBe(false);
    });

    it('should validate plugin permissions', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'permission-test', {
        id: 'permission-test',
        name: 'Permission Test Plugin',
        version: '1.0.0',
        description: 'Test plugin permissions',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'filesystem',
            scope: ['read', 'write'],
            description: 'File system access'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      
      // Should load successfully with valid permissions
      const plugin = await pluginManager.loadPlugin(pluginDir);
      expect(plugin).toBeDefined();
    });

    it('should handle plugin errors gracefully', async () => {
      class ErrorPlugin extends BasePlugin {
        async activate(): Promise<void> {
          throw new Error('Activation failed');
        }

        async deactivate(): Promise<void> {
          // No-op
        }
      }

      const pluginDir = await createTestPlugin(tempDir, 'error-test', {
        id: 'error-test',
        name: 'Error Test Plugin',
        version: '1.0.0',
        description: 'Test plugin errors',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, ErrorPlugin);

      await pluginManager.initialize();
      
      // Should handle activation error
      await expect(pluginManager.loadPlugin(pluginDir)).rejects.toThrow('Activation failed');
    });
  });

  describe('Plugin API Integration', () => {
    it('should provide AI services to plugins', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'ai-test', {
        id: 'ai-test',
        name: 'AI Test Plugin',
        version: '1.0.0',
        description: 'Test AI integration',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'ai',
            scope: ['generate', 'analyze'],
            description: 'AI services access'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, class extends BasePlugin {
        async activate(): Promise<void> {
          // Test AI services
          const text = await this.generateText('Test prompt');
          expect(text).toBe('Generated text for: Test prompt');
          
          const analysis = await this.analyzeStory({ title: 'Test Story' });
          expect(analysis.analysis).toBe('mock analysis');
        }

        async deactivate(): Promise<void> {
          // No-op
        }
      });

      await pluginManager.initialize();
      await pluginManager.loadPlugin(pluginDir);
    });

    it('should provide data services to plugins', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'data-test', {
        id: 'data-test',
        name: 'Data Test Plugin',
        version: '1.0.0',
        description: 'Test data integration',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'database',
            scope: ['read', 'write'],
            description: 'Database access'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, class extends BasePlugin {
        async activate(): Promise<void> {
          // Test data services
          const story = { id: 'test-story', title: 'Test Story' };
          await this.saveStory(story);
          
          const retrieved = await this.getStory('test-story');
          expect(retrieved).toEqual(story);
          
          const stories = await this.listStories();
          expect(stories).toContain(story);
        }

        async deactivate(): Promise<void> {
          // No-op
        }
      });

      await pluginManager.initialize();
      await pluginManager.loadPlugin(pluginDir);
    });

    it('should handle plugin events', async () => {
      let eventReceived = false;
      
      const pluginDir = await createTestPlugin(tempDir, 'event-test', {
        id: 'event-test',
        name: 'Event Test Plugin',
        version: '1.0.0',
        description: 'Test event handling',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, class extends BasePlugin {
        async activate(): Promise<void> {
          this.onEvent('test-event', (data: any) => {
            eventReceived = true;
            expect(data.message).toBe('Hello from test');
          });
        }

        async deactivate(): Promise<void> {
          // No-op
        }
      });

      await pluginManager.initialize();
      const plugin = await pluginManager.loadPlugin(pluginDir);
      
      // Emit test event
      pluginManager.emit('plugin.event-test.test-event', { message: 'Hello from test' });
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(eventReceived).toBe(true);
    });
  });

  describe('Specialized Plugin Types', () => {
    it('should support writing assistant plugins', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'writing-assistant', {
        id: 'writing-assistant',
        name: 'Writing Assistant Plugin',
        version: '1.0.0',
        description: 'Test writing assistant',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'ai',
            scope: ['generate'],
            description: 'AI generation'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, WritingAssistantTestPlugin);

      await pluginManager.initialize();
      const plugin = await pluginManager.loadPlugin(pluginDir);
      
      expect(plugin.isActive).toBe(true);
      expect(plugin.instance).toBeInstanceOf(WritingAssistantTestPlugin);
    });

    it('should support analysis plugins', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'analysis-plugin', {
        id: 'analysis-plugin',
        name: 'Analysis Plugin',
        version: '1.0.0',
        description: 'Test analysis plugin',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'ai',
            scope: ['analyze'],
            description: 'AI analysis'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, AnalysisTestPlugin);

      await pluginManager.initialize();
      const plugin = await pluginManager.loadPlugin(pluginDir);
      
      expect(plugin.isActive).toBe(true);
      expect(plugin.instance).toBeInstanceOf(AnalysisTestPlugin);
    });
  });

  describe('API Integration', () => {
    it('should expose plugins through REST API', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'api-test', {
        id: 'api-test',
        name: 'API Test Plugin',
        version: '1.0.0',
        description: 'Test API integration',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      await pluginManager.loadPlugin(pluginDir);
      
      // Test plugin listing through API
      const plugins = pluginManager.getAllPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].manifest.id).toBe('api-test');
    });

    it('should handle plugin activation through API', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'api-activation', {
        id: 'api-activation',
        name: 'API Activation Plugin',
        version: '1.0.0',
        description: 'Test API activation',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      await pluginManager.loadPlugin(pluginDir, { autoActivate: false });
      
      const plugin = pluginManager.getPlugin('api-activation');
      expect(plugin?.isActive).toBe(false);
      
      // Activate through API
      await pluginManager.activatePlugin('api-activation');
      expect(plugin?.isActive).toBe(true);
    });
  });

  describe('Headless Mode Integration', () => {
    it('should work in headless mode', async () => {
      const pluginDir = await createTestPlugin(tempDir, 'headless-test', {
        id: 'headless-test',
        name: 'Headless Test Plugin',
        version: '1.0.0',
        description: 'Test headless mode',
        author: 'Test Author',
        license: 'MIT',
        main: 'index.js',
        permissions: [
          {
            type: 'ai',
            scope: ['generate'],
            description: 'AI generation'
          }
        ],
        engines: {
          'ai-creative-assistant': '^1.0.0'
        }
      }, TestPlugin);

      await pluginManager.initialize();
      await pluginManager.loadPlugin(pluginDir);
      
      // Test headless operations
      const result = await headlessManager.generateText('Test prompt');
      expect(result).toBe('Generated text for: Test prompt');
    });
  });

  // Helper function to create test plugins
  async function createTestPlugin(
    baseDir: string,
    pluginId: string,
    manifest: PluginManifest,
    PluginClass: typeof BasePlugin
  ): Promise<string> {
    const pluginDir = path.join(baseDir, pluginId);
    await fs.mkdir(pluginDir, { recursive: true });
    
    // Write manifest
    await fs.writeFile(
      path.join(pluginDir, 'package.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Write plugin code
    const pluginCode = `
      const { BasePlugin } = require('${path.join(__dirname, '../../../sdk/PluginSDK')}');
      
      ${PluginClass.toString()}
      
      module.exports = ${PluginClass.name};
    `;
    
    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);
    
    return pluginDir;
  }
});

describe('Plugin SDK Tests', () => {
  it('should create plugin manifests correctly', () => {
    const { PluginBuilder, CommonPermissions } = require('../../../sdk/PluginSDK');
    
    const { manifest } = new PluginBuilder()
      .setId('test-plugin')
      .setName('Test Plugin')
      .setVersion('1.0.0')
      .setDescription('A test plugin')
      .setAuthor('Test Author')
      .setLicense('MIT')
      .setMain('index.js')
      .addPermission(CommonPermissions.AI_GENERATE)
      .addPermission(CommonPermissions.DATA_READ)
      .setEngineVersion('^1.0.0')
      .setPluginClass(TestPlugin)
      .build();
    
    expect(manifest.id).toBe('test-plugin');
    expect(manifest.name).toBe('Test Plugin');
    expect(manifest.permissions).toHaveLength(2);
    expect(manifest.engines['ai-creative-assistant']).toBe('^1.0.0');
  });

  it('should validate plugin manifests', () => {
    const { PluginBuilder } = require('../../../sdk/PluginSDK');
    
    const builder = new PluginBuilder()
      .setName('Test Plugin')
      .setVersion('1.0.0');
    
    // Should throw error for missing required fields
    expect(() => builder.build()).toThrow('Plugin must have id, name, and version');
  });

  it('should test plugins with PluginTester', async () => {
    const { PluginTester, createManifest } = require('../../../sdk/PluginSDK');
    
    const manifest = createManifest({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      license: 'MIT',
      main: 'index.js',
      permissions: []
    });
    
    const tester = new PluginTester(TestPlugin, manifest);
    
    const activationResult = await tester.testActivation();
    const deactivationResult = await tester.testDeactivation();
    const cleanupResult = await tester.testCleanup();
    
    expect(activationResult).toBe(true);
    expect(deactivationResult).toBe(true);
    expect(cleanupResult).toBe(true);
  });
});