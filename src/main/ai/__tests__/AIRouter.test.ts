import { AIRouter } from '../AIRouter';
import { AIProviderRegistry } from '../providers/AIProviderRegistry';
import { ConfigManager } from '../../config/ConfigManager';
import { AIProvider, AIRequest, AIRequestType, StoryContext } from '../../../shared/types/AI';

// Mock dependencies
jest.mock('../providers/AIProviderRegistry');
jest.mock('../../config/ConfigManager');

// Mock provider for testing
class MockTestProvider implements AIProvider {
  constructor(
    public name: string,
    public type: 'cowriter' | 'local' | 'cloud',
    public priority: number,
    public capabilities: any[] = [],
    private available: boolean = true
  ) {}

  async initialize(config: any): Promise<void> {}

  async generateText(prompt: string, context: StoryContext): Promise<any> {
    return {
      content: `${this.name} response: ${prompt}`,
      confidence: 0.8,
      metadata: {
        model: `${this.name}-model`,
        provider: this.name,
        tokensUsed: 10,
        responseTime: 100
      }
    };
  }

  async analyzeStory(content: string): Promise<any> {
    return {
      structure: { identifiedStructure: 'test', completedBeats: [], missingBeats: [], suggestions: [], confidence: 0.8 },
      characters: { consistencyScore: 0.8, voiceConsistency: 0.8, developmentProgress: 0.8, relationshipHealth: [], suggestions: [] },
      pacing: { overallPacing: 'good', tensionCurve: [], recommendations: [] },
      consistency: { overallScore: 0.8, plotHoles: [], characterInconsistencies: [], worldBuildingIssues: [] },
      overallScore: 0.8,
      recommendations: []
    };
  }

  async generateCharacter(traits: any): Promise<any> {
    return {
      id: 'test-char',
      name: 'Test Character',
      archetype: { primary: 'test', description: '', commonTraits: [] },
      traits: { personality: [], motivations: [], fears: [], strengths: [], weaknesses: [], quirks: [] },
      relationships: [],
      developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
      voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
    };
  }

  isAvailable(): boolean {
    return this.available;
  }

  async shutdown(): Promise<void> {}
}

