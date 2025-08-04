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

// Anthropic API interfaces
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  system?: string;
  stream?: boolean;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicError {
  type: string;
  message: string;
}

export class AnthropicProvider extends BaseProvider implements AIProvider {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic Claude';
  public readonly type: 'cloud' = 'cloud';
  public readonly version = '1.0.0';
  public readonly priority = 9; // Very high priority for creative tasks
  public readonly metadata: ProviderMetadata = {
    description: 'Anthropic Claude models for thoughtful and nuanced creative writing assistance',
    author: 'Anthropic',
    website: 'https://anthropic.com',
    documentation: 'https://docs.anthropic.com',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    modelInfo: {
      name: 'Claude-3',
      version: '3.0',
      contextWindow: 200000
    },
    requirements: {
      internetRequired: true,
      apiKeyRequired: true
    }
  };

  public readonly capabilities: AICapability[] = [
    {
      name: 'text_generation',
      description: 'Generate thoughtful and nuanced creative text',
      inputTypes: ['text', 'prompt'],
      outputTypes: ['text', 'story'],
      offline: false
    },
    {
      name: 'story_analysis',
      description: 'Provide deep literary analysis and feedback',
      inputTypes: ['story_text', 'manuscript'],
      outputTypes: ['analysis', 'feedback'],
      offline: false
    },
    {
      name: 'character_generation',
      description: 'Create psychologically complex characters',
      inputTypes: ['character_traits', 'description'],
      outputTypes: ['character_profile'],
      offline: false
    },
    {
      name: 'dialogue_generation',
      description: 'Generate natural, character-appropriate dialogue',
      inputTypes: ['character_context', 'scene_context'],
      outputTypes: ['dialogue'],
      offline: false
    },
    {
      name: 'literary_analysis',
      description: 'Analyze literary themes, symbolism, and techniques',
      inputTypes: ['text', 'literary_work'],
      outputTypes: ['analysis', 'interpretation'],
      offline: false
    },
    {
      name: 'brainstorming',
      description: 'Generate creative and thoughtful ideas',
      inputTypes: ['prompt', 'theme'],
      outputTypes: ['ideas', 'concepts'],
      offline: false
    }
  ];

  private apiKey: string = '';
  private baseURL: string = 'https://api.anthropic.com/v1';
  private model: string = 'claude-3-sonnet-20240229';
  private maxTokens: number = 2048;
  private temperature: number = 0.7;
  private topP: number = 0.9;
  private topK: number = 40;
  private requestTimeout: number = 60000; // 60 seconds (Claude can be slower)

  protected async doInitialize(config: ProviderConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey) {
      throw this.createError('Anthropic API key is required', 'MISSING_API_KEY');
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.endpoint || this.baseURL;
    this.model = config.modelName || this.model;
    this.maxTokens = config.maxTokens || this.maxTokens;
    this.temperature = config.temperature || this.temperature;
    this.topP = config.topP || this.topP;
    this.topK = config.topK || this.topK;
    this.requestTimeout = config.timeout || this.requestTimeout;

    // Update metadata with actual model info
    if (this.metadata.modelInfo) {
      this.metadata.modelInfo.name = this.model;
      this.metadata.modelInfo.contextWindow = this.getContextWindow(this.model);
    }

    console.log(`Anthropic provider initialized with model: ${this.model}`);
  }

  protected async doShutdown(): Promise<void> {
    // No cleanup needed for HTTP-based provider
    console.log('Anthropic provider shut down');
  }

  protected async doUpdateConfig(config: ProviderConfig): Promise<void> {
    // Update configuration without reinitializing
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.endpoint) this.baseURL = config.endpoint;
    if (config.modelName) this.model = config.modelName;
    if (config.maxTokens) this.maxTokens = config.maxTokens;
    if (config.temperature) this.temperature = config.temperature;
    if (config.topP) this.topP = config.topP;
    if (config.topK) this.topK = config.topK;
    if (config.timeout) this.requestTimeout = config.timeout;

