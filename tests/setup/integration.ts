import { jest } from '@jest/globals';

// Integration test setup
console.log('Setting up integration tests...');

// Mock external services for integration testing
global.integrationTestUtils = {
  // Database integration helpers
  setupTestDatabase: async () => {
    const mockDb = {
      connection: null,
      isConnected: false,
      
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      
      // Story operations
      createStory: jest.fn().mockResolvedValue({ id: 'story-123', title: 'Test Story' }),
      getStory: jest.fn().mockResolvedValue({ id: 'story-123', title: 'Test Story' }),
      updateStory: jest.fn().mockResolvedValue({ id: 'story-123', title: 'Updated Story' }),
      deleteStory: jest.fn().mockResolvedValue(true),
      listStories: jest.fn().mockResolvedValue([]),
      
      // Scene operations
      createScene: jest.fn().mockResolvedValue({ id: 'scene-123', title: 'Test Scene' }),
      getScene: jest.fn().mockResolvedValue({ id: 'scene-123', title: 'Test Scene' }),
      updateScene: jest.fn().mockResolvedValue({ id: 'scene-123', title: 'Updated Scene' }),
      deleteScene: jest.fn().mockResolvedValue(true),
      getScenesByStory: jest.fn().mockResolvedValue([]),
      
      // Character operations
      createCharacter: jest.fn().mockResolvedValue({ id: 'char-123', name: 'Test Character' }),
      getCharacter: jest.fn().mockResolvedValue({ id: 'char-123', name: 'Test Character' }),
      updateCharacter: jest.fn().mockResolvedValue({ id: 'char-123', name: 'Updated Character' }),
      deleteCharacter: jest.fn().mockResolvedValue(true),
      getCharactersByStory: jest.fn().mockResolvedValue([]),
      
      // Transaction support
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined)
    };
    
    return mockDb;
  },
  
  // AI provider integration helpers
  setupMockAIProviders: () => {
    const providers = {
      openai: {
        name: 'OpenAI',
        isAvailable: jest.fn().mockResolvedValue(true),
        generateText: jest.fn().mockResolvedValue('OpenAI generated text'),
        streamText: jest.fn().mockImplementation(async function* () {
          yield 'OpenAI ';
          yield 'streamed ';
          yield 'text';
        }),
        getModels: jest.fn().mockResolvedValue(['gpt-4', 'gpt-3.5-turbo']),
        validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
      },
      
      anthropic: {
        name: 'Anthropic',
        isAvailable: jest.fn().mockResolvedValue(true),
        generateText: jest.fn().mockResolvedValue('Anthropic generated text'),
        streamText: jest.fn().mockImplementation(async function* () {
          yield 'Anthropic ';
          yield 'streamed ';
          yield 'text';
        }),
        getModels: jest.fn().mockResolvedValue(['claude-3-opus', 'claude-3-sonnet']),
        validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
      },
      
      ollama: {
        name: 'Ollama',
        isAvailable: jest.fn().mockResolvedValue(true),
        generateText: jest.fn().mockResolvedValue('Ollama generated text'),
        streamText: jest.fn().mockImplementation(async function* () {
          yield 'Ollama ';
          yield 'streamed ';
          yield 'text';
        }),
        getModels: jest.fn().mockResolvedValue(['llama2', 'mistral']),
        validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
      }
    };
    
    return providers;
  },
  
  // File system integration helpers
  setupMockFileSystem: () => ({
    readFile: jest.fn().mockResolvedValue('mock file content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    createDirectory: jest.fn().mockResolvedValue(undefined),
    listDirectory: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
    fileExists: jest.fn().mockResolvedValue(true),
    getFileStats: jest.fn().mockResolvedValue({
      size: 1024,
      isFile: true,
      isDirectory: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    })
  }),
  
  // Network integration helpers
  setupMockNetworking: () => ({
    httpGet: jest.fn().mockResolvedValue({
      status: 200,
      data: { success: true },
      headers: { 'content-type': 'application/json' }
    }),
    
    httpPost: jest.fn().mockResolvedValue({
      status: 201,
      data: { id: 'created-123' },
      headers: { 'content-type': 'application/json' }
    }),
    
    httpPut: jest.fn().mockResolvedValue({
      status: 200,
      data: { updated: true },
      headers: { 'content-type': 'application/json' }
    }),
    
    httpDelete: jest.fn().mockResolvedValue({
      status: 204,
      data: null,
      headers: {}
    }),
    
    websocketConnect: jest.fn().mockResolvedValue({
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: 1 // OPEN
    })
  }),
  
  // Configuration integration helpers
  setupMockConfig: () => ({
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        'ai.defaultProvider': 'openai',
        'ai.openai.apiKey': 'mock-api-key',
        'ai.openai.model': 'gpt-4',
        'database.path': ':memory:',
        'app.theme': 'light',
        'app.language': 'en',
        'accessibility.screenReader': false,
        'accessibility.highContrast': false
      };
      return config[key];
    }),
    
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    has: jest.fn().mockReturnValue(true),
    getAll: jest.fn().mockReturnValue({}),
    reset: jest.fn().mockResolvedValue(undefined)
  }),
  
  // Plugin integration helpers
  setupMockPlugins: () => ({
    loadPlugin: jest.fn().mockResolvedValue({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      enabled: true,
      api: {
        onStoryCreate: jest.fn(),
        onSceneUpdate: jest.fn(),
        onCharacterCreate: jest.fn()
      }
    }),
    
    unloadPlugin: jest.fn().mockResolvedValue(undefined),
    enablePlugin: jest.fn().mockResolvedValue(undefined),
    disablePlugin: jest.fn().mockResolvedValue(undefined),
    getPluginList: jest.fn().mockResolvedValue([]),
    
    callPluginMethod: jest.fn().mockResolvedValue('plugin method result')
  }),
  
  // Accessibility integration helpers
  setupMockAccessibility: () => ({
    screenReader: {
      isEnabled: jest.fn().mockReturnValue(false),
      speak: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      setRate: jest.fn(),
      setPitch: jest.fn(),
      setVolume: jest.fn()
    },
    
    eyeTracking: {
      isAvailable: jest.fn().mockResolvedValue(false),
      calibrate: jest.fn().mockResolvedValue({ success: true, accuracy: 0.95 }),
      startTracking: jest.fn().mockResolvedValue(undefined),
      stopTracking: jest.fn().mockResolvedValue(undefined),
      getGazePoint: jest.fn().mockReturnValue({ x: 500, y: 300 })
    },
    
    voiceCommands: {
      isAvailable: jest.fn().mockResolvedValue(false),
      startListening: jest.fn().mockResolvedValue(undefined),
      stopListening: jest.fn().mockResolvedValue(undefined),
      addCommand: jest.fn(),
      removeCommand: jest.fn()
    }
  }),
  
  // Test workflow helpers
  createIntegrationTestWorkflow: (steps: Array<() => Promise<any>>) => {
    return async () => {
      const results = [];
      for (const step of steps) {
        try {
          const result = await step();
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error });
          throw error; // Stop on first failure
        }
      }
      return results;
    };
  },
  
  // Performance measurement
  measureIntegrationPerformance: async (testName: string, testFn: () => Promise<any>) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await testFn();
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      return {
        testName,
        success: true,
        result,
        metrics: {
          duration: endTime - startTime,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          }
        }
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        testName,
        success: false,
        error,
        metrics: {
          duration: endTime - startTime,
          memoryDelta: null
        }
      };
    }
  },
  
  // Cleanup helpers
  cleanupIntegrationTest: async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Clear any test data
    if (global.testDatabase) {
      await global.testDatabase.disconnect();
    }
    
    // Reset configuration
    if (global.testConfig) {
      await global.testConfig.reset();
    }
    
    // Stop any running services
    if (global.testServices) {
      for (const service of global.testServices) {
        if (service.stop) {
          await service.stop();
        }
      }
    }
  }
};

// Setup global test services
beforeEach(async () => {
  global.testDatabase = await global.integrationTestUtils.setupTestDatabase();
  global.testAIProviders = global.integrationTestUtils.setupMockAIProviders();
  global.testFileSystem = global.integrationTestUtils.setupMockFileSystem();
  global.testNetworking = global.integrationTestUtils.setupMockNetworking();
  global.testConfig = global.integrationTestUtils.setupMockConfig();
  global.testPlugins = global.integrationTestUtils.setupMockPlugins();
  global.testAccessibility = global.integrationTestUtils.setupMockAccessibility();
});

afterEach(async () => {
  await global.integrationTestUtils.cleanupIntegrationTest();
});

console.log('Integration test setup completed');