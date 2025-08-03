import { ModelLoader } from '../inference/ModelLoader';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ModelLoader', () => {
  let modelLoader: ModelLoader;

  beforeEach(() => {
    modelLoader = ModelLoader.getInstance();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await modelLoader.unloadAllModels();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ModelLoader.getInstance();
      const instance2 = ModelLoader.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('ONNX model loading', () => {
    it('should load ONNX model successfully', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);

      const model = await modelLoader.loadONNXModel(modelPath, modelName);

      expect(model).toBeDefined();
      expect(model.modelPath).toBe(modelPath);
      expect(model.modelName).toBe(modelName);
      expect(model.inputNames).toEqual(['input_ids', 'attention_mask']);
      expect(model.outputNames).toEqual(['logits']);
      expect(typeof model.run).toBe('function');
    });

    it('should throw error if model file does not exist', async () => {
      const modelPath = '/nonexistent/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(false);

      await expect(modelLoader.loadONNXModel(modelPath, modelName))
        .rejects.toThrow('Model file not found');
    });

    it('should return cached model if already loaded', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);

      const model1 = await modelLoader.loadONNXModel(modelPath, modelName);
      const model2 = await modelLoader.loadONNXModel(modelPath, modelName);

      expect(model1).toBe(model2);
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1);
    });

    it('should perform inference with loaded model', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);

      const model = await modelLoader.loadONNXModel(modelPath, modelName);
      const result = await model.run({ input_ids: [1, 2, 3] });

      expect(result).toHaveProperty('logits');
      expect(result.logits).toBeInstanceOf(Float32Array);
    });
  });

  describe('WebAssembly model loading', () => {
    it('should load WebAssembly model successfully', async () => {
      const wasmPath = '/path/to/model.wasm';
      const modelName = 'test-wasm-model';
      const mockWasmBuffer = new ArrayBuffer(100);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from(mockWasmBuffer));

      // Mock WebAssembly.instantiate
      const mockInstance = {
        exports: {
          predict: jest.fn(),
          generateText: jest.fn()
        }
      };
      
      global.WebAssembly = {
        instantiate: jest.fn().mockResolvedValue({
          instance: mockInstance,
          module: {}
        })
      } as any;

      const model = await modelLoader.loadWebAssemblyModel(wasmPath, modelName);

      expect(model).toBeDefined();
      expect(model.wasmPath).toBe(wasmPath);
      expect(model.modelName).toBe(modelName);
      expect(typeof model.predict).toBe('function');
      expect(typeof model.generateText).toBe('function');
    });

    it('should throw error if WASM file does not exist', async () => {
      const wasmPath = '/nonexistent/model.wasm';
      const modelName = 'test-wasm-model';

      mockFs.existsSync.mockReturnValue(false);

      await expect(modelLoader.loadWebAssemblyModel(wasmPath, modelName))
        .rejects.toThrow('WASM file not found');
    });

    it('should perform prediction with WASM model', async () => {
      const wasmPath = '/path/to/model.wasm';
      const modelName = 'test-wasm-model';
      const mockWasmBuffer = new ArrayBuffer(100);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from(mockWasmBuffer));

      global.WebAssembly = {
        instantiate: jest.fn().mockResolvedValue({
          instance: { exports: {} },
          module: {}
        })
      } as any;

      const model = await modelLoader.loadWebAssemblyModel(wasmPath, modelName);
      const result = model.predict(new Float32Array([1, 2, 3]));

      expect(result).toBeInstanceOf(Float32Array);
    });
  });

  describe('model management', () => {
    it('should check if model is loaded', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      expect(modelLoader.isModelLoaded(modelName)).toBe(false);

      mockFs.existsSync.mockReturnValue(true);
      await modelLoader.loadONNXModel(modelPath, modelName);

      expect(modelLoader.isModelLoaded(modelName)).toBe(true);
    });

    it('should get loaded model', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);
      const loadedModel = await modelLoader.loadONNXModel(modelPath, modelName);
      const retrievedModel = modelLoader.getLoadedModel(modelName);

      expect(retrievedModel).toBe(loadedModel);
    });

    it('should unload model', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);
      await modelLoader.loadONNXModel(modelPath, modelName);

      expect(modelLoader.isModelLoaded(modelName)).toBe(true);

      await modelLoader.unloadModel(modelName);

      expect(modelLoader.isModelLoaded(modelName)).toBe(false);
    });

    it('should unload all models', async () => {
      const modelPath1 = '/path/to/model1.onnx';
      const modelPath2 = '/path/to/model2.onnx';
      const modelName1 = 'test-model-1';
      const modelName2 = 'test-model-2';

      mockFs.existsSync.mockReturnValue(true);
      await modelLoader.loadONNXModel(modelPath1, modelName1);
      await modelLoader.loadONNXModel(modelPath2, modelName2);

      expect(modelLoader.isModelLoaded(modelName1)).toBe(true);
      expect(modelLoader.isModelLoaded(modelName2)).toBe(true);

      await modelLoader.unloadAllModels();

      expect(modelLoader.isModelLoaded(modelName1)).toBe(false);
      expect(modelLoader.isModelLoaded(modelName2)).toBe(false);
    });
  });

  describe('model information', () => {
    it('should get model info', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);
      await modelLoader.loadONNXModel(modelPath, modelName);

      const info = modelLoader.getModelInfo(modelName);

      expect(info).toEqual({
        name: modelName,
        type: 'ONNX',
        path: modelPath,
        inputNames: ['input_ids', 'attention_mask'],
        outputNames: ['logits'],
        loaded: true
      });
    });

    it('should return null for non-existent model info', () => {
      const info = modelLoader.getModelInfo('nonexistent-model');
      expect(info).toBeNull();
    });

    it('should get all model info', async () => {
      const modelPath1 = '/path/to/model1.onnx';
      const modelPath2 = '/path/to/model2.wasm';
      const modelName1 = 'test-model-1';
      const modelName2 = 'test-model-2';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(Buffer.from(new ArrayBuffer(100)));

      global.WebAssembly = {
        instantiate: jest.fn().mockResolvedValue({
          instance: { exports: {} },
          module: {}
        })
      } as any;

      await modelLoader.loadONNXModel(modelPath1, modelName1);
      await modelLoader.loadWebAssemblyModel(modelPath2, modelName2);

      const allInfo = modelLoader.getAllModelInfo();

      expect(allInfo).toHaveLength(2);
      expect(allInfo.some(info => info.name === modelName1)).toBe(true);
      expect(allInfo.some(info => info.name === modelName2)).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should validate model path', () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes('valid');
      });

      expect(ModelLoader.validateModelPath('/valid/model.onnx')).toBe(true);
      expect(ModelLoader.validateModelPath('/valid/model.wasm')).toBe(true);
      expect(ModelLoader.validateModelPath('/invalid/model.onnx')).toBe(false);
      expect(ModelLoader.validateModelPath('/valid/model.txt')).toBe(false);
    });

    it('should get model type from path', () => {
      expect(ModelLoader.getModelType('/path/to/model.onnx')).toBe('onnx');
      expect(ModelLoader.getModelType('/path/to/model.wasm')).toBe('wasm');
      expect(ModelLoader.getModelType('/path/to/model.txt')).toBe('unknown');
    });

    it('should discover models in directory', async () => {
      const modelsDir = '/models';
      
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString() === modelsDir;
      });

      mockFs.readdirSync.mockReturnValue([
        'model1.onnx',
        'model2.wasm',
        'readme.txt',
        'model3.onnx'
      ] as any);

      mockFs.statSync.mockImplementation((filePath: any) => {
        const fileName = path.basename(filePath.toString());
        return {
          isFile: () => fileName.endsWith('.onnx') || fileName.endsWith('.wasm'),
          size: 1024,
          mtime: new Date()
        } as any;
      });

      const models = await ModelLoader.discoverModels(modelsDir);

      expect(models).toHaveLength(3);
      expect(models.some(model => model.name === 'model1')).toBe(true);
      expect(models.some(model => model.name === 'model2')).toBe(true);
      expect(models.some(model => model.name === 'model3')).toBe(true);
      expect(models.some(model => model.name === 'readme')).toBe(false);
    });

    it('should return empty array for non-existent directory', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const models = await ModelLoader.discoverModels('/nonexistent');

      expect(models).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle ONNX loading errors gracefully', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);

      // Mock ONNX loading to throw an error
      jest.doMock('onnxruntime-node', () => {
        throw new Error('ONNX loading failed');
      });

      await expect(modelLoader.loadONNXModel(modelPath, modelName))
        .rejects.toThrow('Failed to load ONNX model test-model');
    });

    it('should handle WebAssembly loading errors gracefully', async () => {
      const wasmPath = '/path/to/model.wasm';
      const modelName = 'test-wasm-model';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      await expect(modelLoader.loadWebAssemblyModel(wasmPath, modelName))
        .rejects.toThrow('Failed to load WebAssembly model test-wasm-model');
    });

    it('should handle model unloading errors gracefully', async () => {
      const modelPath = '/path/to/model.onnx';
      const modelName = 'test-model';

      mockFs.existsSync.mockReturnValue(true);
      const model = await modelLoader.loadONNXModel(modelPath, modelName);

      // Mock release method to throw error
      model.session = {
        release: jest.fn().mockImplementation(() => {
          throw new Error('Release failed');
        })
      };

      // Should not throw, but handle gracefully
      await expect(modelLoader.unloadModel(modelName)).resolves.not.toThrow();
    });
  });
});