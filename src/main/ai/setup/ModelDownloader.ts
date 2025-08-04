import { EventEmitter } from 'events';
import { LocalAIOption } from './SetupWizard';

export interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  size: string;
  sizeBytes: number;
  provider: string;
  useCase: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  requirements: {
    minRAM: string;
    gpu: boolean;
    diskSpace: string;
  };
  downloadUrl?: string;
  tags?: string[];
}

export interface DownloadProgress {
  modelName: string;
  stage: 'preparing' | 'downloading' | 'extracting' | 'verifying' | 'complete' | 'failed';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: string; // e.g., "1.2 MB/s"
  eta: string; // e.g., "5m 30s"
  message: string;
}

export interface DownloadResult {
  success: boolean;
  modelName: string;
  error?: string;
  warnings: string[];
  installPath?: string;
  finalSize?: string;
}

export class ModelDownloader extends EventEmitter {
  private activeDownloads: Map<string, AbortController> = new Map();

  async downloadRecommendedModels(option: LocalAIOption): Promise<DownloadResult[]> {
    const recommendedModels = this.getRecommendedModels(option);
    const results: DownloadResult[] = [];

    this.emit('progress', {
      stage: 'preparing',
      progress: 0,
      message: `Preparing to download ${recommendedModels.length} recommended models...`
    });

    for (let i = 0; i < recommendedModels.length; i++) {
      const model = recommendedModels[i];
      
      this.emit('progress', {
        stage: 'downloading',
        progress: (i / recommendedModels.length) * 100,
        message: `Downloading model ${i + 1} of ${recommendedModels.length}: ${model.displayName}`
      });

      const result = await this.downloadModel(model, option);
      results.push(result);

      if (!result.success) {
        console.warn(`Failed to download ${model.name}: ${result.error}`);
      }
    }

    this.emit('progress', {
      stage: 'complete',
      progress: 100,
      message: 'Model downloads completed!'
    });

    return results;
  }

  async downloadModel(model: ModelInfo, option: LocalAIOption): Promise<DownloadResult> {
    const warnings: string[] = [];

    try {
      switch (option.type) {
        case 'ollama':
          return await this.downloadOllamaModel(model);
        case 'lm-studio':
          return await this.downloadLMStudioModel(model);
        case 'docker':
          return await this.downloadDockerModel(model);
        default:
          return {
            success: false,
            modelName: model.name,
            error: `Unsupported provider type: ${option.type}`,
            warnings
          };
      }
    } catch (error) {
      return {
        success: false,
        modelName: model.name,
        error: (error as Error).message,
        warnings
      };
    }
  }

