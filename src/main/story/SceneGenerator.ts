import { Story, Scene, Character, SceneGenerationRequest, SceneGenerationResult, AtmosphereProfile, SensoryDetails } from '../../shared/types/Story';
import { AIProviderRegistry } from '../ai/providers/AIProviderRegistry';

export interface SceneGenerationOptions {
  mood: 'tense' | 'peaceful' | 'mysterious' | 'romantic' | 'action' | 'melancholy' | 'hopeful' | 'dark' | 'whimsical';
  setting: 'indoor' | 'outdoor' | 'urban' | 'rural' | 'fantasy' | 'sci-fi' | 'historical' | 'contemporary';
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';
  weather: 'clear' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy' | 'windy' | 'hot' | 'cold';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  sensoryFocus: 'visual' | 'auditory' | 'tactile' | 'olfactory' | 'gustatory' | 'balanced';
  detailLevel: 'minimal' | 'moderate' | 'rich' | 'immersive';
  genre: 'fantasy' | 'sci-fi' | 'romance' | 'thriller' | 'horror' | 'literary' | 'mystery' | 'adventure';
}

export interface AtmosphereGenerationResult {
  atmosphereProfile: AtmosphereProfile;
  sensoryDetails: SensoryDetails;
  moodDescriptors: string[];
  environmentalElements: EnvironmentalElement[];
  suggestions: AtmosphereSuggestion[];
}

export interface EnvironmentalElement {
  type: 'lighting' | 'sound' | 'texture' | 'scent' | 'temperature' | 'movement';
  description: string;
  intensity: number; // 0-10
  moodContribution: string;
}

export interface AtmosphereSuggestion {
  type: 'enhancement' | 'contrast' | 'sensory' | 'mood';
  description: string;
  implementation: string;
  impact: string;
}

export interface ActionChoreographyRequest {
  actionType: 'fight' | 'chase' | 'dance' | 'ritual' | 'sports' | 'combat' | 'escape' | 'stealth';
  participants: string[]; // Character names
  setting: string;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  duration: 'brief' | 'short' | 'medium' | 'extended';
  complexity: 'simple' | 'moderate' | 'complex' | 'intricate';
}

export interface ActionChoreographyResult {
  sequence: ActionSequence[];
  timing: ActionTiming;
  spatialLayout: SpatialDescription;
  suggestions: ActionSuggestion[];
}

export interface ActionSequence {
  step: number;
  description: string;
  participants: string[];
  duration: string;
  intensity: number;
  consequences: string[];
}

export interface ActionTiming {
  totalDuration: string;
  pacing: 'slow' | 'moderate' | 'fast' | 'variable';
  beats: ActionBeat[];
}

export interface ActionBeat {
  timestamp: string;
  event: string;
  emphasis: 'low' | 'medium' | 'high';
}

export interface SpatialDescription {
  layout: string;
  keyPositions: Array<{ name: string; description: string }>;
  movementPaths: Array<{ participant: string; path: string }>;
  obstacles: string[];
}

export interface ActionSuggestion {
  type: 'pacing' | 'detail' | 'consequence' | 'realism';
  description: string;
  implementation: string;
}

export class SceneGenerator {
  private aiRegistry: AIProviderRegistry;
  private atmosphereTemplates: Map<string, AtmosphereTemplate> = new Map();
  private sensoryLibrary: SensoryLibrary;

  constructor(aiRegistry: AIProviderRegistry) {
    this.aiRegistry = aiRegistry;
    this.sensoryLibrary = new SensoryLibrary();
    this.initializeAtmosphereTemplates();
  }

  private initializeAtmosphereTemplates(): void {
    // Tense atmosphere template
    this.atmosphereTemplates.set('tense', {
      name: 'Tense',
      description: 'Creates an atmosphere of suspense and anxiety',
      moodDescriptors: ['oppressive', 'suffocating', 'electric', 'charged', 'heavy'],
      lightingPatterns: ['harsh shadows', 'flickering light', 'dim illumination', 'stark contrasts'],
      soundPatterns: ['silence broken by sudden noises', 'distant sounds', 'creaking', 'whispers'],
      texturePatterns: ['rough surfaces', 'cold materials', 'sharp edges', 'uncomfortable textures'],
      scentPatterns: ['metallic', 'stale air', 'ozone', 'dust'],
      temperaturePatterns: ['uncomfortably warm', 'sudden chills', 'clammy', 'stifling'],
      colorPalette: ['deep reds', 'dark grays', 'muted colors', 'stark black and white'],
      typicalElements: ['shadows', 'confined spaces', 'ticking clocks', 'closed doors']
    });

    // Peaceful atmosphere template
    this.atmosphereTemplates.set('peaceful', {
      name: 'Peaceful',
      description: 'Creates a calm and serene atmosphere',
      moodDescriptors: ['serene', 'tranquil', 'gentle', 'soothing', 'harmonious'],
      lightingPatterns: ['soft golden light', 'dappled sunlight', 'warm glow', 'gentle illumination'],
      soundPatterns: ['gentle breeze', 'distant birdsong', 'soft rustling', 'flowing water'],
      texturePatterns: ['smooth surfaces', 'soft fabrics', 'warm materials', 'comfortable textures'],
      scentPatterns: ['fresh air', 'floral scents', 'clean linen', 'natural aromas'],
      temperaturePatterns: ['pleasantly warm', 'cool breeze', 'comfortable', 'mild'],
      colorPalette: ['soft pastels', 'warm earth tones', 'gentle blues', 'natural greens'],
      typicalElements: ['open spaces', 'natural light', 'plants', 'comfortable seating']
    });

    // Mysterious atmosphere template
    this.atmosphereTemplates.set('mysterious', {
      name: 'Mysterious',
      description: 'Creates an atmosphere of intrigue and unknown',
      moodDescriptors: ['enigmatic', 'shadowy', 'veiled', 'cryptic', 'elusive'],
      lightingPatterns: ['shifting shadows', 'moonlight', 'candlelight', 'filtered light'],
      soundPatterns: ['unexplained sounds', 'echoes', 'whispers', 'distant footsteps'],
      texturePatterns: ['ancient surfaces', 'worn materials', 'hidden textures', 'mysterious fabrics'],
      scentPatterns: ['old books', 'incense', 'musty air', 'unknown fragrances'],
      temperaturePatterns: ['cool drafts', 'unexplained warmth', 'shifting temperatures'],
      colorPalette: ['deep purples', 'midnight blues', 'silver', 'dark gold'],
      typicalElements: ['fog', 'hidden passages', 'old artifacts', 'veiled objects']
    });

    // Add more atmosphere templates...
    this.initializeAdditionalTemplates();
  }