    console.log('Anthropic provider configuration updated');
  }

  protected async doHealthCheck(): Promise<Omit<HealthCheckResult, 'responseTime'>> {
    try {
      // Simple health check with minimal request
      const response = await this.makeRequest({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });

      return {
        healthy: true,
        details: {
          model: this.model,
          available: true,
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
      const { systemMessage, messages } = this.buildMessages(prompt, context);
      
      const request: AnthropicRequest = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages,
        temperature: this.temperature,
        top_p: this.topP,
        top_k: this.topK,
        system: systemMessage
      };

      const response = await this.makeRequest(request);
      
      if (!response.content || response.content.length === 0) {
        throw this.createError('No response generated', 'EMPTY_RESPONSE');
      }

      const content = response.content[0].text.trim();

      return {
        content,
        confidence: this.calculateConfidence(response.stop_reason, content),
        metadata: {
          model: response.model,
          provider: this.name,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          responseTime: 0, // Will be set by base class
          stopReason: response.stop_reason,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      };
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  protected async doAnalyzeStory(content: string): Promise<StoryAnalysis> {
    try {
      const analysisPrompt = this.buildStoryAnalysisPrompt(content);
      const systemMessage = `You are a literary expert and story analyst with deep knowledge of narrative structure, character development, and storytelling craft. 
      
Analyze stories with attention to:
- Narrative structure and pacing
- Character development and consistency
- Thematic elements and symbolism
- Literary techniques and style
- Plot coherence and logic
- Emotional resonance and impact

Provide detailed, constructive feedback that helps writers improve their craft.`;

      const request: AnthropicRequest = {
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3, // Lower temperature for analysis
        system: systemMessage
      };

      const response = await this.makeRequest(request);
      const analysisText = response.content[0].text;

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
      const systemMessage = `You are a character development expert specializing in creating psychologically complex, three-dimensional characters.

Focus on:
- Psychological depth and internal consistency
- Realistic motivations and conflicts
- Unique voice and personality
- Character growth potential
- Authentic human flaws and strengths
- Compelling backstory elements

Create characters that feel like real people with rich inner lives.`;

      const request: AnthropicRequest = {
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: characterPrompt }],
        temperature: 0.8, // Higher temperature for creativity
        system: systemMessage
      };

      const response = await this.makeRequest(request);
      const characterText = response.content[0].text;

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
  private buildMessages(prompt: string, context: StoryContext): { systemMessage: string; messages: AnthropicMessage[] } {
    const systemMessage = this.buildSystemMessage(context);
    const messages: AnthropicMessage[] = [];

    // Add character context if available
    if (context.characters && context.characters.length > 0) {
      const characterContext = this.buildCharacterContext(context.characters);
      messages.push({ role: 'user', content: `Character context: ${characterContext}` });
      messages.push({ role: 'assistant', content: 'I understand the character context. How can I help with your creative writing?' });
    }

    // Main prompt
    messages.push({ role: 'user', content: prompt });

    return { systemMessage, messages };
  }

  private buildSystemMessage(context: StoryContext): string {
    let systemMessage = `You are Claude, an AI assistant created by Anthropic to be helpful, harmless, and honest. You specialize in creative writing and storytelling.

You are thoughtful, nuanced, and provide high-quality creative assistance. You understand narrative craft, character development, and literary techniques.`;

    if (context.genre && context.genre.length > 0) {
      systemMessage += ` You are currently working with ${context.genre.join(' and ')} genre(s), and you understand the conventions and expectations of these genres.`;
    }

    if (context.targetAudience) {
      systemMessage += ` The target audience is ${context.targetAudience}, so adjust your language and content appropriately.`;
    }

    systemMessage += `

Provide creative, engaging, and well-crafted responses that:
- Maintain consistency with established story elements
- Show deep understanding of character psychology
- Demonstrate knowledge of literary techniques
- Offer constructive and specific feedback
- Respect the creative vision while suggesting improvements`;

    return systemMessage;
  }

  private buildCharacterContext(characters: Character[]): string {
    return characters.map(char => {
      const personality = char.traits.personality.join(', ');
      const motivations = char.traits.motivations.join(', ');
      return `${char.name}: Personality - ${personality}; Motivations - ${motivations}`;
    }).join('\n');
  }

  private buildStoryAnalysisPrompt(content: string): string {
    return `Please provide a comprehensive literary analysis of the following story. I need the analysis in JSON format with this exact structure:

{
  "structure": {
    "identifiedStructure": "three-act|hero-journey|save-the-cat|kishōtenketsu|other",
    "completedBeats": ["list of completed story beats"],
    "missingBeats": ["list of missing story beats"],
    "suggestions": ["specific suggestions for structural improvement"],
    "confidence": 0.0-1.0
  },
  "characters": {
    "consistencyScore": 0.0-1.0,
    "voiceConsistency": 0.0-1.0,
    "developmentProgress": 0.0-1.0,
    "relationshipHealth": ["analysis of character relationships"],
    "suggestions": ["specific character development suggestions"]
  },
  "pacing": {
    "overallPacing": "too-fast|good|too-slow",
    "tensionCurve": ["description of how tension builds and releases"],
    "recommendations": ["specific pacing recommendations"]
  },
  "consistency": {
    "overallScore": 0.0-1.0,
    "plotHoles": ["identified logical inconsistencies"],
    "characterInconsistencies": ["character behavior inconsistencies"],
    "worldBuildingIssues": ["world-building problems"]
  },
  "literaryElements": {
    "themes": ["identified themes"],
    "symbolism": ["symbolic elements"],
    "style": "description of writing style",
    "tone": "description of tone",
    "pointOfView": "first-person|third-person-limited|third-person-omniscient|other"
  },
  "overallScore": 0.0-1.0,
  "recommendations": ["prioritized list of overall recommendations"]
}

Please analyze this story with attention to literary craft, narrative structure, character development, and thematic depth:

${content}`;
  }

  private buildCharacterPrompt(traits: any): string {
    return `Create a psychologically complex character based on these traits: ${JSON.stringify(traits)}

Please return a detailed character profile in JSON format with this structure:

{
  "id": "unique-character-id",
  "name": "character name",
  "archetype": {
    "primary": "hero|mentor|villain|ally|trickster|threshold-guardian|shapeshifter|shadow|other",
    "description": "detailed archetype description",
    "commonTraits": ["traits typical of this archetype"]
  },
  "traits": {
    "personality": ["detailed personality traits"],
    "motivations": ["deep psychological motivations"],
    "fears": ["specific fears and anxieties"],
    "strengths": ["character strengths and abilities"],
    "weaknesses": ["realistic flaws and limitations"],
    "quirks": ["unique mannerisms and habits"],
    "values": ["core values and beliefs"],
    "secrets": ["hidden aspects of character"]
  },
  "background": {
    "childhood": "formative childhood experiences",
    "education": "educational background",
    "relationships": "key relationships that shaped them",
    "trauma": "significant traumatic events",
    "achievements": "major accomplishments"
  },
  "relationships": [],
  "developmentArc": {
    "startState": "character's initial psychological state",
    "endState": "potential final psychological state",
    "keyMoments": ["crucial moments for character growth"],
    "internalConflict": "primary internal struggle",
    "completed": false
  },
  "voiceProfile": {
    "vocabulary": ["characteristic words and phrases"],
    "speechPatterns": ["how they structure sentences"],
    "commonPhrases": ["phrases they use frequently"],
    "formalityLevel": 1-10,
    "emotionalRange": ["how they express different emotions"],
    "dialectMarkers": ["regional or social speech markers"]
  },
  "physicalDescription": {
    "appearance": "physical description",
    "mannerisms": "physical habits and gestures",
    "clothing": "typical clothing style"
  }
}

Focus on creating a character with psychological depth, internal consistency, and realistic complexity.`;
  }

  private async makeRequest(request: AnthropicRequest): Promise<AnthropicResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'SoYume-AI-Assistant/1.0'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: { error: AnthropicError } = await response.json();
        throw this.createError(
          errorData.error.message,
          errorData.error.type.toUpperCase(),
          { status: response.status }
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
      // Already a structured error
      return error;
    }

    const message = error.message || 'Unknown Anthropic API error';
    
    // Classify common errors
    if (message.includes('rate_limit')) {
      return this.createError('Rate limit exceeded', 'RATE_LIMIT', error);
    } else if (message.includes('insufficient_quota') || message.includes('billing')) {
      return this.createError('Insufficient quota or billing issue', 'QUOTA_EXCEEDED', error);
    } else if (message.includes('invalid_api_key') || message.includes('authentication')) {
      return this.createError('Invalid API key', 'INVALID_API_KEY', error);
    } else if (message.includes('model_not_found')) {
      return this.createError('Model not found', 'MODEL_NOT_FOUND', error);
    } else if (message.includes('overloaded')) {
      return this.createError('Service overloaded', 'SERVICE_OVERLOADED', error);
    } else {
      return this.createError(message, 'API_ERROR', error);
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('quota') || message.includes('billing')) return 'quota_exceeded';
    if (message.includes('api key') || message.includes('authentication')) return 'invalid_api_key';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('overloaded')) return 'service_overloaded';
    if (message.includes('network')) return 'network_error';
    
    return 'unknown_error';
  }

  private calculateConfidence(stopReason: string, content: string): number {
    let confidence = 0.85; // Base confidence (Claude is generally high quality)
    
    if (stopReason === 'end_turn') {
      confidence = 0.95; // Natural completion
    } else if (stopReason === 'max_tokens') {
      confidence = 0.75; // Truncated due to length
    } else if (stopReason === 'stop_sequence') {
      confidence = 0.9; // Stopped at specified sequence
    }
    
    // Adjust based on content quality indicators
    if (content.length < 10) confidence *= 0.5;
    if (content.includes('I cannot') || content.includes('I\'m not able')) confidence *= 0.6;
    if (content.includes('I apologize') && content.length < 100) confidence *= 0.7;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getContextWindow(model: string): number {
    const contextWindows: Record<string, number> = {
      'claude-3-opus-20240229': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-2.1': 200000,
      'claude-2.0': 100000,
      'claude-instant-1.2': 100000
    };
    
    return contextWindows[model] || 100000;
  }

  private parseAnalysisFromText(text: string): StoryAnalysis {
    // Enhanced fallback parsing for Claude's detailed responses
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
      
      if (lowerLine.includes('structure') || lowerLine.includes('plot')) {
        analysis.structure.suggestions.push(line.trim());
      } else if (lowerLine.includes('character')) {
        analysis.characters.suggestions.push(line.trim());
      } else if (lowerLine.includes('pacing') || lowerLine.includes('pace')) {
        analysis.pacing.recommendations.push(line.trim());
      } else if (lowerLine.includes('recommend') || lowerLine.includes('suggest')) {
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
    // Enhanced character parsing from Claude's detailed responses
    const character: Character = {
      id: `char-${Date.now()}`,
      name: traits.name || 'Generated Character',
      archetype: {
        primary: 'unknown',
        description: 'Generated from detailed analysis',
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
      
      if (lowerLine.includes('name:')) {
        const nameMatch = line.match(/name:\s*(.+)/i);
        if (nameMatch) character.name = nameMatch[1].trim();
      } else if (lowerLine.includes('personality:')) {
        const personalityMatch = line.match(/personality:\s*(.+)/i);
        if (personalityMatch) {
          character.traits.personality = personalityMatch[1].split(',').map(t => t.trim());
        }
      }
    }

    return character;
  }
}