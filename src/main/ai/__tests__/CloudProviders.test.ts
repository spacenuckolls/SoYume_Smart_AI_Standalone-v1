import { OpenAIProvider } from '../providers/cloud/OpenAIProvider';
import { AnthropicProvider } from '../providers/cloud/AnthropicProvider';
import { OpenRouterProvider } from '../providers/cloud/OpenRouterProvider';
import { MistralProvider } from '../providers/cloud/MistralProvider';
import { MoonshotProvider } from '../providers/cloud/MoonshotProvider';
import { StoryContext, ProviderConfig } from '../../../shared/types/AI';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Cloud AI Providers', () => {
  const mockConfig: ProviderConfig = {
    apiKey: 'test-api-key',
    maxTokens: 1024,
    temperature: 0.7
  };

  const mockContext: StoryContext = {
    characters: [],
    genre: ['fantasy'],
    targetAudience: 'adult'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider(
        'openai-test',
        'OpenAI Test',
        'cloud',
        '1.0.0',
        [],
        8,
        {
          description: 'Test OpenAI provider',
          author: 'Test',
          supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }
      );
    });

    afterEach(async () => {
      if (provider.isAvailable()) {
        await provider.shutdown();
      }
    });

    it('should initialize with valid API key', async () => {
      await provider.initialize(mockConfig);
      expect(provider.isAvailable()).toBe(true);
    });

    it('should throw error without API key', async () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).apiKey;
      
      await expect(provider.initialize(invalidConfig)).rejects.toThrow('OpenAI API key is required');
    });

    it('should generate text with proper API call', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'Generated text response' },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 50, prompt_tokens: 20, completion_tokens: 30 },
        model: 'gpt-4'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);
      const response = await provider.generateText('Test prompt', mockContext);

      expect(response.content).toBe('Generated text response');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.metadata.tokensUsed).toBe(50);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_exceeded',
          code: 'rate_limit'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => mockError
      });

      await provider.initialize(mockConfig);
      
      await expect(provider.generateText('Test', mockContext)).rejects.toThrow('Rate limit exceeded');
    });

    it('should perform health check', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
        usage: { total_tokens: 5, prompt_tokens: 2, completion_tokens: 3 },
        model: 'gpt-4'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);
      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('model');
    });

    it('should analyze story structure', async () => {
      const mockAnalysis = {
        structure: { identifiedStructure: 'three-act', confidence: 0.8 },
        characters: { consistencyScore: 0.7 },
        pacing: { overallPacing: 'good' },
        consistency: { overallScore: 0.8 },
        overallScore: 0.75,
        recommendations: ['Develop character arcs further']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAnalysis) }, finish_reason: 'stop' }],
          usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
          model: 'gpt-4'
        })
      });

      await provider.initialize(mockConfig);
      const analysis = await provider.analyzeStory('Test story content');

      expect(analysis.structure.identifiedStructure).toBe('three-act');
      expect(analysis.overallScore).toBe(0.75);
    });

    it('should generate characters', async () => {
      const mockCharacter = {
        id: 'char-123',
        name: 'Test Character',
        archetype: { primary: 'hero' },
        traits: { personality: ['brave', 'loyal'] }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockCharacter) }, finish_reason: 'stop' }],
          usage: { total_tokens: 80, prompt_tokens: 40, completion_tokens: 40 },
          model: 'gpt-4'
        })
      });

      await provider.initialize(mockConfig);
      const character = await provider.generateCharacter({ name: 'Test Character', personality: ['brave'] });

      expect(character.name).toBe('Test Character');
      expect(character.archetype.primary).toBe('hero');
    });
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider(
        'anthropic-test',
        'Anthropic Test',
        'cloud',
        '1.0.0',
        [],
        9,
        {
          description: 'Test Anthropic provider',
          author: 'Test',
          supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }
      );
    });

    afterEach(async () => {
      if (provider.isAvailable()) {
        await provider.shutdown();
      }
    });

    it('should initialize with valid configuration', async () => {
      await provider.initialize(mockConfig);
      expect(provider.isAvailable()).toBe(true);
    });

    it('should generate thoughtful responses', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Thoughtful response from Claude' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 25, output_tokens: 35 },
        model: 'claude-3-sonnet'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);
      const response = await provider.generateText('Complex creative prompt', mockContext);

      expect(response.content).toBe('Thoughtful response from Claude');
      expect(response.confidence).toBeGreaterThan(0.8); // Claude typically has high confidence
    });

    it('should handle Anthropic-specific errors', async () => {
      const mockError = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockError
      });

      await provider.initialize(mockConfig);
      
      await expect(provider.generateText('Test', mockContext)).rejects.toThrow('Invalid API key');
    });

    it('should provide detailed literary analysis', async () => {
      const detailedAnalysis = {
        structure: { identifiedStructure: 'hero-journey', confidence: 0.9 },
        characters: { consistencyScore: 0.85, voiceConsistency: 0.9 },
        pacing: { overallPacing: 'good', tensionCurve: ['rising', 'climax', 'falling'] },
        consistency: { overallScore: 0.88 },
        literaryElements: { themes: ['redemption', 'sacrifice'], style: 'literary fiction' },
        overallScore: 0.87,
        recommendations: ['Strengthen the midpoint reversal', 'Develop secondary characters']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(detailedAnalysis) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 200 },
          model: 'claude-3-sonnet'
        })
      });

      await provider.initialize(mockConfig);
      const analysis = await provider.analyzeStory('Complex literary story');

      expect(analysis.structure.confidence).toBe(0.9);
      expect(analysis.overallScore).toBe(0.87);
    });
  });

  describe('OpenRouterProvider', () => {
    let provider: OpenRouterProvider;

    beforeEach(() => {
      provider = new OpenRouterProvider(
        'openrouter-test',
        'OpenRouter Test',
        'cloud',
        '1.0.0',
        [],
        7,
        {
          description: 'Test OpenRouter provider',
          author: 'Test',
          supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }
      );
    });

    afterEach(async () => {
      if (provider.isAvailable()) {
        await provider.shutdown();
      }
    });

    it('should load available models on initialization', async () => {
      const mockModels = {
        data: [
          { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', context_length: 200000 },
          { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', context_length: 128000 }
        ]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockModels
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Test response' }, finish_reason: 'stop' }],
            usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
            model: 'anthropic/claude-3-sonnet'
          })
        });

      await provider.initialize(mockConfig);
      
      const models = provider.getAvailableModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('anthropic/claude-3-sonnet');
    });

    it('should select appropriate model for task', async () => {
      const mockModels = {
        data: [
          { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', context_length: 200000 },
          { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', context_length: 128000 }
        ]
      };

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockModels
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Story analysis response' }, finish_reason: 'stop' }],
            usage: { total_tokens: 50, prompt_tokens: 25, completion_tokens: 25 },
            model: 'anthropic/claude-3-sonnet'
          })
        });

      await provider.initialize({ ...mockConfig, modelName: 'auto' });
      const analysis = await provider.analyzeStory('Test story');

      expect(analysis).toBeDefined();
      // Should have selected Claude for analysis task
    });

    it('should handle model switching', async () => {
      await provider.initialize(mockConfig);
      
      provider.setModel('openai/gpt-4-turbo');
      expect(provider.getConfig().modelName).toBe('openai/gpt-4-turbo');
    });
  });

  describe('MistralProvider', () => {
    let provider: MistralProvider;

    beforeEach(() => {
      provider = new MistralProvider(
        'mistral-test',
        'Mistral Test',
        'cloud',
        '1.0.0',
        [],
        7,
        {
          description: 'Test Mistral provider',
          author: 'Test',
          supportedLanguages: ['en', 'fr'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }
      );
    });

    afterEach(async () => {
      if (provider.isAvailable()) {
        await provider.shutdown();
      }
    });

    it('should support European privacy standards', async () => {
      await provider.initialize({ ...mockConfig, safePrompt: true });
      expect(provider.getSafePrompt()).toBe(true);
    });

    it('should generate multilingual content', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Réponse en français' }, finish_reason: 'stop' }],
        usage: { total_tokens: 20, prompt_tokens: 10, completion_tokens: 10 },
        model: 'mistral-large-latest'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);
      const response = await provider.generateText('Écrivez en français', {
        ...mockContext,
        targetAudience: 'french-speakers'
      });

      expect(response.content).toBe('Réponse en français');
    });

    it('should handle content filtering', async () => {
      const mockError = {
        error: {
          message: 'Content filtered by safety system',
          type: 'content_filter'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockError
      });

      await provider.initialize(mockConfig);
      
      await expect(provider.generateText('Inappropriate content', mockContext))
        .rejects.toThrow('Content filtered by safety system');
    });
  });

  describe('MoonshotProvider', () => {
    let provider: MoonshotProvider;

    beforeEach(() => {
      provider = new MoonshotProvider(
        'moonshot-test',
        'Moonshot Test',
        'cloud',
        '1.0.0',
        [],
        6,
        {
          description: 'Test Moonshot provider',
          author: 'Test',
          supportedLanguages: ['zh', 'en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }
      );
    });

    afterEach(async () => {
      if (provider.isAvailable()) {
        await provider.shutdown();
      }
    });

    it('should support long context processing', async () => {
      await provider.initialize({ ...mockConfig, modelName: 'moonshot-v1-128k' });
      
      expect(provider.supportsLongContext()).toBe(true);
      expect(provider.getMaxContextWindow()).toBe(131072);
    });

    it('should handle Chinese and English content', async () => {
      const mockResponse = {
        choices: [{ message: { content: '这是一个中文回复 with English mixed in' }, finish_reason: 'stop' }],
        usage: { total_tokens: 30, prompt_tokens: 15, completion_tokens: 15 },
        model: 'moonshot-v1-128k'
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);
      const response = await provider.generateText('请用中英文回复', mockContext);

      expect(response.content).toContain('中文');
      expect(response.content).toContain('English');
    });

    it('should analyze long documents', async () => {
      const longDocument = 'A'.repeat(60000); // Very long document
      
      const mockAnalysis = {
        structure: { identifiedStructure: 'kishōtenketsu', confidence: 0.85 },
        culturalElements: { identifiedCulture: 'East Asian', culturalAccuracy: 0.9 },
        overallScore: 0.82
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAnalysis) }, finish_reason: 'stop' }],
          usage: { total_tokens: 500, prompt_tokens: 400, completion_tokens: 100 },
          model: 'moonshot-v1-128k'
        })
      });

      await provider.initialize(mockConfig);
      const analysis = await provider.analyzeLongDocument(longDocument);

      expect(analysis.structure.identifiedStructure).toBe('kishōtenketsu');
    });

    it('should handle bilingual errors', async () => {
      const mockError = {
        error: {
          message: '频率限制 Rate limit exceeded',
          type: 'rate_limit'
        }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => mockError
      });

      await provider.initialize(mockConfig);
      
      await expect(provider.generateText('Test', mockContext))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Provider Integration', () => {
    it('should handle network timeouts consistently', async () => {
      const providers = [
        new OpenAIProvider('openai', 'OpenAI', 'cloud', '1.0.0', [], 8, {
          description: 'Test', author: 'Test', supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }),
        new AnthropicProvider('anthropic', 'Anthropic', 'cloud', '1.0.0', [], 9, {
          description: 'Test', author: 'Test', supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        })
      ];

      // Mock timeout
      (fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 100)
        )
      );

      for (const provider of providers) {
        await provider.initialize({ ...mockConfig, timeout: 50 });
        
        await expect(provider.generateText('Test', mockContext))
          .rejects.toThrow();
      }
    });

    it('should maintain consistent error handling across providers', async () => {
      const providers = [
        new OpenAIProvider('openai', 'OpenAI', 'cloud', '1.0.0', [], 8, {
          description: 'Test', author: 'Test', supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        }),
        new MistralProvider('mistral', 'Mistral', 'cloud', '1.0.0', [], 7, {
          description: 'Test', author: 'Test', supportedLanguages: ['en'],
          requirements: { internetRequired: true, apiKeyRequired: true }
        })
      ];

      const mockError = {
        error: { message: 'Invalid API key', type: 'authentication_error' }
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => mockError
      });

      for (const provider of providers) {
        await provider.initialize(mockConfig);
        
        await expect(provider.generateText('Test', mockContext))
          .rejects.toThrow('Invalid API key');
      }
    });

    it('should support configuration updates without reinitialization', async () => {
      const provider = new OpenAIProvider('openai', 'OpenAI', 'cloud', '1.0.0', [], 8, {
        description: 'Test', author: 'Test', supportedLanguages: ['en'],
        requirements: { internetRequired: true, apiKeyRequired: true }
      });

      await provider.initialize(mockConfig);
      
      const newConfig = { ...mockConfig, temperature: 0.9, maxTokens: 2048 };
      await provider.updateConfig(newConfig);
      
      const updatedConfig = provider.getConfig();
      expect(updatedConfig.temperature).toBe(0.9);
      expect(updatedConfig.maxTokens).toBe(2048);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests', async () => {
      const provider = new OpenAIProvider('openai', 'OpenAI', 'cloud', '1.0.0', [], 8, {
        description: 'Test', author: 'Test', supportedLanguages: ['en'],
        requirements: { internetRequired: true, apiKeyRequired: true }
      });

      const mockResponse = {
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
        model: 'gpt-4'
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await provider.initialize(mockConfig);

      const requests = Array(5).fill(null).map((_, i) => 
        provider.generateText(`Request ${i}`, mockContext)
      );

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.content).toBe('Response');
      });
    });

    it('should calculate confidence scores appropriately', async () => {
      const provider = new AnthropicProvider('anthropic', 'Anthropic', 'cloud', '1.0.0', [], 9, {
        description: 'Test', author: 'Test', supportedLanguages: ['en'],
        requirements: { internetRequired: true, apiKeyRequired: true }
      });

      const scenarios = [
        { stop_reason: 'end_turn', content: 'Complete response', expectedConfidence: 0.95 },
        { stop_reason: 'max_tokens', content: 'Truncated resp', expectedConfidence: 0.75 },
        { stop_reason: 'end_turn', content: 'I cannot help', expectedConfidence: 0.6 }
      ];

      await provider.initialize(mockConfig);

      for (const scenario of scenarios) {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'text', text: scenario.content }],
            stop_reason: scenario.stop_reason,
            usage: { input_tokens: 10, output_tokens: 10 },
            model: 'claude-3-sonnet'
          })
        });

        const response = await provider.generateText('Test', mockContext);
        expect(response.confidence).toBeCloseTo(scenario.expectedConfidence, 1);
      }
    });
  });
});