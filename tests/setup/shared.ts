import { jest } from '@jest/globals';

// Shared modules test setup
console.log('Setting up shared modules tests...');

// Mock shared utilities and types
global.sharedTestUtils = {
  // Story validation test helpers
  createValidStoryData: (overrides: any = {}) => ({
    title: 'Valid Test Story',
    description: 'A valid story for testing validation',
    genre: 'fantasy',
    scenes: [
      {
        id: 'scene-1',
        title: 'Opening Scene',
        content: 'The story begins...',
        order: 1
      }
    ],
    characters: [
      {
        id: 'char-1',
        name: 'Hero',
        description: 'The main character',
        role: 'protagonist'
      }
    ],
    ...overrides
  }),
  
  createInvalidStoryData: (invalidField: string) => {
    const base = {
      title: 'Test Story',
      description: 'Test description',
      genre: 'fantasy',
      scenes: [],
      characters: []
    };
    
    switch (invalidField) {
      case 'title':
        return { ...base, title: '' };
      case 'description':
        return { ...base, description: '' };
      case 'genre':
        return { ...base, genre: 'invalid-genre' };
      case 'scenes':
        return { ...base, scenes: null };
      case 'characters':
        return { ...base, characters: undefined };
      default:
        return base;
    }
  },
  
  // AI types test helpers
  createMockAIProvider: (overrides: any = {}) => ({
    id: 'mock-provider',
    name: 'Mock AI Provider',
    type: 'local' as const,
    isAvailable: true,
    models: ['mock-model-1', 'mock-model-2'],
    config: {
      apiKey: 'mock-api-key',
      baseUrl: 'http://localhost:8080',
      model: 'mock-model-1'
    },
    capabilities: {
      textGeneration: true,
      textStreaming: true,
      imageGeneration: false,
      functionCalling: false
    },
    ...overrides
  }),
  
  createMockAIRequest: (overrides: any = {}) => ({
    prompt: 'Test prompt for AI generation',
    model: 'mock-model',
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    stream: false,
    systemPrompt: 'You are a helpful AI assistant.',
    ...overrides
  }),
  
  createMockAIResponse: (overrides: any = {}) => ({
    text: 'Mock AI response text',
    model: 'mock-model',
    usage: {
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40
    },
    finishReason: 'stop' as const,
    metadata: {
      requestId: 'mock-request-id',
      timestamp: new Date().toISOString()
    },
    ...overrides
  }),
  
  // Utility function test helpers
  createMockStoryMetrics: (overrides: any = {}) => ({
    wordCount: 1500,
    characterCount: 8500,
    sceneCount: 5,
    characterCount_characters: 3,
    averageSceneLength: 300,
    readingTime: 6, // minutes
    complexity: 'medium' as const,
    pacing: 'balanced' as const,
    ...overrides
  }),
  
  createMockAnalysisResult: (overrides: any = {}) => ({
    score: 0.85,
    confidence: 0.92,
    suggestions: [
      'Consider adding more character development',
      'The pacing could be improved in scene 3'
    ],
    metrics: {
      coherence: 0.88,
      engagement: 0.82,
      originality: 0.79
    },
    timestamp: new Date().toISOString(),
    ...overrides
  }),
  
  // Validation test helpers
  testValidationRules: {
    required: (value: any) => value !== null && value !== undefined && value !== '',
    minLength: (value: string, min: number) => value && value.length >= min,
    maxLength: (value: string, max: number) => value && value.length <= max,
    isEmail: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    isUrl: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    isPositiveNumber: (value: number) => typeof value === 'number' && value > 0,
    isInRange: (value: number, min: number, max: number) => 
      typeof value === 'number' && value >= min && value <= max
  },
  
  // Error handling test helpers
  createMockError: (type: string, message?: string) => {
    const errors = {
      validation: new Error(message || 'Validation failed'),
      network: new Error(message || 'Network request failed'),
      ai: new Error(message || 'AI provider error'),
      database: new Error(message || 'Database operation failed'),
      file: new Error(message || 'File operation failed'),
      permission: new Error(message || 'Permission denied')
    };
    
    const error = errors[type as keyof typeof errors] || new Error(message || 'Unknown error');
    error.name = type;
    return error;
  },
  
  // Performance test helpers
  createPerformanceMetrics: (overrides: any = {}) => ({
    startTime: performance.now(),
    endTime: performance.now() + 100,
    duration: 100,
    memoryUsage: {
      used: 50 * 1024 * 1024, // 50MB
      total: 100 * 1024 * 1024 // 100MB
    },
    operations: 1000,
    operationsPerSecond: 10,
    ...overrides
  }),
  
  // Async test helpers
  createMockPromise: <T>(value: T, delay: number = 0): Promise<T> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), delay);
    });
  },
  
  createMockRejectedPromise: (error: Error, delay: number = 0): Promise<never> => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    });
  },
  
  // Data transformation test helpers
  deepClone: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),
  
  compareObjects: (obj1: any, obj2: any): boolean => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  },
  
  generateTestId: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // Mock date/time helpers
  mockCurrentTime: (timestamp: number | string | Date) => {
    const mockDate = new Date(timestamp);
    jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    return mockDate;
  },
  
  restoreTime: () => {
    jest.restoreAllMocks();
  }
};

// Mock crypto for consistent test results
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => '12345678-1234-1234-1234-123456789012'),
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  }
});

// Mock Buffer for Node.js compatibility
if (typeof Buffer === 'undefined') {
  global.Buffer = {
    from: jest.fn((data) => ({ data, toString: () => data })),
    alloc: jest.fn((size) => new Array(size).fill(0)),
    isBuffer: jest.fn(() => false)
  } as any;
}

// Mock process for environment variables
if (typeof process === 'undefined') {
  global.process = {
    env: {
      NODE_ENV: 'test',
      DEBUG: 'false'
    },
    version: 'v18.0.0',
    platform: 'linux',
    arch: 'x64'
  } as any;
}

console.log('Shared modules test setup completed');