import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { ConfigManager } from '../../../config/ConfigManager';

export interface OllamaConfig {
  host: string;
  port: number;
  timeout: number;
  maxConcurrentRequests: number;
  modelPath?: string;
  enableGPU: boolean;
  gpuLayers?: number;
}

export interface ConfigurationResult {
  success: boolean;
  config?: OllamaConfig;
  serviceRunning: boolean;
  error?: string;
  warnings: string[];
}

export class OllamaConfigurator extends EventEmitter {
  private configManager: ConfigManager;
  private defaultConfig: OllamaConfig = {
    host: 'localhost',
    port: 11434,
    timeout: 30000,
    maxConcurrentRequests: 4,
    enableGPU: true
  };

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  async configure(): Promise<ConfigurationResult> {
    const warnings: string[] = [];

    try {
      this.emit('progress', {
        stage: 'detection',
        progress: 10,
        message: 'Detecting Ollama installation...'
      });

      // Check if Ollama is installed
      if (!await this.isOllamaInstalled()) {
        throw new Error('Ollama is not installed. Please install Ollama first.');
      }

      this.emit('progress', {
        stage: 'service',
        progress: 30,
        message: 'Starting Ollama service...'
      });

      // Start Ollama service
      const serviceStarted = await this.startOllamaService();
      if (!serviceStarted) {
        warnings.push('Could not start Ollama service automatically - you may need to start it manually');
      }

      this.emit('progress', {
        stage: 'configuration',
        progress: 50,
        message: 'Configuring Ollama settings...'
      });

      // Detect optimal configuration
      const config = await this.detectOptimalConfig();

      this.emit('progress', {
        stage: 'testing',
        progress: 70,
        message: 'Testing Ollama connection...'
      });

      // Test connection
      const connectionTest = await this.testConnection(config);
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      this.emit('progress', {
        stage: 'saving',
        progress: 90,
        message: 'Saving configuration...'
      });

      // Save configuration
      await this.saveConfiguration(config);

      this.emit('progress', {
        stage: 'complete',
        progress: 100,
        message: 'Ollama configuration completed successfully!'
      });

      return {
        success: true,
        config,
        serviceRunning: await this.isServiceRunning(),
        warnings
      };
    } catch (error) {
      return {
        success: false,
        serviceRunning: await this.isServiceRunning(),
        error: (error as Error).message,
        warnings
      };
    }
  }

  private async isOllamaInstalled(): Promise<boolean> {
    try {
      execSync('ollama --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async startOllamaService(): Promise<boolean> {
    try {
      // Check if service is already running
      if (await this.isServiceRunning()) {
        return true;
      }

      // Try to start the service
      const process = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });

      process.unref();

      // Wait a moment for service to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      return await this.isServiceRunning();
    } catch (error) {
      console.error('Failed to start Ollama service:', error);
      return false;
    }
  }

