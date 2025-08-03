import { AIProvider, ProviderConfig, AICapability, AIRequest, AIResponse } from '../../../shared/types/AI';
import { ConfigManager } from '../../config/ConfigManager';

// Provider registry for managing all AI providers
export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private configManager: ConfigManager;
  private initialized = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load enabled providers from configuration
    const enabledProviders = this.configManager.getEnabledProviders();
    
    for (const providerConfig of enabledProviders) {
      try {
        await this.loadProvider(providerConfig);
      } catch (error) {
        console.error(`Failed to load provider ${providerConfig.name}:`, error);
      }
    }

    this.initialized = true;
    console.log(`AI Provider Registry initialized with ${this.providers.size} providers`);
  }

  private async loadProvider(providerConfig: any): Promise<void> {
    let provider: AIProvider;

    // Create provider based on type
    switch (providerConfig.type) {
      case 'cowriter':
        provider = await this.createCowriterProvider(providerConfig);
        break;
      case 'local':
        provider = await this.createLocalProvider(providerConfig);
        break;
      case 'cloud':
        provider = await this.createCloudProvider(providerConfig);
        break;
      default:
        throw new Error(`Unknown provider type: ${providerConfig.type}`);
    }

    // Initialize the provider
    await provider.initialize(providerConfig.config);
    
    // Register the provider
    this.providers.set(providerConfig.name, provider);
    
    console.log(`Loaded AI provider: ${providerConfig.name} (${providerConfig.type})`);
  }

  private async createCowriterProvider(config: any): Promise<AIProvider> {
    // Import and create Co-writer provider
    const { CowriterProvider } = await import('./CowriterProvider');
    return new CowriterProvider(config);
  }

  private async createLocalProvider(config: any): Promise<AIProvider> {
    // Import appropriate local provider based on config
    switch (config.name.toLowerCase()) {
      case 'ollama':
        const { OllamaProvider } = await import('./local/OllamaProvider');
        return new OllamaProvider(config);
      case 'lm studio':
        const { LMStudioProvider } = await import('./local/LMStudioProvider');
        return new LMStudioProvider(config);
      case 'docker':
        const { DockerProvider } = await import('./local/DockerProvider');
        return new DockerProvider(config);
      default:
        const { GenericLocalProvider } = await import('./local/GenericLocalProvider');
        return new GenericLocalProvider(config);
    }
  }

  private async createCloudProvider(config: any): Promise<AIProvider> {
    // Import appropriate cloud provider based on config
    switch (config.name.toLowerCase()) {
      case 'openai':
        const { OpenAIProvider } = await import('./cloud/OpenAIProvider');
        return new OpenAIProvider(config);
      case 'anthropic':
        const { AnthropicProvider } = await import('./cloud/AnthropicProvider');
        return new AnthropicProvider(config);
      case 'openrouter':
        const { OpenRouterProvider } = await import('./cloud/OpenRouterProvider');
        return new OpenRouterProvider(config);
      case 'mistral':
        const { MistralProvider } = await import('./cloud/MistralProvider');
        return new MistralProvider(config);
      case 'moonshot':
      case 'kimi':
        const { MoonshotProvider } = await import('./cloud/MoonshotProvider');
        return new MoonshotProvider(config);
      default:
        throw new Error(`Unknown cloud provider: ${config.name}`);
    }
  }

  // Provider management methods
  async registerProvider(name: string, provider: AIProvider, config: ProviderConfig): Promise<void> {
    await provider.initialize(config);
    this.providers.set(name, provider);
    console.log(`Registered AI provider: ${name}`);
  }

  async unregisterProvider(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (provider) {
      await provider.shutdown();
      this.providers.delete(name);
      console.log(`Unregistered AI provider: ${name}`);
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableProviders(): AIProvider[] {
    return this.getAllProviders().filter(provider => provider.isAvailable());
  }

  getProvidersByType(type: AIProvider['type']): AIProvider[] {
    return this.getAllProviders().filter(provider => provider.type === type);
  }

  getProvidersByCapability(capability: string): AIProvider[] {
    return this.getAllProviders().filter(provider => 
      provider.capabilities.some(cap => cap.name === capability)
    );
  }

  // Provider information
  getProviderInfo(name: string): any {
    const provider = this.providers.get(name);
    if (!provider) return null;

    return {
      name: provider.name,
      type: provider.type,
      capabilities: provider.capabilities,
      priority: provider.priority,
      available: provider.isAvailable()
    };
  }

  getAllProviderInfo(): any[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      type: provider.type,
      capabilities: provider.capabilities,
      priority: provider.priority,
      available: provider.isAvailable()
    }));
  }

  // Health check
  async healthCheck(): Promise<{ [providerName: string]: boolean }> {
    const results: { [providerName: string]: boolean } = {};
    
    for (const [name, provider] of this.providers) {
      try {
        results[name] = provider.isAvailable();
      } catch (error) {
        console.error(`Health check failed for provider ${name}:`, error);
        results[name] = false;
      }
    }
    
    return results;
  }

  // Shutdown all providers
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.providers.values()).map(provider => 
      provider.shutdown().catch(error => 
        console.error(`Error shutting down provider ${provider.name}:`, error)
      )
    );
    
    await Promise.all(shutdownPromises);
    this.providers.clear();
    this.initialized = false;
    console.log('AI Provider Registry shut down');
  }

  // Configuration updates
  async updateProviderConfig(name: string, config: ProviderConfig): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }

    // Shutdown and reinitialize with new config
    await provider.shutdown();
    await provider.initialize(config);
    
    console.log(`Updated configuration for provider: ${name}`);
  }

  // Provider statistics
  getProviderStats(): { [providerName: string]: any } {
    const stats: { [providerName: string]: any } = {};
    
    for (const [name, provider] of this.providers) {
      stats[name] = {
        type: provider.type,
        priority: provider.priority,
        capabilities: provider.capabilities.length,
        available: provider.isAvailable()
      };
    }
    
    return stats;
  }
}