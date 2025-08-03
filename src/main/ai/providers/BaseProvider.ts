import { 
  AIProvider, 
  ProviderConfig, 
  AICapability, 
  StoryContext, 
  AIResponse,
  StoryAnalysis
} from '../../../shared/types/AI';
import { Character } from '../../../shared/types/Story';

// Base abstract class for all AI providers
export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  abstract type: 'cowriter' | 'local' | 'cloud';
  abstract capabilities: AICapability[];
  abstract priority: number;

  protected config: ProviderConfig = {};
  protected initialized = false;
  protected available = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    try {
      await this.doInitialize();
      this.initialized = true;
      this.available = true;
      console.log(`${this.name} provider initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${this.name} provider:`, error);
      this.initialized = false;
      this.available = false;
      throw error;
    }
  }

  protected abstract doInitialize(): Promise<void>;

  abstract generateText(prompt: string, context: StoryContext): Promise<AIResponse>;
  abstract analyzeStory(content: string): Promise<StoryAnalysis>;
  abstract generateCharacter(traits: any): Promise<Character>;

  isAvailable(): boolean {
    return this.initialized && this.available;
  }

  async shutdown(): Promise<void> {
    try {
      await this.doShutdown();
      this.initialized = false;
      this.available = false;
      console.log(`${this.name} provider shut down successfully`);
    } catch (error) {
      console.error(`Error shutting down ${this.name} provider:`, error);
    }
  }

  protected abstract doShutdown(): Promise<void>;

  // Helper method to create standardized responses
  protected createResponse(
    content: string,
    confidence: number = 0.8,
    additionalMetadata: any = {}
  ): AIResponse {
    return {
      content,
      confidence,
      metadata: {
        model: this.config.modelName || 'unknown',
        provider: this.name,
        tokensUsed: this.estimateTokens(content),
        responseTime: 0, // Will be set by caller
        ...additionalMetadata
      }
    };
  }

  // Simple token estimation (rough approximation)
  protected estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  // Helper method to validate configuration
  protected validateConfig(requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!this.config[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }
  }

  // Helper method to handle errors consistently
  protected handleError(error: any, operation: string): never {
    const errorMessage = `${this.name} provider failed during ${operation}: ${error.message || error}`;
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      // Perform a simple test request
      await this.performHealthCheck();
      return true;
    } catch (error) {
      console.warn(`Health check failed for ${this.name}:`, error);
      this.available = false;
      return false;
    }
  }

  protected abstract performHealthCheck(): Promise<void>;

  // Get provider information
  getInfo(): any {
    return {
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
      priority: this.priority,
      initialized: this.initialized,
      available: this.available,
      config: this.getSafeConfig()
    };
  }

  // Get configuration without sensitive data
  protected getSafeConfig(): any {
    const safeConfig = { ...this.config };
    
    // Remove sensitive fields
    delete safeConfig.apiKey;
    delete safeConfig.password;
    delete safeConfig.token;
    
    return safeConfig;
  }
}

// Base class for cloud providers
export abstract class BaseCloudProvider extends BaseProvider {
  type: 'cloud' = 'cloud';
  
  protected abstract apiKey: string;
  protected abstract baseUrl: string;

  protected async doInitialize(): Promise<void> {
    this.validateConfig(['apiKey']);
    this.apiKey = this.config.apiKey!;
    
    // Test API connection
    await this.testConnection();
  }

  protected abstract testConnection(): Promise<void>;

  protected async performHealthCheck(): Promise<void> {
    await this.testConnection();
  }

  // Common HTTP request helper
  protected async makeRequest(
    endpoint: string, 
    data: any, 
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Base class for local providers
export abstract class BaseLocalProvider extends BaseProvider {
  type: 'local' = 'local';
  
  protected abstract port: number;
  protected abstract host: string;

  protected async doInitialize(): Promise<void> {
    this.host = this.config.host || 'localhost';
    this.port = this.config.port || this.getDefaultPort();
    
    // Test local connection
    await this.testLocalConnection();
  }

  protected abstract getDefaultPort(): number;
  protected abstract testLocalConnection(): Promise<void>;

  protected async performHealthCheck(): Promise<void> {
    await this.testLocalConnection();
  }

  // Common local HTTP request helper
  protected async makeLocalRequest(
    endpoint: string, 
    data: any, 
    options: RequestInit = {}
  ): Promise<any> {
    const url = `http://${this.host}:${this.port}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });

    if (!response.ok) {
      throw new Error(`Local service error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Check if local service is running
  protected async isServiceRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.host}:${this.port}/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      return response.ok;
    } catch {
      return false;
    }
  }
}