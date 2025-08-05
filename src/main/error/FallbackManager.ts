import { EventEmitter } from 'events';
import { AIProvider } from '../ai/providers/BaseProvider';

/**
 * Automatic fallback system between Co-writer AI, local AI, and cloud providers
 * Provides seamless switching when primary providers fail
 */
export class FallbackManager extends EventEmitter {
  private providers: Map<string, AIProvider>;
  private fallbackChains: Map<string, FallbackChain>;
  private providerHealth: Map<string, ProviderHealthStatus>;
  private currentProvider: string | null;
  private healthCheckInterval: NodeJS.Timeout | null;

  constructor(options: FallbackManagerOptions = {}) {
    super();
    
    this.providers = new Map();
    this.fallbackChains = new Map();
    this.providerHealth = new Map();
    this.currentProvider = null;
    this.healthCheckInterval = null;
    
    this.initializeFallbackChains();
    this.startHealthMonitoring(options.healthCheckInterval || 60000);
  }

  /**
   * Register an AI provider
   */
  registerProvider(id: string, provider: AIProvider): void {
    this.providers.set(id, provider);
    this.providerHealth.set(id, {
      status: ProviderStatus.UNKNOWN,
      lastCheck: 0,
      consecutiveFailures: 0,
      averageResponseTime: 0,
      availability: 0
    });
    
    this.emit('providerRegistered', { id, provider: provider.name });
  }

  /**
   * Execute operation with automatic fallback
   */
  async executeWithFallback<T>(
    operation: string,
    params: any,
    options: FallbackExecutionOptions = {}
  ): Promise<FallbackExecutionResult<T>> {
    const chain = this.fallbackChains.get(operation);
    if (!chain) {
      throw new Error(`No fallback chain defined for operation: ${operation}`);
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    let lastError: Error | null = null;
    const attemptedProviders: string[] = [];

    // Try each provider in the fallback chain
    for (const providerId of chain.providers) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        continue;
      }

      // Check if provider is healthy enough to try
      const health = this.providerHealth.get(providerId);
      if (health && health.status === ProviderStatus.FAILED && 
          health.consecutiveFailures > chain.maxFailures) {
        continue;
      }

      attemptedProviders.push(providerId);

      try {
        this.emit('fallbackAttempt', { 
          executionId, 
          operation, 
          providerId, 
          attempt: attemptedProviders.length 
        });

        const result = await this.executeOperation(provider, operation, params, options);
        
        // Success - update provider health and return result
        this.updateProviderHealth(providerId, true, Date.now() - startTime);
        this.currentProvider = providerId;
        
        const executionResult: FallbackExecutionResult<T> = {
          success: true,
          result,
          providerId,
          executionTime: Date.now() - startTime,
          attemptedProviders,
          fallbackUsed: attemptedProviders.length > 1
        };

        this.emit('fallbackSuccess', { executionId, ...executionResult });
        return executionResult;

      } catch (error) {
        lastError = error as Error;
        this.updateProviderHealth(providerId, false, Date.now() - startTime);
        
        this.emit('fallbackFailure', { 
          executionId, 
          operation, 
          providerId, 
          error: error.message 
        });

        // If this is a critical error that affects all providers, break early
        if (this.isCriticalError(error as Error)) {
          break;
        }
      }
    }

    // All providers failed
    const executionResult: FallbackExecutionResult<T> = {
      success: false,
      error: lastError?.message || 'All providers failed',
      executionTime: Date.now() - startTime,
      attemptedProviders,
      fallbackUsed: attemptedProviders.length > 1
    };