  private initializeAdditionalTemplates(): void {
    // Action atmosphere
    this.atmosphereTemplates.set('action', {
      name: 'Action',
      description: 'Creates a dynamic, high-energy atmosphere',
      moodDescriptors: ['dynamic', 'explosive', 'intense', 'kinetic', 'charged'],
      lightingPatterns: ['bright flashes', 'strobing lights', 'harsh illumination', 'dramatic contrasts'],
      soundPatterns: ['loud impacts', 'rushing sounds', 'mechanical noises', 'explosive sounds'],
      texturePatterns: ['hard surfaces', 'metal', 'concrete', 'rough textures'],
      scentPatterns: ['smoke', 'metal', 'ozone', 'burning'],
      temperaturePatterns: ['heat from exertion', 'cold metal', 'temperature extremes'],
      colorPalette: ['bright reds', 'electric blues', 'stark whites', 'deep blacks'],
      typicalElements: ['movement', 'obstacles', 'machinery', 'open spaces for action']
    });

    // Romantic atmosphere
    this.atmosphereTemplates.set('romantic', {
      name: 'Romantic',
      description: 'Creates an intimate, loving atmosphere',
      moodDescriptors: ['intimate', 'warm', 'tender', 'enchanting', 'dreamy'],
      lightingPatterns: ['soft candlelight', 'warm lamplight', 'sunset glow', 'starlight'],
      soundPatterns: ['gentle music', 'soft whispers', 'rustling silk', 'distant laughter'],
      texturePatterns: ['silk', 'velvet', 'soft fabrics', 'smooth surfaces'],
      scentPatterns: ['roses', 'vanilla', 'perfume', 'wine'],
      temperaturePatterns: ['warm and cozy', 'gentle warmth', 'comfortable'],
      colorPalette: ['soft pinks', 'warm golds', 'deep reds', 'cream'],
      typicalElements: ['flowers', 'candles', 'comfortable seating', 'privacy']
    });

    // Dark atmosphere
    this.atmosphereTemplates.set('dark', {
      name: 'Dark',
      description: 'Creates a foreboding, ominous atmosphere',
      moodDescriptors: ['ominous', 'foreboding', 'sinister', 'menacing', 'grim'],
      lightingPatterns: ['deep shadows', 'minimal light', 'harsh contrasts', 'flickering darkness'],
      soundPatterns: ['ominous silence', 'distant thunder', 'creaking', 'whispers'],
      texturePatterns: ['rough stone', 'cold metal', 'decay', 'sharp edges'],
      scentPatterns: ['decay', 'dampness', 'smoke', 'metallic'],
      temperaturePatterns: ['bone-chilling cold', 'unnatural warmth', 'clammy'],
      colorPalette: ['deep blacks', 'blood red', 'sickly green', 'pale gray'],
      typicalElements: ['shadows', 'decay', 'abandoned objects', 'threatening shapes']
    });
  }

  async generateScene(request: SceneGenerationRequest): Promise<SceneGenerationResult> {
    const options = request.options;
    
    // Generate atmosphere profile
    const atmosphereResult = await this.generateAtmosphere(options);
    
    // Generate scene content using AI
    const sceneContent = await this.generateSceneContent(request, atmosphereResult);
    
    // Generate sensory details
    const sensoryDetails = await this.generateSensoryDetails(options, atmosphereResult);
    
    // Create scene structure
    const scene: Scene = {
      id: `scene_${Date.now()}`,
      title: request.title || 'Generated Scene',
      content: sceneContent,
      summary: await this.generateSceneSummary(sceneContent),
      characters: request.characters || [],
      setting: request.setting,
      mood: options.mood,
      sensoryDetails,
      atmosphereProfile: atmosphereResult.atmosphereProfile
    };
    
    // Generate enhancement suggestions
    const suggestions = await this.generateSceneEnhancements(scene, options);
    
    return {
      scene,
      atmosphereResult,
      suggestions,
      metadata: {
        generationTime: new Date(),
        options: options,
        wordCount: sceneContent.split(/\s+/).length,
        readingTime: Math.ceil(sceneContent.split(/\s+/).length / 250)
      }
    };
  }

