import { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIRequestType, 
  ProviderConfig,
  AICapability
} from '../../shared/types/AI';
import { ConfigManager } from '../config/ConfigManager';

export interface ProviderRegistration {
  provider: AIProvider;
  config: ProviderConfig;
  enabled: boolean;
  lastHealthCheck: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  errorCount: number;
  lastError?: string;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
}

export class ProviderRegistry {
  private providers: Map<string, ProviderRegistration> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private configManager: ConfigManager;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async initialize(): Promise<void> {
    // Load providers from configuration
    const providerConfigs = this.configManager.getEnabledProviders();
    
    for (const config of providerConfigs) {
      try {
        const provider = await this.createProvider(config);
        await this.registerProvider(provider, config.config, config.enabled);
      } catch (error) {
        console.error(`Failed to initialize provider ${config.name}:`, error);
      }
    }

    // Start health check monitoring
    this.startHealthChecking();
    
    console.log(`Provider registry initialized with ${this.providers.size} providers`);
  }

  private async createProvider(config: any): Promise<AIProvider> {
    // This will be implemented with actual provider classes in later tasks
    // For now, return a mock provider based on type
    switch (config.type) {
      case 'cowriter':
        const { MockCowriterProvider } = await import('./providers/MockCowriterProvider');
        return new MockCowriterProvider(config);
      case 'local':
        const { MockLocalProvider } = await import('./providers/MockLocalProvider');
        return new MockLocalProvider(config);
      case 'cloud':
        const { MockCloudProvider } = await import('./providers/MockCloudProvider');
        return new MockCloudProvider(config);
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  async registerProvider(
    provider: AIProvider, 
    config: ProviderConfig, 
    enabled: boolean = true
  ): Promise<void> {
    try {
      // Initialize the provider
      await provider.initialize(config);
      
      // Register in the registry
      const registration: ProviderRegistration = {
        provider,
        config,
        enabled,
        lastHealthCheck: new Date(),
        healthStatus: 'unknown',
        errorCount: 0
      };

      this.providers.set(provider.name, registration);
      
      // Initialize metrics
      this.metrics.set(provider.name, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      });

      // Perform initial health check
      await this.checkProviderHealth(provider.name);
      
      console.log(`Registered provider: ${provider.name} (${provider.type})`);
    } catch (error) {
      console.error(`Failed to register provider ${provider.name}:`, error);
      throw error;
    }
  }

  async unregisterProvider(providerName: string): Promise<void> {
    const registration = this.providers.get(providerName);
    if (registration) {
      try {
        await registration.provider.shutdown();
      } catch (error) {
        console.error(`Error shutting down provider ${providerName}:`, error);
      }
      
      this.providers.delete(providerName);
      this.metrics.delete(providerName);
      
      console.log(`Unregistered provider: ${providerName}`);
    }
  }

  getProvider(providerName: string): AIProvider | null {
    const registration = this.providers.get(providerName);
    return registration?.enabled ? registration.provider : null;
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.values())
      .filter(reg => reg.enabled && reg.provider.isAvailable())
      .map(reg => reg.provider);
  }

  getProvidersByType(type: AIProvider['type']): AIProvider[] {
    return this.getAvailableProviders().filter(provider => provider.type === type);
  }

  getProvidersByCapability(capability: string): AIProvider[] {
    return this.getAvailableProviders().filter(provider =>
      provider.capabilities.some(cap => cap.name === capability)
    );
  }

  async enableProvider(providerName: string): Promise<void> {
    const registration = this.providers.get(providerName);
    if (registration) {
      registration.enabled = true;
      await this.checkProviderHealth(providerName);
      console.log(`Enabled provider: ${providerName}`);
    }
  }

  async disableProvider(providerName: string): Promise<void> {
    const registration = this.providers.get(providerName);
    if (registration) {
      registration.enabled = false;
      console.log(`Disabled provider: ${providerName}`);
    }
  }

