import { AIProviderRegistry } from '../providers/AIProviderRegistry';
import { ConfigManager } from '../../config/ConfigManager';
import { AIProvider, ProviderConfig } from '../../../shared/types/AI';

// Mock ConfigManager
jest.mock('../../config/ConfigManager');

// Mock provider for testing
class MockTestProvider implements AIProvider {
  name = 'Test Provider';
  type: 'local' = 'local';
  capabilities = [
    {
      name: 'test_capability',
      description: 'Test capability',
      inputTypes: ['text'],
      outputTypes: ['text'],
      offline: true
    }
  ];
  priority = 5;
  private initialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.initialized = true;
  }

  async generateText(prompt: string, context: any): Promise<any> {
    return {
      content: `Test response: ${prompt}`,
      confidence: 0.8,
      metadata: {
        model: 'test-model',
        provider: this.name,
        tokensUsed: 10,
        responseTime: 100
      }
    };
  }

  async analyzeStory(content: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async generateCharacter(traits: any): Promise<any> {
    throw new Error('Not implemented');
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}

describe('AIProviderRegistry', () => {
  let registry: AIProviderRegistry;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockConfigManager.getEnabledProviders.mockReturnValue([]);
    registry = new AIProviderRegistry(mockConfigManager);
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully with no providers', async () => {
      await expect(registry.initialize()).resolves.not.toThrow();
    });

    it('should load providers from configuration', async () => {
      const mockProviderConfig = {
        name: 'test-provider',
        type: 'local',
        enabled: true,
        priority: 5,
        taskPreferences: {},
        config: { host: 'localhost', port: 8080 }
      };

      mockConfigManager.getEnabledProviders.mockReturnValue([mockProviderConfig]);

      // Mock the dynamic import
      jest.doMock('../providers/local/GenericLocalProvider', () => ({
        GenericLocalProvider: MockTestProvider
      }));

      await registry.initialize();

      const providers = registry.getAllProviders();
      expect(providers).toHaveLength(1);
    });

    it('should handle provider loading errors gracefully', async () => {
      const mockProviderConfig = {
        name: 'failing-provider',
        type: 'unknown',
        enabled: true,
        priority: 5,
        taskPreferences: {},
        config: {}
      };

      mockConfigManager.getEnabledProviders.mockReturnValue([mockProviderConfig]);

      await expect(registry.initialize()).resolves.not.toThrow();
      expect(registry.getAllProviders()).toHaveLength(0);
    });
  });

  describe('provider management', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
    });

    it('should register a provider successfully', async () => {
      await registry.registerProvider('test', testProvider, {});

      expect(registry.getProvider('test')).toBe(testProvider);
      expect(registry.getAllProviders()).toContain(testProvider);
    });

    it('should unregister a provider successfully', async () => {
      await registry.registerProvider('test', testProvider, {});
      await registry.unregisterProvider('test');

      expect(registry.getProvider('test')).toBeUndefined();
      expect(registry.getAllProviders()).not.toContain(testProvider);
    });

    it('should get providers by type', async () => {
      await registry.registerProvider('test', testProvider, {});

      const localProviders = registry.getProvidersByType('local');
      expect(localProviders).toContain(testProvider);

      const cloudProviders = registry.getProvidersByType('cloud');
      expect(cloudProviders).not.toContain(testProvider);
    });

    it('should get providers by capability', async () => {
      await registry.registerProvider('test', testProvider, {});

      const capableProviders = registry.getProvidersByCapability('test_capability');
      expect(capableProviders).toContain(testProvider);

      const incapableProviders = registry.getProvidersByCapability('nonexistent_capability');
      expect(incapableProviders).not.toContain(testProvider);
    });

    it('should get available providers only', async () => {
      await registry.registerProvider('test', testProvider, {});

      expect(registry.getAvailableProviders()).toContain(testProvider);

      await testProvider.shutdown();
      expect(registry.getAvailableProviders()).not.toContain(testProvider);
    });
  });

  describe('provider information', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
      await registry.registerProvider('test', testProvider, {});
    });

    it('should return provider info', () => {
      const info = registry.getProviderInfo('test');

      expect(info).toEqual({
        name: 'Test Provider',
        type: 'local',
        capabilities: testProvider.capabilities,
        priority: 5,
        available: true
      });
    });

    it('should return null for non-existent provider', () => {
      const info = registry.getProviderInfo('nonexistent');
      expect(info).toBeNull();
    });

    it('should return all provider info', () => {
      const allInfo = registry.getAllProviderInfo();

      expect(allInfo).toHaveLength(1);
      expect(allInfo[0]).toEqual({
        name: 'Test Provider',
        type: 'local',
        capabilities: testProvider.capabilities,
        priority: 5,
        available: true
      });
    });
  });

  describe('health check', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
      await registry.registerProvider('test', testProvider, {});
    });

    it('should perform health check on all providers', async () => {
      const results = await registry.healthCheck();

      expect(results).toEqual({
        test: true
      });
    });

    it('should handle provider health check failures', async () => {
      await testProvider.shutdown();

      const results = await registry.healthCheck();

      expect(results).toEqual({
        test: false
      });
    });
  });

  describe('configuration updates', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
      await registry.registerProvider('test', testProvider, {});
    });

    it('should update provider configuration', async () => {
      const newConfig = { newSetting: 'value' };

      await expect(registry.updateProviderConfig('test', newConfig)).resolves.not.toThrow();
    });

    it('should throw error for non-existent provider', async () => {
      const newConfig = { newSetting: 'value' };

      await expect(registry.updateProviderConfig('nonexistent', newConfig))
        .rejects.toThrow('Provider nonexistent not found');
    });
  });

  describe('statistics', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
      await registry.registerProvider('test', testProvider, {});
    });

    it('should return provider statistics', () => {
      const stats = registry.getProviderStats();

      expect(stats).toEqual({
        test: {
          type: 'local',
          priority: 5,
          capabilities: 1,
          available: true
        }
      });
    });
  });

  describe('shutdown', () => {
    let testProvider: MockTestProvider;

    beforeEach(async () => {
      testProvider = new MockTestProvider();
      await registry.initialize();
      await registry.registerProvider('test', testProvider, {});
    });

    it('should shutdown all providers', async () => {
      await registry.shutdown();

      expect(registry.getAllProviders()).toHaveLength(0);
      expect(testProvider.isAvailable()).toBe(false);
    });
  });
});