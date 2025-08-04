import { 
  AIProvider, 
  AICapability, 
  StoryContext, 
  AIResponse,
  StoryAnalysis,
  ProviderConfig,
  ProviderMetadata,
  HealthCheckResult
} from '../../../../shared/types/AI';
import { Character } from '../../../../shared/types/Story';
import { BaseProvider } from '../BaseProvider';

// OpenRouter API interfaces (similar to OpenAI but with model routing)
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  transforms?: string[];
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
  };
}

interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export class OpenRouterProvider extends BaseProvider implements AIProvider {
  public readonly id = 'openrouter';
  public readonly name = 'OpenRouter';
  public readonly type: 'cloud' = 'cloud';
  public readonly version = '1.0.0';
  public readonly priority = 7; // Good priority for accessing multiple models
  public readonly metadata: ProviderMetadata = {
    description: 'Access to multiple AI models through OpenRouter API including GPT, Claude, Llama, and more',
    author: 'OpenRouter',
    website: 'https://openrouter.ai',
    documentation: 'https://openrouter.ai/docs',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
    modelInfo: {
      name: 'Multiple Models',
      version: 'Various',
      contextWindow: 128000 // Varies by model
    },
    requirements: {
      internetRequired: true,
      apiKeyRequired: true
    }
  };

  public readonly capabilities: AICapability[] = [
    {
      name: 'text_generation',
      description: 'Generate text using various state-of-the-art models',
      inputTypes: ['text', 'prompt'],
      outputTypes: ['text', 'story'],
      offline: false
    },
    {
      name: 'story_analysis',
      description: 'Analyze stories using specialized models',
      inputTypes: ['story_text', 'manuscript'],
      outputTypes: ['analysis', 'feedback'],
      offline: false
    },
    {
      name: 'character_generation',
      description: 'Create characters using creative AI models',
      inputTypes: ['character_traits', 'description'],
      outputTypes: ['character_profile'],
      offline: false
    },
    {
      name: 'dialogue_generation',
      description: 'Generate dialogue using conversation-optimized models',
      inputTypes: ['character_context', 'scene_context'],
      outputTypes: ['dialogue'],
      offline: false
    },
    {
      name: 'code_generation',
      description: 'Generate code using specialized coding models',
      inputTypes: ['code_prompt', 'requirements'],
      outputTypes: ['code'],
      offline: false
    },
    {
      name: 'research',
      description: 'Research topics using knowledge-enhanced models',
      inputTypes: ['query', 'topic'],
      outputTypes: ['information', 'facts'],
      offline: false
    },
    {
      name: 'brainstorming',
      description: 'Generate ideas using creative models',
      inputTypes: ['prompt', 'theme'],
      outputTypes: ['ideas', 'concepts'],
      offline: false
    }
  ];

  private apiKey: string = '';
  private baseURL: string = 'https://openrouter.ai/api/v1';
  private model: string = 'anthropic/claude-3-sonnet';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private topP: number = 0.9;
  private requestTimeout: number = 45000; // 45 seconds
  private availableModels: OpenRouterModel[] = [];
  private appName: string = 'SoYume AI Assistant';
  private appUrl: string = 'https://soyume.ai';

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey) {
      throw this.createError('OpenRouter API key is required', 'MISSING_API_KEY');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.endpoint || this.baseURL;
    this.model = config.modelName || this.model;
    this.maxTokens = config.maxTokens || this.maxTokens;
    this.temperature = config.temperature || this.temperature;
    this.topP = config.topP || this.topP;
    this.requestTimeout = config.timeout || this.requestTimeout;
    this.appName = config.appName || this.appName;
    this.appUrl = config.appUrl || this.appUrl;

    // Load available models
    await this.loadAvailableModels();

    // Update metadata with actual model info
    if (this.metadata.modelInfo) {
      const modelInfo = this.getModelInfo(this.model);
      this.metadata.modelInfo.name = modelInfo?.name || this.model;
      this.metadata.modelInfo.contextWindow = modelInfo?.context_length || 4096;
    }

    console.log(`OpenRouter provider initialized with model: ${this.model}`);
  }

  protected async doShutdown(): Promise<void> {
    // No cleanup needed for HTTP-based provider
    this.availableModels = [];
    console.log('OpenRouter provider shut down');
  }

  protected async doUpdateConfig(config: ProviderConfig): Promise<void> {
    // Update configuration without reinitializing
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.endpoint) this.baseURL = config.endpoint;
    if (config.modelName) this.model = config.modelName;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
    if (config.temperature) this.temperature = config.temperature;
    if (config.topP) this.topP = config.topP;
    if (config.timeout) this.requestTimeout = config.timeout;
    if (config.appName) this.appName = config.appName;
    if (config.appUrl) this.appUrl = config.appUrl;

    console.log('OpenRouter provider configuration updated');
  }

  protected async doHealthCheck(): Promise<Omit<HealthCheckResult, 'responseTime'>> {
    try {
      // Check if we can access the models endpoint
      await this.loadAvailableModels();

      // Simple health check with minimal request
      const response = await this.makeRequest({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      return {
        healthy: true,
        details: {
          model: this.model,
          available: true,
          modelsLoaded: this.availableModels.length,
          rateLimitOk: true
        }
      };
    } catch (error) {
      const err = error as Error;
      return {
        healthy: false,
        error: err.message,
        details: {
          model: this.model,
          available: false,
          errorType: this.classifyError(err)
        }
      };
    }
  }

  protected async doGenerateText(prompt: string, context: StoryContext): Promise<AIResponse> {
    try {
      // Select best model for the task if auto-selection is enabled
      const selectedModel = this.selectBestModel('text_generation', context);
      
      const messages = this.buildMessages(prompt, context);
      
      const request: OpenRouterRequest = {
        model: selectedModel,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: this.topP,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      };

      const response = await this.makeRequest(request);
      
      if (!response.choices || response.choices.length === 0) {
        throw this.createError('No response generated', 'EMPTY_RESPONSE');
      }

      const choice = response.choices[0];
      const content = choice.message.content.trim();

      return {
        content,
        confidence: this.calculateConfidence(choice.finish_reason, content),
        metadata: {
          model: response.model,
          provider: this.name,
          tokensUsed: response.usage.total_tokens,
          responseTime: 0, // Will be set by base class
          finishReason: choice.finish_reason,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          selectedModel: selectedModel
        }
      };
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  protected async doAnalyzeStory(content: string): Promise<StoryAnalysis> {
    try {
      // Select best model for analysis (prefer Claude or GPT-4 for analysis)
      const selectedModel = this.selectBestModel('story_analysis');
      
      const analysisPrompt = this.buildStoryAnalysisPrompt(content);
      const messages: OpenRouterMessage[] = [
        {
          role: 'system',
          content: 'You are an expert story analyst. Analyze the provided story and return a detailed JSON analysis.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ];

      const request: OpenRouterRequest = {
        model: selectedModel,
        messages,
        max_tokens: 2048,
        temperature: 0.3 // Lower temperature for analysis
      };

      const response = await this.makeRequest(request);
      const analysisText = response.choices[0].message.content;

      // Try to parse as JSON, fallback to structured analysis
      try {
        return JSON.parse(analysisText);
      } catch {
        return this.parseAnalysisFromText(analysisText);
      }
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  protected async doGenerateCharacter(traits: any): Promise<Character> {
    try {
      // Select best model for character generation
      const selectedModel = this.selectBestModel('character_generation');
      
      const characterPrompt = this.buildCharacterPrompt(traits);
      const messages: OpenRouterMessage[] = [
        {
          role: 'system',
          content: 'You are a character development expert. Create a detailed character based on the provided traits. Return the result as JSON.'
        },
        {
          role: 'user',
          content: characterPrompt
        }
      ];

      const request: OpenRouterRequest = {
        model: selectedModel,
        messages,
        max_tokens: 1024,
        temperature: 0.8 // Higher temperature for creativity
      };

      const response = await this.makeRequest(request);
      const characterText = response.choices[0].message.content;

      // Try to parse as JSON, fallback to structured character
      try {
        const characterData = JSON.parse(characterText);
        return this.normalizeCharacter(characterData, traits);
      } catch {
        return this.parseCharacterFromText(characterText, traits);
      }
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  // OpenRouter-specific methods
  private async loadAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': `${this.appName}/1.0`,
          'HTTP-Referer': this.appUrl
        }
      });

      if (!response.ok) {
        console.warn('Failed to load OpenRouter models, using default model');
        return;
      }

      const data = await response.json();
      this.availableModels = data.data || [];
      
      console.log(`Loaded ${this.availableModels.length} available models from OpenRouter`);
    } catch (error) {
      console.warn('Failed to load OpenRouter models:', error);
    }
  }

  private selectBestModel(task: string, context?: StoryContext): string {
    // If model is explicitly set, use it
    if (this.model && this.model !== 'auto') {
      return this.model;
    }

    // Model selection logic based on task and context
    const modelPreferences = {
      'text_generation': [
        'anthropic/claude-3-sonnet',
        'openai/gpt-4-turbo',
        'meta-llama/llama-3-70b-instruct',
        'openai/gpt-3.5-turbo'
      ],
      'story_analysis': [
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'openai/gpt-4-turbo',
        'openai/gpt-4'
      ],
      'character_generation': [
        'anthropic/claude-3-sonnet',
        'openai/gpt-4-turbo',
        'meta-llama/llama-3-70b-instruct'
      ],
      'dialogue_generation': [
        'anthropic/claude-3-sonnet',
        'openai/gpt-4-turbo',
        'meta-llama/llama-3-70b-instruct'
      ],
      'research': [
        'openai/gpt-4-turbo',
        'anthropic/claude-3-opus',
        'perplexity/llama-3-sonar-large-32k-online'
      ],
      'brainstorming': [
        'anthropic/claude-3-sonnet',
        'openai/gpt-4-turbo',
        'meta-llama/llama-3-70b-instruct'
      ]
    };

    const preferences = modelPreferences[task as keyof typeof modelPreferences] || modelPreferences.text_generation;
    
    // Find the first available model from preferences
    for (const preferredModel of preferences) {
      if (this.isModelAvailable(preferredModel)) {
        return preferredModel;
      }
    }

    // Fallback to default model
    return 'anthropic/claude-3-sonnet';
  }

  private isModelAvailable(modelId: string): boolean {
    if (this.availableModels.length === 0) {
      // If we haven't loaded models yet, assume it's available
      return true;
    }
    
    return this.availableModels.some(model => model.id === modelId);
  }

  private getModelInfo(modelId: string): OpenRouterModel | undefined {
    return this.availableModels.find(model => model.id === modelId);
  }

  // Helper methods (similar to OpenAI provider but adapted for OpenRouter)
  private buildMessages(prompt: string, context: StoryContext): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

    // System message with context
    const systemMessage = this.buildSystemMessage(context);
    messages.push({ role: 'system', content: systemMessage });

    // Add character context if available
    if (context.characters && context.characters.length > 0) {
      const characterContext = this.buildCharacterContext(context.characters);
      messages.push({ role: 'user', content: `Character context: ${characterContext}` });
    }

    // Main prompt
    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  private buildSystemMessage(context: StoryContext): string {
    let systemMessage = 'You are a creative writing assistant specializing in storytelling and narrative craft.';

    if (context.genre && context.genre.length > 0) {
      systemMessage += ` You are working with ${context.genre.join(' and ')} genre(s).`;
    }

    if (context.targetAudience) {
      systemMessage += ` The target audience is ${context.targetAudience}.`;
    }

    systemMessage += ' Provide creative, engaging, and well-crafted responses that maintain consistency with the established story elements.';

    return systemMessage;
  }

  private buildCharacterContext(characters: Character[]): string {
    return characters.map(char => 
      `${char.name}: ${char.traits.personality.join(', ')}`
    ).join('; ');
  }

  private buildStoryAnalysisPrompt(content: string): string {
    return `Please analyze the following story and provide a comprehensive analysis in JSON format with the following structure:
{
  "structure": {
    "identifiedStructure": "three-act|hero-journey|save-the-cat|other",
    "completedBeats": ["list of completed story beats"],
    "missingBeats": ["list of missing story beats"],
    "suggestions": ["suggestions for improvement"],
    "confidence": 0.0-1.0
  },
  "characters": {
    "consistencyScore": 0.0-1.0,
    "voiceConsistency": 0.0-1.0,
    "developmentProgress": 0.0-1.0,
    "relationshipHealth": ["relationship analysis"],
    "suggestions": ["character improvement suggestions"]
  },
  "pacing": {
    "overallPacing": "too-fast|good|too-slow",
    "tensionCurve": ["description of tension progression"],
    "recommendations": ["pacing recommendations"]
  },
  "consistency": {
    "overallScore": 0.0-1.0,
    "plotHoles": ["identified plot holes"],
    "characterInconsistencies": ["character inconsistencies"],
    "worldBuildingIssues": ["world building issues"]
  },
  "overallScore": 0.0-1.0,
  "recommendations": ["overall recommendations"]
}

Story to analyze:
${content}`;
  }

  private buildCharacterPrompt(traits: any): string {
    return `Create a detailed character based on these traits: ${JSON.stringify(traits)}

Please return a JSON object with this structure:
{
  "id": "unique-id",
  "name": "character name",
  "archetype": {
    "primary": "hero|mentor|villain|ally|other",
    "description": "archetype description",
    "commonTraits": ["list of common traits"]
  },
  "traits": {
    "personality": ["personality traits"],
    "motivations": ["character motivations"],
    "fears": ["character fears"],
    "strengths": ["character strengths"],
    "weaknesses": ["character weaknesses"],
    "quirks": ["unique quirks"]
  },
  "relationships": [],
  "developmentArc": {
    "startState": "initial character state",
    "endState": "final character state",
    "keyMoments": ["key development moments"],
    "completed": false
  },
  "voiceProfile": {
    "vocabulary": ["typical words/phrases"],
    "speechPatterns": ["speech patterns"],
    "commonPhrases": ["common phrases"],
    "formalityLevel": 1-10,
    "emotionalRange": ["emotional expressions"]
  }
}`;
  }

  private async makeRequest(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.appUrl,
          'X-Title': this.appName,
          'User-Agent': `${this.appName}/1.0`
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: OpenRouterError = await response.json();
        throw this.createError(
          errorData.error.message,
          errorData.error.code || 'API_ERROR',
          { status: response.status, type: errorData.error.type }
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('Request timeout', 'TIMEOUT');
      }
      
      throw error;
    }
  }

  private handleAPIError(error: any): Error {
    if (error.code) {
      return error;
    }

    const message = error.message || 'Unknown OpenRouter API error';
    
    if (message.includes('rate limit')) {
      return this.createError('Rate limit exceeded', 'RATE_LIMIT', error);
    } else if (message.includes('insufficient_quota') || message.includes('credits')) {
      return this.createError('Insufficient credits', 'QUOTA_EXCEEDED', error);
    } else if (message.includes('invalid_api_key')) {
      return this.createError('Invalid API key', 'INVALID_API_KEY', error);
    } else if (message.includes('model_not_found')) {
      return this.createError('Model not found', 'MODEL_NOT_FOUND', error);
    } else {
      return this.createError(message, 'API_ERROR', error);
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('quota') || message.includes('credits')) return 'quota_exceeded';
    if (message.includes('api key')) return 'invalid_api_key';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network_error';
    
    return 'unknown_error';
  }

  private calculateConfidence(finishReason: string, content: string): number {
    let confidence = 0.8; // Base confidence
    
    if (finishReason === 'stop') {
      confidence = 0.9;
    } else if (finishReason === 'length') {
      confidence = 0.7;
    } else if (finishReason === 'content_filter') {
      confidence = 0.5;
    }
    
    if (content.length < 10) confidence *= 0.5;
    if (content.includes('I cannot') || content.includes('I\'m sorry')) confidence *= 0.6;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private parseAnalysisFromText(text: string): StoryAnalysis {
    return {
      structure: {
        identifiedStructure: 'unknown',
        completedBeats: [],
        missingBeats: [],
        suggestions: [text.substring(0, 200) + '...'],
        confidence: 0.5
      },
      characters: {
        consistencyScore: 0.5,
        voiceConsistency: 0.5,
        developmentProgress: 0.5,
        relationshipHealth: [],
        suggestions: []
      },
      pacing: {
        overallPacing: 'good',
        tensionCurve: [],
        recommendations: []
      },
      consistency: {
        overallScore: 0.5,
        plotHoles: [],
        characterInconsistencies: [],
        worldBuildingIssues: []
      },
      overallScore: 0.5,
      recommendations: ['Analysis could not be fully parsed. Please try again.']
    };
  }

  private normalizeCharacter(data: any, originalTraits: any): Character {
    return {
      id: data.id || `char-${Date.now()}`,
      name: data.name || originalTraits.name || 'Unnamed Character',
      archetype: data.archetype || {
        primary: 'unknown',
        description: '',
        commonTraits: []
      },
      traits: data.traits || {
        personality: originalTraits.personality || [],
        motivations: originalTraits.motivations || [],
        fears: originalTraits.fears || [],
        strengths: originalTraits.strengths || [],
        weaknesses: originalTraits.weaknesses || [],
        quirks: originalTraits.quirks || []
      },
      relationships: data.relationships || [],
      developmentArc: data.developmentArc || {
        startState: '',
        endState: '',
        keyMoments: [],
        completed: false
      },
      voiceProfile: data.voiceProfile || {
        vocabulary: [],
        speechPatterns: [],
        commonPhrases: [],
        formalityLevel: 5,
        emotionalRange: []
      }
    };
  }

  private parseCharacterFromText(text: string, traits: any): Character {
    return {
      id: `char-${Date.now()}`,
      name: traits.name || 'Generated Character',
      archetype: {
        primary: 'unknown',
        description: 'Generated from text analysis',
        commonTraits: []
      },
      traits: {
        personality: traits.personality || [],
        motivations: traits.motivations || [],
        fears: traits.fears || [],
        strengths: traits.strengths || [],
        weaknesses: traits.weaknesses || [],
        quirks: traits.quirks || []
      },
      relationships: [],
      developmentArc: {
        startState: '',
        endState: '',
        keyMoments: [],
        completed: false
      },
      voiceProfile: {
        vocabulary: [],
        speechPatterns: [],
        commonPhrases: [],
        formalityLevel: 5,
        emotionalRange: []
      }
    };
  }

  // Public methods for model management
  getAvailableModels(): OpenRouterModel[] {
    return [...this.availableModels];
  }

  async refreshModels(): Promise<void> {
    await this.loadAvailableModels();
  }

  setModel(modelId: string): void {
    this.model = modelId;
    console.log(`OpenRouter model changed to: ${modelId}`);
  }
}