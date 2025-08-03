import { AIProvider, AIRequest, AIResponse, StoryContext, StoryAnalysis } from '../../shared/types/AI';
import { Story, Character } from '../../shared/types/Story';
import { ConfigManager } from '../config/ConfigManager';

export class AIEngine {
  private providers: Map<string, AIProvider> = new Map();
  private configManager: ConfigManager;
  private initialized = false;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.configManager.initialize();
    await this.loadProviders();
    
    this.initialized = true;
    console.log('AI Engine initialized with', this.providers.size, 'providers');
  }

  private async loadProviders(): Promise<void> {
    const providerConfigs = this.configManager.getEnabledProviders();
    
    for (const config of providerConfigs) {
      try {
        let provider: AIProvider;
        
        switch (config.type) {
          case 'cowriter':
            provider = await this.createCowriterProvider(config);
            break;
          case 'local':
            provider = await this.createLocalProvider(config);
            break;
          case 'cloud':
            provider = await this.createCloudProvider(config);
            break;
          default:
            console.warn(`Unknown provider type: ${config.type}`);
            continue;
        }

        await provider.initialize(config.config);
        this.providers.set(config.name, provider);
        
        console.log(`Loaded AI provider: ${config.name} (${config.type})`);
      } catch (error) {
        console.error(`Failed to load provider ${config.name}:`, error);
      }
    }
  }

  private async createCowriterProvider(config: any): Promise<AIProvider> {
    // For now, create a mock Co-writer provider
    // This will be replaced with the actual trained model in Task 4
    return new MockCowriterProvider(config);
  }

  private async createLocalProvider(config: any): Promise<AIProvider> {
    // Create local AI provider (Ollama, LM Studio, etc.)
    // This will be implemented in Task 6
    return new MockLocalProvider(config);
  }

  private async createCloudProvider(config: any): Promise<AIProvider> {
    // Create cloud AI provider (OpenAI, Anthropic, etc.)
    // This will be implemented in Task 5
    return new MockCloudProvider(config);
  }

  // Main AI interface methods
  async generateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    const provider = this.selectProvider('prose_generation', context);
    if (!provider) {
      throw new Error('No suitable AI provider available for text generation');
    }

    return provider.generateText(prompt, context);
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    const provider = this.selectProvider('story_analysis');
    if (!provider) {
      throw new Error('No suitable AI provider available for story analysis');
    }

    return provider.analyzeStory(content);
  }

  async generateCharacter(traits: any): Promise<Character> {
    const provider = this.selectProvider('character_analysis');
    if (!provider) {
      throw new Error('No suitable AI provider available for character generation');
    }

    return provider.generateCharacter(traits);
  }

  // Provider selection logic
  private selectProvider(taskType: string, context?: StoryContext): AIProvider | null {
    // Check if user requires offline mode
    const requireOffline = !this.configManager.isCloudAIAllowed();
    
    // Get provider preference for this task
    const preferredProvider = this.configManager.getProviderForTask(taskType);
    
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider.name);
      if (provider && provider.isAvailable()) {
        // Check offline requirement
        if (requireOffline && preferredProvider.type === 'cloud') {
          console.warn(`Preferred provider ${preferredProvider.name} is cloud-based but offline mode required`);
        } else {
          return provider;
        }
      }
    }

    // Fallback to any available provider, prioritizing by type
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.isAvailable())
      .filter(p => !requireOffline || p.type !== 'cloud')
      .sort((a, b) => {
        // Prioritize: cowriter > local > cloud
        const priority = { cowriter: 3, local: 2, cloud: 1 };
        return priority[b.type] - priority[a.type];
      });

    return availableProviders[0] || null;
  }

  // Provider management
  async addProvider(name: string, provider: AIProvider): Promise<void> {
    await provider.initialize({});
    this.providers.set(name, provider);
  }

  removeProvider(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.shutdown();
      this.providers.delete(name);
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter(name => {
      const provider = this.providers.get(name);
      return provider?.isAvailable() || false;
    });
  }

  getProviderInfo(name: string): any {
    const provider = this.providers.get(name);
    if (!provider) return null;

    return {
      name: provider.name,
      type: provider.type,
      capabilities: provider.capabilities,
      available: provider.isAvailable()
    };
  }

  async shutdown(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    this.providers.clear();
    this.initialized = false;
  }
}

// Mock providers for initial development
// These will be replaced with real implementations in later tasks

class MockCowriterProvider implements AIProvider {
  name = 'SoYume Co-writer';
  type: 'cowriter' = 'cowriter';
  capabilities = [
    {
      name: 'outline_generation',
      description: 'Generate story outlines from premises',
      inputTypes: ['text'],
      outputTypes: ['outline'],
      offline: true
    },
    {
      name: 'character_analysis',
      description: 'Analyze and develop characters',
      inputTypes: ['character_data'],
      outputTypes: ['character_analysis'],
      offline: true
    }
  ];
  priority = 10;