  async generateAtmosphere(options: SceneGenerationOptions): Promise<AtmosphereGenerationResult> {
    const template = this.atmosphereTemplates.get(options.mood);
    if (!template) {
      throw new Error(`Unknown mood: ${options.mood}`);
    }
    
    // Create atmosphere profile
    const atmosphereProfile: AtmosphereProfile = {
      mood: options.mood,
      intensity: this.calculateMoodIntensity(options),
      dominantSenses: this.determineDominantSenses(options.sensoryFocus),
      environmentalFactors: this.generateEnvironmentalFactors(options),
      colorPalette: template.colorPalette,
      lightingStyle: this.selectLightingStyle(template, options),
      soundscape: this.generateSoundscape(template, options)
    };
    
    // Generate sensory details
    const sensoryDetails = await this.sensoryLibrary.generateDetails(options, template);
    
    // Generate environmental elements
    const environmentalElements = this.generateEnvironmentalElements(template, options);
    
    // Generate suggestions
    const suggestions = this.generateAtmosphereSuggestions(atmosphereProfile, options);
    
    return {
      atmosphereProfile,
      sensoryDetails,
      moodDescriptors: template.moodDescriptors,
      environmentalElements,
      suggestions
    };
  }

  private calculateMoodIntensity(options: SceneGenerationOptions): number {
    let intensity = 5; // Base intensity
    
    // Adjust based on mood
    const intensityModifiers = {
      'tense': 2,
      'action': 3,
      'dark': 2,
      'peaceful': -2,
      'romantic': 1,
      'mysterious': 1,
      'melancholy': 0,
      'hopeful': 1,
      'whimsical': 0
    };
    
    intensity += intensityModifiers[options.mood] || 0;
    
    // Adjust based on weather
    if (options.weather === 'stormy') intensity += 2;
    if (options.weather === 'clear') intensity -= 1;
    
    // Adjust based on time of day
    if (options.timeOfDay === 'night' || options.timeOfDay === 'midnight') intensity += 1;
    if (options.timeOfDay === 'dawn' || options.timeOfDay === 'dusk') intensity += 1;
    
    return Math.max(1, Math.min(10, intensity));
  }

  private determineDominantSenses(sensoryFocus: SceneGenerationOptions['sensoryFocus']): string[] {
    if (sensoryFocus === 'balanced') {
      return ['visual', 'auditory', 'tactile'];
    }
    
    const senseMap = {
      'visual': ['visual', 'tactile'],
      'auditory': ['auditory', 'visual'],
      'tactile': ['tactile', 'visual'],
      'olfactory': ['olfactory', 'visual'],
      'gustatory': ['gustatory', 'olfactory']
    };
    
    return senseMap[sensoryFocus] || ['visual'];
  }

  private generateEnvironmentalFactors(options: SceneGenerationOptions): string[] {
    const factors: string[] = [];
    
    // Add weather factors
    factors.push(`weather: ${options.weather}`);
    
    // Add time factors
    factors.push(`time: ${options.timeOfDay}`);
    
    // Add seasonal factors
    factors.push(`season: ${options.season}`);
    
    // Add setting factors
    factors.push(`setting: ${options.setting}`);
    
    return factors;
  }

  private selectLightingStyle(template: AtmosphereTemplate, options: SceneGenerationOptions): string {
    const timeBasedLighting = {
      'dawn': 'soft golden light filtering through',
      'morning': 'bright natural light',
      'midday': 'harsh overhead lighting',
      'afternoon': 'warm slanted light',
      'dusk': 'fading golden light',
      'evening': 'soft artificial lighting',
      'night': 'dim artificial lighting',
      'midnight': 'minimal lighting with deep shadows'
    };
    
    const baseLighting = timeBasedLighting[options.timeOfDay];
    const moodLighting = template.lightingPatterns[0]; // Primary lighting pattern
    
    return `${baseLighting} with ${moodLighting}`;
  }

  private generateSoundscape(template: AtmosphereTemplate, options: SceneGenerationOptions): string[] {
    const soundscape: string[] = [];
    
    // Add template sounds
    soundscape.push(...template.soundPatterns.slice(0, 2));
    
    // Add weather sounds
    const weatherSounds = {
      'rainy': 'gentle rainfall',
      'stormy': 'thunder and heavy rain',
      'windy': 'wind through trees',
      'snowy': 'muffled silence of snow'
    };
    
    if (weatherSounds[options.weather]) {
      soundscape.push(weatherSounds[options.weather]);
    }
    
    // Add setting sounds
    const settingSounds = {
      'urban': 'distant traffic',
      'rural': 'natural sounds',
      'indoor': 'muffled exterior sounds'
    };
    
    if (settingSounds[options.setting]) {
      soundscape.push(settingSounds[options.setting]);
    }
    
    return soundscape;
  }

