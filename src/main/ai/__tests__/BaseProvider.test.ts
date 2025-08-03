import { BaseProvider, BaseCloudProvider, BaseLocalProvider } from '../providers/BaseProvider';
import { AICapability, ProviderConfig, StoryContext } from '../../../shared/types/AI';
import { Character } from '../../../shared/types/Story';
import { StoryAnalysis } from '../../../shared/types/AI';

// Test implementation of BaseProvider
class TestProvider extends BaseProvider {
  name = 'Test Provider';
  type: 'local' = 'local';
  capabilities: AICapability[] = [
    {
      name: 'test_capability',
      description: 'Test capability',
      inputTypes: ['text'],
      outputTypes: ['text'],
      offline: true
    }
  ];
  priority = 5;

  protected async doInitialize(): Promise<void> {
    // Mock initialization
  }

  protected async doShutdown(): Promise<void> {
    // Mock shutdown
  }

  async generateText(prompt: string, context: StoryContext): Promise<any> {
    return this.createResponse(`Generated: ${prompt}`, 0.8);
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    return {
      structure: { identifiedStructure: 'test', completedBeats: [], missingBeats: [], suggestions: [], confidence: 0.8 },
      characters: { consistencyScore: 0.8, voiceConsistency: 0.8, developmentProgress: 0.8, relationshipHealth: [], suggestions: [] },
      pacing: { overallPacing: 'good', tensionCurve: [], recommendations: [] },
      consistency: { overallScore: 0.8, plotHoles: [], characterInconsistencies: [], worldBuildingIssues: [] },
      overallScore: 0.8,
      recommendations: []
    };
  }

  async generateCharacter(traits: any): Promise<Character> {
    return {
      id: 'test-char',
      name: traits.name || 'Test Character',
      archetype: { primary: 'test', description: '', commonTraits: [] },
      traits: { personality: [], motivations: [], fears: [], strengths: [], weaknesses: [], quirks: [] },
      relationships: [],
      developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
      voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
    };
  }

  protected async performHealthCheck(): Promise<void> {
    // Mock health check
  }
}

// Test implementation of BaseCloudProvider
class TestCloudProvider extends BaseCloudProvider {
  name = 'Test Cloud Provider';
  capabilities: AICapability[] = [];
  priority = 3;
  protected apiKey = '';
  protected baseUrl = 'https://api.test.com';

  protected async testConnection(): Promise<void> {
    // Mock connection test
  }

  async generateText(prompt: string, context: StoryContext): Promise<any> {
    return this.createResponse(`Cloud generated: ${prompt}`, 0.9);
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    throw new Error('Not implemented');
  }

  async generateCharacter(traits: any): Promise<Character> {
    throw new Error('Not implemented');
  }
}

// Test implementation of BaseLocalProvider
class TestLocalProvider extends BaseLocalProvider {
  name = 'Test Local Provider';
  capabilities: AICapability[] = [];
  priority = 5;
  protected port = 8080;
  protected host = 'localhost';

  protected getDefaultPort(): number {
    return 8080;
  }

  protected async testLocalConnection(): Promise<void> {
    // Mock connection test
  }

  async generateText(prompt: string, context: StoryContext): Promise<any> {
    return this.createResponse(`Local generated: ${prompt}`, 0.7);
  }

  async analyzeStory(content: string): Promise<StoryAnalysis> {
    throw new Error('Not implemented');
  }

