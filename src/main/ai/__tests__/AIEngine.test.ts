import { AIEngine } from '../AIEngine';
import { AIProviderRegistry } from '../providers/AIProviderRegistry';
import { AIRouter } from '../AIRouter';
import { ConfigManager } from '../../config/ConfigManager';
import { AIRequest, AIProvider } from '../../../shared/types/AI';

// Mock dependencies
jest.mock('../providers/AIProviderRegistry');
jest.mock('../AIRouter');
jest.mock('../../config/ConfigManager');

describe('AIEngine', () => {
  let aiEngine: AIEngine;
  let mockRegistry: jest.Mocked<AIProviderRegistry>;
  let mockRouter: jest.Mocked<AIRouter>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockRegistry = new AIProviderRegistry(mockConfigManager) as jest.Mocked<AIProviderRegistry>;
    mockRouter = new AIRouter(mockRegistry, mockConfigManager) as jest.Mocked<AIRouter>;

    aiEngine = new AIEngine();
    
    // Replace the private instances with our mocks
    (aiEngine as any).registry = mockRegistry;
    (aiEngine as any).router = mockRouter;
    (aiEngine as any).configManager = mockConfigManager;
  });

  afterEach(async () => {
    if ((aiEngine as any).initialized) {
      await aiEngine.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();

      await aiEngine.initialize();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(mockRegistry.initialize).toHaveBeenCalled();
      expect((aiEngine as any).initialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();

      await aiEngine.initialize();
      await aiEngine.initialize();

      expect(mockConfigManager.initialize).toHaveBeenCalledTimes(1);
      expect(mockRegistry.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockConfigManager.initialize.mockRejectedValue(new Error('Config init failed'));

      await expect(aiEngine.initialize()).rejects.toThrow('Config init failed');
      expect((aiEngine as any).initialized).toBe(false);
    });
  });

  describe('request routing', () => {
    beforeEach(async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      await aiEngine.initialize();
    });

    it('should route requests through the router', async () => {
      const mockResponse = {
        content: 'Test response',
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test prompt',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const response = await aiEngine.routeRequest(request);

      expect(mockRouter.routeRequest).toHaveBeenCalledWith(request);
      expect(response).toEqual(mockResponse);
    });

    it('should throw error when not initialized', async () => {
      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test prompt',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      await expect(aiEngine.routeRequest(request)).rejects.toThrow('AI Engine not initialized');
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      await aiEngine.initialize();
    });

    it('should generate text using router', async () => {
      const mockResponse = {
        content: 'Generated text',
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const response = await aiEngine.generateText('Test prompt', {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'young-adult'
      });

      expect(mockRouter.routeRequest).toHaveBeenCalledWith({
        type: 'prose_generation',
        content: 'Test prompt',
        context: { characters: [], genre: ['fantasy'], targetAudience: 'young-adult' }
      });

      expect(response).toEqual(mockResponse);
    });

    it('should analyze story using router', async () => {
      const mockAnalysis = {
        structure: { identifiedStructure: 'three-act', completedBeats: [], missingBeats: [], suggestions: [], confidence: 0.8 },
        characters: { consistencyScore: 0.8, voiceConsistency: 0.8, developmentProgress: 0.8, relationshipHealth: [], suggestions: [] },
        pacing: { overallPacing: 'good', tensionCurve: [], recommendations: [] },
        consistency: { overallScore: 0.8, plotHoles: [], characterInconsistencies: [], worldBuildingIssues: [] },
        overallScore: 0.8,
        recommendations: []
      };

      const mockResponse = {
        content: JSON.stringify(mockAnalysis),
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const analysis = await aiEngine.analyzeStory('Story content');

      expect(mockRouter.routeRequest).toHaveBeenCalledWith({
        type: 'story_analysis',
        content: 'Story content',
        context: { characters: [], genre: [], targetAudience: '' }
      });

      expect(analysis).toEqual(mockAnalysis);
    });

    it('should handle invalid JSON in story analysis', async () => {
      const mockResponse = {
        content: 'Invalid JSON',
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const analysis = await aiEngine.analyzeStory('Story content');

      // Should return mock structure when JSON parsing fails
      expect(analysis).toHaveProperty('structure');
      expect(analysis).toHaveProperty('characters');
      expect(analysis).toHaveProperty('pacing');
      expect(analysis).toHaveProperty('consistency');
      expect(analysis.overallScore).toBe(0.5);
    });

    it('should generate character using router', async () => {
      const mockCharacter = {
        id: 'test-char',
        name: 'Test Character',
        archetype: { primary: 'hero', description: '', commonTraits: [] },
        traits: { personality: [], motivations: [], fears: [], strengths: [], weaknesses: [], quirks: [] },
        relationships: [],
        developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
        voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
      };

      const mockResponse = {
        content: JSON.stringify(mockCharacter),
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const traits = { name: 'Test Character', personality: ['brave'] };
      const character = await aiEngine.generateCharacter(traits);

      expect(mockRouter.routeRequest).toHaveBeenCalledWith({
        type: 'character_analysis',
        content: JSON.stringify(traits),
        context: { characters: [], genre: [], targetAudience: '' }
      });

      expect(character).toEqual(mockCharacter);
    });

    it('should handle invalid JSON in character generation', async () => {
      const mockResponse = {
        content: 'Invalid JSON',
        confidence: 0.8,
        metadata: {
          model: 'test-model',
          provider: 'test-provider',
          tokensUsed: 10,
          responseTime: 100
        }
      };

      mockRouter.routeRequest.mockResolvedValue(mockResponse);

      const character = await aiEngine.generateCharacter({ name: 'Test' });

      // Should return mock character when JSON parsing fails
      expect(character).toHaveProperty('id');
      expect(character).toHaveProperty('name');
      expect(character.name).toBe('Test');
    });
  });

  describe('provider management', () => {
    beforeEach(async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      await aiEngine.initialize();
    });

    it('should delegate provider management to registry', () => {
      const mockProviders = [
        { name: 'Provider 1', type: 'local' as const, capabilities: [], priority: 5, isAvailable: () => true },
        { name: 'Provider 2', type: 'cloud' as const, capabilities: [], priority: 3, isAvailable: () => true }
      ] as AIProvider[];

      mockRegistry.getAvailableProviders.mockReturnValue(mockProviders);
      mockRegistry.getAllProviders.mockReturnValue(mockProviders);
      mockRegistry.getProvider.mockReturnValue(mockProviders[0]);
      mockRegistry.getProvidersByType.mockReturnValue([mockProviders[0]]);
      mockRegistry.getProvidersByCapability.mockReturnValue([mockProviders[0]]);

      expect(aiEngine.getAvailableProviders()).toEqual(mockProviders);
      expect(aiEngine.getAllProviders()).toEqual(mockProviders);
      expect(aiEngine.getProvider('Provider 1')).toEqual(mockProviders[0]);
      expect(aiEngine.getProvidersByType('local')).toEqual([mockProviders[0]]);
      expect(aiEngine.getProvidersByCapability('test')).toEqual([mockProviders[0]]);

      expect(mockRegistry.getAvailableProviders).toHaveBeenCalled();
      expect(mockRegistry.getAllProviders).toHaveBeenCalled();
      expect(mockRegistry.getProvider).toHaveBeenCalledWith('Provider 1');
      expect(mockRegistry.getProvidersByType).toHaveBeenCalledWith('local');
      expect(mockRegistry.getProvidersByCapability).toHaveBeenCalledWith('test');
    });

    it('should delegate provider info to registry', () => {
      const mockInfo = {
        name: 'Test Provider',
        type: 'local',
        capabilities: [],
        priority: 5,
        available: true
      };

      const mockAllInfo = [mockInfo];

      mockRegistry.getProviderInfo.mockReturnValue(mockInfo);
      mockRegistry.getAllProviderInfo.mockReturnValue(mockAllInfo);

      expect(aiEngine.getProviderInfo('Test Provider')).toEqual(mockInfo);
      expect(aiEngine.getAllProviderInfo()).toEqual(mockAllInfo);

      expect(mockRegistry.getProviderInfo).toHaveBeenCalledWith('Test Provider');
      expect(mockRegistry.getAllProviderInfo).toHaveBeenCalled();
    });
  });

  describe('router functionality', () => {
    beforeEach(async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      await aiEngine.initialize();
    });

    it('should delegate router functionality', async () => {
      const mockProvider = { name: 'Test Provider' } as AIProvider;
      const mockMetrics = { 'provider-task': { totalRequests: 5, successCount: 4, totalResponseTime: 1000 } };
      const mockRecommendations = { recommended: ['Provider 1'], alternatives: ['Provider 2'], reasons: ['Test reason'] };

      mockRouter.getProviderForRequest.mockResolvedValue(mockProvider);
      mockRouter.getRequestMetrics.mockReturnValue(mockMetrics);
      mockRouter.getRoutingRecommendations.mockReturnValue(mockRecommendations);

      const request: AIRequest = {
        type: 'prose_generation',
        content: 'Test',
        context: { characters: [], genre: [], targetAudience: '' }
      };

      const provider = await aiEngine.getProviderForRequest(request);
      const metrics = aiEngine.getRequestMetrics();
      const recommendations = aiEngine.getRoutingRecommendations('prose_generation');

      expect(provider).toEqual(mockProvider);
      expect(metrics).toEqual(mockMetrics);
      expect(recommendations).toEqual(mockRecommendations);

      expect(mockRouter.getProviderForRequest).toHaveBeenCalledWith(request);
      expect(mockRouter.getRequestMetrics).toHaveBeenCalled();
      expect(mockRouter.getRoutingRecommendations).toHaveBeenCalledWith('prose_generation');
    });

    it('should clear metrics', () => {
      aiEngine.clearMetrics();
      expect(mockRouter.clearMetrics).toHaveBeenCalled();
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      await aiEngine.initialize();
    });

    it('should perform health check', async () => {
      const mockHealthResults = { 'Provider 1': true, 'Provider 2': false };
      mockRegistry.healthCheck.mockResolvedValue(mockHealthResults);

      const results = await aiEngine.healthCheck();

      expect(results).toEqual(mockHealthResults);
      expect(mockRegistry.healthCheck).toHaveBeenCalled();
    });

    it('should get provider stats', () => {
      const mockStats = {
        'Provider 1': { type: 'local', priority: 5, capabilities: 2, available: true },
        'Provider 2': { type: 'cloud', priority: 3, capabilities: 1, available: false }
      };

      mockRegistry.getProviderStats.mockReturnValue(mockStats);

      const stats = aiEngine.getProviderStats();

      expect(stats).toEqual(mockStats);
      expect(mockRegistry.getProviderStats).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown registry', async () => {
      mockConfigManager.initialize.mockResolvedValue();
      mockRegistry.initialize.mockResolvedValue();
      mockRegistry.shutdown.mockResolvedValue();

      await aiEngine.initialize();
      await aiEngine.shutdown();

      expect(mockRegistry.shutdown).toHaveBeenCalled();
      expect((aiEngine as any).initialized).toBe(false);
    });

    it('should handle shutdown when registry is not initialized', async () => {
      await expect(aiEngine.shutdown()).resolves.not.toThrow();
    });
  });
});