  private async downloadOllamaModel(model: ModelInfo): Promise<DownloadResult> {
    const warnings: string[] = [];
    const abortController = new AbortController();
    this.activeDownloads.set(model.name, abortController);

    try {
      // Check if model is already installed
      const installedModels = await this.getOllamaInstalledModels();
      if (installedModels.includes(model.name)) {
        return {
          success: true,
          modelName: model.name,
          warnings: ['Model is already installed']
        };
      }

      this.emit('modelProgress', {
        modelName: model.name,
        stage: 'preparing',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: model.sizeBytes,
        speed: '0 B/s',
        eta: 'calculating...',
        message: `Preparing to download ${model.displayName}...`
      });

      // Start the download using Ollama's pull command
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: model.name }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to start download: ${response.statusText}`);
      }

      // Stream the response to track progress
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      let downloadedBytes = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.status) {
              const progress = data.completed && data.total 
                ? Math.round((data.completed / data.total) * 100)
                : 0;

              downloadedBytes = data.completed || 0;
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = elapsed > 0 ? this.formatSpeed(downloadedBytes / elapsed) : '0 B/s';
              const eta = this.calculateETA(downloadedBytes, model.sizeBytes, elapsed);

              this.emit('modelProgress', {
                modelName: model.name,
                stage: 'downloading',
                progress,
                downloadedBytes,
                totalBytes: data.total || model.sizeBytes,
                speed,
                eta,
                message: data.status
              });
            }

            if (data.status === 'success') {
              this.emit('modelProgress', {
                modelName: model.name,
                stage: 'complete',
                progress: 100,
                downloadedBytes: model.sizeBytes,
                totalBytes: model.sizeBytes,
                speed: '0 B/s',
                eta: '0s',
                message: 'Download completed successfully!'
              });
              break;
            }
          } catch (error) {
            // Ignore JSON parse errors for non-JSON lines
          }
        }
      }

      return {
        success: true,
        modelName: model.name,
        warnings,
        finalSize: model.size
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          modelName: model.name,
          error: 'Download was cancelled',
          warnings
        };
      }

      return {
        success: false,
        modelName: model.name,
        error: (error as Error).message,
        warnings
      };
    } finally {
      this.activeDownloads.delete(model.name);
    }
  }

  private async downloadLMStudioModel(model: ModelInfo): Promise<DownloadResult> {
    // LM Studio models are typically downloaded through the GUI
    // We can provide instructions instead of automated download
    return {
      success: true,
      modelName: model.name,
      warnings: [
        'LM Studio models must be downloaded through the application',
        'Open LM Studio and browse the model marketplace',
        `Search for "${model.displayName}" and click download`
      ]
    };
  }

  private async downloadDockerModel(model: ModelInfo): Promise<DownloadResult> {
    const warnings: string[] = [];

    try {
      // For Docker, we typically pull container images
      const imageName = this.getDockerImageName(model);
      
      this.emit('modelProgress', {
        modelName: model.name,
        stage: 'downloading',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: model.sizeBytes,
        speed: '0 B/s',
        eta: 'calculating...',
        message: `Pulling Docker image: ${imageName}`
      });

      // This would require Docker API integration
      // For now, provide instructions
      warnings.push(`Run: docker pull ${imageName}`);
      warnings.push('Docker image download must be done manually');

      return {
        success: true,
        modelName: model.name,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        modelName: model.name,
        error: (error as Error).message,
        warnings
      };
    }
  }

  private async getOllamaInstalledModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      return [];
    }
  }

  private getDockerImageName(model: ModelInfo): string {
    // Map model names to Docker image names
    const imageMap: Record<string, string> = {
      'llama3.1:8b': 'ollama/ollama:latest',
      'mistral:7b': 'mistralai/mistral:7b',
      'neural-chat:7b': 'intel/neural-chat:7b'
    };

    return imageMap[model.name] || `ai-models/${model.name}`;
  }

  getRecommendedModels(option: LocalAIOption): ModelInfo[] {
    const allModels = this.getAllAvailableModels();
    
    // Filter models based on provider type and system requirements
    return allModels.filter(model => {
      // Check if model is compatible with the provider
      if (!model.provider.includes(option.type)) {
        return false;
      }

      // For beginners, only show easy models
      if (option.difficulty === 'easy' && model.difficulty !== 'beginner') {
        return false;
      }

      return true;
    }).slice(0, 3); // Limit to top 3 recommendations
  }

  getAllAvailableModels(): ModelInfo[] {
    return [
      {
        name: 'llama3.1:8b',
        displayName: 'Llama 3.1 8B',
        description: 'Meta\'s latest language model, excellent for creative writing and story analysis',
        size: '4.7GB',
        sizeBytes: 4700000000,
        provider: 'ollama,docker',
        useCase: ['creative_writing', 'story_analysis', 'general_chat'],
        difficulty: 'beginner',
        requirements: {
          minRAM: '8GB',
          gpu: false,
          diskSpace: '5GB'
        },
        tags: ['recommended', 'creative', 'fast']
      },
      {
        name: 'llama3.1:13b',
        displayName: 'Llama 3.1 13B',
        description: 'Larger version with better quality, ideal for complex creative tasks',
        size: '7.3GB',
        sizeBytes: 7300000000,
        provider: 'ollama,docker',
        useCase: ['advanced_writing', 'complex_analysis', 'research'],
        difficulty: 'intermediate',
        requirements: {
          minRAM: '16GB',
          gpu: true,
          diskSpace: '8GB'
        },
        tags: ['high_quality', 'creative', 'large']
      },
      {
        name: 'mistral:7b',
        displayName: 'Mistral 7B',
        description: 'Fast and efficient model from Mistral AI, great for quick generation',
        size: '4.1GB',
        sizeBytes: 4100000000,
        provider: 'ollama,lm-studio,docker',
        useCase: ['quick_generation', 'brainstorming', 'dialogue'],
        difficulty: 'beginner',
        requirements: {
          minRAM: '8GB',
          gpu: false,
          diskSpace: '5GB'
        },
        tags: ['fast', 'efficient', 'multilingual']
      },
      {
        name: 'neural-chat:7b',
        displayName: 'Neural Chat 7B',
        description: 'Optimized for conversational AI and dialogue generation',
        size: '4.1GB',
        sizeBytes: 4100000000,
        provider: 'ollama,lm-studio',
        useCase: ['dialogue', 'character_chat', 'conversation'],
        difficulty: 'beginner',
        requirements: {
          minRAM: '8GB',
          gpu: false,
          diskSpace: '5GB'
        },
        tags: ['dialogue', 'chat', 'character']
      },
      {
        name: 'codellama:13b',
        displayName: 'Code Llama 13B',
        description: 'Specialized for code generation and technical writing',
        size: '7.3GB',
        sizeBytes: 7300000000,
        provider: 'ollama,lm-studio',
        useCase: ['code_generation', 'technical_writing', 'documentation'],
        difficulty: 'intermediate',
        requirements: {
          minRAM: '16GB',
          gpu: true,
          diskSpace: '8GB'
        },
        tags: ['code', 'technical', 'programming']
      }
    ];
  }

  getModelsByUseCase(useCase: string): ModelInfo[] {
    return this.getAllAvailableModels().filter(model => 
      model.useCase.includes(useCase)
    );
  }

  getModelsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): ModelInfo[] {
    return this.getAllAvailableModels().filter(model => 
      model.difficulty === difficulty
    );
  }

  cancelDownload(modelName: string): boolean {
    const controller = this.activeDownloads.get(modelName);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(modelName);
      return true;
    }
    return false;
  }

  cancelAllDownloads(): void {
    for (const [modelName, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();
  }

  getActiveDownloads(): string[] {
    return Array.from(this.activeDownloads.keys());
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  private calculateETA(downloadedBytes: number, totalBytes: number, elapsedSeconds: number): string {
    if (elapsedSeconds === 0 || downloadedBytes === 0) {
      return 'calculating...';
    }

    const remainingBytes = totalBytes - downloadedBytes;
    const speed = downloadedBytes / elapsedSeconds;
    const remainingSeconds = remainingBytes / speed;

    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = Math.round(remainingSeconds % 60);
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  getDownloadInstructions(option: LocalAIOption): string[] {
    const instructions: string[] = [];

    switch (option.type) {
      case 'ollama':
        instructions.push(
          '📥 Downloading Models with Ollama:',
          '',
          '1. Ensure Ollama service is running',
          '2. Use the command: ollama pull <model-name>',
          '3. Wait for download to complete',
          '4. Verify with: ollama list',
          '',
          '🎯 Recommended for Creative Writing:',
          '• ollama pull llama3.1:8b',
          '• ollama pull mistral:7b',
          '• ollama pull neural-chat:7b',
          '',
          '💡 Tips:',
          '• Start with smaller models (7B-8B parameters)',
          '• Ensure sufficient disk space before downloading',
          '• Downloads can be resumed if interrupted'
        );
        break;

      case 'lm-studio':
        instructions.push(
          '📥 Downloading Models with LM Studio:',
          '',
          '1. Open LM Studio application',
          '2. Click on the "Discover" or "Models" tab',
          '3. Browse or search for models',
          '4. Click "Download" on your chosen model',
          '5. Wait for download to complete',
          '6. Load the model in the "Chat" tab',
          '',
          '🎯 Recommended Models:',
          '• Search for "Llama 3.1 8B Instruct"',
          '• Look for "Mistral 7B Instruct"',
          '• Try "Neural Chat 7B"',
          '',
          '💡 Tips:',
          '• Check model size vs available disk space',
          '• GGUF format models are recommended',
          '• Higher quantization = better quality but larger size'
        );
        break;

      case 'docker':
        instructions.push(
          '📥 Downloading AI Models with Docker:',
          '',
          '1. Pull AI container images:',
          '   docker pull ollama/ollama:latest',
          '   docker pull mistralai/mistral:7b',
          '',
          '2. Run containers with model access:',
          '   docker run -d -p 11434:11434 ollama/ollama',
          '',
          '3. Download models inside containers:',
          '   docker exec -it <container> ollama pull llama3.1:8b',
          '',
          '💡 Tips:',
          '• Use docker-compose for easier management',
          '• Mount volumes for persistent model storage',
          '• Allocate sufficient memory to containers'
        );
        break;
    }

    return instructions;
  }

  estimateTotalDownloadTime(models: ModelInfo[], speedMbps: number = 50): string {
    const totalBytes = models.reduce((sum, model) => sum + model.sizeBytes, 0);
    const totalMB = totalBytes / (1024 * 1024);
    const timeMinutes = (totalMB * 8) / speedMbps / 60; // Convert to minutes

    if (timeMinutes < 60) {
      return `${Math.round(timeMinutes)} minutes`;
    } else {
      const hours = Math.floor(timeMinutes / 60);
      const minutes = Math.round(timeMinutes % 60);
      return `${hours}h ${minutes}m`;
    }
  }
}