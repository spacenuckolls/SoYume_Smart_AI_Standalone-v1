import { AIEngine } from '../AIEngine';
import { ConfigManager } from '../../config/ConfigManager';
import { AIProvider, AIRequest, StoryContext, ProviderConfig, AICapability } from '../../../shared/types/AI';

// Mock provider for testing
class MockProvider implements AIProvider {
  readonly id = 'test-provider';
  readonly name = 'test-provider';
  readonly type = 'local' as const;
  readonly version = '1.0.0';
  readonly capabilities: AICapability[] = [{ name: 'text_generation', description: 'Generate text' }];
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

  async initialize(config: ProviderConfig): Promise<void> {}
  async shutdown(): Promise<void> {}
  isAvailable(): boolean { return true; }
  
  getStatus() {
    return {
      state: 'ready' as const,
      uptime: 1000,
      requestCount: 0,
      averageResponseTime: 100
    };
  }

  async healthCheck() {
    return {
      healthy: true,
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

  async updateConfig(config: Partial<ProviderConfig>): Promise<void> {}
  getConfig(): ProviderConfig { return {}; }

  async generateText(prompt: string, context: StoryContext) {
    return {
      content: `Generated: ${prompt}`,
      confidence: 0.8,
      metadata: {
        model: 'test-model',
        provider: this.name,
        tokensUsed: 10,
        responseTime: 100
      }
    };
  }

  async analyzeStory(content: string) {
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
}

// Mock ConfigManager
class MockConfigManager extends ConfigManager {
  async initialize(): Promise<void> {}
  
  getEnabledProviders() {
    return [
      {
        name: 'test-provider',
        type: 'local',
        enabled: true,
        config: {}
      }
    ];
  }

  isCloudAIAllowed(): boolean {
    return true;
  }

  get(key: string): any {
    return undefined;
  }

  set(key: string, value: any): void {}
}

// Mock the provider imports
jest.mock('../providers/MockCowriterProvider', () => ({
  MockCowriterProvider: MockProvider
}));

jest.mock('../providers/MockLocalProvider', () => ({
  MockLocalProvider: MockProvider
}));

jest.mock('../providers/MockCloudProvider', () => ({
  MockCloudProvider: MockProvider
}));

describe('AIEngine', () => {
  let engine: AIEngine;
  let mockConfigManager: MockConfigManager;

  beforeEach(() => {
    mockConfigManager = new MockConfigManager();
    engine = new AIEngine(mockConfigManager);
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await engine.initialize();
      expect(engine).toBeDefined();
    });

    it('should not initialize twice', async () => {
      await engine.initialize();
      await engine.initialize(); // Should not throw
      expect(engine).toBeDefined();
    });

    it('should emit provider-added events during initialization', async () => {
      const addedProviders: AIProvider[] = [];
      engine.on('provider-added', (provider) => {
        addedProviders.push(provider);
      });

      await engine.initialize();
      
      expect(addedProviders.length).toBeGreaterThan(0);
    });
  });

  describe('request routing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should route request through the router', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Write a story',
        context: { characters: [], genre: ['fantasy'], targetAudience: 'young adult' }
      };

      const response = await engine.routeRequest(request);
      
      expect(response.content).toContain('Generated: Write a story');
      expect(response.confidence).toBe(0.8);
    });

