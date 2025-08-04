import { SetupWizard } from '../setup/SetupWizard';
import { SystemChecker } from '../setup/SystemChecker';
import { OllamaInstaller } from '../setup/installers/OllamaInstaller';
import { ConnectionTester } from '../setup/ConnectionTester';
import { ModelDownloader } from '../setup/ModelDownloader';
import { ConfigManager } from '../../config/ConfigManager';

// Mock the dependencies
jest.mock('../setup/SystemChecker');
jest.mock('../setup/installers/OllamaInstaller');
jest.mock('../setup/ConnectionTester');
jest.mock('../setup/ModelDownloader');
jest.mock('../../config/ConfigManager');

describe('SetupWizard', () => {
  let setupWizard: SetupWizard;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    setupWizard = new SetupWizard(mockConfigManager);
  });

  afterEach(() => {
    setupWizard.cancelSetup();
    jest.clearAllMocks();
  });

  describe('Available Options', () => {
    it('should provide all available local AI options', () => {
      const options = setupWizard.getAvailableOptions();
      
      expect(options).toHaveLength(4);
      expect(options.map(opt => opt.id)).toEqual(['ollama', 'lm-studio', 'docker', 'manual']);
    });

    it('should include proper metadata for each option', () => {
      const options = setupWizard.getAvailableOptions();
      
      options.forEach(option => {
        expect(option).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          type: expect.any(String),
          difficulty: expect.stringMatching(/^(easy|medium|hard)$/),
          requirements: expect.objectContaining({
            os: expect.any(Array),
            minRAM: expect.any(String),
            minStorage: expect.any(String)
          }),
          features: expect.any(Array),
          setupSteps: expect.any(Array)
        });
      });
    });

    it('should have proper setup steps for each option', () => {
      const options = setupWizard.getAvailableOptions();
      
      options.forEach(option => {
        expect(option.setupSteps.length).toBeGreaterThan(0);
        
        option.setupSteps.forEach(step => {
          expect(step).toMatchObject({
            id: expect.any(String),
            title: expect.any(String),
            description: expect.any(String),
            component: expect.any(String),
            required: expect.any(Boolean),
            estimatedTime: expect.any(Number)
          });
        });
      });
    });
  });

  describe('Setup Process', () => {
    it('should start setup for valid option', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockResolvedValue({
        overall: 'pass',
        requirements: [],
        canProceed: true,
        warnings: [],
        recommendations: []
      });

      const mockOllamaInstaller = OllamaInstaller as jest.MockedClass<typeof OllamaInstaller>;
      mockOllamaInstaller.prototype.install = jest.fn().mockResolvedValue({
        success: true,
        warnings: []
      });

      const mockConnectionTester = ConnectionTester as jest.MockedClass<typeof ConnectionTester>;
      mockConnectionTester.prototype.testProvider = jest.fn().mockResolvedValue({
        success: true,
        provider: 'Ollama',
        endpoint: 'http://localhost:11434',
        responseTime: 100,
        warnings: [],
        capabilities: []
      });

      const setupPromise = setupWizard.startSetup('ollama');
      
      // Should not throw
      await expect(setupPromise).resolves.toBeUndefined();
    });

    it('should reject setup for invalid option', async () => {
      await expect(setupWizard.startSetup('invalid-option')).rejects.toThrow('Unknown setup option: invalid-option');
    });

    it('should prevent multiple concurrent setups', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const firstSetup = setupWizard.startSetup('ollama');
      
      await expect(setupWizard.startSetup('lm-studio')).rejects.toThrow('Setup wizard is already running');
      
      setupWizard.cancelSetup();
      await expect(firstSetup).resolves.toBeUndefined();
    });

    it('should emit progress events during setup', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockResolvedValue({
        overall: 'pass',
        requirements: [],
        canProceed: true,
        warnings: [],
        recommendations: []
      });

      const progressEvents: any[] = [];
      setupWizard.on('step-started', (step) => progressEvents.push({ type: 'started', step }));
      setupWizard.on('step-completed', (step, result) => progressEvents.push({ type: 'completed', step, result }));

      await setupWizard.startSetup('ollama');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(event => event.type === 'started')).toBe(true);
    });

    it('should handle step failures gracefully', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockRejectedValue(new Error('System check failed'));

      const errorEvents: any[] = [];
      setupWizard.on('step-failed', (step, error) => errorEvents.push({ step, error }));
      setupWizard.on('wizard-completed', (results) => errorEvents.push({ type: 'completed', results }));

      await setupWizard.startSetup('ollama');

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents.some(event => event.error?.message === 'System check failed')).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should provide accurate progress information', () => {
      const progress = setupWizard.getProgress();
      
      expect(progress).toMatchObject({
        currentStep: expect.any(Number),
        totalSteps: expect.any(Number),
        stepId: expect.any(String),
        progress: expect.any(Number),
        status: expect.stringMatching(/^(pending|in-progress|completed|failed|skipped)$/)
      });
    });

    it('should update progress during setup', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockImplementation(async () => {
        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          overall: 'pass',
          requirements: [],
          canProceed: true,
          warnings: [],
          recommendations: []
        };
      });

      const setupPromise = setupWizard.startSetup('ollama');
      
      // Check initial progress
      const initialProgress = setupWizard.getProgress();
      expect(initialProgress.currentStep).toBe(1);
      expect(initialProgress.progress).toBe(0);

      await setupPromise;

      // Progress should have advanced
      const finalProgress = setupWizard.getProgress();
      expect(finalProgress.progress).toBeGreaterThan(initialProgress.progress);
    });
  });

  describe('Setup Cancellation', () => {
    it('should cancel running setup', async () => {
      const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
      mockSystemChecker.prototype.checkRequirements = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      const cancelEvents: any[] = [];
      setupWizard.on('wizard-cancelled', () => cancelEvents.push({ type: 'cancelled' }));

      const setupPromise = setupWizard.startSetup('ollama');
      
      // Cancel after a short delay
      setTimeout(() => setupWizard.cancelSetup(), 100);

      await setupPromise;

      expect(cancelEvents.length).toBe(1);
    });

    it('should handle cancellation of inactive wizard', () => {
      // Should not throw when cancelling inactive wizard
      expect(() => setupWizard.cancelSetup()).not.toThrow();
    });
  });
});

