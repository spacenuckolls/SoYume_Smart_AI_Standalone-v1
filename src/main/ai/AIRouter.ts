import { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIRequestType
} from '../../shared/types/AI';
import { AIProviderRegistry } from './providers/AIProviderRegistry';
import { ConfigManager } from '../config/ConfigManager';

export interface RoutingRule {
  requestType: AIRequestType;
  preferredProviderType?: 'cowriter' | 'local' | 'cloud';
  preferredProvider?: string;
  fallbackStrategy: 'priority' | 'load_balance' | 'performance';
  requireOffline?: boolean;
}

export interface RoutingConfig {
  defaultStrategy: 'priority' | 'load_balance' | 'performance';
  rules: RoutingRule[];
  enableFallback: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export class AIRouter {
  private providerRegistry: AIProviderRegistry;
  private configManager: ConfigManager;
  private routingConfig: RoutingConfig;

  constructor(providerRegistry: AIProviderRegistry, configManager: ConfigManager) {
    this.providerRegistry = providerRegistry;
    this.configManager = configManager;

    // Load routing configuration
    this.routingConfig = this.loadRoutingConfig();
  }

  private loadRoutingConfig(): RoutingConfig {
    // Load from config manager or use defaults
    const config = this.configManager.get('aiRouting') as Partial<RoutingConfig> || {};
    
    return {
      defaultStrategy: config.defaultStrategy || 'priority',
      enableFallback: config.enableFallback !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rules: config.rules || this.getDefaultRoutingRules()
    };
  }

  private getDefaultRoutingRules(): RoutingRule[] {
    return [
      // Co-writer AI handles core creative tasks
      {
        requestType: 'outline',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'character_analysis',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'scene_structure',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'story_analysis',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'plot_hole_detection',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'pacing_analysis',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'consistency_check',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'manuscript_analysis',
        preferredProviderType: 'cowriter',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      
      // Cloud AI for complex generation tasks
      {
        requestType: 'prose_generation',
        preferredProviderType: 'cloud',
        fallbackStrategy: 'performance',
        requireOffline: false
      },
      {
        requestType: 'dialogue_generation',
        preferredProviderType: 'cloud',
        fallbackStrategy: 'performance',
        requireOffline: false
      },
      {
        requestType: 'research',
        preferredProviderType: 'cloud',
        fallbackStrategy: 'priority',
        requireOffline: false
      },
      {
        requestType: 'brainstorming',
        preferredProviderType: 'cloud',
        fallbackStrategy: 'load_balance',
        requireOffline: false
      }
    ];
  }

  async routeRequest(request: AIRequest): Promise<AIProvider> {
    const provider = await this.selectProvider(request);
    if (!provider) {
      throw new Error(`No suitable provider found for request type: ${request.type}`);
    }
    return provider;
  }

  private async selectProvider(request: AIRequest): Promise<AIProvider | null> {
    // Find applicable routing rule
    const rule = this.findRoutingRule(request.type);
    
    // Get available providers
    let candidates = this.providerRegistry.getAvailableProviders();
    
    // Apply request-level filters
    candidates = this.applyRequestFilters(candidates, request, rule);
    
    if (candidates.length === 0) {
      return null;
    }

    // Simple priority-based selection for now
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }

  private findRoutingRule(requestType: AIRequestType): RoutingRule | null {
    return this.routingConfig.rules.find(rule => rule.requestType === requestType) || null;
  }

  private applyRequestFilters(
    providers: AIProvider[], 
    request: AIRequest, 
    rule: RoutingRule | null
  ): AIProvider[] {
    let filtered = providers;

    // Filter by preferred provider (request level)
    if (request.options?.preferredProvider) {
      const preferred = filtered.find(p => p.name === request.options!.preferredProvider);
      if (preferred) return [preferred];
    }

    // Filter by offline requirement
    const requireOffline = request.options?.requireOffline || 
                          rule?.requireOffline || 
                          !this.configManager.isCloudAIAllowed();
    
    if (requireOffline) {
      filtered = filtered.filter(p => p.type !== 'cloud');
    }

    // Filter by preferred provider type (rule level)
    if (rule?.preferredProviderType) {
      const typeFiltered = filtered.filter(p => p.type === rule.preferredProviderType);
      if (typeFiltered.length > 0) {
        filtered = typeFiltered;
      }
    }

    // Filter by preferred provider name (rule level)
    if (rule?.preferredProvider) {
      const nameFiltered = filtered.filter(p => p.name === rule.preferredProvider);
      if (nameFiltered.length > 0) {
        filtered = nameFiltered;
      }
    }

    return filtered;
  }

  async executeRequest(request: AIRequest): Promise<AIResponse> {
    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = this.routingConfig.maxRetries + 1;

    while (attempts < maxAttempts) {
      try {
        const provider = await this.selectProvider(request);
        if (!provider) {
          throw new Error(`No suitable provider available for request type: ${request.type}`);
        }

        // Execute request directly on provider
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
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;

        if (attempts < maxAttempts && this.routingConfig.enableFallback) {
          console.warn(`Request attempt ${attempts} failed, retrying in ${this.routingConfig.retryDelay}ms:`, error);
          await this.delay(this.routingConfig.retryDelay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAvailableProviders(): AIProvider[] {
    return this.providerRegistry.getAvailableProviders();
  }

  setProviderPriority(providerName: string, priority: number): void {
    const provider = this.providerRegistry.getProvider(providerName);
    if (provider) {
      provider.priority = priority;
      console.log(`Updated priority for provider ${providerName}: ${priority}`);
    }
  }

  // Configuration management
  updateRoutingConfig(config: Partial<RoutingConfig>): void {
    this.routingConfig = { ...this.routingConfig, ...config };
    this.configManager.set('aiRouting', this.routingConfig);
    console.log('Routing configuration updated');
  }

  addRoutingRule(rule: RoutingRule): void {
    // Remove existing rule for the same request type
    this.routingConfig.rules = this.routingConfig.rules.filter(
      r => r.requestType !== rule.requestType
    );
    
    // Add new rule
    this.routingConfig.rules.push(rule);
    this.configManager.set('aiRouting', this.routingConfig);
    console.log(`Added routing rule for ${rule.requestType}`);
  }

  removeRoutingRule(requestType: AIRequestType): void {
    this.routingConfig.rules = this.routingConfig.rules.filter(
      r => r.requestType !== requestType
    );
    this.configManager.set('aiRouting', this.routingConfig);
    console.log(`Removed routing rule for ${requestType}`);
  }

  getRoutingConfig(): RoutingConfig {
    return { ...this.routingConfig };
  }

  // Analytics and monitoring
  getProviderUsageStats(): Map<string, any> {
    const stats = new Map();
    const providerStats = this.providerRegistry.getProviderStats();
    
    for (const [providerName, stat] of Object.entries(providerStats)) {
      stats.set(providerName, {
        totalRequests: 0,
        successRate: 100,
        averageResponseTime: 0,
        healthStatus: stat.available ? 'healthy' : 'unhealthy',
        lastRequestTime: new Date(),
        errorCount: 0
      });
    }
    
    return stats;
  }

  getRequestTypeStats(): Map<AIRequestType, number> {
    // This would be implemented with actual request tracking
    // For now, return empty map
    return new Map();
  }

  // Testing and debugging
  async testProvider(providerName: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const testRequest: AIRequest = {
        type: 'prose_generation',
        content: 'Write a single sentence about a cat.',
        context: {
          characters: [],
          genre: ['test'],
          targetAudience: 'general'
        }
      };

      const provider = this.providerRegistry.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      await provider.generateText(testRequest.content, testRequest.context);
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async testAllProviders(): Promise<Map<string, any>> {
    const results = new Map();
    const providers = this.providerRegistry.getAvailableProviders();
    
    const testPromises = providers.map(async (provider) => {
      const result = await this.testProvider(provider.name);
      results.set(provider.name, result);
    });
    
    await Promise.all(testPromises);
    return results;
  }

  // Provider recommendation
  recommendProvider(requestType: AIRequestType): {
    recommended: string | null;
    alternatives: string[];
    reasoning: string;
  } {
    const rule = this.findRoutingRule(requestType);
    const providers = this.providerRegistry.getAvailableProviders();
    
    // Apply filters
    const candidates = this.applyRequestFilters(providers, { 
      type: requestType, 
      content: '', 
      context: { characters: [], genre: [], targetAudience: '' } 
    }, rule);
    
    if (candidates.length === 0) {
      return {
        recommended: null,
        alternatives: [],
        reasoning: 'No suitable providers available'
      };
    }

    // Simple priority-based selection
    candidates.sort((a, b) => b.priority - a.priority);
    const recommended = candidates[0];

    const alternatives = candidates
      .filter(p => p.name !== recommended?.name)
      .map(p => p.name);

    let reasoning = `Selected using priority strategy`;
    if (rule?.preferredProviderType) {
      reasoning += `, preferred type: ${rule.preferredProviderType}`;
    }

    return {
      recommended: recommended?.name || null,
      alternatives,
      reasoning
    };
  }
}