    it('should emit request-completed event', async () => {
      let completedRequest: AIRequest | null = null;
      let completedResponse: any = null;
      let usedProvider: AIProvider | null = null;

      engine.on('request-completed', (request, response, provider) => {
        completedRequest = request;
        completedResponse = response;
        usedProvider = provider;
      });

      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await engine.routeRequest(request);
      
      expect(completedRequest).toBe(request);
      expect(completedResponse).toBeDefined();
      expect(usedProvider).toBeDefined();
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should generate text', async () => {
      const context: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'young adult'
      };

      const response = await engine.generateText('Write a story', context);
      
      expect(response.content).toContain('Generated: Write a story');
      expect(response.confidence).toBe(0.8);
    });

    it('should generate text with options', async () => {
      const context: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'young adult'
      };

      const options = {
        preferredProvider: 'test-provider',
        maxTokens: 100
      };

      const response = await engine.generateText('Write a story', context, options);
      
      expect(response.content).toContain('Generated: Write a story');
    });

    it('should analyze story', async () => {
      const analysis = await engine.analyzeStory('Once upon a time...');
      
      expect(analysis.overallScore).toBe(0.8);
      expect(analysis.structure).toBeDefined();
      expect(analysis.characters).toBeDefined();
      expect(analysis.pacing).toBeDefined();
      expect(analysis.consistency).toBeDefined();
    });

    it('should generate character', async () => {
      const traits = {
        name: 'Hero',
        personality: ['brave', 'kind']
      };

      const character = await engine.generateCharacter(traits);
      
      expect(character.id).toBe('test-char');
      expect(character.name).toBe('Test Character');
      expect(character.archetype.primary).toBe('hero');
    });
  });

  describe('provider management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should get available providers', () => {
      const providers = engine.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get all providers', () => {
      const providers = engine.getAllProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get provider by name', () => {
      const provider = engine.getProvider('test-provider');
      expect(provider).toBeDefined();
    });

    it('should return undefined for nonexistent provider', () => {
      const provider = engine.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });

    it('should get providers by type', () => {
      const providers = engine.getProvidersByType('local');
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get providers by capability', () => {
      const providers = engine.getProvidersByCapability('text_generation');
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get provider info', () => {
      const info = engine.getProviderInfo('test-provider');
      expect(info).toBeDefined();
    });

    it('should get all provider info', () => {
      const infos = engine.getAllProviderInfo();
      expect(Array.isArray(infos)).toBe(true);
    });
  });

  describe('router functionality', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should get provider for request', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const provider = await engine.getProviderForRequest(request);
      expect(provider).toBeDefined();
    });

    it('should get request metrics', () => {
      const metrics = engine.getRequestMetrics();
      expect(typeof metrics).toBe('object');
    });

    it('should clear metrics', () => {
      expect(() => engine.clearMetrics()).not.toThrow();
    });

    it('should get routing recommendations', () => {
      const recommendations = engine.getRoutingRecommendations('prose_generation');
      expect(recommendations).toBeDefined();
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should perform health check', async () => {
      const health = await engine.healthCheck();
      expect(typeof health).toBe('object');
    });

    it('should get provider stats', () => {
      const stats = engine.getProviderStats();
      expect(typeof stats).toBe('object');
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', () => {
      expect(() => engine.getAvailableProviders()).toThrow('AI Engine not initialized');
    });

    it('should handle provider loading errors gracefully', async () => {
      // Mock a provider that fails to load
      const failingConfigManager = new MockConfigManager();
      failingConfigManager.getEnabledProviders = () => [
        {
          name: 'failing-provider',
          type: 'unknown' as any, // Invalid type
          enabled: true,
          config: {}
        }
      ];

      const failingEngine = new AIEngine(failingConfigManager);
      
      // Should not throw, but should log error
      await expect(failingEngine.initialize()).resolves.not.toThrow();
      
      await failingEngine.shutdown();
    });
  });

  describe('event handling', () => {
    it('should emit provider-removed events', async () => {
      await engine.initialize();
      
      const removedProviders: string[] = [];
      engine.on('provider-removed', (providerId) => {
        removedProviders.push(providerId);
      });

      // This would require access to the registry to remove a provider
      // For now, we'll just test that the event handler is set up
      expect(engine.listenerCount('provider-removed')).toBe(1);
    });

    it('should emit request-failed events', async () => {
      await engine.initialize();
      
      const failedRequests: AIRequest[] = [];
      engine.on('request-failed', (request) => {
        failedRequests.push(request);
      });

      // This would require mocking a failing request
      // For now, we'll just test that the event handler is set up
      expect(engine.listenerCount('request-failed')).toBe(1);
    });
  });
});