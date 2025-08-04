import { EventEmitter } from 'events';
import { LocalAIOption } from './SetupWizard';

export interface ConnectionTestResult {
  success: boolean;
  provider: string;
  endpoint: string;
  responseTime: number;
  version?: string;
  models?: string[];
  error?: string;
  warnings: string[];
  capabilities: string[];
}

export class ConnectionTester extends EventEmitter {
  async testProvider(option: LocalAIOption): Promise<ConnectionTestResult> {
    this.emit('progress', {
      stage: 'testing',
      progress: 10,
      message: `Testing ${option.name} connection...`
    });

    switch (option.type) {
      case 'ollama':
        return this.testOllama();
      case 'lm-studio':
        return this.testLMStudio();
      case 'docker':
        return this.testDocker();
      case 'manual':
        return this.testManual();
      default:
        return {
          success: false,
          provider: option.name,
          endpoint: 'unknown',
          responseTime: 0,
          error: `Unknown provider type: ${option.type}`,
          warnings: [],
          capabilities: []
        };
    }
  }

  private async testOllama(): Promise<ConnectionTestResult> {
    const endpoint = 'http://localhost:11434';
    const startTime = Date.now();
    const warnings: string[] = [];
    const capabilities: string[] = [];

    try {
      this.emit('progress', {
        stage: 'testing',
        progress: 30,
        message: 'Testing Ollama API connection...'
      });

      // Test basic connectivity
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      this.emit('progress', {
        stage: 'testing',
        progress: 60,
        message: 'Checking available models...'
      });

      // Get installed models
      const models = data.models?.map((model: any) => model.name) || [];
      
      if (models.length === 0) {
        warnings.push('No models are currently installed');
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 80,
        message: 'Testing text generation...'
      });

      // Test text generation if models are available
      if (models.length > 0) {
        const testResult = await this.testTextGeneration(endpoint, models[0]);
        if (testResult.success) {
          capabilities.push('text_generation');
        } else {
          warnings.push(`Text generation test failed: ${testResult.error}`);
        }
      }

      // Check for GPU support
      try {
        const versionResponse = await fetch(`${endpoint}/api/version`);
        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          capabilities.push('version_info');
        }
      } catch (error) {
        // Version endpoint might not be available in older versions
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 100,
        message: 'Ollama connection test completed!'
      });

      return {
        success: true,
        provider: 'Ollama',
        endpoint,
        responseTime,
        models,
        warnings,
        capabilities
      };
    } catch (error) {
      return {
        success: false,
        provider: 'Ollama',
        endpoint,
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        warnings,
        capabilities
      };
    }
  }

  private async testLMStudio(): Promise<ConnectionTestResult> {
    const endpoint = 'http://localhost:1234';
    const startTime = Date.now();
    const warnings: string[] = [];
    const capabilities: string[] = [];

    try {
      this.emit('progress', {
        stage: 'testing',
        progress: 30,
        message: 'Testing LM Studio API connection...'
      });

      // Test OpenAI-compatible endpoint
      const response = await fetch(`${endpoint}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      this.emit('progress', {
        stage: 'testing',
        progress: 60,
        message: 'Checking loaded models...'
      });

      // Get loaded models
      const models = data.data?.map((model: any) => model.id) || [];
      
      if (models.length === 0) {
        warnings.push('No models are currently loaded in LM Studio');
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 80,
        message: 'Testing chat completion...'
      });

      // Test chat completion if models are available
      if (models.length > 0) {
        const testResult = await this.testChatCompletion(endpoint, models[0]);
        if (testResult.success) {
          capabilities.push('chat_completion');
          capabilities.push('openai_compatible');
        } else {
          warnings.push(`Chat completion test failed: ${testResult.error}`);
        }
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 100,
        message: 'LM Studio connection test completed!'
      });

      return {
        success: true,
        provider: 'LM Studio',
        endpoint,
        responseTime,
        models,
        warnings,
        capabilities
      };
    } catch (error) {
      return {
        success: false,
        provider: 'LM Studio',
        endpoint,
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        warnings: [...warnings, 'Make sure LM Studio is running and the server is started'],
        capabilities
      };
    }
  }

  private async testDocker(): Promise<ConnectionTestResult> {
    const warnings: string[] = [];
    const capabilities: string[] = [];
    const startTime = Date.now();

    try {
      this.emit('progress', {
        stage: 'testing',
        progress: 30,
        message: 'Testing Docker AI containers...'
      });

      // Test common Docker AI endpoints
      const endpoints = [
        'http://localhost:8080', // Common AI container port
        'http://localhost:5000', // Alternative port
        'http://localhost:3000'  // Another common port
      ];

      let successfulEndpoint: string | null = null;
      let models: string[] = [];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${endpoint}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            successfulEndpoint = endpoint;
            capabilities.push('health_check');
            break;
          }
        } catch (error) {
          // Try next endpoint
        }
      }

      if (!successfulEndpoint) {
        throw new Error('No Docker AI containers found running on common ports');
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 70,
        message: `Testing Docker container at ${successfulEndpoint}...`
      });

      // Try to get model information
      try {
        const modelsResponse = await fetch(`${successfulEndpoint}/models`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          models = Array.isArray(modelsData) ? modelsData : [];
          capabilities.push('model_listing');
        }
      } catch (error) {
        warnings.push('Could not retrieve model information from container');
      }

      this.emit('progress', {
        stage: 'testing',
        progress: 100,
        message: 'Docker AI connection test completed!'
      });

      return {
        success: true,
        provider: 'Docker AI',
        endpoint: successfulEndpoint,
        responseTime: Date.now() - startTime,
        models,
        warnings,
        capabilities
      };
    } catch (error) {
      return {
        success: false,
        provider: 'Docker AI',
        endpoint: 'unknown',
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        warnings: [...warnings, 'Make sure Docker containers are running and accessible'],
        capabilities
      };
    }
  }

  private async testManual(): Promise<ConnectionTestResult> {
    const warnings: string[] = [];
    const capabilities: string[] = [];

    // For manual setup, we can't automatically test
    // Instead, provide guidance for the user to test
    return {
      success: true,
      provider: 'Manual Setup',
      endpoint: 'user-configured',
      responseTime: 0,
      warnings: [
        'Manual setup requires user verification',
        'Please test your configuration manually'
      ],
      capabilities: ['manual_configuration']
    };
  }

  private async testTextGeneration(endpoint: string, modelName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Hello, this is a test.',
          stream: false
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      
      if (!data.response) {
        return {
          success: false,
          error: 'No response text received'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async testChatCompletion(endpoint: string, modelName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'user', content: 'Hello, this is a test.' }
          ],
          max_tokens: 50
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        return {
          success: false,
          error: 'No response choices received'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // Comprehensive connection test for all common endpoints
  async testAllEndpoints(): Promise<{
    ollama: ConnectionTestResult;
    lmStudio: ConnectionTestResult;
    docker: ConnectionTestResult;
  }> {
    this.emit('progress', {
      stage: 'comprehensive',
      progress: 0,
      message: 'Testing all local AI endpoints...'
    });

    const results = {
      ollama: await this.testOllama(),
      lmStudio: await this.testLMStudio(),
      docker: await this.testDocker()
    };

    this.emit('progress', {
      stage: 'comprehensive',
      progress: 100,
      message: 'Comprehensive connection test completed!'
    });

    return results;
  }

  // Get connection recommendations based on test results
  getRecommendations(results: ConnectionTestResult[]): string[] {
    const recommendations: string[] = [];
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length === 0) {
      recommendations.push('❌ No local AI providers are currently accessible');
      recommendations.push('💡 Consider installing Ollama for the easiest setup');
      recommendations.push('📖 Check the installation guides for your preferred provider');
    } else {
      recommendations.push(`✅ Found ${successful.length} working AI provider(s)`);
      
      // Recommend the fastest provider
      const fastest = successful.reduce((prev, current) => 
        prev.responseTime < current.responseTime ? prev : current
      );
      recommendations.push(`⚡ Fastest provider: ${fastest.provider} (${fastest.responseTime}ms)`);

      // Recommend providers with most models
      const mostModels = successful.reduce((prev, current) => 
        (prev.models?.length || 0) > (current.models?.length || 0) ? prev : current
      );
      if (mostModels.models && mostModels.models.length > 0) {
        recommendations.push(`🎯 Most models available: ${mostModels.provider} (${mostModels.models.length} models)`);
      }
    }

    // Add specific recommendations for failed providers
    failed.forEach(result => {
      switch (result.provider) {
        case 'Ollama':
          recommendations.push('🔧 Ollama: Run "ollama serve" to start the service');
          break;
        case 'LM Studio':
          recommendations.push('🔧 LM Studio: Open the app and start the server in the Server tab');
          break;
        case 'Docker AI':
          recommendations.push('🔧 Docker: Ensure AI containers are running and ports are accessible');
          break;
      }
    });

    return recommendations;
  }

  // Generate a connection test report
  generateReport(results: ConnectionTestResult[]): string {
    const lines: string[] = [];
    
    lines.push('🔍 Local AI Connection Test Report');
    lines.push('=' .repeat(40));
    lines.push('');

    results.forEach(result => {
      lines.push(`📡 ${result.provider}`);
      lines.push(`   Endpoint: ${result.endpoint}`);
      lines.push(`   Status: ${result.success ? '✅ Connected' : '❌ Failed'}`);
      lines.push(`   Response Time: ${result.responseTime}ms`);
      
      if (result.models && result.models.length > 0) {
        lines.push(`   Models: ${result.models.length} available`);
        result.models.slice(0, 3).forEach(model => {
          lines.push(`     • ${model}`);
        });
        if (result.models.length > 3) {
          lines.push(`     • ... and ${result.models.length - 3} more`);
        }
      }
      
      if (result.capabilities.length > 0) {
        lines.push(`   Capabilities: ${result.capabilities.join(', ')}`);
      }
      
      if (result.warnings.length > 0) {
        lines.push(`   Warnings:`);
        result.warnings.forEach(warning => {
          lines.push(`     ⚠️  ${warning}`);
        });
      }
      
      if (result.error) {
        lines.push(`   Error: ${result.error}`);
      }
      
      lines.push('');
    });

    const recommendations = this.getRecommendations(results);
    if (recommendations.length > 0) {
      lines.push('💡 Recommendations:');
      recommendations.forEach(rec => {
        lines.push(`   ${rec}`);
      });
    }

    return lines.join('\n');
  }
}