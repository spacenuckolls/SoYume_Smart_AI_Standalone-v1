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

// Mistral API interfaces
interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  random_seed?: number;
  stream?: boolean;
  safe_prompt?: boolean;
}

interface MistralResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'model_length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MistralError {
  message: string;
  type: string;
  code?: string;
}

export class MistralProvider extends BaseProvider implements AIProvider {
  public readonly id = 'mistral';
  public readonly name = 'Mistral AI';
  public readonly type: 'cloud' = 'cloud';
  public readonly version = '1.0.0';
  public readonly priority = 7; // Good priority for European AI
  public readonly metadata: ProviderMetadata = {
    description: 'Mistral AI models for efficient and high-quality text generation with European privacy standards',
    author: 'Mistral AI',
    website: 'https://mistral.ai',
    documentation: 'https://docs.mistral.ai',
    supportedLanguages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ru'],
    modelInfo: {
      name: 'Mistral Large',
      version: '2.0',
      contextWindow: 32768
    },
    requirements: {
      internetRequired: true,
      apiKeyRequired: true
    }
  };

  public readonly capabilities: AICapability[] = [
    {
      name: 'text_generation',
      description: 'Generate high-quality text with European privacy standards',
      inputTypes: ['text', 'prompt'],
      outputTypes: ['text', 'story'],
      offline: false
    },
    {
      name: 'story_analysis',
      description: 'Analyze story structure and narrative elements',
      inputTypes: ['story_text', 'manuscript'],
      outputTypes: ['analysis', 'feedback'],
      offline: false
    },
    {
      name: 'character_generation',
      description: 'Create detailed character profiles',
      inputTypes: ['character_traits', 'description'],
      outputTypes: ['character_profile'],
      offline: false
    },
    {
      name: 'dialogue_generation',
      description: 'Generate natural dialogue with multilingual support',
      inputTypes: ['character_context', 'scene_context'],
      outputTypes: ['dialogue'],
      offline: false
    },
    {
      name: 'multilingual_generation',
      description: 'Generate content in multiple European languages',
      inputTypes: ['text', 'language_code'],
      outputTypes: ['text'],
      offline: false
    },
    {
      name: 'brainstorming',
      description: 'Generate creative ideas and concepts',
      inputTypes: ['prompt', 'theme'],
      outputTypes: ['ideas', 'concepts'],
      offline: false
    }
  ];