  private generateEnvironmentalElements(template: AtmosphereTemplate, options: SceneGenerationOptions): EnvironmentalElement[] {
    const elements: EnvironmentalElement[] = [];
    
    // Lighting element
    elements.push({
      type: 'lighting',
      description: template.lightingPatterns[0],
      intensity: this.calculateMoodIntensity(options),
      moodContribution: 'Sets the visual tone and mood'
    });
    
    // Sound element
    elements.push({
      type: 'sound',
      description: template.soundPatterns[0],
      intensity: Math.min(8, this.calculateMoodIntensity(options)),
      moodContribution: 'Creates auditory atmosphere'
    });
    
    // Temperature element
    if (template.temperaturePatterns.length > 0) {
      elements.push({
        type: 'temperature',
        description: template.temperaturePatterns[0],
        intensity: 6,
        moodContribution: 'Affects physical comfort and mood'
      });
    }
    
    // Scent element
    if (template.scentPatterns.length > 0) {
      elements.push({
        type: 'scent',
        description: template.scentPatterns[0],
        intensity: 4,
        moodContribution: 'Adds subtle atmospheric depth'
      });
    }
    
    return elements;
  }

  private generateAtmosphereSuggestions(profile: AtmosphereProfile, options: SceneGenerationOptions): AtmosphereSuggestion[] {
    const suggestions: AtmosphereSuggestion[] = [];
    
    // Suggest sensory enhancements
    if (options.sensoryFocus === 'visual') {
      suggestions.push({
        type: 'sensory',
        description: 'Consider adding non-visual sensory details',
        implementation: 'Include sounds, scents, or tactile sensations to create a more immersive experience',
        impact: 'Increases reader immersion and engagement'
      });
    }
    
    // Suggest mood contrasts
    if (profile.intensity > 7) {
      suggestions.push({
        type: 'contrast',
        description: 'Add moments of relief to balance high intensity',
        implementation: 'Include brief peaceful or calm elements within the intense atmosphere',
        impact: 'Prevents reader fatigue and makes intense moments more impactful'
      });
    }
    
    // Suggest atmospheric layering
    suggestions.push({
      type: 'enhancement',
      description: 'Layer multiple atmospheric elements',
      implementation: 'Combine lighting, sound, and environmental details to create depth',
      impact: 'Creates a more sophisticated and believable atmosphere'
    });
    
    return suggestions;
  }

  async generateSceneContent(request: SceneGenerationRequest, atmosphereResult: AtmosphereGenerationResult): Promise<string> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = this.buildScenePrompt(request, atmosphereResult);
    
    const response = await provider.generateText({
      prompt,
      maxTokens: 1000,
      temperature: 0.8,
      systemPrompt: 'You are a creative writing assistant specializing in immersive scene generation. Create vivid, atmospheric scenes that engage multiple senses and serve the story\'s needs.'
    });
    