  async generateCharacter(traits: any): Promise<Character> {
    throw new Error('Not implemented');
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider();
  });

  afterEach(async () => {
    if (provider.isAvailable()) {
      await provider.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await provider.initialize({});

      expect(provider.isAvailable()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const failingProvider = new TestProvider();
      failingProvider['doInitialize'] = jest.fn().mockRejectedValue(new Error('Init failed'));

      await expect(failingProvider.initialize({})).rejects.toThrow('Init failed');
      expect(failingProvider.isAvailable()).toBe(false);
    });

    it('should merge configuration', async () => {
      const config = { testSetting: 'value' };
      await provider.initialize(config);

      expect(provider['config']).toEqual(expect.objectContaining(config));
    });
  });

  describe('availability', () => {
    it('should not be available before initialization', () => {
      expect(provider.isAvailable()).toBe(false);
    });

    it('should be available after successful initialization', async () => {
      await provider.initialize({});
      expect(provider.isAvailable()).toBe(true);
    });

    it('should not be available after shutdown', async () => {
      await provider.initialize({});
      await provider.shutdown();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('response creation', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should create standardized responses', async () => {
      const response = await provider.generateText('test prompt', {
        characters: [],
        genre: [],
        targetAudience: ''
      });

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('confidence');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata).toHaveProperty('provider', 'Test Provider');
      expect(response.metadata).toHaveProperty('tokensUsed');
    });

    it('should estimate tokens correctly', () => {
      const shortText = 'test';
      const longText = 'this is a much longer text that should have more tokens';

      const shortTokens = provider['estimateTokens'](shortText);
      const longTokens = provider['estimateTokens'](longText);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });
  });

  describe('configuration validation', () => {
    it('should validate required configuration fields', async () => {
      const validatingProvider = new TestProvider();
      validatingProvider['doInitialize'] = jest.fn().mockImplementation(() => {
        validatingProvider['validateConfig'](['requiredField']);
      });

      await expect(validatingProvider.initialize({})).rejects.toThrow(
        'Missing required configuration field: requiredField'
      );
    });

    it('should pass validation with required fields present', async () => {
      const validatingProvider = new TestProvider();
      validatingProvider['doInitialize'] = jest.fn().mockImplementation(() => {
        validatingProvider['validateConfig'](['requiredField']);
      });

      await expect(validatingProvider.initialize({ requiredField: 'value' }))
        .resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should handle errors consistently', () => {
      const error = new Error('Test error');

      expect(() => provider['handleError'](error, 'test operation'))
        .toThrow('Test Provider provider failed during test operation: Test error');
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should pass health check when available', async () => {
      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it('should fail health check when not available', async () => {
      await provider.shutdown();
      const result = await provider.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle health check errors', async () => {
      provider['performHealthCheck'] = jest.fn().mockRejectedValue(new Error('Health check failed'));

      const result = await provider.healthCheck();
      expect(result).toBe(false);
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('provider information', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should return provider information', () => {
      const info = provider.getInfo();

      expect(info).toEqual({
        name: 'Test Provider',
        type: 'local',
        capabilities: provider.capabilities,
        priority: 5,
        initialized: true,
        available: true,
        config: {}
      });
    });

    it('should return safe configuration without sensitive data', () => {
      const sensitiveConfig = {
        apiKey: 'secret-key',
        password: 'secret-password',
        token: 'secret-token',
        normalSetting: 'normal-value'
      };

      provider['config'] = sensitiveConfig;
      const info = provider.getInfo();

      expect(info.config).toEqual({ normalSetting: 'normal-value' });
      expect(info.config).not.toHaveProperty('apiKey');
      expect(info.config).not.toHaveProperty('password');
      expect(info.config).not.toHaveProperty('token');
    });
  });
});

describe('BaseCloudProvider', () => {
  let provider: TestCloudProvider;

  beforeEach(() => {
    provider = new TestCloudProvider();
  });

  afterEach(async () => {
    if (provider.isAvailable()) {
      await provider.shutdown();
    }
  });

  describe('initialization', () => {
    it('should require API key', async () => {
      await expect(provider.initialize({})).rejects.toThrow(
        'Missing required configuration field: apiKey'
      );
    });

    it('should initialize with API key', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('HTTP requests', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test-key' });
    });

    it('should make HTTP requests with proper headers', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: 'success' })
      });

      const result = await provider['makeRequest']('/test', { data: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          }),
          body: JSON.stringify({ data: 'test' })
        })
      );

      expect(result).toEqual({ result: 'success' });
    });

    it('should handle HTTP errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider['makeRequest']('/test', {}))
        .rejects.toThrow('HTTP 400: Bad Request');
    });
  });
});

describe('BaseLocalProvider', () => {
  let provider: TestLocalProvider;

  beforeEach(() => {
    provider = new TestLocalProvider();
  });

  afterEach(async () => {
    if (provider.isAvailable()) {
      await provider.shutdown();
    }
  });

  describe('initialization', () => {
    it('should use default configuration', async () => {
      await provider.initialize({});

      expect(provider['host']).toBe('localhost');
      expect(provider['port']).toBe(8080);
    });

    it('should use provided configuration', async () => {
      await provider.initialize({ host: '127.0.0.1', port: 9000 });

      expect(provider['host']).toBe('127.0.0.1');
      expect(provider['port']).toBe(9000);
    });
  });

  describe('local HTTP requests', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should make local HTTP requests', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: 'success' })
      });

      const result = await provider['makeLocalRequest']('/test', { data: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ data: 'test' })
        })
      );

      expect(result).toEqual({ result: 'success' });
    });

    it('should check if service is running', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const isRunning = await provider['isServiceRunning']();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        expect.objectContaining({
          method: 'GET',
          timeout: 5000
        })
      );

      expect(isRunning).toBe(true);
    });

    it('should handle service check failures', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const isRunning = await provider['isServiceRunning']();

      expect(isRunning).toBe(false);
    });
  });
});