describe('AIRouter', () => {
  let router: AIRouter;
  let mockRegistry: jest.Mocked<AIProviderRegistry>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  let cowriterProvider: MockTestProvider;
  let localProvider: MockTestProvider;
  let cloudProvider: MockTestProvider;

  beforeEach(() => {
    mockRegistry = new AIProviderRegistry({} as any) as jest.Mocked<AIProviderRegistry>;
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;

    // Create test providers
    cowriterProvider = new MockTestProvider('SoYume Co-writer', 'cowriter', 10, [
      { name: 'outline_generation', description: '', inputTypes: [], outputTypes: [], offline: true },
      { name: 'character_analysis', description: '', inputTypes: [], outputTypes: [], offline: true }
    ]);

    localProvider = new MockTestProvider('Local AI', 'local', 5, [
      { name: 'text_generation', description: '', inputTypes: [], outputTypes: [], offline: true }
    ]);

    cloudProvider = new MockTestProvider('Cloud AI', 'cloud', 3, [
      { name: 'text_generation', description: '', inputTypes: [], outputTypes: [], offline: false },
      { name: 'research', description: '', inputTypes: [], outputTypes: [], offline: false }
    ]);

    // Setup mock registry
    mockRegistry.getAvailableProviders.mockReturnValue([cowriterProvider, localProvider, cloudProvider]);
    mockConfigManager.isCloudAIAllowed.mockReturnValue(true);
    mockConfigManager.getProviderForTask.mockReturnValue(null);

    router = new AIRouter(mockRegistry, mockConfigManager);
  });

  describe('request routing', () => {
    it('should route outline generation to co-writer provider', async () => {
      const request: AIRequest = {
        type: 'outline',
        content: 'Generate an outline for a fantasy story',
        context: { characters: [], genre: ['fantasy'], targetAudience: 'young-adult' }
      };

      const response = await router.routeRequest(request);

      expect(response.content).toContain('SoYume Co-writer response');
      expect(response.metadata.provider).toBe('SoYume Co-writer');
    });

    it('should route prose generation to best available provider', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Write a dramatic scene',
        context: { characters: [], genre: ['drama'], targetAudience: 'adult' }
      };

      const response = await router.routeRequest(request);

      // Should prefer cloud provider for complex generation tasks
      expect(response.content).toContain('Cloud AI response');
    });

    it('should respect offline requirement', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Write a scene',
        context: { characters: [], genre: [], targetAudience: '' },
        options: { requireOffline: true }
      };

      const response = await router.routeRequest(request);

      // Should not use cloud provider when offline is required
      expect(response.content).not.toContain('Cloud AI response');
    });

    it('should respect privacy settings', async () => {
      mockConfigManager.isCloudAIAllowed.mockReturnValue(false);

      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Write a scene',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const response = await router.routeRequest(request);

      // Should not use cloud provider when cloud AI is disabled
      expect(response.content).not.toContain('Cloud AI response');
    });

    it('should use preferred provider when specified', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Write a scene',
        context: { characters: [], genre: [], targetAudience: '' },
        options: { preferredProvider: 'Local AI' }
      };

      const response = await router.routeRequest(request);

      expect(response.content).toContain('Local AI response');
    });

    it('should throw error when no suitable provider available', async () => {
      mockRegistry.getAvailableProviders.mockReturnValue([]);

      const request: AIRequest = {
        type: 'outline',
        content: 'Generate outline',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await expect(router.routeRequest(request)).rejects.toThrow(
        'No suitable AI provider available for request type: outline'
      );
    });
  });

  describe('provider selection', () => {
    it('should select co-writer for core creative tasks', async () => {
      const request: AIRequest = {
        type: 'character_analysis',
        content: 'Analyze character',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const provider = await router.getProviderForRequest(request);

      expect(provider?.name).toBe('SoYume Co-writer');
    });

    it('should consider provider performance history', async () => {
      // Simulate some request history
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      // Make a few requests to build history
      await router.routeRequest(request);
      await router.routeRequest(request);

      const metrics = router.getRequestMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    it('should handle provider unavailability', async () => {
      // Make co-writer unavailable
      cowriterProvider = new MockTestProvider('SoYume Co-writer', 'cowriter', 10, [], false);
      mockRegistry.getAvailableProviders.mockReturnValue([localProvider, cloudProvider]);

      const request: AIRequest = {
        type: 'outline',
        content: 'Generate outline',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const response = await router.routeRequest(request);

      // Should fallback to another provider
      expect(response.content).not.toContain('SoYume Co-writer response');
    });
  });

  describe('routing recommendations', () => {
    it('should provide routing recommendations for request types', () => {
      const recommendations = router.getRoutingRecommendations('outline');

      expect(recommendations).toHaveProperty('recommended');
      expect(recommendations).toHaveProperty('alternatives');
      expect(recommendations).toHaveProperty('reasons');
      expect(recommendations.recommended).toBeInstanceOf(Array);
      expect(recommendations.alternatives).toBeInstanceOf(Array);
      expect(recommendations.reasons).toBeInstanceOf(Array);
    });

    it('should recommend co-writer for creative tasks', () => {
      const recommendations = router.getRoutingRecommendations('character_analysis');

      expect(recommendations.recommended).toContain('SoYume Co-writer');
    });
  });

  describe('metrics and monitoring', () => {
    it('should track request metrics', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test content',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await router.routeRequest(request);

      const metrics = router.getRequestMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    it('should clear metrics', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test content',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await router.routeRequest(request);
      router.clearMetrics();

      const metrics = router.getRequestMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });

    it('should record failed requests', async () => {
      // Mock a provider that throws an error
      const failingProvider = new MockTestProvider('Failing Provider', 'local', 1);
      failingProvider.generateText = jest.fn().mockRejectedValue(new Error('Provider failed'));

      mockRegistry.getAvailableProviders.mockReturnValue([failingProvider]);

      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test content',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await expect(router.routeRequest(request)).rejects.toThrow();

      // Metrics should still be recorded for failed requests
      const metrics = router.getRequestMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });
  });

  describe('context-aware routing', () => {
    it('should consider genre in provider selection', async () => {
      const fantasyRequest: AIRequest = {
        type: 'prose_generation',
        content: 'Write fantasy scene',
        context: { characters: [], genre: ['fantasy'], targetAudience: 'young-adult' }
      };

      const provider = await router.getProviderForRequest(fantasyRequest);

      // Co-writer should get bonus for specialized genres
      expect(provider?.type).toBe('cowriter');
    });

    it('should consider target audience', async () => {
      const yaRequest: AIRequest = {
        type: 'prose_generation',
        content: 'Write YA scene',
        context: { characters: [], genre: [], targetAudience: 'young-adult' }
      };

      const provider = await router.getProviderForRequest(yaRequest);

      // Co-writer should get bonus for YA content
      expect(provider?.type).toBe('cowriter');
    });
  });
});