    return response.text;
  }

  private buildScenePrompt(request: SceneGenerationRequest, atmosphereResult: AtmosphereGenerationResult): string {
    const { options } = request;
    const { atmosphereProfile, sensoryDetails, moodDescriptors } = atmosphereResult;
    
    let prompt = `Generate a ${options.detailLevel} scene with the following specifications:\n\n`;
    
    // Basic scene parameters
    prompt += `Setting: ${options.setting} environment\n`;
    prompt += `Time: ${options.timeOfDay} during ${options.season}\n`;
    prompt += `Weather: ${options.weather}\n`;
    prompt += `Mood: ${options.mood} (${moodDescriptors.join(', ')})\n`;
    prompt += `Genre: ${options.genre}\n\n`;
    
    // Characters
    if (request.characters && request.characters.length > 0) {
      prompt += `Characters present: ${request.characters.join(', ')}\n`;
    }
    
    // Scene purpose
    if (request.purpose) {
      prompt += `Scene purpose: ${request.purpose}\n`;
    }
    
    // Atmosphere guidance
    prompt += `\nAtmosphere guidance:\n`;
    prompt += `- Lighting: ${atmosphereProfile.lightingStyle}\n`;
    prompt += `- Sounds: ${atmosphereProfile.soundscape.join(', ')}\n`;
    prompt += `- Dominant senses: ${atmosphereProfile.dominantSenses.join(', ')}\n`;
    
    // Sensory details
    prompt += `\nSensory details to incorporate:\n`;
    if (sensoryDetails.visual) prompt += `- Visual: ${sensoryDetails.visual.join(', ')}\n`;
    if (sensoryDetails.auditory) prompt += `- Auditory: ${sensoryDetails.auditory.join(', ')}\n`;
    if (sensoryDetails.tactile) prompt += `- Tactile: ${sensoryDetails.tactile.join(', ')}\n`;
    if (sensoryDetails.olfactory) prompt += `- Olfactory: ${sensoryDetails.olfactory.join(', ')}\n`;
    
    // Instructions
    prompt += `\nInstructions:\n`;
    prompt += `- Create a scene that establishes the ${options.mood} mood effectively\n`;
    prompt += `- Use ${options.sensoryFocus === 'balanced' ? 'multiple senses' : options.sensoryFocus + ' details primarily'}\n`;
    prompt += `- Match the ${options.genre} genre conventions\n`;
    prompt += `- Write in a ${options.detailLevel} style\n`;
    prompt += `- Focus on atmosphere and immersion\n`;
    
    return prompt;
  }

  async generateSensoryDetails(options: SceneGenerationOptions, atmosphereResult: AtmosphereGenerationResult): Promise<SensoryDetails> {
    return await this.sensoryLibrary.generateDetails(options, this.atmosphereTemplates.get(options.mood)!);
  }

  async generateSceneSummary(content: string): Promise<string> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const response = await provider.generateText({
      prompt: `Summarize this scene in 1-2 sentences, focusing on the key events and atmosphere:\n\n${content}`,
      maxTokens: 100,
      temperature: 0.3
    });
    
    return response.text;
  }

  async generateSceneEnhancements(scene: Scene, options: SceneGenerationOptions): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Analyze current scene content
    const wordCount = scene.content.split(/\s+/).length;
    const sensoryBalance = this.analyzeSensoryBalance(scene.content);
    
    // Length suggestions
    if (wordCount < 200 && options.detailLevel !== 'minimal') {
      suggestions.push('Consider expanding the scene with more descriptive details');
    } else if (wordCount > 800 && options.detailLevel !== 'immersive') {
      suggestions.push('Consider condensing the scene to maintain pacing');
    }
    
    // Sensory balance suggestions
    if (sensoryBalance.visual > 0.7) {
      suggestions.push('Add non-visual sensory details (sounds, scents, textures) for better immersion');
    }
    
    if (sensoryBalance.dialogue > 0.6) {
      suggestions.push('Balance dialogue with more atmospheric description');
    }
    
    // Mood consistency suggestions
    const moodKeywords = this.getMoodKeywords(options.mood);
    const moodPresence = this.analyzeMoodPresence(scene.content, moodKeywords);
    
    if (moodPresence < 0.3) {
      suggestions.push(`Strengthen the ${options.mood} mood with more appropriate descriptive language`);
    }
    
    return suggestions;
  }

  private analyzeSensoryBalance(content: string): { visual: number; auditory: number; tactile: number; dialogue: number } {
    const words = content.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    
    const visualWords = ['see', 'look', 'watch', 'bright', 'dark', 'color', 'light', 'shadow', 'gleam', 'glitter'];
    const auditoryWords = ['hear', 'sound', 'noise', 'whisper', 'shout', 'music', 'silence', 'echo', 'ring', 'buzz'];
    const tactileWords = ['feel', 'touch', 'rough', 'smooth', 'cold', 'warm', 'soft', 'hard', 'texture', 'pressure'];
    
    const visualCount = words.filter(word => visualWords.some(vw => word.includes(vw))).length;
    const auditoryCount = words.filter(word => auditoryWords.some(aw => word.includes(aw))).length;
    const tactileCount = words.filter(word => tactileWords.some(tw => word.includes(tw))).length;
    
    // Count dialogue (rough estimate)
    const dialogueMatches = content.match(/["']([^"']*?)["']/g);
    const dialogueWords = dialogueMatches ? dialogueMatches.join(' ').split(/\s+/).length : 0;
    
    return {
      visual: visualCount / totalWords,
      auditory: auditoryCount / totalWords,
      tactile: tactileCount / totalWords,
      dialogue: dialogueWords / totalWords
    };
  }

  private getMoodKeywords(mood: SceneGenerationOptions['mood']): string[] {
    const moodKeywords = {
      'tense': ['tension', 'anxiety', 'pressure', 'tight', 'strained', 'nervous', 'edge'],
      'peaceful': ['calm', 'serene', 'tranquil', 'gentle', 'soft', 'quiet', 'still'],
      'mysterious': ['mystery', 'shadow', 'hidden', 'secret', 'unknown', 'enigma', 'veil'],
      'romantic': ['love', 'tender', 'intimate', 'warm', 'gentle', 'soft', 'sweet'],
      'action': ['fast', 'quick', 'sudden', 'explosive', 'dynamic', 'intense', 'rapid'],
      'melancholy': ['sad', 'melancholy', 'wistful', 'somber', 'mournful', 'heavy', 'gray'],
      'hopeful': ['hope', 'bright', 'optimistic', 'promising', 'uplifting', 'light', 'dawn'],
      'dark': ['dark', 'ominous', 'sinister', 'grim', 'foreboding', 'menacing', 'shadow'],
      'whimsical': ['playful', 'whimsical', 'quirky', 'charming', 'delightful', 'magical', 'wonder']
    };
    
    return moodKeywords[mood] || [];
  }

  private analyzeMoodPresence(content: string, moodKeywords: string[]): number {
    const words = content.toLowerCase().split(/\s+/);
    const moodWordCount = words.filter(word => 
      moodKeywords.some(keyword => word.includes(keyword))
    ).length;
    
    return moodWordCount / words.length;
  }

  // Action choreography methods
  async generateActionChoreography(request: ActionChoreographyRequest): Promise<ActionChoreographyResult> {
    const sequence = await this.generateActionSequence(request);
    const timing = this.calculateActionTiming(sequence, request);
    const spatialLayout = await this.generateSpatialLayout(request);
    const suggestions = this.generateActionSuggestions(sequence, request);
    
    return {
      sequence,
      timing,
      spatialLayout,
      suggestions
    };
  }

  private async generateActionSequence(request: ActionChoreographyRequest): Promise<ActionSequence[]> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = `Generate a detailed action sequence for a ${request.actionType} scene with the following parameters:
    
Participants: ${request.participants.join(', ')}
Setting: ${request.setting}
Intensity: ${request.intensity}
Duration: ${request.duration}
Complexity: ${request.complexity}

Break down the action into 5-8 sequential steps, each with:
- Clear description of what happens
- Which participants are involved
- Approximate duration
- Intensity level (1-10)
- Immediate consequences

Format as a numbered list with clear, actionable descriptions.`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.7,
      systemPrompt: 'You are an expert in action choreography and scene direction. Create realistic, engaging action sequences that are easy to visualize and write.'
    });
    
    // Parse the response into ActionSequence objects
    return this.parseActionSequence(response.text, request.participants);
  }

  private parseActionSequence(text: string, participants: string[]): ActionSequence[] {
    const lines = text.split('\n').filter(line => line.trim());
    const sequences: ActionSequence[] = [];
    
    let currentStep = 0;
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        currentStep++;
        const description = line.replace(/^\d+\.\s*/, '');
        
        sequences.push({
          step: currentStep,
          description,
          participants: this.extractParticipants(description, participants),
          duration: this.estimateDuration(description),
          intensity: this.estimateIntensity(description),
          consequences: this.extractConsequences(description)
        });
      }
    }
    
    return sequences;
  }

  private extractParticipants(description: string, allParticipants: string[]): string[] {
    const mentioned: string[] = [];
    const lowerDescription = description.toLowerCase();
    
    for (const participant of allParticipants) {
      if (lowerDescription.includes(participant.toLowerCase())) {
        mentioned.push(participant);
      }
    }
    
    return mentioned.length > 0 ? mentioned : allParticipants;
  }

  private estimateDuration(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('instant') || lowerDesc.includes('sudden') || lowerDesc.includes('quick')) {
      return '1-2 seconds';
    } else if (lowerDesc.includes('brief') || lowerDesc.includes('short')) {
      return '3-5 seconds';
    } else if (lowerDesc.includes('extended') || lowerDesc.includes('long')) {
      return '10-15 seconds';
    } else {
      return '5-8 seconds';
    }
  }

  private estimateIntensity(description: string): number {
    const lowerDesc = description.toLowerCase();
    let intensity = 5; // Base intensity
    
    const highIntensityWords = ['explosive', 'violent', 'intense', 'powerful', 'devastating'];
    const lowIntensityWords = ['gentle', 'slow', 'careful', 'subtle', 'quiet'];
    
    for (const word of highIntensityWords) {
      if (lowerDesc.includes(word)) intensity += 2;
    }
    
    for (const word of lowIntensityWords) {
      if (lowerDesc.includes(word)) intensity -= 2;
    }
    
    return Math.max(1, Math.min(10, intensity));
  }

  private extractConsequences(description: string): string[] {
    const consequences: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('fall') || lowerDesc.includes('knock')) {
      consequences.push('Character position changed');
    }
    if (lowerDesc.includes('damage') || lowerDesc.includes('hurt') || lowerDesc.includes('wound')) {
      consequences.push('Physical damage inflicted');
    }
    if (lowerDesc.includes('advantage') || lowerDesc.includes('upper hand')) {
      consequences.push('Tactical advantage gained');
    }
    if (lowerDesc.includes('escape') || lowerDesc.includes('flee')) {
      consequences.push('Position or situation changed');
    }
    
    return consequences;
  }

  private calculateActionTiming(sequence: ActionSequence[], request: ActionChoreographyRequest): ActionTiming {
    const totalSeconds = sequence.reduce((sum, step) => {
      const duration = step.duration;
      const seconds = this.parseDurationToSeconds(duration);
      return sum + seconds;
    }, 0);
    
    const totalDuration = this.formatDuration(totalSeconds);
    const pacing = this.determinePacing(sequence);
    const beats = this.generateActionBeats(sequence);
    
    return {
      totalDuration,
      pacing,
      beats
    };
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/(\d+)-?(\d+)?\s*seconds?/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return (min + max) / 2;
    }
    return 5; // Default
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  private determinePacing(sequence: ActionSequence[]): ActionTiming['pacing'] {
    const intensities = sequence.map(s => s.intensity);
    const avgIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    const variance = intensities.reduce((sum, i) => sum + Math.pow(i - avgIntensity, 2), 0) / intensities.length;
    
    if (variance > 4) return 'variable';
    if (avgIntensity > 7) return 'fast';
    if (avgIntensity < 4) return 'slow';
    return 'moderate';
  }

  private generateActionBeats(sequence: ActionSequence[]): ActionBeat[] {
    const beats: ActionBeat[] = [];
    let currentTime = 0;
    
    for (const step of sequence) {
      const stepDuration = this.parseDurationToSeconds(step.duration);
      const emphasis = step.intensity > 7 ? 'high' : step.intensity > 4 ? 'medium' : 'low';
      
      beats.push({
        timestamp: this.formatDuration(currentTime),
        event: step.description,
        emphasis
      });
      
      currentTime += stepDuration;
    }
    
    return beats;
  }

  private async generateSpatialLayout(request: ActionChoreographyRequest): Promise<SpatialDescription> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = `Describe the spatial layout for a ${request.actionType} scene in ${request.setting}:

Participants: ${request.participants.join(', ')}
Action Type: ${request.actionType}
Setting: ${request.setting}

Provide:
1. Overall layout description
2. Key positions for each participant
3. Movement paths during the action
4. Any obstacles or environmental features

Keep descriptions clear and practical for writing action scenes.`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 400,
      temperature: 0.6
    });
    
    return this.parseSpatialDescription(response.text, request.participants);
  }

  private parseSpatialDescription(text: string, participants: string[]): SpatialDescription {
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      layout: lines[0] || 'Open space suitable for action',
      keyPositions: participants.map(participant => ({
        name: participant,
        description: `Starting position for ${participant}`
      })),
      movementPaths: participants.map(participant => ({
        participant,
        path: `Movement path for ${participant} during action`
      })),
      obstacles: ['Environmental obstacles and features']
    };
  }

  private generateActionSuggestions(sequence: ActionSequence[], request: ActionChoreographyRequest): ActionSuggestion[] {
    const suggestions: ActionSuggestion[] = [];
    
    // Pacing suggestions
    const avgIntensity = sequence.reduce((sum, s) => sum + s.intensity, 0) / sequence.length;
    if (avgIntensity > 8) {
      suggestions.push({
        type: 'pacing',
        description: 'Consider adding brief moments of lower intensity',
        implementation: 'Include pauses, reactions, or setup moments between high-intensity actions'
      });
    }
    
    // Detail suggestions
    if (sequence.length < 4) {
      suggestions.push({
        type: 'detail',
        description: 'Add more detailed breakdown of the action',
        implementation: 'Break complex movements into smaller, more specific steps'
      });
    }
    
    // Consequence suggestions
    const consequenceCount = sequence.reduce((sum, s) => sum + s.consequences.length, 0);
    if (consequenceCount < sequence.length) {
      suggestions.push({
        type: 'consequence',
        description: 'Add more consequences and reactions to actions',
        implementation: 'Show how each action affects the participants and situation'
      });
    }
    
    return suggestions;
  }

  // Public API methods
  async enhanceExistingScene(scene: Scene, enhancementType: 'atmosphere' | 'sensory' | 'action'): Promise<string[]> {
    const suggestions: string[] = [];
    
    switch (enhancementType) {
      case 'atmosphere':
        suggestions.push(...await this.generateAtmosphereEnhancements(scene));
        break;
      case 'sensory':
        suggestions.push(...await this.generateSensoryEnhancements(scene));
        break;
      case 'action':
        suggestions.push(...await this.generateActionEnhancements(scene));
        break;
    }
    
    return suggestions;
  }

  private async generateAtmosphereEnhancements(scene: Scene): Promise<string[]> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = `Analyze this scene and suggest atmospheric enhancements:

${scene.content}

Current mood: ${scene.mood}
Setting: ${scene.setting}

Suggest 3-5 specific ways to enhance the atmosphere, focusing on:
- Environmental details
- Lighting and shadows
- Ambient sounds
- Temperature and weather
- Emotional undertones`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 300,
      temperature: 0.7
    });
    
    return response.text.split('\n').filter(line => line.trim()).slice(0, 5);
  }

  private async generateSensoryEnhancements(scene: Scene): Promise<string[]> {
    const sensoryBalance = this.analyzeSensoryBalance(scene.content);
    const suggestions: string[] = [];
    
    if (sensoryBalance.auditory < 0.1) {
      suggestions.push('Add auditory details: sounds, music, voices, or ambient noise');
    }
    
    if (sensoryBalance.tactile < 0.1) {
      suggestions.push('Include tactile sensations: textures, temperature, physical contact');
    }
    
    if (sensoryBalance.visual > 0.6) {
      suggestions.push('Balance visual descriptions with other senses');
    }
    
    suggestions.push('Consider adding scents or smells to ground the scene');
    suggestions.push('Include taste elements if characters are eating or drinking');
    
    return suggestions;
  }

  private async generateActionEnhancements(scene: Scene): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Analyze current action level
    const actionWords = ['run', 'jump', 'fight', 'move', 'rush', 'grab', 'push', 'pull'];
    const content = scene.content.toLowerCase();
    const actionCount = actionWords.filter(word => content.includes(word)).length;
    
    if (actionCount < 3) {
      suggestions.push('Add more dynamic movement and physical actions');
      suggestions.push('Include character gestures and body language');
      suggestions.push('Show rather than tell character reactions');
    }
    
    suggestions.push('Vary sentence length to control pacing');
    suggestions.push('Use active voice for more immediate action');
    
    return suggestions;
  }
}