describe('SystemChecker', () => {
  let systemChecker: SystemChecker;

  beforeEach(() => {
    systemChecker = new SystemChecker();
  });

  describe('System Requirements', () => {
    it('should check operating system compatibility', async () => {
      const mockOption = {
        requirements: {
          os: ['windows', 'macos', 'linux'],
          minRAM: '8GB',
          minStorage: '10GB'
        }
      } as any;

      const result = await systemChecker.checkRequirements(mockOption);
      
      expect(result).toMatchObject({
        overall: expect.stringMatching(/^(pass|fail|warning)$/),
        requirements: expect.any(Array),
        canProceed: expect.any(Boolean),
        warnings: expect.any(Array),
        recommendations: expect.any(Array)
      });

      // Should have OS requirement
      const osRequirement = result.requirements.find(req => req.name === 'Operating System');
      expect(osRequirement).toBeDefined();
    });

    it('should check RAM requirements', async () => {
      const mockOption = {
        requirements: {
          os: ['windows', 'macos', 'linux'],
          minRAM: '32GB', // High requirement to test warning/fail
          minStorage: '10GB'
        }
      } as any;

      const result = await systemChecker.checkRequirements(mockOption);
      
      const ramRequirement = result.requirements.find(req => req.name === 'RAM Memory');
      expect(ramRequirement).toBeDefined();
      expect(ramRequirement?.status).toMatch(/^(pass|fail|warning)$/);
    });

    it('should provide system information', async () => {
      const systemInfo = await systemChecker.getSystemInfo();
      
      expect(systemInfo).toMatchObject({
        platform: expect.any(String),
        arch: expect.any(String),
        release: expect.any(String),
        totalMemory: expect.stringMatching(/\d+GB/),
        freeMemory: expect.stringMatching(/\d+GB/),
        cpus: expect.any(Number),
        nodeVersion: expect.any(String)
      });
    });
  });
});