  constructor(private config: any) {}

  async initialize(config: any): Promise<void> {
    console.log('Mock Co-writer AI initialized');
  }

  async generateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    // Mock response - will be replaced with actual AI inference
    return {
      content: `[Mock Co-writer Response] Generated text for: "${prompt.substring(0, 50)}..."`,
      confidence: 0.85,
      metadata: {
        model: 'soyume-cowriter-mock',
        provider: 'SoYume Co-writer',
        tokensUsed: 150,
        responseTime: 1200
      },
      suggestions: ['Consider adding more sensory details', 'Develop character motivation further']
    };
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    // Mock analysis - will be replaced with actual AI analysis
    return {
      structure: {
        identifiedStructure: 'three-act',
        completedBeats: ['opening', 'inciting-incident'],
        missingBeats: ['midpoint', 'climax'],
        suggestions: ['Consider adding a stronger midpoint twist'],
        confidence: 0.75
      },
      characters: {
        consistencyScore: 0.8,
        voiceConsistency: 0.85,
        developmentProgress: 0.6,
        relationshipHealth: [],
        suggestions: ['Develop secondary character arcs']
      },
      pacing: {
        overallPacing: 'good',
        tensionCurve: [],
        recommendations: ['Increase tension in middle section']
      },
      consistency: {
        overallScore: 0.82,
        plotHoles: [],
        characterInconsistencies: [],
        worldBuildingIssues: []
      },
      overallScore: 0.78,
      recommendations: [
        'Strengthen character development',
        'Add more conflict in the middle section',
        'Consider foreshadowing the climax earlier'
      ]
    };
  }

  async generateCharacter(traits: any): Promise<Character> {
    // Mock character generation
    return {
      id: `char-${Date.now()}`,
      name: 'Generated Character',
      archetype: {
        primary: 'hero',
        description: 'A determined protagonist',
        commonTraits: ['brave', 'loyal', 'determined']
      },
      traits: {
        personality: ['determined', 'compassionate', 'stubborn'],
        motivations: ['protect loved ones', 'seek justice'],
        fears: ['failure', 'losing friends'],
        strengths: ['leadership', 'empathy'],
        weaknesses: ['impulsiveness', 'self-doubt'],
        quirks: ['always carries a lucky charm']
      },
      relationships: [],
      developmentArc: {
        startState: 'naive but determined',
        endState: 'wise and confident leader',
        keyMoments: [],
        completed: false
      },
      voiceProfile: {
        vocabulary: ['determined', 'justice', 'protect'],
        speechPatterns: ['short, decisive sentences'],
        commonPhrases: ['We can do this', 'I won\'t give up'],
        formalityLevel: 5,
        emotionalRange: ['determined', 'compassionate', 'fierce']
      }
    };
  }

  isAvailable(): boolean {
    return true; // Mock is always available
  }

  async shutdown(): Promise<void> {
    console.log('Mock Co-writer AI shutdown');
  }
}

class MockLocalProvider implements AIProvider {
  name = 'Mock Local AI';
  type: 'local' = 'local';
  capabilities = [];
  priority = 5;

  constructor(private config: any) {}

  async initialize(config: any): Promise<void> {
    console.log('Mock Local AI initialized');
  }

  async generateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    return {
      content: `[Mock Local AI] ${prompt}`,
      confidence: 0.7,
      metadata: {
        model: 'mock-local',
        provider: 'Mock Local AI',
        tokensUsed: 100,
        responseTime: 2000
      }
    };
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    throw new Error('Story analysis not supported by this provider');
  }

  async generateCharacter(traits: any): Promise<Character> {
    throw new Error('Character generation not supported by this provider');
  }

  isAvailable(): boolean {
    return true;
  }

  async shutdown(): Promise<void> {
    console.log('Mock Local AI shutdown');
  }
}

class MockCloudProvider implements AIProvider {
  name = 'Mock Cloud AI';
  type: 'cloud' = 'cloud';
  capabilities = [];
  priority = 3;

  constructor(private config: any) {}

  async initialize(config: any): Promise<void> {
    console.log('Mock Cloud AI initialized');
  }

  async generateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    return {
      content: `[Mock Cloud AI] ${prompt}`,
      confidence: 0.9,
      metadata: {
        model: 'mock-cloud',
        provider: 'Mock Cloud AI',
        tokensUsed: 200,
        responseTime: 3000
      }
    };
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    throw new Error('Story analysis not supported by this provider');
  }

  async generateCharacter(traits: any): Promise<Character> {
    throw new Error('Character generation not supported by this provider');
  }

  isAvailable(): boolean {
    return true;
  }

  async shutdown(): Promise<void> {
    console.log('Mock Cloud AI shutdown');
  }
}