// Helper classes
interface AtmosphereTemplate {
  name: string;
  description: string;
  moodDescriptors: string[];
  lightingPatterns: string[];
  soundPatterns: string[];
  texturePatterns: string[];
  scentPatterns: string[];
  temperaturePatterns: string[];
  colorPalette: string[];
  typicalElements: string[];
}

class SensoryLibrary {
  private sensoryDatabase: Map<string, SensoryCategory> = new Map();

  constructor() {
    this.initializeSensoryDatabase();
  }

  private initializeSensoryDatabase(): void {
    // Visual sensory details
    this.sensoryDatabase.set('visual', {
      lighting: ['golden sunlight', 'harsh fluorescent glare', 'flickering candlelight', 'moonbeams', 'neon glow'],
      colors: ['deep crimson', 'pale silver', 'vibrant emerald', 'muted gray', 'warm amber'],
      textures: ['rough stone', 'smooth silk', 'weathered wood', 'polished metal', 'soft velvet'],
      movement: ['dancing shadows', 'swaying branches', 'rippling water', 'drifting smoke', 'fluttering fabric']
    });

    // Auditory sensory details
    this.sensoryDatabase.set('auditory', {
      natural: ['rustling leaves', 'flowing water', 'chirping birds', 'howling wind', 'crackling fire'],
      mechanical: ['humming machinery', 'ticking clock', 'creaking floorboards', 'slamming door', 'ringing phone'],
      human: ['whispered conversation', 'distant laughter', 'heavy breathing', 'footsteps', 'heartbeat'],
      ambient: ['city traffic', 'ocean waves', 'thunderstorm', 'silence', 'echoing sounds']
    });

    // Tactile sensory details
    this.sensoryDatabase.set('tactile', {
      temperature: ['icy cold', 'blazing heat', 'cool breeze', 'warm embrace', 'clammy skin'],
      texture: ['rough bark', 'smooth glass', 'soft fur', 'sharp edges', 'sticky surface'],
      pressure: ['gentle touch', 'firm grip', 'crushing weight', 'light caress', 'tight squeeze'],
      movement: ['flowing air', 'vibrating surface', 'swaying motion', 'steady pulse', 'trembling']
    });

    // Olfactory sensory details
    this.sensoryDatabase.set('olfactory', {
      natural: ['pine forest', 'ocean breeze', 'fresh rain', 'blooming flowers', 'earthy soil'],
      food: ['baking bread', 'roasted coffee', 'spiced wine', 'fresh herbs', 'sweet vanilla'],
      artificial: ['cleaning products', 'gasoline', 'perfume', 'paint', 'leather'],
      unpleasant: ['stale air', 'rotting garbage', 'smoke', 'mildew', 'chemical fumes']
    });

    // Gustatory sensory details
    this.sensoryDatabase.set('gustatory', {
      sweet: ['honey', 'ripe fruit', 'chocolate', 'sugar', 'caramel'],
      salty: ['sea spray', 'tears', 'pretzels', 'cheese', 'olives'],
      bitter: ['dark coffee', 'medicine', 'burnt toast', 'herbs', 'alcohol'],
      sour: ['lemon', 'vinegar', 'unripe fruit', 'fermented food', 'wine'],
      umami: ['mushrooms', 'aged cheese', 'soy sauce', 'meat', 'tomatoes']
    });
  }