describe('ConnectionTester', () => {
  let connectionTester: ConnectionTester;

  beforeEach(() => {
    connectionTester = new ConnectionTester();
    
    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Provider Testing', () => {
    it('should test Ollama connection', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.1:8b' }] })
      } as Response);

      const mockOption = { type: 'ollama', name: 'Ollama' } as any;
      const result = await connectionTester.testProvider(mockOption);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        provider: 'Ollama',
        endpoint: expect.any(String),
        responseTime: expect.any(Number),
        warnings: expect.any(Array),
        capabilities: expect.any(Array)
      });
    });

    it('should test LM Studio connection', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'llama-3.1-8b' }] })
      } as Response);

      const mockOption = { type: 'lm-studio', name: 'LM Studio' } as any;
      const result = await connectionTester.testProvider(mockOption);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        provider: 'LM Studio',
        endpoint: expect.any(String),
        responseTime: expect.any(Number),
        warnings: expect.any(Array),
        capabilities: expect.any(Array)
      });
    });

    it('should handle connection failures', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const mockOption = { type: 'ollama', name: 'Ollama' } as any;
      const result = await connectionTester.testProvider(mockOption);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('should generate connection recommendations', () => {
      const mockResults = [
        {
          success: true,
          provider: 'Ollama',
          endpoint: 'http://localhost:11434',
          responseTime: 100,
          models: ['llama3.1:8b'],
          warnings: [],
          capabilities: ['text_generation']
        },
        {
          success: false,
          provider: 'LM Studio',
          endpoint: 'http://localhost:1234',
          responseTime: 0,
          error: 'Connection refused',
          warnings: [],
          capabilities: []
        }
      ] as any[];

      const recommendations = connectionTester.getRecommendations(mockResults);
      
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('Ollama'))).toBe(true);
    });
  });
});

