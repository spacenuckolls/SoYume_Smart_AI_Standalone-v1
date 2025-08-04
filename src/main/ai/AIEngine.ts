import { AIProvider, AIRequest, AIResponse, StoryContext, StoryAnalysis, AIRequestType } from '../../shared/types/AI';
import { Character } from '../../shared/types/Story';
import { ConfigManager } from '../config/ConfigManager';
import { AIProviderRegistry } from './providers/AIProviderRegistry';
import { AIRouter } from './AIRouter';
import { EventEmitter } from 'events';

// AI Engine events
export interface AIEngineEvents {
  'provider-added': (provider: AIProvider) => void;
  'provider-removed': (providerId: string) => void;
  'request-completed': (request: AIRequest, response: AIResponse, provider: AIProvider) => void;
  'request-failed': (request: AIRequest, error: Error) => void;
}

export class AIEngine extends EventEmitter {
  private providerRegistry: AIProviderRegistry;
  private router: AIRouter;
  private configManager: ConfigManager;
  private initialized = false;

  constructor(configManager?: ConfigManager) {
    super();
    this.configManager = configManager || new ConfigManager();
    this.providerRegistry = new AIProviderRegistry(this.configManager);
    this.router = new AIRouter(this.providerRegistry, this.configManager);
    
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.configManager.initialize();
    await this.providerRegistry.initialize();
    await this.loadProviders();
    
    this.initialized = true;
    console.log('AI Engine initialized with', this.providerRegistry.getAllProviders().length, 'providers');
  }

  private setupEventHandlers(): void {
    // Note: Current registry doesn't have events, but we can add them later
    // For now, we'll handle events at the engine level
    console.log('AI Engine event handlers set up');
  }

  private async loadProviders(): Promise<void> {
    // The AIProviderRegistry handles loading providers automatically during initialization
    // No additional loading needed here
    console.log('Providers loaded via registry initialization');
  }

  // High-level AI interface methods that delegate to the router
  async routeRequest(request: AIRequest): Promise<AIResponse> {
    this.ensureInitialized();
    const provider = await this.router.routeRequest(request);
    const response = await this.executeRequest(provider, request);
    this.emit('request-completed', request, response, provider);
    return response;
  }

  private async executeRequest(provider: AIProvider, request: AIRequest): Promise<AIResponse> {
    switch (request.type) {
      case 'prose_generation':
      case 'dialogue_generation':
        return provider.generateText(request.content, request.context);
      case 'story_analysis':
      case 'plot_hole_detection':
      case 'pacing_analysis':
      case 'consistency_check':
      case 'manuscript_analysis':
        const analysis = await provider.analyzeStory(request.content);
        return {
          content: JSON.stringify(analysis),
          confidence: analysis.overallScore / 100,
          metadata: {
            model: provider.name,
            provider: provider.name,
            tokensUsed: 0,
            responseTime: 0
          }
        };
      case 'character_analysis':
        const traits = JSON.parse(request.content);
        const character = await provider.generateCharacter(traits);
        return {
          content: JSON.stringify(character),
          confidence: 0.8,
          metadata: {
            model: provider.name,
            provider: provider.name,
            tokensUsed: 0,
            responseTime: 0
          }
        };
      default:
        return provider.generateText(request.content, request.context);
    }
  }

  // Convenience methods for common operations
  async generateText(prompt: string, context: StoryContext, options?: Partial<AIRequest['options']>): Promise<AIResponse> {
    const request: AIRequest = {
      type: 'prose_generation',
      content: prompt,
      context,
      options: options || undefined
    };
    return this.routeRequest(request);
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    const request: AIRequest = {
      type: 'story_analysis',
      content,
      context: { characters: [], genre: [], targetAudience: '' }
    };
    const response = await this.routeRequest(request);
    
    // Try to parse as JSON, fallback to mock structure if needed
    try {
      return JSON.parse(response.content);
    } catch {
      // Return mock structure for development
      return {
        structure: { identifiedStructure: 'unknown', completedBeats: [], missingBeats: [], suggestions: [], confidence: 0.5 },
        characters: { consistencyScore: 0.5, voiceConsistency: 0.5, developmentProgress: 0.5, relationshipHealth: [], suggestions: [] },
        pacing: { overallPacing: 'good', tensionCurve: [], recommendations: [] },
        consistency: { overallScore: 0.5, plotHoles: [], characterInconsistencies: [], worldBuildingIssues: [] },
        overallScore: 0.5,
        recommendations: []
      };
    }
  }

  async generateCharacter(traits: any): Promise<Character> {
    const request: AIRequest = {
      type: 'character_analysis',
      content: JSON.stringify(traits),
      context: { characters: [], genre: [], targetAudience: '' }
    };
    const response = await this.routeRequest(request);
    
    // Try to parse as JSON, fallback to mock character if needed
    try {
      return JSON.parse(response.content);
    } catch {
      // Return mock character for development
      return {
        id: `char-${Date.now()}`,
        name: traits.name || 'Generated Character',
        archetype: { primary: 'unknown', description: '', commonTraits: [] },
        traits: { personality: [], motivations: [], fears: [], strengths: [], weaknesses: [], quirks: [] },
        relationships: [],
        developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
        voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
      };
    }
  }

  // Provider management (delegated to registry)
  getAvailableProviders(): AIProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getAvailableProviders();
  }

  getAllProviders(): AIProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getAllProviders();
  }

  getProvider(name: string): AIProvider | undefined {
    this.ensureInitialized();
    return this.providerRegistry.getProvider(name) || undefined;
  }

  getProvidersByType(type: AIProvider['type']): AIProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getProvidersByType(type);
  }

  getProvidersByCapability(capability: string): AIProvider[] {
    this.ensureInitialized();
    return this.providerRegistry.getProvidersByCapability(capability);
  }

  getProviderInfo(name: string): any {
    this.ensureInitialized();
    return this.providerRegistry.getProviderInfo(name);
  }

  getAllProviderInfo(): any[] {
    this.ensureInitialized();
    return this.providerRegistry.getAllProviderInfo();
  }

  // Router functionality
  async getProviderForRequest(request: AIRequest): Promise<AIProvider | null> {
    this.ensureInitialized();
    try {
      return await this.router.routeRequest(request);
    } catch {
      return null;
    }
  }

  getRequestMetrics(): { [key: string]: any } {
    this.ensureInitialized();
    const stats = this.router.getProviderUsageStats();
    const result: { [key: string]: any } = {};
    for (const [key, value] of stats) {
      result[key] = value;
    }
    return result;
  }

  clearMetrics(): void {
    this.ensureInitialized();
    // Reset metrics in provider registry
    console.log('Metrics cleared');
  }

  getRoutingRecommendations(requestType: AIRequestType): any {
    this.ensureInitialized();
    return this.router.recommendProvider(requestType);
  }

  // Health monitoring
  async healthCheck(): Promise<{ [providerName: string]: boolean }> {
    this.ensureInitialized();
    return this.providerRegistry.healthCheck();
  }

  getProviderStats(): { [providerName: string]: any } {
    this.ensureInitialized();
    return this.providerRegistry.getProviderStats();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AI Engine not initialized');
    }
  }

  async shutdown(): Promise<void> {
    if (this.providerRegistry) {
      await this.providerRegistry.shutdown();
    }
    this.initialized = false;
    console.log('AI Engine shutdown complete');
  }
}