  private apiKey: string = '';
  private baseURL: string = 'https://api.mistral.ai/v1';
  private model: string = 'mistral-large-latest';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private topP: number = 0.9;
  private requestTimeout: number = 30000; // 30 seconds
  private safePrompt: boolean = false; // Mistral's content filtering

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey) {
      throw this.createError('Mistral API key is required', 'MISSING_API_KEY');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.endpoint || this.baseURL;
    this.model = config.modelName || this.model;
    this.maxTokens = config.maxTokens || this.maxTokens;
    this.temperature = config.temperature || this.temperature;
    this.topP = config.topP || this.topP;
    this.requestTimeout = config.timeout || this.requestTimeout;
    this.safePrompt = config.safePrompt || this.safePrompt;

    // Update metadata with actual model info
    if (this.metadata.modelInfo) {
      this.metadata.modelInfo.name = this.model;
      this.metadata.modelInfo.contextWindow = this.getContextWindow(this.model);
    }

    console.log(`Mistral provider initialized with model: ${this.model}`);
  }

  protected async doShutdown(): Promise<void> {
    // No cleanup needed for HTTP-based provider
    console.log('Mistral provider shut down');
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
    if (config.safePrompt !== undefined) this.safePrompt = config.safePrompt;

    console.log('Mistral provider configuration updated');
  }

  protected async doHealthCheck(): Promise<Omit<HealthCheckResult, 'responseTime'>> {
    try {
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
          rateLimitOk: true,
          safePrompt: this.safePrompt
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
      const messages = this.buildMessages(prompt, context);
      
      const request: MistralRequest = {
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: this.topP,
        safe_prompt: this.safePrompt
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
          safePrompt: this.safePrompt
        }
      };
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  protected async doAnalyzeStory(content: string): Promise<StoryAnalysis> {
    try {
      const analysisPrompt = this.buildStoryAnalysisPrompt(content);
      const messages: MistralMessage[] = [
        {
          role: 'system',
          content: 'You are an expert literary analyst. Analyze the provided story and return a detailed JSON analysis focusing on narrative structure, character development, and storytelling craft.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ];

      const request: MistralRequest = {
        model: this.model,
        messages,
        max_tokens: 2048,
        temperature: 0.3, // Lower temperature for analysis
        safe_prompt: this.safePrompt
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
      const characterPrompt = this.buildCharacterPrompt(traits);
      const messages: MistralMessage[] = [
        {
          role: 'system',
          content: 'You are a character development expert. Create a detailed, psychologically consistent character based on the provided traits. Return the result as JSON.'
        },
        {
          role: 'user',
          content: characterPrompt
        }
      ];

      const request: MistralRequest = {
        model: this.model,
        messages,
        max_tokens: 1024,
        temperature: 0.8, // Higher temperature for creativity
        safe_prompt: this.safePrompt
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

  // Private helper methods
  private buildMessages(prompt: string, context: StoryContext): MistralMessage[] {
    const messages: MistralMessage[] = [];

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
    let systemMessage = 'You are a creative writing assistant specializing in storytelling, narrative craft, and character development.';

    if (context.genre && context.genre.length > 0) {
      systemMessage += ` You are working with ${context.genre.join(' and ')} genre(s).`;
    }

    if (context.targetAudience) {
      systemMessage += ` The target audience is ${context.targetAudience}.`;
    }

    // Add multilingual support note
    systemMessage += ' You can work in multiple languages and understand cultural nuances. Provide creative, engaging, and well-crafted responses that maintain consistency with the established story elements.';

    return systemMessage;
  }

  private buildCharacterContext(characters: Character[]): string {
    return characters.map(char => 
      `${char.name}: ${char.traits.personality.join(', ')}`
    ).join('; ');
  }

  private buildStoryAnalysisPrompt(content: string): string {
    return `Please analyze the following story and provide a comprehensive analysis in JSON format. Focus on European literary traditions and narrative techniques.

Required JSON structure:
{
  "structure": {
    "identifiedStructure": "three-act|hero-journey|save-the-cat|freytag-pyramid|other",
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
  "style": {
    "writingStyle": "description of writing style",
    "tone": "description of tone",
    "literaryDevices": ["identified literary devices"],
    "culturalElements": ["cultural references and elements"]
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
    "primary": "hero|mentor|villain|ally|trickster|other",
    "description": "archetype description",
    "commonTraits": ["list of common traits"]
  },
  "traits": {
    "personality": ["personality traits"],
    "motivations": ["character motivations"],
    "fears": ["character fears"],
    "strengths": ["character strengths"],
    "weaknesses": ["character weaknesses"],
    "quirks": ["unique quirks"],
    "culturalBackground": "cultural background if relevant"
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
    "emotionalRange": ["emotional expressions"],
    "languageStyle": "description of how they speak"
  }
}

Focus on creating a character with psychological depth and cultural authenticity.`;
  }

  private async makeRequest(request: MistralRequest): Promise<MistralResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'SoYume-AI-Assistant/1.0'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: { error: MistralError } = await response.json();
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

    const message = error.message || 'Unknown Mistral API error';
    
    if (message.includes('rate_limit')) {
      return this.createError('Rate limit exceeded', 'RATE_LIMIT', error);
    } else if (message.includes('insufficient_quota') || message.includes('billing')) {
      return this.createError('Insufficient quota', 'QUOTA_EXCEEDED', error);
    } else if (message.includes('invalid_api_key') || message.includes('unauthorized')) {
      return this.createError('Invalid API key', 'INVALID_API_KEY', error);
    } else if (message.includes('model_not_found')) {
      return this.createError('Model not found', 'MODEL_NOT_FOUND', error);
    } else if (message.includes('content_filter')) {
      return this.createError('Content filtered by safety system', 'CONTENT_FILTERED', error);
    } else {
      return this.createError(message, 'API_ERROR', error);
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('quota') || message.includes('billing')) return 'quota_exceeded';
    if (message.includes('api key') || message.includes('unauthorized')) return 'invalid_api_key';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('content_filter')) return 'content_filtered';
    if (message.includes('network')) return 'network_error';
    
    return 'unknown_error';
  }

  private calculateConfidence(finishReason: string, content: string): number {
    let confidence = 0.8; // Base confidence
    
    if (finishReason === 'stop') {
      confidence = 0.9; // Natural completion
    } else if (finishReason === 'length' || finishReason === 'model_length') {
      confidence = 0.7; // Truncated due to length
    }
    
    // Adjust based on content quality indicators
    if (content.length < 10) confidence *= 0.5;
    if (content.includes('I cannot') || content.includes('I\'m sorry')) confidence *= 0.6;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'mistral-large-latest': 32768,
      'mistral-large-2402': 32768,
      'mistral-medium-latest': 32768,
      'mistral-small-latest': 32768,
      'mistral-tiny': 32768,
      'open-mistral-7b': 32768,
      'open-mixtral-8x7b': 32768,
      'open-mixtral-8x22b': 65536
    };
    
    return contextWindows[model] || 32768;
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

  // Public methods for Mistral-specific features
  setSafePrompt(enabled: boolean): void {
    this.safePrompt = enabled;
    console.log(`Mistral safe prompt ${enabled ? 'enabled' : 'disabled'}`);
  }

  getSafePrompt(): boolean {
    return this.safePrompt;
  }
}