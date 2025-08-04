import { EventEmitter } from 'events';
import { ConfigManager } from '../../config/ConfigManager';

// Setup wizard interfaces
export interface SetupStep {
  id: string;
  title: string;
  description: string;
  component: string;
  required: boolean;
  dependencies?: string[];
  estimatedTime: number; // minutes
}

export interface SetupProgress {
  currentStep: number;
  totalSteps: number;
  stepId: string;
  progress: number; // 0-100
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  message?: string;
  error?: string;
}

export interface LocalAIOption {
  id: string;
  name: string;
  description: string;
  type: 'ollama' | 'lm-studio' | 'docker' | 'manual';
  difficulty: 'easy' | 'medium' | 'hard';
  requirements: {
    os: string[];
    minRAM: string;
    minStorage: string;
    gpu?: boolean;
    docker?: boolean;
  };
  features: string[];
  setupSteps: SetupStep[];
}

export interface SetupWizardEvents {
  'step-started': (step: SetupStep) => void;
  'step-progress': (progress: SetupProgress) => void;
  'step-completed': (step: SetupStep, result: any) => void;
  'step-failed': (step: SetupStep, error: Error) => void;
  'wizard-completed': (results: SetupResults) => void;
  'wizard-cancelled': () => void;
}

export interface SetupResults {
  selectedOption: LocalAIOption;
  installedProviders: string[];
  configuration: any;
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class SetupWizard extends EventEmitter {
  private configManager: ConfigManager;
  private currentStep = 0;
  private selectedOption?: LocalAIOption;
  private setupResults: Partial<SetupResults> = {};
  private isRunning = false;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  // Get available local AI options
  getAvailableOptions(): LocalAIOption[] {
    return [
      this.getOllamaOption(),
      this.getLMStudioOption(),
      this.getDockerOption(),
      this.getManualOption()
    ];
  }

  // Start the setup wizard
  async startSetup(optionId: string): Promise<void> {
    if (this.isRunning) {
      throw new Error('Setup wizard is already running');
    }

    const option = this.getAvailableOptions().find(opt => opt.id === optionId);
    if (!option) {
      throw new Error(`Unknown setup option: ${optionId}`);
    }

    this.selectedOption = option;
    this.currentStep = 0;
    this.isRunning = true;
    this.setupResults = {
      selectedOption: option,
      installedProviders: [],
      errors: [],
      warnings: []
    };

    console.log(`Starting setup wizard for ${option.name}`);
    await this.executeSteps();
  }

  // Cancel the setup wizard
  cancelSetup(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.emit('wizard-cancelled');
      console.log('Setup wizard cancelled');
    }
  }

  // Get current progress
  getProgress(): SetupProgress {
    if (!this.selectedOption) {
      return {
        currentStep: 0,
        totalSteps: 0,
        stepId: '',
        progress: 0,
        status: 'pending'
      };
    }

    const steps = this.selectedOption.setupSteps;
    const currentStepData = steps[this.currentStep];

    return {
      currentStep: this.currentStep + 1,
      totalSteps: steps.length,
      stepId: currentStepData?.id || '',
      progress: Math.round(((this.currentStep) / steps.length) * 100),
      status: this.isRunning ? 'in-progress' : 'pending'
    };
  }

