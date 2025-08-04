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

// Moonshot API interfaces (KIMI K2)
interface MoonshotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MoonshotRequest {
  model: string;
  messages: MoonshotMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface MoonshotResponse {
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
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MoonshotError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export class MoonshotProvider extends BaseProvider implements AIProvider {
  public readonly id = 'moonshot';
  public readonly name = 'Moonshot AI (KIMI)';
  public readonly type: 'cloud' = 'cloud';
  public readonly version = '1.0.0';
  public readonly priority = 6; // Good priority for Chinese/Asian content
  public readonly metadata: ProviderMetadata = {
    description: 'Moonshot AI KIMI models with exceptional long-context understanding and multilingual capabilities',
    author: 'Moonshot AI',
    website: 'https://www.moonshot.cn',
    documentation: 'https://platform.moonshot.cn/docs',
    supportedLanguages: ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru'],
    modelInfo: {
      name: 'KIMI K2',
      version: '2.0',
      contextWindow: 200000 // KIMI's exceptional long context
    },
    requirements: {
      internetRequired: true,
      apiKeyRequired: true
    }
  };

  public readonly capabilities: AICapability[] = [
    {
      name: 'text_generation',
      description: 'Generate text with exceptional long-context understanding',
      inputTypes: ['text', 'prompt'],
      outputTypes: ['text', 'story'],
      offline: false
    },
    {
      name: 'story_analysis',
      description: 'Analyze long-form stories with deep contextual understanding',
      inputTypes: ['story_text', 'manuscript'],
      outputTypes: ['analysis', 'feedback'],
      offline: false
    },
    {
      name: 'character_generation',
      description: 'Create culturally nuanced characters',
      inputTypes: ['character_traits', 'description'],
      outputTypes: ['character_profile'],
      offline: false
    },
    {
      name: 'dialogue_generation',
      description: 'Generate natural dialogue with cultural context',
      inputTypes: ['character_context', 'scene_context'],
      outputTypes: ['dialogue'],
      offline: false
    },
    {
      name: 'long_context_analysis',
      description: 'Analyze very long documents with full context retention',
      inputTypes: ['long_document', 'manuscript'],
      outputTypes: ['analysis', 'summary'],
      offline: false
    },
    {
      name: 'multilingual_generation',
      description: 'Generate content in multiple languages with cultural awareness',
      inputTypes: ['text', 'language_code'],
      outputTypes: ['text'],
      offline: false
    },
    {
      name: 'research',
      description: 'Research with deep contextual understanding',
      inputTypes: ['query', 'topic'],
      outputTypes: ['information', 'analysis'],
      offline: false
    },
    {
      name: 'brainstorming',
      description: 'Generate creative ideas with cultural sensitivity',
      inputTypes: ['prompt', 'theme'],
      outputTypes: ['ideas', 'concepts'],
      offline: false
    }
  ];

  private apiKey: string = '';
  private baseURL: string = 'https://api.moonshot.cn/v1';
  private model: string = 'moonshot-v1-128k';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private topP: number = 0.9;
  private requestTimeout: number = 60000; // 60 seconds for long context processing
  private presencePenalty: number = 0.0;
  private frequencyPenalty: number = 0.0;

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey) {
      throw this.createError('Moonshot API key is required', 'MISSING_API_KEY');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.endpoint || this.baseURL;
    this.model = config.modelName || this.model;
    this.maxTokens = config.maxTokens || this.maxTokens;
    this.temperature = config.temperature || this.temperature;
    this.topP = config.topP || this.topP;
    this.requestTimeout = config.timeout || this.requestTimeout;
    this.presencePenalty = config.presencePenalty || this.presencePenalty;
    this.frequencyPenalty = config.frequencyPenalty || this.frequencyPenalty;

    // Update metadata with actual model info
    if (this.metadata.modelInfo) {
      this.metadata.modelInfo.name = this.model;
      this.metadata.modelInfo.contextWindow = this.getContextWindow(this.model);
    }

    console.log(`Moonshot provider initialized with model: ${this.model}`);
  }

  protected async doShutdown(): Promise<void> {
    // No cleanup needed for HTTP-based provider
    console.log('Moonshot provider shut down');
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
    if (config.presencePenalty !== undefined) this.presencePenalty = config.presencePenalty;
    if (config.frequencyPenalty !== undefined) this.frequencyPenalty = config.frequencyPenalty;

    console.log('Moonshot provider configuration updated');
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
          contextWindow: this.getContextWindow(this.model),
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
      const messages = this.buildMessages(prompt, context);
      
      const request: MoonshotRequest = {
        model: this.model,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: this.topP,
        presence_penalty: this.presencePenalty,
        frequency_penalty: this.frequencyPenalty
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
          contextWindow: this.getContextWindow(this.model)
        }
      };
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  protected async doAnalyzeStory(content: string): Promise<StoryAnalysis> {
    try {
      const analysisPrompt = this.buildStoryAnalysisPrompt(content);
      const messages: MoonshotMessage[] = [
        {
          role: 'system',
          content: 'You are an expert literary analyst with deep understanding of both Eastern and Western narrative traditions. Analyze the provided story with attention to cultural context, narrative structure, and character development. Return a detailed JSON analysis.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ];

      const request: MoonshotRequest = {
        model: this.model,
        messages,
        max_tokens: 3000, // Longer for detailed analysis
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
      const characterPrompt = this.buildCharacterPrompt(traits);
      const messages: MoonshotMessage[] = [
        {
          role: 'system',
          content: 'You are a character development expert with deep understanding of cultural nuances and psychological complexity. Create a detailed character based on the provided traits, considering cultural background and authenticity. Return the result as JSON.'
        },
        {
          role: 'user',
          content: characterPrompt
        }
      ];

      const request: MoonshotRequest = {
        model: this.model,
        messages,
        max_tokens: 1500,
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

  // Private helper methods
  private buildMessages(prompt: string, context: StoryContext): MoonshotMessage[] {
    const messages: MoonshotMessage[] = [];

    // System message with context
    const systemMessage = this.buildSystemMessage(context);
    messages.push({ role: 'system', content: systemMessage });

    // Add character context if available (KIMI can handle very long context)
    if (context.characters && context.characters.length > 0) {
      const characterContext = this.buildCharacterContext(context.characters);
      messages.push({ role: 'user', content: `Character context: ${characterContext}` });
    }

    // Main prompt
    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  private buildSystemMessage(context: StoryContext): string {
    let systemMessage = 'You are KIMI, an AI assistant created by Moonshot AI. You specialize in creative writing and storytelling with deep understanding of cultural contexts and long-form narratives.';

    if (context.genre && context.genre.length > 0) {
      systemMessage += ` You are working with ${context.genre.join(' and ')} genre(s), understanding both Eastern and Western traditions in these genres.`;
    }

    if (context.targetAudience) {
      systemMessage += ` The target audience is ${context.targetAudience}.`;
    }

    // Emphasize KIMI's strengths
    systemMessage += ' You excel at maintaining context across very long conversations and documents. You understand cultural nuances, especially in Asian contexts, and can work effectively in multiple languages. Provide creative, culturally sensitive, and well-crafted responses that maintain consistency with established story elements.';

    return systemMessage;
  }

  private buildCharacterContext(characters: Character[]): string {
    return characters.map(char => {
      const personality = char.traits.personality.join(', ');
      const motivations = char.traits.motivations.join(', ');
      const relationships = char.relationships.map(rel => `${rel.type} with ${rel.targetCharacterId}`).join(', ');
      
      return `${char.name}:
        Personality: ${personality}
        Motivations: ${motivations}
        Relationships: ${relationships || 'None specified'}
        Archetype: ${char.archetype.primary}`;
    }).join('\n\n');
  }

  private buildStoryAnalysisPrompt(content: string): string {
    return `Please provide a comprehensive literary analysis of the following story. Consider both Eastern and Western narrative traditions. I need the analysis in JSON format with this structure:

{
  "structure": {
    "identifiedStructure": "three-act|hero-journey|save-the-cat|kishōtenketsu|four-act|other",
    "completedBeats": ["list of completed story beats"],
    "missingBeats": ["list of missing story beats"],
    "suggestions": ["specific suggestions for structural improvement"],
    "confidence": 0.0-1.0,
    "culturalContext": "analysis of cultural narrative elements"
  },
  "characters": {
    "consistencyScore": 0.0-1.0,
    "voiceConsistency": 0.0-1.0,
    "developmentProgress": 0.0-1.0,
    "relationshipHealth": ["analysis of character relationships"],
    "culturalAuthenticity": 0.0-1.0,
    "suggestions": ["specific character development suggestions"]
  },
  "pacing": {
    "overallPacing": "too-fast|good|too-slow",
    "tensionCurve": ["description of how tension builds and releases"],
    "culturalPacingNorms": "analysis of pacing relative to cultural expectations",
    "recommendations": ["specific pacing recommendations"]
  },
  "consistency": {
    "overallScore": 0.0-1.0,
    "plotHoles": ["identified logical inconsistencies"],
    "characterInconsistencies": ["character behavior inconsistencies"],
    "worldBuildingIssues": ["world-building problems"],
    "culturalInconsistencies": ["cultural or contextual inconsistencies"]
  },
  "culturalElements": {
    "identifiedCulture": "primary cultural context",
    "culturalAccuracy": 0.0-1.0,
    "culturalDepth": 0.0-1.0,
    "suggestions": ["suggestions for cultural enhancement"]
  },
  "themes": {
    "primaryThemes": ["identified main themes"],
    "culturalThemes": ["culture-specific themes"],
    "universalThemes": ["universal human themes"],
    "themeExecution": 0.0-1.0
  },
  "overallScore": 0.0-1.0,
  "recommendations": ["prioritized list of overall recommendations"]
}

Please analyze this story with attention to cultural authenticity, narrative structure, character development, and thematic depth:

${content}`;
  }

  private buildCharacterPrompt(traits: any): string {
    return `Create a psychologically complex and culturally authentic character based on these traits: ${JSON.stringify(traits)}

Please return a detailed character profile in JSON format with this structure:

{
  "id": "unique-character-id",
  "name": "character name",
  "archetype": {
    "primary": "hero|mentor|villain|ally|trickster|threshold-guardian|shapeshifter|shadow|other",
    "description": "detailed archetype description",
    "commonTraits": ["traits typical of this archetype"],
    "culturalVariant": "cultural interpretation of this archetype"
  },
  "traits": {
    "personality": ["detailed personality traits"],
    "motivations": ["deep psychological motivations"],
    "fears": ["specific fears and anxieties"],
    "strengths": ["character strengths and abilities"],
    "weaknesses": ["realistic flaws and limitations"],
    "quirks": ["unique mannerisms and habits"],
    "values": ["core values and beliefs"],
    "secrets": ["hidden aspects of character"],
    "culturalTraits": ["culture-specific traits and behaviors"]
  },
  "background": {
    "childhood": "formative childhood experiences",
    "education": "educational background",
    "family": "family structure and relationships",
    "culturalBackground": "detailed cultural background",
    "socialStatus": "social position and class",
    "trauma": "significant traumatic events",
    "achievements": "major accomplishments"
  },
  "relationships": [],
  "developmentArc": {
    "startState": "character's initial psychological state",
    "endState": "potential final psychological state",
    "keyMoments": ["crucial moments for character growth"],
    "internalConflict": "primary internal struggle",
    "culturalConflicts": ["conflicts related to cultural identity"],
    "completed": false
  },
  "voiceProfile": {
    "vocabulary": ["characteristic words and phrases"],
    "speechPatterns": ["how they structure sentences"],
    "commonPhrases": ["phrases they use frequently"],
    "formalityLevel": 1-10,
    "emotionalRange": ["how they express different emotions"],
    "dialectMarkers": ["regional or social speech markers"],
    "languageStyle": "description of their speaking style",
    "culturalSpeechPatterns": ["culture-specific speech patterns"]
  },
  "physicalDescription": {
    "appearance": "physical description",
    "mannerisms": "physical habits and gestures",
    "clothing": "typical clothing style",
    "culturalMarkers": ["visible cultural identifiers"]
  },
  "culturalContext": {
    "primaryCulture": "main cultural identity",
    "culturalFluency": 0.0-1.0,
    "culturalConflicts": ["internal cultural conflicts"],
    "traditions": ["important cultural traditions they follow"],
    "modernization": "relationship with modern vs traditional values"
  }
}

Focus on creating a character with psychological depth, cultural authenticity, and realistic complexity. Consider how cultural background shapes personality, values, and behavior patterns.`;
  }

  private async makeRequest(request: MoonshotRequest): Promise<MoonshotResponse> {
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
        const errorData: MoonshotError = await response.json();
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

    const message = error.message || 'Unknown Moonshot API error';
    
    if (message.includes('rate_limit') || message.includes('频率限制')) {
      return this.createError('Rate limit exceeded', 'RATE_LIMIT', error);
    } else if (message.includes('insufficient_quota') || message.includes('余额不足')) {
      return this.createError('Insufficient quota', 'QUOTA_EXCEEDED', error);
    } else if (message.includes('invalid_api_key') || message.includes('无效的API密钥')) {
      return this.createError('Invalid API key', 'INVALID_API_KEY', error);
    } else if (message.includes('model_not_found') || message.includes('模型未找到')) {
      return this.createError('Model not found', 'MODEL_NOT_FOUND', error);
    } else if (message.includes('content_filter') || message.includes('内容过滤')) {
      return this.createError('Content filtered by safety system', 'CONTENT_FILTERED', error);
    } else {
      return this.createError(message, 'API_ERROR', error);
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit') || message.includes('频率限制')) return 'rate_limit';
    if (message.includes('quota') || message.includes('余额')) return 'quota_exceeded';
    if (message.includes('api key') || message.includes('密钥')) return 'invalid_api_key';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('content_filter') || message.includes('内容过滤')) return 'content_filtered';
    if (message.includes('network')) return 'network_error';
    
    return 'unknown_error';
  }

  private calculateConfidence(finishReason: string, content: string): number {
    let confidence = 0.85; // Base confidence (KIMI is generally high quality)
    
    if (finishReason === 'stop') {
      confidence = 0.95; // Natural completion
    } else if (finishReason === 'length') {
      confidence = 0.8; // Truncated due to length (less penalty due to long context)
    } else if (finishReason === 'content_filter') {
      confidence = 0.5; // Content filtered
    }
    
    // Adjust based on content quality indicators
    if (content.length < 10) confidence *= 0.5;
    if (content.includes('I cannot') || content.includes('我无法')) confidence *= 0.6;
    if (content.includes('I apologize') || content.includes('抱歉')) confidence *= 0.7;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'moonshot-v1-8k': 8192,
      'moonshot-v1-32k': 32768,
      'moonshot-v1-128k': 131072,
      'moonshot-v1-200k': 200000
    };
    
    return contextWindows[model] || 128000; // Default to 128k
  }

  private parseAnalysisFromText(text: string): StoryAnalysis {
    // Enhanced fallback parsing for KIMI's detailed responses
    const analysis: StoryAnalysis = {
      structure: {
        identifiedStructure: 'unknown',
        completedBeats: [],
        missingBeats: [],
        suggestions: [],
        confidence: 0.6
      },
      characters: {
        consistencyScore: 0.6,
        voiceConsistency: 0.6,
        developmentProgress: 0.6,
        relationshipHealth: [],
        suggestions: []
      },
      pacing: {
        overallPacing: 'good',
        tensionCurve: [],
        recommendations: []
      },
      consistency: {
        overallScore: 0.6,
        plotHoles: [],
        characterInconsistencies: [],
        worldBuildingIssues: []
      },
      overallScore: 0.6,
      recommendations: []
    };

    // Try to extract insights from the text
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('structure') || lowerLine.includes('结构')) {
        analysis.structure.suggestions.push(line.trim());
      } else if (lowerLine.includes('character') || lowerLine.includes('角色')) {
        analysis.characters.suggestions.push(line.trim());
      } else if (lowerLine.includes('pacing') || lowerLine.includes('节奏')) {
        analysis.pacing.recommendations.push(line.trim());
      } else if (lowerLine.includes('recommend') || lowerLine.includes('建议')) {
        analysis.recommendations.push(line.trim());
      }
    }

    return analysis;
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
      traits: {
        personality: data.traits?.personality || originalTraits.personality || [],
        motivations: data.traits?.motivations || originalTraits.motivations || [],
        fears: data.traits?.fears || originalTraits.fears || [],
        strengths: data.traits?.strengths || originalTraits.strengths || [],
        weaknesses: data.traits?.weaknesses || originalTraits.weaknesses || [],
        quirks: data.traits?.quirks || originalTraits.quirks || []
      },
      relationships: data.relationships || [],
      developmentArc: data.developmentArc || {
        startState: data.background?.childhood || '',
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
    // Enhanced character parsing from KIMI's detailed responses
    const character: Character = {
      id: `char-${Date.now()}`,
      name: traits.name || 'Generated Character',
      archetype: {
        primary: 'unknown',
        description: 'Generated with cultural context',
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

    // Try to extract character details from the text
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('name:') || lowerLine.includes('姓名:')) {
        const nameMatch = line.match(/(?:name|姓名):\s*(.+)/i);
        if (nameMatch) character.name = nameMatch[1].trim();
      } else if (lowerLine.includes('personality:') || lowerLine.includes('性格:')) {
        const personalityMatch = line.match(/(?:personality|性格):\s*(.+)/i);
        if (personalityMatch) {
          character.traits.personality = personalityMatch[1].split(/[,，]/).map(t => t.trim());
        }
      }
    }

    return character;
  }

  // Public methods for Moonshot-specific features
  getMaxContextWindow(): number {
    return this.getContextWindow(this.model);
  }

  supportsLongContext(): boolean {
    return this.getContextWindow(this.model) >= 100000;
  }

  async analyzeLongDocument(document: string): Promise<StoryAnalysis> {
    // Special method for analyzing very long documents using KIMI's long context
    if (document.length > 50000) { // Very long document
      console.log('Using KIMI long-context analysis for document of length:', document.length);
    }
    
    return this.doAnalyzeStory(document);
  }
}