  async generateDetails(options: SceneGenerationOptions, template: AtmosphereTemplate): Promise<SensoryDetails> {
    const details: SensoryDetails = {};

    // Generate visual details
    if (options.sensoryFocus === 'visual' || options.sensoryFocus === 'balanced') {
      details.visual = this.selectSensoryElements('visual', template, 3);
    }

    // Generate auditory details
    if (options.sensoryFocus === 'auditory' || options.sensoryFocus === 'balanced') {
      details.auditory = this.selectSensoryElements('auditory', template, 2);
    }

    // Generate tactile details
    if (options.sensoryFocus === 'tactile' || options.sensoryFocus === 'balanced') {
      details.tactile = this.selectSensoryElements('tactile', template, 2);
    }

    // Generate olfactory details
    if (options.sensoryFocus === 'olfactory' || options.sensoryFocus === 'balanced') {
      details.olfactory = this.selectSensoryElements('olfactory', template, 1);
    }

    // Generate gustatory details (less common)
    if (options.sensoryFocus === 'gustatory') {
      details.gustatory = this.selectSensoryElements('gustatory', template, 1);
    }

    return details;
  }

  private selectSensoryElements(senseType: string, template: AtmosphereTemplate, count: number): string[] {
    const category = this.sensoryDatabase.get(senseType);
    if (!category) return [];

    const elements: string[] = [];
    const allElements = Object.values(category).flat();

    // Filter elements that match the mood
    const moodKeywords = template.moodDescriptors;
    const relevantElements = allElements.filter(element => 
      this.isElementRelevantToMood(element, moodKeywords)
    );

    // Select random elements
    const sourceElements = relevantElements.length > 0 ? relevantElements : allElements;
    for (let i = 0; i < count && i < sourceElements.length; i++) {
      const randomIndex = Math.floor(Math.random() * sourceElements.length);
      const element = sourceElements[randomIndex];
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }

    return elements;
  }

  private isElementRelevantToMood(element: string, moodKeywords: string[]): boolean {
    const elementWords = element.toLowerCase().split(/\s+/);
    return moodKeywords.some(keyword => 
      elementWords.some(word => word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word))
    );
  }
}

interface SensoryCategory {
  [subcategory: string]: string[];
}