  private async isServiceRunning(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async detectOptimalConfig(): Promise<OllamaConfig> {
    const config = { ...this.defaultConfig };

    // Detect if GPU is available
    config.enableGPU = await this.detectGPU();

    // Detect optimal port (check if default is available)
    config.port = await this.findAvailablePort(config.port);

    // Detect system capabilities for concurrent requests
    config.maxConcurrentRequests = await this.detectOptimalConcurrency();

    return config;
  }

  private async detectGPU(): Promise<boolean> {
    try {
      // Try to detect NVIDIA GPU
      try {
        execSync('nvidia-smi', { stdio: 'pipe' });
        return true;
      } catch (error) {
        // NVIDIA not found, try other methods
      }

      // Try to detect AMD GPU on Linux
      if (process.platform === 'linux') {
        try {
          const output = execSync('lspci | grep -i amd', { encoding: 'utf8' });
          if (output.includes('VGA') || output.includes('Display')) {
            return true;
          }
        } catch (error) {
          // AMD not found
        }
      }

      // Try to detect Apple Silicon GPU
      if (process.platform === 'darwin') {
        try {
          const output = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf8' });
          if (output.includes('Apple') && (output.includes('M1') || output.includes('M2') || output.includes('M3'))) {
            return true;
          }
        } catch (error) {
          // Apple Silicon detection failed
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 10; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return startPort; // Fallback to original port
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(1000)
      });
      return false; // Port is in use
    } catch (error) {
      return true; // Port is available
    }
  }

  private async detectOptimalConcurrency(): Promise<number> {
    const cpuCount = require('os').cpus().length;
    const totalMemoryGB = Math.round(require('os').totalmem() / (1024 * 1024 * 1024));

    // Conservative approach: limit based on available resources
    if (totalMemoryGB < 8) {
      return 1;
    } else if (totalMemoryGB < 16) {
      return 2;
    } else if (totalMemoryGB < 32) {
      return Math.min(4, Math.floor(cpuCount / 2));
    } else {
      return Math.min(8, cpuCount);
    }
  }

  private async testConnection(config: OllamaConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `http://${config.host}:${config.port}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeout)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async saveConfiguration(config: OllamaConfig): Promise<void> {
    // Save to config manager
    await this.configManager.updateAIProvider('ollama', {
      type: 'local',
      name: 'Ollama',
      enabled: true,
      config: {
        endpoint: `http://${config.host}:${config.port}`,
        timeout: config.timeout,
        maxConcurrentRequests: config.maxConcurrentRequests,
        enableGPU: config.enableGPU,
        gpuLayers: config.gpuLayers
      }
    });

    console.log('Ollama configuration saved successfully');
  }

  // Public utility methods
  async getInstalledModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Failed to get installed models:', error);
      return [];
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      this.emit('progress', {
        stage: 'download',
        progress: 0,
        message: `Downloading model: ${modelName}...`
      });

      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Stream the response to track progress
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status) {
                this.emit('progress', {
                  stage: 'download',
                  progress: data.completed ? Math.round((data.completed / data.total) * 100) : 0,
                  message: data.status
                });
              }
            } catch (error) {
              // Ignore JSON parse errors
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error);
      return false;
    }
  }

  async removeModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      });

      return response.ok;
    } catch (error) {
      console.error(`Failed to remove model ${modelName}:`, error);
      return false;
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await fetch('http://localhost:11434/api/show', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get model info for ${modelName}:`, error);
      return null;
    }
  }

  getRecommendedModels(): Array<{ name: string; description: string; size: string; use: string }> {
    return [
      {
        name: 'llama3.1:8b',
        description: 'Llama 3.1 8B - Great balance of quality and speed',
        size: '4.7GB',
        use: 'General creative writing and story analysis'
      },
      {
        name: 'llama3.1:13b',
        description: 'Llama 3.1 13B - Higher quality, slower',
        size: '7.3GB',
        use: 'Advanced creative writing and complex analysis'
      },
      {
        name: 'mistral:7b',
        description: 'Mistral 7B - Fast and efficient',
        size: '4.1GB',
        use: 'Quick text generation and brainstorming'
      },
      {
        name: 'codellama:13b',
        description: 'Code Llama 13B - Specialized for code',
        size: '7.3GB',
        use: 'Code generation and technical writing'
      },
      {
        name: 'neural-chat:7b',
        description: 'Neural Chat 7B - Optimized for conversation',
        size: '4.1GB',
        use: 'Dialogue generation and character interactions'
      }
    ];
  }

  async getServiceStatus(): Promise<{
    running: boolean;
    version?: string;
    models: string[];
    config: OllamaConfig;
  }> {
    const running = await this.isServiceRunning();
    let version: string | undefined;
    let models: string[] = [];

    if (running) {
      try {
        version = execSync('ollama --version', { encoding: 'utf8' }).trim();
        models = await this.getInstalledModels();
      } catch (error) {
        // Ignore errors
      }
    }

    return {
      running,
      version,
      models,
      config: this.defaultConfig
    };
  }

  getConfigurationInstructions(): string[] {
    return [
      '1. Ensure Ollama is installed and running',
      '2. Start the Ollama service: ollama serve',
      '3. Pull a model: ollama pull llama3.1:8b',
      '4. Test the installation: ollama run llama3.1:8b "Hello"',
      '5. The service will be available at http://localhost:11434',
      '',
      'Recommended models for creative writing:',
      '• llama3.1:8b - Best balance of quality and speed',
      '• mistral:7b - Fast and efficient',
      '• neural-chat:7b - Great for dialogue',
      '',
      'GPU Acceleration:',
      '• NVIDIA: Automatically detected and used',
      '• AMD: Limited support on Linux',
      '• Apple Silicon: Automatically used on M1/M2/M3 Macs'
    ];
  }
}