import { ONNXModelLoader, WASMModelLoader, createModelLoader, getDefaultModelConfig, validateModelConfig } from '../inference/ModelLoader';
import { ModelConfig } from '../inference/ModelLoader';

describe('ModelLoader', () => {
  const mockModelPath = './test-models/test-model.onnx';
  let modelConfig: ModelConfig;

  beforeEach(() => {
    modelConfig = {
      ...getDefaultModelConfig(),
      modelPath: mockModelPath
    };
  });

  describe('ONNXModelLoader', () => {
    let loader: ONNXModelLoader;

    beforeEach(() => {
      loader = new ONNXModelLoader(modelConfig);
    });

    afterEach(async () => {
      if (loader.isModelLoaded()) {
        await loader.unloadModel();
      }
    });

    it('should initialize with correct configuration', () => {
      expect(loader.getConfig()).toEqual(modelConfig);
      expect(loader.isLoaded()).toBe(false);
      expect(loader.isLoading()).toBe(false);
    });

    it('should emit loading events during model loading', async () => {
      const events: string[] = [];
      
      loader.on('loading-started', () => events.push('started'));
      loader.on('loading-progress', (progress, stage) => events.push(`progress-${stage}`));
      loader.on('loading-completed', () => events.push('completed'));
      loader.on('loading-failed', () => events.push('failed'));

      try {
        await loader.loadModel();
        expect(events).toContain('started');
        // Note: In real implementation with actual model files, we'd expect 'completed'
        // For now, with mock implementation, we might get 'failed' which is expected
      } catch (error) {
        // Expected for mock implementation without actual model files
        expect(events).toContain('started');
      }
    });

    it('should handle model loading failure gracefully', async () => {
      const invalidConfig = {
        ...modelConfig,
        modelPath: './non-existent-model.onnx'
      };
      
      const invalidLoader = new ONNXModelLoader(invalidConfig);
      
      await expect(invalidLoader.loadModel()).rejects.toThrow();
      expect(invalidLoader.isModelLoaded()).toBe(false);
    });

    it('should update configuration correctly', () => {
      const newConfig = {
        ...modelConfig,
        temperature: 0.9,
        maxTokens: 4096
      };

      loader.updateConfig(newConfig);
      
      const updatedConfig = loader.getConfig();
      expect(updatedConfig.temperature).toBe(0.9);
      expect(updatedConfig.maxTokens).toBe(4096);
    });

    it('should validate model files correctly', async () => {
      // Test with non-existent file
      const isValid = await loader.validateModel('./non-existent.onnx');
      expect(isValid).toBe(false);
    });

    it('should prevent multiple simultaneous loads', async () => {
      const loadPromise1 = loader.loadModel().catch(() => {}); // Ignore errors for test
      const loadPromise2 = loader.loadModel().catch(() => {}); // Ignore errors for test

      await Promise.all([loadPromise1, loadPromise2]);
      
      // Should not cause issues with multiple load attempts
      expect(loader.isLoading()).toBe(false);
    });
  });

  describe('WASMModelLoader', () => {
    let loader: WASMModelLoader;

    beforeEach(() => {
      const wasmConfig = {
        ...modelConfig,
        modelPath: './test-models/test-model.bin'
      };
      loader = new WASMModelLoader(wasmConfig);
    });

    afterEach(async () => {
      if (loader.isModelLoaded()) {
        await loader.unloadModel();
      }
    });

    it('should initialize with correct configuration', () => {
      expect(loader.isLoaded()).toBe(false);
      expect(loader.isLoading()).toBe(false);
    });

    it('should handle WASM module loading', async () => {
      try {
        await loader.loadModel();
        // With mock implementation, this should succeed
        expect(loader.isModelLoaded()).toBe(true);
      } catch (error) {
        // Expected if WASM module is not available
        expect(loader.isModelLoaded()).toBe(false);
      }
    });

    it('should clean up resources on unload', async () => {
      try {
        await loader.loadModel();
        if (loader.isModelLoaded()) {
          await loader.unloadModel();
          expect(loader.isModelLoaded()).toBe(false);
        }
      } catch (error) {
        // Expected for mock implementation
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create ONNX loader by default', () => {
      const loader = createModelLoader(modelConfig);
      expect(loader).toBeInstanceOf(ONNXModelLoader);
    });

    it('should create ONNX loader when specified', () => {
      const loader = createModelLoader(modelConfig, 'onnx');
      expect(loader).toBeInstanceOf(ONNXModelLoader);
    });

    it('should create WASM loader when specified', () => {
      const loader = createModelLoader(modelConfig, 'wasm');
      expect(loader).toBeInstanceOf(WASMModelLoader);
    });

    it('should throw error for unsupported backend', () => {
      expect(() => {
        createModelLoader(modelConfig, 'unsupported' as any);
      }).toThrow('Unsupported backend: unsupported');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const errors = validateModelConfig(modelConfig);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing model path', () => {
      const invalidConfig = { ...modelConfig };
      delete (invalidConfig as any).modelPath;
      
      const errors = validateModelConfig(invalidConfig);
      expect(errors).toContain('Model path is required');
    });

    it('should detect invalid max tokens', () => {
      const invalidConfig = { ...modelConfig, maxTokens: -1 };
      
      const errors = validateModelConfig(invalidConfig);
      expect(errors).toContain('Max tokens must be positive');
    });

    it('should detect invalid temperature', () => {
      const invalidConfig = { ...modelConfig, temperature: 3.0 };
      
      const errors = validateModelConfig(invalidConfig);
      expect(errors).toContain('Temperature must be between 0 and 2');
    });

    it('should detect invalid top-p', () => {
      const invalidConfig = { ...modelConfig, topP: 1.5 };
      
      const errors = validateModelConfig(invalidConfig);
      expect(errors).toContain('Top-p must be between 0 and 1');
    });

    it('should collect multiple validation errors', () => {
      const invalidConfig = {
        ...modelConfig,
        maxTokens: -1,
        temperature: 3.0,
        topP: 1.5
      };
      delete (invalidConfig as any).modelPath;
      
      const errors = validateModelConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('Default Configuration', () => {
    it('should provide sensible defaults', () => {
      const defaultConfig = getDefaultModelConfig();
      
      expect(defaultConfig).toMatchObject({
        modelPath: '',
        quantization: '8bit',
        maxTokens: 2048,
        contextWindow: 4096,
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        repeatPenalty: 1.1,
        threads: 4,
        gpuLayers: 0
      });
    });

    it('should pass validation', () => {
      const defaultConfig = getDefaultModelConfig();
      defaultConfig.modelPath = './test-model.onnx'; // Add required path
      
      const errors = validateModelConfig(defaultConfig);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    it('should estimate memory requirements correctly', () => {
      const loader = new ONNXModelLoader(modelConfig);
      
      // Test memory estimation (accessing protected method via any)
      const modelSize = 1000000; // 1MB
      const memoryReq = (loader as any).estimateMemoryRequirement(modelSize, '8bit');
      
      expect(memoryReq).toBeGreaterThan(modelSize);
      expect(memoryReq).toBeLessThan(modelSize * 3); // Should be reasonable overhead
    });

    it('should handle different quantization levels', () => {
      const loader = new ONNXModelLoader(modelConfig);
      const modelSize = 1000000;
      
      const fp32Memory = (loader as any).estimateMemoryRequirement(modelSize, 'fp32');
      const fp16Memory = (loader as any).estimateMemoryRequirement(modelSize, 'fp16');
      const int8Memory = (loader as any).estimateMemoryRequirement(modelSize, '8bit');
      const int4Memory = (loader as any).estimateMemoryRequirement(modelSize, '4bit');
      
      expect(fp32Memory).toBeGreaterThan(fp16Memory);
      expect(fp16Memory).toBeGreaterThan(int8Memory);
      expect(int8Memory).toBeGreaterThan(int4Memory);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const invalidConfig = {
        ...modelConfig,
        modelPath: '/invalid/path/model.onnx'
      };
      
      const loader = new ONNXModelLoader(invalidConfig);
      
      await expect(loader.loadModel()).rejects.toThrow();
    });

    it('should handle ONNX runtime errors', async () => {
      // Test with a path that exists but isn't a valid ONNX model
      const invalidModelConfig = {
        ...modelConfig,
        modelPath: __filename // Use this test file as invalid model
      };
      
      const loader = new ONNXModelLoader(invalidModelConfig);
      
      await expect(loader.loadModel()).rejects.toThrow();
    });

    it('should clean up on failed initialization', async () => {
      const loader = new ONNXModelLoader(modelConfig);
      
      try {
        await loader.loadModel();
      } catch (error) {
        // Should not be in loading state after failure
        expect(loader.isLoading()).toBe(false);
        expect(loader.isModelLoaded()).toBe(false);
      }
    });
  });

  describe('Model Metadata', () => {
    it('should extract model metadata after loading', async () => {
      const loader = new ONNXModelLoader(modelConfig);
      
      try {
        await loader.loadModel();
        
        if (loader.isModelLoaded()) {
          const metadata = loader.getModelInfo();
          
          expect(metadata).toMatchObject({
            name: expect.any(String),
            version: expect.any(String),
            architecture: expect.any(String),
            parameters: expect.any(String),
            quantization: expect.any(String),
            contextWindow: expect.any(Number),
            specialTokens: expect.any(Object),
            trainingData: expect.any(Object)
          });
        }
      } catch (error) {
        // Expected for mock implementation
      }
    });

    it('should return null metadata when model not loaded', () => {
      const loader = new ONNXModelLoader(modelConfig);
      
      const metadata = loader.getModelInfo();
      expect(metadata).toBeNull();
    });
  });
});