  private async executeSteps(): Promise<void> {
    if (!this.selectedOption) return;

    const steps = this.selectedOption.setupSteps;

    try {
      for (let i = 0; i < steps.length; i++) {
        if (!this.isRunning) break;

        this.currentStep = i;
        const step = steps[i];

        this.emit('step-started', step);
        
        try {
          const result = await this.executeStep(step);
          this.emit('step-completed', step, result);
        } catch (error) {
          this.emit('step-failed', step, error as Error);
          this.setupResults.errors?.push(`Step ${step.title}: ${(error as Error).message}`);
          
          if (step.required) {
            throw error;
          }
        }
      }

      this.setupResults.success = true;
      this.emit('wizard-completed', this.setupResults as SetupResults);
    } catch (error) {
      this.setupResults.success = false;
      this.setupResults.errors?.push((error as Error).message);
      this.emit('wizard-completed', this.setupResults as SetupResults);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeStep(step: SetupStep): Promise<any> {
    console.log(`Executing step: ${step.title}`);
    
    // Route to appropriate step handler
    switch (step.id) {
      case 'check-system':
        return this.checkSystemRequirements();
      case 'install-ollama':
        return this.installOllama();
      case 'configure-ollama':
        return this.configureOllama();
      case 'install-lm-studio':
        return this.installLMStudio();
      case 'configure-lm-studio':
        return this.configureLMStudio();
      case 'setup-docker':
        return this.setupDocker();
      case 'configure-docker-ai':
        return this.configureDockerAI();
      case 'manual-setup':
        return this.manualSetup();
      case 'test-connection':
        return this.testConnection();
      case 'download-models':
        return this.downloadModels();
      default:
        console.warn(`Unknown step: ${step.id}`);
        return {};
    }
  }

  // Step implementations will be added in separate files
  private async checkSystemRequirements(): Promise<any> {
    // Implementation in SystemChecker.ts
    const { SystemChecker } = await import('./SystemChecker');
    const checker = new SystemChecker();
    return checker.checkRequirements(this.selectedOption!);
  }

  private async installOllama(): Promise<any> {
    const { OllamaInstaller } = await import('./installers/OllamaInstaller');
    const installer = new OllamaInstaller();
    return installer.install();
  }

  private async configureOllama(): Promise<any> {
    const { OllamaConfigurator } = await import('./configurators/OllamaConfigurator');
    const configurator = new OllamaConfigurator(this.configManager);
    return configurator.configure();
  }

  private async installLMStudio(): Promise<any> {
    const { LMStudioInstaller } = await import('./installers/LMStudioInstaller');
    const installer = new LMStudioInstaller();
    return installer.install();
  }

  private async configureLMStudio(): Promise<any> {
    const { LMStudioConfigurator } = await import('./configurators/LMStudioConfigurator');
    const configurator = new LMStudioConfigurator(this.configManager);
    return configurator.configure();
  }

  private async setupDocker(): Promise<any> {
    const { DockerInstaller } = await import('./installers/DockerInstaller');
    const installer = new DockerInstaller();
    return installer.install();
  }

  private async configureDockerAI(): Promise<any> {
    const { DockerAIConfigurator } = await import('./configurators/DockerAIConfigurator');
    const configurator = new DockerAIConfigurator(this.configManager);
    return configurator.configure();
  }

  private async manualSetup(): Promise<any> {
    const { ManualSetupGuide } = await import('./ManualSetupGuide');
    const guide = new ManualSetupGuide();
    return guide.showInstructions(this.selectedOption!);
  }

  private async testConnection(): Promise<any> {
    const { ConnectionTester } = await import('./ConnectionTester');
    const tester = new ConnectionTester();
    return tester.testProvider(this.selectedOption!);
  }

  private async downloadModels(): Promise<any> {
    const { ModelDownloader } = await import('./ModelDownloader');
    const downloader = new ModelDownloader();
    return downloader.downloadRecommendedModels(this.selectedOption!);
  }

  // Option definitions
  private getOllamaOption(): LocalAIOption {
    return {
      id: 'ollama',
      name: 'Ollama',
      description: 'Easy-to-use local AI with automatic model management',
      type: 'ollama',
      difficulty: 'easy',
      requirements: {
        os: ['windows', 'macos', 'linux'],
        minRAM: '8GB',
        minStorage: '10GB',
        gpu: false
      },
      features: [
        'Automatic model downloads',
        'Simple command-line interface',
        'Multiple model support',
        'Low resource usage',
        'Active community'
      ],
      setupSteps: [
        {
          id: 'check-system',
          title: 'Check System Requirements',
          description: 'Verify your system meets the minimum requirements',
          component: 'SystemCheck',
          required: true,
          estimatedTime: 1
        },
        {
          id: 'install-ollama',
          title: 'Install Ollama',
          description: 'Download and install Ollama on your system',
          component: 'OllamaInstaller',
          required: true,
          estimatedTime: 5
        },
        {
          id: 'configure-ollama',
          title: 'Configure Ollama',
          description: 'Set up Ollama configuration and connection',
          component: 'OllamaConfig',
          required: true,
          dependencies: ['install-ollama'],
          estimatedTime: 2
        },
        {
          id: 'download-models',
          title: 'Download AI Models',
          description: 'Download recommended models for creative writing',
          component: 'ModelDownloader',
          required: false,
          dependencies: ['configure-ollama'],
          estimatedTime: 15
        },
        {
          id: 'test-connection',
          title: 'Test Connection',
          description: 'Verify that everything is working correctly',
          component: 'ConnectionTest',
          required: true,
          dependencies: ['configure-ollama'],
          estimatedTime: 1
        }
      ]
    };
  }

  private getLMStudioOption(): LocalAIOption {
    return {
      id: 'lm-studio',
      name: 'LM Studio',
      description: 'User-friendly GUI for running local AI models',
      type: 'lm-studio',
      difficulty: 'easy',
      requirements: {
        os: ['windows', 'macos', 'linux'],
        minRAM: '16GB',
        minStorage: '20GB',
        gpu: true
      },
      features: [
        'Beautiful graphical interface',
        'Model marketplace',
        'Performance optimization',
        'Chat interface',
        'API server mode'
      ],
      setupSteps: [
        {
          id: 'check-system',
          title: 'Check System Requirements',
          description: 'Verify your system meets the requirements for LM Studio',
          component: 'SystemCheck',
          required: true,
          estimatedTime: 1
        },
        {
          id: 'install-lm-studio',
          title: 'Install LM Studio',
          description: 'Download and install LM Studio application',
          component: 'LMStudioInstaller',
          required: true,
          estimatedTime: 10
        },
        {
          id: 'configure-lm-studio',
          title: 'Configure LM Studio',
          description: 'Set up LM Studio for API access',
          component: 'LMStudioConfig',
          required: true,
          dependencies: ['install-lm-studio'],
          estimatedTime: 3
        },
        {
          id: 'download-models',
          title: 'Download Models',
          description: 'Download models through LM Studio interface',
          component: 'ModelDownloader',
          required: false,
          dependencies: ['configure-lm-studio'],
          estimatedTime: 20
        },
        {
          id: 'test-connection',
          title: 'Test Connection',
          description: 'Test the API connection to LM Studio',
          component: 'ConnectionTest',
          required: true,
          dependencies: ['configure-lm-studio'],
          estimatedTime: 1
        }
      ]
    };
  }

  private getDockerOption(): LocalAIOption {
    return {
      id: 'docker',
      name: 'Docker AI',
      description: 'Containerized AI solutions for advanced users',
      type: 'docker',
      difficulty: 'medium',
      requirements: {
        os: ['windows', 'macos', 'linux'],
        minRAM: '16GB',
        minStorage: '30GB',
        docker: true,
        gpu: true
      },
      features: [
        'Isolated environments',
        'Easy deployment',
        'Multiple AI frameworks',
        'Scalable setup',
        'Version control'
      ],
      setupSteps: [
        {
          id: 'check-system',
          title: 'Check System Requirements',
          description: 'Verify Docker and system requirements',
          component: 'SystemCheck',
          required: true,
          estimatedTime: 2
        },
        {
          id: 'setup-docker',
          title: 'Setup Docker',
          description: 'Install and configure Docker if needed',
          component: 'DockerInstaller',
          required: true,
          estimatedTime: 15
        },
        {
          id: 'configure-docker-ai',
          title: 'Configure AI Containers',
          description: 'Set up AI model containers',
          component: 'DockerAIConfig',
          required: true,
          dependencies: ['setup-docker'],
          estimatedTime: 10
        },
        {
          id: 'download-models',
          title: 'Pull AI Images',
          description: 'Download AI model container images',
          component: 'ModelDownloader',
          required: false,
          dependencies: ['configure-docker-ai'],
          estimatedTime: 30
        },
        {
          id: 'test-connection',
          title: 'Test Containers',
          description: 'Verify AI containers are running correctly',
          component: 'ConnectionTest',
          required: true,
          dependencies: ['configure-docker-ai'],
          estimatedTime: 2
        }
      ]
    };
  }

  private getManualOption(): LocalAIOption {
    return {
      id: 'manual',
      name: 'Manual Setup',
      description: 'Custom setup with detailed instructions',
      type: 'manual',
      difficulty: 'hard',
      requirements: {
        os: ['windows', 'macos', 'linux'],
        minRAM: '8GB',
        minStorage: '10GB'
      },
      features: [
        'Maximum flexibility',
        'Custom configurations',
        'Advanced options',
        'Multiple frameworks',
        'Expert control'
      ],
      setupSteps: [
        {
          id: 'manual-setup',
          title: 'Manual Setup Guide',
          description: 'Follow detailed instructions for custom setup',
          component: 'ManualGuide',
          required: true,
          estimatedTime: 60
        },
        {
          id: 'test-connection',
          title: 'Test Your Setup',
          description: 'Verify your manual configuration works',
          component: 'ConnectionTest',
          required: true,
          dependencies: ['manual-setup'],
          estimatedTime: 5
        }
      ]
    };
  }
}