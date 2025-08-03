import { AIProvider, AIRequest, AIResponse, StoryContext, StoryAnalysis } from '../../shared/types/AI';
import { Story, Character } from '../../shared/types/Story';
import { ConfigManager } from '../config/ConfigManager';
import { AIProviderRegistry } from './providers/AIProviderRegistry';
import { AIRouter } from './AIRouter';

export class AIEngine {
  private registry: AIProviderRegistry;
  private router: AIRouter;
  private configManager: ConfigManager;
  private initialized = false;

  constructor() {
    this.configManager = new ConfigManager();
    this.registry = new AIProviderRegistry(this.configManager);
    this.router = new AIRouter(this.registry, this.configManager);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.configManager.initialize();
    await this.registry.initialize();
    
    this.initialized = true;
    console.log('AI Engine initialized with provider registry and intelligent routing');
  }

  // High-level AI interface methods that delegate to the router
  async routeRequest(request: AIRequest): Promise<AIResponse> {
    this.ensureInitialized();
    return this.router.routeRequest(request);
  }

  // Convenience methods for common operations
  async generateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    const request: AIRequest = {
      type: 'prose_generation',
      content: prompt,
      context
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
        pacing: { overallPacing: 'unknown', tensionCurve: [], recommendations: [] },
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
    return this.registry.getAvailableProviders();
  }

  getAllProviders(): AIProvider[] {
    this.ensureInitialized();
    return this.registry.getAllProviders();
  }

  getProvider(name: string): AIProvider | undefined {
    this.ensureInitialized();
    return this.registry.getProvider(name);
  }

  getProvidersByType(type: AIProvider['type']): AIProvider[] {
    this.ensureInitialized();
    return this.registry.getProvidersByType(type);
  }

  getProvidersByCapability(capability: string): AIProvider[] {
    this.ensureInitialized();
    return this.registry.getProvidersByCapability(capability);
  }

  getProviderInfo(name: string): any {
    this.ensureInitialized();
    return this.registry.getProviderInfo(name);
  }

  getAllProviderInfo(): any[] {
    this.ensureInitialized();
    return this.registry.getAllProviderInfo();
  }

  // Router functionality
  async getProviderForRequest(request: AIRequest): Promise<AIProvider | null> {
    this.ensureInitialized();
    return this.router.getProviderForRequest(request);
  }

  getRequestMetrics(): { [key: string]: any } {
    this.ensureInitialized();
    return this.router.getRequestMetrics();
  }

  clearMetrics(): void {
    this.ensureInitialized();
    this.router.clearMetrics();
  }

  getRoutingRecommendations(requestType: any): any {
    this.ensureInitialized();
    return this.router.getRoutingRecommendations(requestType);
  }

  // Health monitoring
  async healthCheck(): Promise<{ [providerName: string]: boolean }> {
    this.ensureInitialized();
    return this.registry.healthCheck();
  }

  getProviderStats(): { [providerName: string]: any } {
    this.ensureInitialized();
    return this.registry.getProviderStats();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AI Engine not initialized');
    }
  }

  async shutdown(): Promise<void> {
    if (this.registry) {
      await this.registry.shutdown();
    }
    this.initialized = false;
    console.log('AI Engine shutdown complete');
  }
}

