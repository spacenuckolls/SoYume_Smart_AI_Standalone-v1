import { ProviderRegistry, ProviderRegistration, ProviderMetrics } from '../ProviderRegistry';
import { ConfigManager } from '../../config/ConfigManager';
import { AIProvider, ProviderConfig, AICapability } from '../../../shared/types/AI';

// Mock provider for testing
class MockTestProvider implements AIProvider {
  readonly id = 'test-provider';
  readonly name = 'Test Provider';
  readonly type = 'local' as const;
  readonly version = '1.0.0';
  readonly capabilities: AICapability[] = [
    { name: 'text_generation', description: 'Generate text' }
  ];
  readonly priority = 5;
  readonly metadata = {
    description: 'Test provider',
    author: 'Test',
    supportedLanguages: ['en'],
    requirements: {
      internetRequired: false,
      apiKeyRequired: false
    }
  };

  private initialized = false;
  private shouldFail = false;

  async initialize(config: ProviderConfig): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Initialization failed');
    }
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getStatus() {
    return {
      state: this.initialized ? 'ready' as const : 'offline' as const,
      uptime: 1000,
      requestCount: 0,
      averageResponseTime: 100
    };
  }

  async healthCheck() {
    return {
      healthy: this.initialized,
      responseTime: 50
    };
  }

  getUsageStats() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 100,
      totalTokensUsed: 0,
      requestsByType: {},
      lastUsed: new Date()
    };
  }

  async updateConfig(config: Partial<ProviderConfig>): Promise<void> {
    // Mock implementation
  }

  getConfig(): ProviderConfig {
    return {};
  }

  async generateText(prompt: string, context: any) {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    return {
      content: `Generated: ${prompt}`,
      confidence: 0.8,
      metadata: {
        model: this.name,
        provider: this.name,
        tokensUsed: 10,
        responseTime: 100
      }
    };
  }

  async analyzeStory(content: string) {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    return {
      structure: { identifiedStructure: 'three-act', completedBeats: [], missingBeats: [], suggestions: [], confidence: 0.8 },
      characters: { consistencyScore: 0.8, voiceConsistency: 0.8, developmentProgress: 0.8, relationshipHealth: [], suggestions: [] },
      pacing: { overallPacing: 'good', tensionCurve: [], recommendations: [] },
      consistency: { overallScore: 0.8, plotHoles: [], characterInconsistencies: [], worldBuildingIssues: [] },
      overallScore: 0.8,
      recommendations: []
    };
  }

  async generateCharacter(traits: any) {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    return {
      id: 'test-char',
      name: 'Test Character',
      archetype: { primary: 'hero', description: 'Test hero', commonTraits: [] },
      traits: { personality: [], motivations: [], fears: [], strengths: [], weaknesses: [], quirks: [] },
      relationships: [],
      developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
      voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
    };
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }
}

// Mock ConfigManager
class MockConfigManager extends ConfigManager {
  getEnabledProviders() {
    return [];
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let configManager: MockConfigManager;
  let mockProvider: MockTestProvider;

  beforeEach(() => {
    configManager = new MockConfigManager();
    registry = new ProviderRegistry(configManager);
    mockProvider = new MockTestProvider();
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await registry.initialize();
      expect(registry).toBeDefined();
    });
  });

  describe('provider registration', () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it('should register a provider successfully', async () => {
      await registry.registerProvider(mockProvider, {});
      
      const provider = registry.getProvider(mockProvider.name);
      expect(provider).toBe(mockProvider);
    });

    it('should initialize provider during registration', async () => {
      await registry.registerProvider(mockProvider, {});
      
      expect(mockProvider.isAvailable()).toBe(true);
    });

    it('should handle provider initialization failure', async () => {
      mockProvider.setShouldFail(true);
      
      await expect(registry.registerProvider(mockProvider, {}))
        .rejects.toThrow('Initialization failed');
    });

    it('should unregister a provider', async () => {
      await registry.registerProvider(mockProvider, {});
      await registry.unregisterProvider(mockProvider.name);
      
      const provider = registry.getProvider(mockProvider.name);
      expect(provider).toBeNull();
    });
  });

  describe('provider access', () => {
    beforeEach(async () => {
      await registry.initialize();
      await registry.registerProvider(mockProvider, {});
    });

    it('should get available providers', () => {
      const providers = registry.getAvailableProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider);
    });

    it('should get providers by type', () => {
      const providers = registry.getProvidersByType('local');
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider);
    });

    it('should get providers by capability', () => {
      const providers = registry.getProvidersByCapability('text_generation');
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider);
    });

    it('should not return disabled providers', async () => {
      await registry.disableProvider(mockProvider.name);
      
      const provider = registry.getProvider(mockProvider.name);
      expect(provider).toBeNull();
    });
  });

  describe('request execution', () => {
    beforeEach(async () => {
      await registry.initialize();
      await registry.registerProvider(mockProvider, {});
    });

    it('should execute text generation request', async () => {
      const request = {
        type: 'prose_generation' as const,
        content: 'Test prompt',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const response = await registry.executeRequest(mockProvider.name, request);
      
      expect(response.content).toBe('Generated: Test prompt');
      expect(response.confidence).toBe(0.8);
    });

    it('should execute story analysis request', async () => {
      const request = {
        type: 'story_analysis' as const,
        content: 'Test story content',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const response = await registry.executeRequest(mockProvider.name, request);
      
      const analysis = JSON.parse(response.content);
      expect(analysis.overallScore).toBe(0.8);
    });

    it('should update metrics on successful request', async () => {
      const request = {
        type: 'prose_generation' as const,
        content: 'Test prompt',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await registry.executeRequest(mockProvider.name, request);
      
      const metrics = registry.getProviderMetrics(mockProvider.name);
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.successfulRequests).toBe(1);
      expect(metrics?.failedRequests).toBe(0);
    });

    it('should handle request failure', async () => {
      await registry.disableProvider(mockProvider.name);
      
      const request = {
        type: 'prose_generation' as const,
        content: 'Test prompt',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await expect(registry.executeRequest(mockProvider.name, request))
        .rejects.toThrow('Provider disabled');
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await registry.initialize();
      await registry.registerProvider(mockProvider, {});
    });

    it('should perform health check', async () => {
      await registry.checkProviderHealth(mockProvider.name);
      
      const status = registry.getProviderStatus(mockProvider.name);
      expect(status?.healthStatus).toBe('healthy');
    });

    it('should update health status on failure', async () => {
      // Simulate provider becoming unavailable
      await mockProvider.shutdown();
      await registry.checkProviderHealth(mockProvider.name);
      
      const status = registry.getProviderStatus(mockProvider.name);
      expect(status?.healthStatus).toBe('unhealthy');
    });
  });

  describe('provider management', () => {
    beforeEach(async () => {
      await registry.initialize();
      await registry.registerProvider(mockProvider, {});
    });

    it('should enable and disable providers', async () => {
      await registry.disableProvider(mockProvider.name);
      expect(registry.getProvider(mockProvider.name)).toBeNull();
      
      await registry.enableProvider(mockProvider.name);
      expect(registry.getProvider(mockProvider.name)).toBe(mockProvider);
    });

    it('should get provider status', () => {
      const status = registry.getProviderStatus(mockProvider.name);
      expect(status).toBeDefined();
      expect(status?.provider).toBe(mockProvider);
      expect(status?.enabled).toBe(true);
    });

    it('should get provider metrics', () => {
      const metrics = registry.getProviderMetrics(mockProvider.name);
      expect(metrics).toBeDefined();
      expect(metrics?.totalRequests).toBe(0);
    });
  });
});