  async executeRequest(
    providerName: string, 
    request: AIRequest
  ): Promise<AIResponse> {
    const registration = this.providers.get(providerName);
    if (!registration) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    if (!registration.enabled) {
      throw new Error(`Provider disabled: ${providerName}`);
    }

    const provider = registration.provider;
    const metrics = this.metrics.get(providerName)!;
    
    const startTime = Date.now();
    
    try {
      // Update metrics
      metrics.totalRequests++;
      metrics.lastRequestTime = new Date();

      // Execute the request based on type
      let response: AIResponse;
      
      switch (request.type) {
        case 'prose_generation':
        case 'dialogue_generation':
          response = await provider.generateText(request.content, request.context);
          break;
        case 'story_analysis':
        case 'plot_hole_detection':
        case 'pacing_analysis':
        case 'consistency_check':
          const analysis = await provider.analyzeStory(request.content);
          response = {
            content: JSON.stringify(analysis),
            confidence: analysis.overallScore / 100,
            metadata: {
              model: provider.name,
              provider: provider.name,
              tokensUsed: 0,
              responseTime: Date.now() - startTime
            }
          };
          break;
        case 'character_analysis':
          // Extract character traits from request content
          const traits = JSON.parse(request.content);
          const character = await provider.generateCharacter(traits);
          response = {
            content: JSON.stringify(character),
            confidence: 0.8,
            metadata: {
              model: provider.name,
              provider: provider.name,
              tokensUsed: 0,
              responseTime: Date.now() - startTime
            }
          };
          break;
        default:
          // Default to text generation for other types
          response = await provider.generateText(request.content, request.context);
      }

      // Update success metrics
      metrics.successfulRequests++;
      const responseTime = Date.now() - startTime;
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (metrics.successfulRequests - 1) + responseTime) / 
        metrics.successfulRequests;

      // Reset error count on successful request
      registration.errorCount = 0;

      return response;
    } catch (error) {
      // Update failure metrics
      metrics.failedRequests++;
      registration.errorCount++;
      registration.lastError = error instanceof Error ? error.message : String(error);
      
      // Update health status if too many errors
      if (registration.errorCount >= 3) {
        registration.healthStatus = 'unhealthy';
      } else if (registration.errorCount >= 1) {
        registration.healthStatus = 'degraded';
      }

      console.error(`Provider ${providerName} request failed:`, error);
      throw error;
    }
  }

  async checkProviderHealth(providerName: string): Promise<void> {
    const registration = this.providers.get(providerName);
    if (!registration) return;

    try {
      const isAvailable = registration.provider.isAvailable();
      
      if (isAvailable) {
        // Perform a simple test request
        const testResponse = await registration.provider.generateText(
          'Test connection',
          { characters: [], genre: [], targetAudience: '' }
        );
        
        if (testResponse && testResponse.content) {
          registration.healthStatus = 'healthy';
          registration.errorCount = 0;
        } else {
          registration.healthStatus = 'degraded';
        }
      } else {
        registration.healthStatus = 'unhealthy';
      }
    } catch (error) {
      registration.healthStatus = 'unhealthy';
      registration.lastError = error instanceof Error ? error.message : String(error);
      console.warn(`Health check failed for provider ${providerName}:`, error);
    }

    registration.lastHealthCheck = new Date();
  }

  private startHealthChecking(): void {
    // Check provider health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      for (const providerName of this.providers.keys()) {
        await this.checkProviderHealth(providerName);
      }
    }, 5 * 60 * 1000);
  }

  getProviderStatus(providerName: string): ProviderRegistration | null {
    return this.providers.get(providerName) || null;
  }

  getProviderMetrics(providerName: string): ProviderMetrics | null {
    return this.metrics.get(providerName) || null;
  }

  getAllProviderStatuses(): Map<string, ProviderRegistration> {
    return new Map(this.providers);
  }

  getAllProviderMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.metrics);
  }

  async shutdown(): Promise<void> {
    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown all providers
    const shutdownPromises = Array.from(this.providers.values()).map(async (registration) => {
      try {
        await registration.provider.shutdown();
      } catch (error) {
        console.error(`Error shutting down provider ${registration.provider.name}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    
    this.providers.clear();
    this.metrics.clear();
    
    console.log('Provider registry shutdown complete');
  }
}

// Provider selection strategies
export interface ProviderSelectionStrategy {
  selectProvider(
    providers: AIProvider[], 
    request: AIRequest, 
    metrics: Map<string, ProviderMetrics>
  ): AIProvider | null;
}

export class PriorityBasedStrategy implements ProviderSelectionStrategy {
  selectProvider(
    providers: AIProvider[], 
    request: AIRequest, 
    metrics: Map<string, ProviderMetrics>
  ): AIProvider | null {
    // Filter by capability if specified
    let candidates = providers;
    
    // Filter by offline requirement
    if (request.options?.requireOffline) {
      candidates = candidates.filter(p => p.type !== 'cloud');
    }

    // Filter by preferred provider
    if (request.options?.preferredProvider) {
      const preferred = candidates.find(p => p.name === request.options!.preferredProvider);
      if (preferred) return preferred;
    }

    // Sort by priority (higher is better)
    candidates.sort((a, b) => b.priority - a.priority);
    
    return candidates[0] || null;
  }
}

export class LoadBalancingStrategy implements ProviderSelectionStrategy {
  selectProvider(
    providers: AIProvider[], 
    request: AIRequest, 
    metrics: Map<string, ProviderMetrics>
  ): AIProvider | null {
    // Filter by capability and requirements
    let candidates = providers;
    
    if (request.options?.requireOffline) {
      candidates = candidates.filter(p => p.type !== 'cloud');
    }

    if (candidates.length === 0) return null;

    // Select provider with lowest current load (total requests)
    let bestProvider = candidates[0];
    let lowestLoad = metrics.get(bestProvider.name)?.totalRequests || 0;

    for (const provider of candidates.slice(1)) {
      const load = metrics.get(provider.name)?.totalRequests || 0;
      if (load < lowestLoad) {
        bestProvider = provider;
        lowestLoad = load;
      }
    }

    return bestProvider;
  }
}

export class PerformanceBasedStrategy implements ProviderSelectionStrategy {
  selectProvider(
    providers: AIProvider[], 
    request: AIRequest, 
    metrics: Map<string, ProviderMetrics>
  ): AIProvider | null {
    // Filter by capability and requirements
    let candidates = providers;
    
    if (request.options?.requireOffline) {
      candidates = candidates.filter(p => p.type !== 'cloud');
    }

    if (candidates.length === 0) return null;

    // Select provider with best success rate and response time
    let bestProvider = candidates[0];
    let bestScore = this.calculatePerformanceScore(bestProvider, metrics);

    for (const provider of candidates.slice(1)) {
      const score = this.calculatePerformanceScore(provider, metrics);
      if (score > bestScore) {
        bestProvider = provider;
        bestScore = score;
      }
    }

    return bestProvider;
  }

  private calculatePerformanceScore(provider: AIProvider, metrics: Map<string, ProviderMetrics>): number {
    const metric = metrics.get(provider.name);
    if (!metric || metric.totalRequests === 0) {
      return provider.priority; // Fallback to priority for new providers
    }

    const successRate = metric.successfulRequests / metric.totalRequests;
    const responseTimeScore = Math.max(0, 1 - (metric.averageResponseTime / 10000)); // Normalize to 0-1
    
    return (successRate * 0.7 + responseTimeScore * 0.3) * 100 + provider.priority;
  }
}