    this.emit('fallbackExhausted', { executionId, ...executionResult });
    return executionResult;
  }

  /**
   * Get the best available provider for an operation
   */
  getBestProvider(operation: string): string | null {
    const chain = this.fallbackChains.get(operation);
    if (!chain) {
      return null;
    }

    // Find the first healthy provider in the chain
    for (const providerId of chain.providers) {
      const health = this.providerHealth.get(providerId);
      if (health && health.status === ProviderStatus.HEALTHY) {
        return providerId;
      }
    }

    // If no healthy provider, return the first available one
    for (const providerId of chain.providers) {
      const health = this.providerHealth.get(providerId);
      if (health && health.status !== ProviderStatus.FAILED) {
        return providerId;
      }
    }

    return null;
  }

  /**
   * Force switch to a specific provider
   */
  async switchToProvider(providerId: string): Promise<ProviderSwitchResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} not found`
      };
    }

    try {
      // Test provider availability
      const isAvailable = await this.testProviderAvailability(provider);
      
      if (isAvailable) {
        this.currentProvider = providerId;
        this.emit('providerSwitched', { providerId, forced: true });
        
        return {
          success: true,
          providerId,
          previousProvider: this.currentProvider
        };
      } else {
        return {
          success: false,
          error: `Provider ${providerId} is not available`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current provider status
   */
  getCurrentProvider(): string | null {
    return this.currentProvider;
  }

  /**
   * Get all provider health statuses
   */
  getProviderHealthStatuses(): Map<string, ProviderHealthStatus> {
    return new Map(this.providerHealth);
  }

  /**
   * Get fallback chain for an operation
   */
  getFallbackChain(operation: string): FallbackChain | null {
    return this.fallbackChains.get(operation) || null;
  }

  /**
   * Update fallback chain for an operation
   */
  updateFallbackChain(operation: string, chain: FallbackChain): void {
    this.fallbackChains.set(operation, chain);
    this.emit('fallbackChainUpdated', { operation, chain });
  }

  /**
   * Get fallback statistics
   */
  getFallbackStatistics(): FallbackStatistics {
    const stats: FallbackStatistics = {
      totalProviders: this.providers.size,
      healthyProviders: 0,
      degradedProviders: 0,
      failedProviders: 0,
      averageResponseTime: 0,
      fallbackChains: this.fallbackChains.size,
      currentProvider: this.currentProvider
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const health of this.providerHealth.values()) {
      switch (health.status) {
        case ProviderStatus.HEALTHY:
          stats.healthyProviders++;
          break;
        case ProviderStatus.DEGRADED:
          stats.degradedProviders++;
          break;
        case ProviderStatus.FAILED:
          stats.failedProviders++;
          break;
      }

      if (health.averageResponseTime > 0) {
        totalResponseTime += health.averageResponseTime;
        responseTimeCount++;
      }
    }

    if (responseTimeCount > 0) {
      stats.averageResponseTime = totalResponseTime / responseTimeCount;
    }

    return stats;
  }

  /**
   * Initialize default fallback chains
   */
  private initializeFallbackChains(): void {
    // Text generation fallback chain
    this.fallbackChains.set('generateText', {
      providers: ['cowriter-ai', 'openai', 'anthropic', 'ollama', 'local-ai'],
      maxFailures: 3,
      timeout: 30000,
      retryDelay: 1000
    });

    // Story analysis fallback chain
    this.fallbackChains.set('analyzeStory', {
      providers: ['cowriter-ai', 'local-ai', 'openai', 'anthropic'],
      maxFailures: 2,
      timeout: 60000,
      retryDelay: 2000
    });

    // Character analysis fallback chain
    this.fallbackChains.set('analyzeCharacter', {
      providers: ['cowriter-ai', 'openai', 'anthropic', 'local-ai'],
      maxFailures: 2,
      timeout: 30000,
      retryDelay: 1000
    });

    // Scene generation fallback chain
    this.fallbackChains.set('generateScene', {
      providers: ['cowriter-ai', 'openai', 'anthropic', 'ollama'],
      maxFailures: 3,
      timeout: 45000,
      retryDelay: 1500
    });

    // Dialogue generation fallback chain
    this.fallbackChains.set('generateDialogue', {
      providers: ['cowriter-ai', 'openai', 'anthropic', 'local-ai'],
      maxFailures: 2,
      timeout: 20000,
      retryDelay: 1000
    });
  }

  /**
   * Execute operation on a specific provider
   */
  private async executeOperation(
    provider: AIProvider,
    operation: string,
    params: any,
    options: FallbackExecutionOptions
  ): Promise<any> {
    const timeout = options.timeout || 30000;
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation ${operation} timed out after ${timeout}ms`));
      }, timeout);

      try {
        let result;
        
        switch (operation) {
          case 'generateText':
            result = await provider.generateText(params.prompt, params.options);
            break;
          case 'analyzeStory':
            result = await provider.analyzeStory?.(params.story, params.options);
            break;
          case 'analyzeCharacter':
            result = await provider.analyzeCharacter?.(params.character, params.options);
            break;
          case 'generateScene':
            result = await provider.generateScene?.(params.sceneData, params.options);
            break;
          case 'generateDialogue':
            result = await provider.generateDialogue?.(params.characters, params.context, params.options);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Start health monitoring for all providers
   */
  private startHealthMonitoring(interval: number): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllProvidersHealth();
    }, interval);
  }

  /**
   * Check health of all registered providers
   */
  private async checkAllProvidersHealth(): Promise<void> {
    const healthCheckPromises = Array.from(this.providers.entries()).map(
      async ([id, provider]) => {
        try {
          const startTime = Date.now();
          const isHealthy = await this.testProviderAvailability(provider);
          const responseTime = Date.now() - startTime;
          
          this.updateProviderHealth(id, isHealthy, responseTime);
        } catch (error) {
          this.updateProviderHealth(id, false, 0);
        }
      }
    );

    await Promise.allSettled(healthCheckPromises);
    this.emit('healthCheckCompleted', this.getProviderHealthStatuses());
  }

  /**
   * Test if a provider is available
   */
  private async testProviderAvailability(provider: AIProvider): Promise<boolean> {
    try {
      // Use provider's built-in availability check if available
      if (provider.isAvailable) {
        return await provider.isAvailable();
      }
      
      // Fallback to a simple test generation
      await provider.generateText('test', { maxTokens: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(providerId: string, success: boolean, responseTime: number): void {
    const health = this.providerHealth.get(providerId);
    if (!health) return;

    const now = Date.now();
    
    if (success) {
      health.consecutiveFailures = 0;
      health.status = responseTime > 10000 ? ProviderStatus.DEGRADED : ProviderStatus.HEALTHY;
      
      // Update average response time
      if (health.averageResponseTime === 0) {
        health.averageResponseTime = responseTime;
      } else {
        health.averageResponseTime = (health.averageResponseTime * 0.8) + (responseTime * 0.2);
      }
    } else {
      health.consecutiveFailures++;
      health.status = health.consecutiveFailures >= 3 ? ProviderStatus.FAILED : ProviderStatus.DEGRADED;
    }

    health.lastCheck = now;
    
    // Calculate availability (simplified)
    const timeSinceLastCheck = now - health.lastCheck;
    if (timeSinceLastCheck > 0) {
      const uptime = success ? timeSinceLastCheck : 0;
      health.availability = (health.availability * 0.9) + ((uptime / timeSinceLastCheck) * 0.1);
    }

    this.emit('providerHealthUpdated', { providerId, health });
  }

  /**
   * Check if an error is critical and affects all providers
   */
  private isCriticalError(error: Error): boolean {
    const criticalErrors = [
      'NETWORK_ERROR',
      'AUTHENTICATION_ERROR',
      'RATE_LIMIT_EXCEEDED'
    ];
    
    return criticalErrors.some(criticalError => 
      error.message.includes(criticalError) || error.name === criticalError
    );
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthMonitoring();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface FallbackManagerOptions {
  healthCheckInterval?: number;
}

export interface FallbackChain {
  providers: string[];
  maxFailures: number;
  timeout: number;
  retryDelay: number;
}

export interface FallbackExecutionOptions {
  timeout?: number;
  retryCount?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface FallbackExecutionResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  providerId?: string;
  executionTime: number;
  attemptedProviders: string[];
  fallbackUsed: boolean;
}

export interface ProviderSwitchResult {
  success: boolean;
  providerId?: string;
  previousProvider?: string | null;
  error?: string;
}

export interface ProviderHealthStatus {
  status: ProviderStatus;
  lastCheck: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  availability: number;
}

export interface FallbackStatistics {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  failedProviders: number;
  averageResponseTime: number;
  fallbackChains: number;
  currentProvider: string | null;
}

export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  UNKNOWN = 'unknown'
}

// Extend AIProvider interface to include optional methods
declare module '../ai/providers/BaseProvider' {
  interface AIProvider {
    analyzeStory?(story: any, options?: any): Promise<any>;
    analyzeCharacter?(character: any, options?: any): Promise<any>;
    generateScene?(sceneData: any, options?: any): Promise<any>;
    generateDialogue?(characters: any[], context: any, options?: any): Promise<any>;
  }
}