describe('ModelDownloader', () => {
  let modelDownloader: ModelDownloader;

  beforeEach(() => {
    modelDownloader = new ModelDownloader();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    modelDownloader.cancelAllDownloads();
    jest.restoreAllMocks();
  });

  describe('Model Information', () => {
    it('should provide available models', () => {
      const models = modelDownloader.getAllAvailableModels();
      
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      
      models.forEach(model => {
        expect(model).toMatchObject({
          name: expect.any(String),
          displayName: expect.any(String),
          description: expect.any(String),
          size: expect.any(String),
          sizeBytes: expect.any(Number),
          provider: expect.any(String),
          useCase: expect.any(Array),
          difficulty: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
          requirements: expect.objectContaining({
            minRAM: expect.any(String),
            gpu: expect.any(Boolean),
            diskSpace: expect.any(String)
          })
        });
      });
    });

    it('should filter models by use case', () => {
      const creativeModels = modelDownloader.getModelsByUseCase('creative_writing');
      
      expect(creativeModels).toBeInstanceOf(Array);
      creativeModels.forEach(model => {
        expect(model.useCase).toContain('creative_writing');
      });
    });

    it('should filter models by difficulty', () => {
      const beginnerModels = modelDownloader.getModelsByDifficulty('beginner');
      
      expect(beginnerModels).toBeInstanceOf(Array);
      beginnerModels.forEach(model => {
        expect(model.difficulty).toBe('beginner');
      });
    });

    it('should provide recommended models for options', () => {
      const mockOption = { type: 'ollama', difficulty: 'easy' } as any;
      const recommended = modelDownloader.getRecommendedModels(mockOption);
      
      expect(recommended).toBeInstanceOf(Array);
      expect(recommended.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Download Management', () => {
    it('should track active downloads', () => {
      const activeDownloads = modelDownloader.getActiveDownloads();
      expect(activeDownloads).toBeInstanceOf(Array);
      expect(activeDownloads.length).toBe(0);
    });

    it('should cancel specific downloads', () => {
      const result = modelDownloader.cancelDownload('non-existent-model');
      expect(result).toBe(false);
    });

    it('should cancel all downloads', () => {
      expect(() => modelDownloader.cancelAllDownloads()).not.toThrow();
    });

    it('should estimate download time', () => {
      const models = modelDownloader.getAllAvailableModels().slice(0, 2);
      const estimatedTime = modelDownloader.estimateTotalDownloadTime(models, 50);
      
      expect(estimatedTime).toMatch(/\d+(\.\d+)?\s*(minutes?|hours?|h|m)/);
    });
  });

  describe('Download Instructions', () => {
    it('should provide instructions for each provider type', () => {
      const providerTypes = ['ollama', 'lm-studio', 'docker'] as const;
      
      providerTypes.forEach(type => {
        const mockOption = { type } as any;
        const instructions = modelDownloader.getDownloadInstructions(mockOption);
        
        expect(instructions).toBeInstanceOf(Array);
        expect(instructions.length).toBeGreaterThan(0);
        expect(instructions.some(instruction => instruction.includes(type))).toBe(true);
      });
    });
  });
});

describe('Integration Tests', () => {
  let setupWizard: SetupWizard;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    setupWizard = new SetupWizard(mockConfigManager);
  });

  it('should complete full Ollama setup workflow', async () => {
    // Mock all dependencies for successful setup
    const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
    mockSystemChecker.prototype.checkRequirements = jest.fn().mockResolvedValue({
      overall: 'pass',
      requirements: [
        { name: 'Operating System', required: true, status: 'pass', message: 'Supported' },
        { name: 'RAM Memory', required: true, status: 'pass', message: 'Sufficient' }
      ],
      canProceed: true,
      warnings: [],
      recommendations: []
    });

    const mockOllamaInstaller = OllamaInstaller as jest.MockedClass<typeof OllamaInstaller>;
    mockOllamaInstaller.prototype.install = jest.fn().mockResolvedValue({
      success: true,
      version: '0.1.0',
      installPath: '/usr/local/bin/ollama',
      warnings: []
    });

    const mockConnectionTester = ConnectionTester as jest.MockedClass<typeof ConnectionTester>;
    mockConnectionTester.prototype.testProvider = jest.fn().mockResolvedValue({
      success: true,
      provider: 'Ollama',
      endpoint: 'http://localhost:11434',
      responseTime: 150,
      models: ['llama3.1:8b'],
      warnings: [],
      capabilities: ['text_generation']
    });

    const events: any[] = [];
    setupWizard.on('wizard-completed', (results) => events.push(results));

    await setupWizard.startSetup('ollama');

    expect(events.length).toBe(1);
    expect(events[0].success).toBe(true);
    expect(events[0].selectedOption.id).toBe('ollama');
  });

  it('should handle partial failures in setup workflow', async () => {
    // Mock system check success but installer failure
    const mockSystemChecker = SystemChecker as jest.MockedClass<typeof SystemChecker>;
    mockSystemChecker.prototype.checkRequirements = jest.fn().mockResolvedValue({
      overall: 'pass',
      requirements: [],
      canProceed: true,
      warnings: [],
      recommendations: []
    });

    const mockOllamaInstaller = OllamaInstaller as jest.MockedClass<typeof OllamaInstaller>;
    mockOllamaInstaller.prototype.install = jest.fn().mockRejectedValue(new Error('Installation failed'));

    const events: any[] = [];
    setupWizard.on('wizard-completed', (results) => events.push(results));

    await setupWizard.startSetup('ollama');

    expect(events.length).toBe(1);
    expect(events[0].success).toBe(false);
    expect(events[0].errors).toContain('Installation failed');
  });
});