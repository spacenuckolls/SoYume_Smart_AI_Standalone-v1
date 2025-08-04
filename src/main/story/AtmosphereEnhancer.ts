import { Scene, AtmosphereProfile, SensoryDetails, AtmosphereEnhancement } from '../../shared/types/Story';
import { AIProviderRegistry } from '../ai/providers/AIProviderRegistry';

export interface AtmosphereAnalysisResult {
  currentAtmosphere: AtmosphereProfile;
  strengths: string[];
  weaknesses: string[];
  suggestions: AtmosphereEnhancement[];
  moodConsistency: number; // 0-100
  sensoryBalance: SensoryBalance;
  immersionScore: number; // 0-100
}

export interface SensoryBalance {
  visual: number;
  auditory: number;
  tactile: number;
  olfactory: number;
  gustatory: number;
  overall: number;
}

export interface MoodTransition {
  fromMood: string;
  toMood: string;
  transitionType: 'gradual' | 'sudden' | 'contrasting' | 'layered';
  techniques: string[];
  examples: string[];
}

export interface GenreAtmosphereGuide {
  genre: string;
  commonMoods: string[];
  typicalSettings: string[];
  atmosphericElements: string[];
  avoidElements: string[];
  examples: string[];
}

export class AtmosphereEnhancer {
  private aiRegistry: AIProviderRegistry;
  private genreGuides: Map<string, GenreAtmosphereGuide> = new Map();
  private moodTransitions: Map<string, MoodTransition[]> = new Map();

  constructor(aiRegistry: AIProviderRegistry) {
    this.aiRegistry = aiRegistry;
    this.initializeGenreGuides();
    this.initializeMoodTransitions();
  }

  private initializeGenreGuides(): void {
    // Fantasy genre guide
    this.genreGuides.set('fantasy', {
      genre: 'Fantasy',
      commonMoods: ['mysterious', 'epic', 'magical', 'dark', 'adventurous'],
      typicalSettings: ['ancient forests', 'mystical towers', 'enchanted realms', 'medieval cities'],
      atmosphericElements: [
        'magical energy in the air',
        'ancient stone architecture',
        'mystical lighting effects',
        'otherworldly sounds',
        'enchanted scents',
        'supernatural temperature changes'
      ],
      avoidElements: ['modern technology', 'contemporary references', 'mundane descriptions'],
      examples: [
        'The air shimmered with residual magic',
        'Ancient runes glowed with ethereal light',
        'The scent of otherworldly flowers filled the grove'
      ]
    });

    // Science Fiction genre guide
    this.genreGuides.set('sci-fi', {
      genre: 'Science Fiction',
      commonMoods: ['futuristic', 'sterile', 'technological', 'alien', 'dystopian'],
      typicalSettings: ['space stations', 'alien worlds', 'cyberpunk cities', 'research facilities'],
      atmosphericElements: [
        'artificial lighting systems',
        'technological hums and beeps',
        'recycled air systems',
        'synthetic materials',
        'holographic displays',
        'alien environmental factors'
      ],
      avoidElements: ['primitive technology', 'natural wilderness', 'medieval elements'],
      examples: [
        'The corridor hummed with the sound of life support systems',
        'Holographic displays cast blue light across metallic surfaces',
        'The artificial atmosphere carried a faint ozone scent'
      ]
    });

    // Horror genre guide
    this.genreGuides.set('horror', {
      genre: 'Horror',
      commonMoods: ['terrifying', 'ominous', 'unsettling', 'claustrophobic', 'dreadful'],
      typicalSettings: ['abandoned buildings', 'dark forests', 'isolated locations', 'decrepit structures'],
      atmosphericElements: [
        'oppressive darkness',
        'unnatural sounds',
        'decay and deterioration',
        'uncomfortable temperatures',
        'unsettling scents',
        'threatening shadows'
      ],
      avoidElements: ['bright cheerful lighting', 'comfortable settings', 'reassuring elements'],
      examples: [
        'Shadows seemed to writhe in the flickering candlelight',
        'The floorboards groaned ominously underfoot',
        'A musty smell of decay permeated the air'
      ]
    });

    // Romance genre guide
    this.genreGuides.set('romance', {
      genre: 'Romance',
      commonMoods: ['intimate', 'passionate', 'tender', 'dreamy', 'sensual'],
      typicalSettings: ['cozy interiors', 'beautiful landscapes', 'romantic venues', 'private spaces'],
      atmosphericElements: [
        'soft warm lighting',
        'gentle sounds',
        'luxurious textures',
        'pleasant scents',
        'comfortable temperatures',
        'intimate spaces'
      ],
      avoidElements: ['harsh lighting', 'unpleasant odors', 'uncomfortable settings'],
      examples: [
        'Candlelight cast a warm glow across the intimate space',
        'The scent of roses filled the evening air',
        'Soft music drifted from the nearby café'
      ]
    });

    // Thriller genre guide
    this.genreGuides.set('thriller', {
      genre: 'Thriller',
      commonMoods: ['suspenseful', 'tense', 'urgent', 'paranoid', 'high-stakes'],
      typicalSettings: ['urban environments', 'confined spaces', 'public places', 'escape routes'],
      atmosphericElements: [
        'harsh contrasting lighting',
        'sudden sounds',
        'time pressure indicators',
        'surveillance elements',
        'escape route awareness',
        'threat indicators'
      ],
      avoidElements: ['relaxing elements', 'slow pacing', 'comfortable settings'],
      examples: [
        'The fluorescent lights buzzed overhead like angry insects',
        'Every shadow could hide a potential threat',
        'The ticking of the clock seemed unnaturally loud'
      ]
    });
  }

  private initializeMoodTransitions(): void {
    // Peaceful to Tense transitions
    this.moodTransitions.set('peaceful-tense', [
      {
        fromMood: 'peaceful',
        toMood: 'tense',
        transitionType: 'gradual',
        techniques: [
          'Introduce subtle discordant elements',
          'Gradually shift lighting from warm to harsh',
          'Add increasingly uncomfortable sounds',
          'Change temperature or air quality'
        ],
        examples: [
          'The gentle breeze began to feel uncomfortably cold',
          'A distant sound broke the peaceful silence',
          'The warm light seemed to flicker and dim'
        ]
      },
      {
        fromMood: 'peaceful',
        toMood: 'tense',
        transitionType: 'sudden',
        techniques: [
          'Introduce shocking sensory change',
          'Break the peace with jarring sound',
          'Sudden lighting change',
          'Unexpected physical sensation'
        ],
        examples: [
          'The tranquil scene shattered with a piercing scream',
          'Suddenly, all the lights went out',
          'A cold hand grabbed her shoulder'
        ]
      }
    ]);

    // Tense to Peaceful transitions
    this.moodTransitions.set('tense-peaceful', [
      {
        fromMood: 'tense',
        toMood: 'peaceful',
        transitionType: 'gradual',
        techniques: [
          'Slowly remove threatening elements',
          'Introduce comforting sensory details',
          'Warm the lighting gradually',
          'Add soothing sounds'
        ],
        examples: [
          'The harsh shadows began to soften',
          'A gentle melody drifted through the air',
          'The oppressive atmosphere slowly lifted'
        ]
      }
    ]);

    // Dark to Hopeful transitions
    this.moodTransitions.set('dark-hopeful', [
      {
        fromMood: 'dark',
        toMood: 'hopeful',
        transitionType: 'contrasting',
        techniques: [
          'Introduce light breaking through darkness',
          'Add uplifting sounds to ominous silence',
          'Warm colors breaking through cold palette',
          'Fresh air replacing stale atmosphere'
        ],
        examples: [
          'A single ray of sunlight pierced the gloom',
          'The sound of children laughing echoed in the distance',
          'Fresh morning air swept away the stale darkness'
        ]
      }
    ]);
  }

  async analyzeAtmosphere(scene: Scene): Promise<AtmosphereAnalysisResult> {
    const content = scene.content || '';
    
    // Analyze current atmosphere
    const currentAtmosphere = await this.extractCurrentAtmosphere(scene);
    
    // Calculate mood consistency
    const moodConsistency = this.calculateMoodConsistency(content, scene.mood || 'neutral');
    
    // Analyze sensory balance
    const sensoryBalance = this.analyzeSensoryBalance(content);
    
    // Calculate immersion score
    const immersionScore = this.calculateImmersionScore(content, sensoryBalance);
    
    // Identify strengths and weaknesses
    const strengths = this.identifyAtmosphericStrengths(content, sensoryBalance, moodConsistency);
    const weaknesses = this.identifyAtmosphericWeaknesses(content, sensoryBalance, moodConsistency);
    
    // Generate enhancement suggestions
    const suggestions = await this.generateEnhancementSuggestions(scene, weaknesses, sensoryBalance);
    
    return {
      currentAtmosphere,
      strengths,
      weaknesses,
      suggestions,
      moodConsistency,
      sensoryBalance,
      immersionScore
    };
  }

  private async extractCurrentAtmosphere(scene: Scene): Promise<AtmosphereProfile> {
    const content = scene.content || '';
    
    // Extract lighting information
    const lightingKeywords = ['light', 'bright', 'dark', 'shadow', 'glow', 'dim', 'illuminate'];
    const lightingMatches = this.extractKeywordContext(content, lightingKeywords);
    
    // Extract sound information
    const soundKeywords = ['sound', 'noise', 'quiet', 'silent', 'echo', 'whisper', 'loud'];
    const soundMatches = this.extractKeywordContext(content, soundKeywords);
    
    // Extract color information
    const colorKeywords = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'golden'];
    const colorMatches = this.extractKeywordContext(content, colorKeywords);
    
    return {
      mood: scene.mood || 'neutral',
      intensity: this.calculateAtmosphereIntensity(content),
      dominantSenses: this.identifyDominantSenses(content),
      environmentalFactors: this.extractEnvironmentalFactors(content),
      colorPalette: colorMatches,
      lightingStyle: lightingMatches.join(', ') || 'unspecified',
      soundscape: soundMatches
    };
  }

  private extractKeywordContext(content: string, keywords: string[]): string[] {
    const matches: string[] = [];
    const sentences = content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const keyword of keywords) {
        if (lowerSentence.includes(keyword)) {
          // Extract the phrase containing the keyword
          const words = sentence.trim().split(/\s+/);
          const keywordIndex = words.findIndex(word => 
            word.toLowerCase().includes(keyword)
          );
          
          if (keywordIndex !== -1) {
            const start = Math.max(0, keywordIndex - 2);
            const end = Math.min(words.length, keywordIndex + 3);
            const phrase = words.slice(start, end).join(' ');
            matches.push(phrase);
          }
          break; // Only match one keyword per sentence
        }
      }
    }
    
    return matches.slice(0, 5); // Limit to 5 matches
  }

  private calculateAtmosphereIntensity(content: string): number {
    const intensityKeywords = {
      high: ['intense', 'overwhelming', 'powerful', 'dramatic', 'extreme', 'violent'],
      medium: ['noticeable', 'clear', 'distinct', 'evident', 'apparent'],
      low: ['subtle', 'gentle', 'mild', 'faint', 'slight']
    };
    
    let score = 5; // Base intensity
    const lowerContent = content.toLowerCase();
    
    for (const keyword of intensityKeywords.high) {
      if (lowerContent.includes(keyword)) score += 2;
    }
    
    for (const keyword of intensityKeywords.medium) {
      if (lowerContent.includes(keyword)) score += 1;
    }
    
    for (const keyword of intensityKeywords.low) {
      if (lowerContent.includes(keyword)) score -= 1;
    }
    
    return Math.max(1, Math.min(10, score));
  }

  private identifyDominantSenses(content: string): string[] {
    const senseKeywords = {
      visual: ['see', 'look', 'watch', 'bright', 'dark', 'color', 'light', 'shadow'],
      auditory: ['hear', 'sound', 'noise', 'whisper', 'shout', 'music', 'silence'],
      tactile: ['feel', 'touch', 'rough', 'smooth', 'cold', 'warm', 'soft', 'hard'],
      olfactory: ['smell', 'scent', 'aroma', 'fragrance', 'odor', 'perfume'],
      gustatory: ['taste', 'flavor', 'sweet', 'bitter', 'sour', 'salty']
    };
    
    const senseScores: { [key: string]: number } = {};
    const lowerContent = content.toLowerCase();
    
    for (const [sense, keywords] of Object.entries(senseKeywords)) {
      senseScores[sense] = keywords.filter(keyword => 
        lowerContent.includes(keyword)
      ).length;
    }
    
    // Return senses sorted by frequency
    return Object.entries(senseScores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0)
      .map(([sense]) => sense)
      .slice(0, 3);
  }

  private extractEnvironmentalFactors(content: string): string[] {
    const factors: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Weather factors
    const weatherKeywords = ['rain', 'snow', 'wind', 'storm', 'sun', 'cloud', 'fog'];
    for (const keyword of weatherKeywords) {
      if (lowerContent.includes(keyword)) {
        factors.push(`weather: ${keyword}`);
      }
    }
    
    // Time factors
    const timeKeywords = ['morning', 'afternoon', 'evening', 'night', 'dawn', 'dusk'];
    for (const keyword of timeKeywords) {
      if (lowerContent.includes(keyword)) {
        factors.push(`time: ${keyword}`);
      }
    }
    
    // Location factors
    const locationKeywords = ['indoor', 'outdoor', 'forest', 'city', 'room', 'building'];
    for (const keyword of locationKeywords) {
      if (lowerContent.includes(keyword)) {
        factors.push(`location: ${keyword}`);
      }
    }
    
    return factors;
  }

  private calculateMoodConsistency(content: string, targetMood: string): number {
    const moodKeywords = this.getMoodKeywords(targetMood);
    const lowerContent = content.toLowerCase();
    const words = lowerContent.split(/\s+/);
    
    let consistentWords = 0;
    let inconsistentWords = 0;
    
    // Get opposing mood keywords
    const opposingMoods = this.getOpposingMoods(targetMood);
    const opposingKeywords = opposingMoods.flatMap(mood => this.getMoodKeywords(mood));
    
    for (const word of words) {
      if (moodKeywords.some(keyword => word.includes(keyword))) {
        consistentWords++;
      } else if (opposingKeywords.some(keyword => word.includes(keyword))) {
        inconsistentWords++;
      }
    }
    
    const totalMoodWords = consistentWords + inconsistentWords;
    if (totalMoodWords === 0) return 50; // Neutral if no mood words found
    
    return Math.round((consistentWords / totalMoodWords) * 100);
  }

  private getMoodKeywords(mood: string): string[] {
    const moodKeywords: { [key: string]: string[] } = {
      peaceful: ['calm', 'serene', 'tranquil', 'gentle', 'quiet', 'still', 'peaceful'],
      tense: ['tense', 'tight', 'strained', 'anxious', 'nervous', 'pressure', 'stress'],
      mysterious: ['mystery', 'secret', 'hidden', 'unknown', 'enigma', 'shadow', 'veil'],
      romantic: ['love', 'tender', 'intimate', 'warm', 'gentle', 'soft', 'sweet'],
      dark: ['dark', 'ominous', 'sinister', 'grim', 'foreboding', 'menacing', 'shadow'],
      hopeful: ['hope', 'bright', 'optimistic', 'promising', 'uplifting', 'light', 'dawn'],
      action: ['fast', 'quick', 'sudden', 'explosive', 'dynamic', 'intense', 'rapid'],
      melancholy: ['sad', 'melancholy', 'wistful', 'somber', 'mournful', 'heavy', 'gray']
    };
    
    return moodKeywords[mood] || [];
  }

  private getOpposingMoods(mood: string): string[] {
    const oppositions: { [key: string]: string[] } = {
      peaceful: ['tense', 'action', 'dark'],
      tense: ['peaceful', 'romantic'],
      mysterious: ['clear', 'obvious'],
      romantic: ['tense', 'dark', 'action'],
      dark: ['hopeful', 'peaceful', 'romantic'],
      hopeful: ['dark', 'melancholy'],
      action: ['peaceful', 'romantic'],
      melancholy: ['hopeful', 'romantic']
    };
    
    return oppositions[mood] || [];
  }

  private analyzeSensoryBalance(content: string): SensoryBalance {
    const words = content.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    
    const senseKeywords = {
      visual: ['see', 'look', 'watch', 'bright', 'dark', 'color', 'light', 'shadow', 'gleam', 'glitter'],
      auditory: ['hear', 'sound', 'noise', 'whisper', 'shout', 'music', 'silence', 'echo', 'ring'],
      tactile: ['feel', 'touch', 'rough', 'smooth', 'cold', 'warm', 'soft', 'hard', 'texture'],
      olfactory: ['smell', 'scent', 'aroma', 'fragrance', 'odor', 'perfume', 'stench'],
      gustatory: ['taste', 'flavor', 'sweet', 'bitter', 'sour', 'salty', 'delicious']
    };
    
    const senseCounts: { [key: string]: number } = {};
    
    for (const [sense, keywords] of Object.entries(senseKeywords)) {
      senseCounts[sense] = words.filter(word => 
        keywords.some(keyword => word.includes(keyword))
      ).length;
    }
    
    const visual = (senseCounts.visual / totalWords) * 100;
    const auditory = (senseCounts.auditory / totalWords) * 100;
    const tactile = (senseCounts.tactile / totalWords) * 100;
    const olfactory = (senseCounts.olfactory / totalWords) * 100;
    const gustatory = (senseCounts.gustatory / totalWords) * 100;
    
    const overall = (visual + auditory + tactile + olfactory + gustatory) / 5;
    
    return {
      visual: Math.round(visual * 10) / 10,
      auditory: Math.round(auditory * 10) / 10,
      tactile: Math.round(tactile * 10) / 10,
      olfactory: Math.round(olfactory * 10) / 10,
      gustatory: Math.round(gustatory * 10) / 10,
      overall: Math.round(overall * 10) / 10
    };
  }

  private calculateImmersionScore(content: string, sensoryBalance: SensoryBalance): number {
    let score = 50; // Base score
    
    // Reward sensory variety
    const activeSenses = [
      sensoryBalance.visual,
      sensoryBalance.auditory,
      sensoryBalance.tactile,
      sensoryBalance.olfactory,
      sensoryBalance.gustatory
    ].filter(value => value > 0).length;
    
    score += activeSenses * 8; // Up to 40 points for using all senses
    
    // Reward balanced sensory usage
    const maxSense = Math.max(
      sensoryBalance.visual,
      sensoryBalance.auditory,
      sensoryBalance.tactile,
      sensoryBalance.olfactory,
      sensoryBalance.gustatory
    );
    
    if (maxSense < 70) { // Not overly dominated by one sense
      score += 15;
    }
    
    // Reward atmospheric details
    const atmosphericKeywords = [
      'atmosphere', 'mood', 'feeling', 'sense', 'impression',
      'ambiance', 'environment', 'setting', 'tone'
    ];
    
    const lowerContent = content.toLowerCase();
    const atmosphericCount = atmosphericKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    ).length;
    
    score += Math.min(20, atmosphericCount * 5);
    
    // Penalize for lack of detail
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 100) {
      score -= 20;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private identifyAtmosphericStrengths(content: string, sensoryBalance: SensoryBalance, moodConsistency: number): string[] {
    const strengths: string[] = [];
    
    // Mood consistency strength
    if (moodConsistency > 80) {
      strengths.push('Strong mood consistency throughout the scene');
    }
    
    // Sensory variety strength
    const activeSenses = [
      sensoryBalance.visual,
      sensoryBalance.auditory,
      sensoryBalance.tactile,
      sensoryBalance.olfactory,
      sensoryBalance.gustatory
    ].filter(value => value > 0).length;
    
    if (activeSenses >= 4) {
      strengths.push('Excellent sensory variety engages multiple senses');
    } else if (activeSenses >= 3) {
      strengths.push('Good sensory variety with multiple senses engaged');
    }
    
    // Specific sensory strengths
    if (sensoryBalance.visual > 2 && sensoryBalance.visual < 8) {
      strengths.push('Well-balanced visual descriptions');
    }
    
    if (sensoryBalance.auditory > 1) {
      strengths.push('Good use of auditory details');
    }
    
    if (sensoryBalance.olfactory > 0.5) {
      strengths.push('Effective use of scent to enhance atmosphere');
    }
    
    // Detail level strength
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 300) {
      strengths.push('Rich detail level creates immersive experience');
    }
    
    return strengths;
  }

  private identifyAtmosphericWeaknesses(content: string, sensoryBalance: SensoryBalance, moodConsistency: number): string[] {
    const weaknesses: string[] = [];
    
    // Mood consistency weakness
    if (moodConsistency < 60) {
      weaknesses.push('Inconsistent mood elements detract from atmosphere');
    }
    
    // Sensory imbalance weaknesses
    if (sensoryBalance.visual > 8) {
      weaknesses.push('Over-reliance on visual descriptions');
    }
    
    if (sensoryBalance.auditory < 0.5) {
      weaknesses.push('Lack of auditory details reduces immersion');
    }
    
    if (sensoryBalance.tactile < 0.5) {
      weaknesses.push('Missing tactile sensations limit physical connection');
    }
    
    if (sensoryBalance.olfactory === 0) {
      weaknesses.push('No scent details - missed opportunity for atmospheric depth');
    }
    
    // Overall sensory weakness
    const activeSenses = [
      sensoryBalance.visual,
      sensoryBalance.auditory,
      sensoryBalance.tactile,
      sensoryBalance.olfactory,
      sensoryBalance.gustatory
    ].filter(value => value > 0).length;
    
    if (activeSenses < 2) {
      weaknesses.push('Limited sensory engagement reduces immersion');
    }
    
    // Detail level weakness
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 150) {
      weaknesses.push('Insufficient detail for strong atmospheric impact');
    }
    
    return weaknesses;
  }

  private async generateEnhancementSuggestions(
    scene: Scene,
    weaknesses: string[],
    sensoryBalance: SensoryBalance
  ): Promise<AtmosphereEnhancement[]> {
    const suggestions: AtmosphereEnhancement[] = [];
    
    // Generate AI-powered suggestions
    const aiSuggestions = await this.generateAISuggestions(scene, weaknesses);
    suggestions.push(...aiSuggestions);
    
    // Generate rule-based suggestions
    const ruleSuggestions = this.generateRuleBasedSuggestions(scene, sensoryBalance);
    suggestions.push(...ruleSuggestions);
    
    // Sort by priority
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async generateAISuggestions(scene: Scene, weaknesses: string[]): Promise<AtmosphereEnhancement[]> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const prompt = `Analyze this scene and suggest specific atmospheric enhancements:

Scene: ${scene.content}
Current mood: ${scene.mood}
Identified weaknesses: ${weaknesses.join(', ')}

Provide 3-5 specific, actionable suggestions to enhance the atmosphere. For each suggestion, include:
1. What to add or change
2. Where in the scene to make the change
3. Why this will improve the atmosphere

Focus on sensory details, mood consistency, and immersion.`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 500,
      temperature: 0.7,
      systemPrompt: 'You are an expert in atmospheric writing and scene enhancement. Provide specific, actionable advice for improving scene atmosphere.'
    });
    
    return this.parseAISuggestions(response.text);
  }

  private parseAISuggestions(text: string): AtmosphereEnhancement[] {
    const suggestions: AtmosphereEnhancement[] = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentSuggestion: Partial<AtmosphereEnhancement> = {};
    
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        // Save previous suggestion
        if (currentSuggestion.description) {
          suggestions.push({
            type: 'ai_generated',
            priority: 'medium',
            description: currentSuggestion.description,
            implementation: currentSuggestion.implementation || 'Apply the suggested changes',
            expectedImpact: currentSuggestion.expectedImpact || 'Improved atmospheric immersion',
            targetArea: currentSuggestion.targetArea || 'general'
          });
        }
        
        // Start new suggestion
        currentSuggestion = {
          description: line.replace(/^\d+\.\s*/, '')
        };
      } else if (line.toLowerCase().includes('implementation') || line.toLowerCase().includes('how')) {
        currentSuggestion.implementation = line;
      } else if (line.toLowerCase().includes('impact') || line.toLowerCase().includes('why')) {
        currentSuggestion.expectedImpact = line;
      }
    }
    
    // Add final suggestion
    if (currentSuggestion.description) {
      suggestions.push({
        type: 'ai_generated',
        priority: 'medium',
        description: currentSuggestion.description,
        implementation: currentSuggestion.implementation || 'Apply the suggested changes',
        expectedImpact: currentSuggestion.expectedImpact || 'Improved atmospheric immersion',
        targetArea: currentSuggestion.targetArea || 'general'
      });
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  private generateRuleBasedSuggestions(scene: Scene, sensoryBalance: SensoryBalance): AtmosphereEnhancement[] {
    const suggestions: AtmosphereEnhancement[] = [];
    
    // Sensory balance suggestions
    if (sensoryBalance.auditory < 1) {
      suggestions.push({
        type: 'sensory_enhancement',
        priority: 'high',
        description: 'Add auditory details to enhance immersion',
        implementation: 'Include sounds like ambient noise, character voices, or environmental audio',
        expectedImpact: 'Creates a more complete sensory experience',
        targetArea: 'auditory'
      });
    }
    
    if (sensoryBalance.tactile < 1) {
      suggestions.push({
        type: 'sensory_enhancement',
        priority: 'medium',
        description: 'Include tactile sensations',
        implementation: 'Add descriptions of temperature, texture, or physical sensations',
        expectedImpact: 'Increases physical connection to the scene',
        targetArea: 'tactile'
      });
    }
    
    if (sensoryBalance.olfactory === 0) {
      suggestions.push({
        type: 'sensory_enhancement',
        priority: 'low',
        description: 'Consider adding scent details',
        implementation: 'Include subtle scent descriptions that match the setting and mood',
        expectedImpact: 'Adds atmospheric depth and memory triggers',
        targetArea: 'olfactory'
      });
    }
    
    // Visual balance suggestion
    if (sensoryBalance.visual > 8) {
      suggestions.push({
        type: 'balance_adjustment',
        priority: 'medium',
        description: 'Reduce visual dominance',
        implementation: 'Replace some visual descriptions with other sensory details',
        expectedImpact: 'Creates more balanced and engaging sensory experience',
        targetArea: 'visual'
      });
    }
    
    return suggestions;
  }

  // Public API methods
  async enhanceSceneAtmosphere(scene: Scene, targetMood?: string): Promise<AtmosphereEnhancement[]> {
    const analysis = await this.analyzeAtmosphere(scene);
    
    if (targetMood && targetMood !== scene.mood) {
      // Generate mood transition suggestions
      const transitionSuggestions = await this.generateMoodTransitionSuggestions(
        scene.mood || 'neutral',
        targetMood
      );
      analysis.suggestions.push(...transitionSuggestions);
    }
    
    return analysis.suggestions;
  }

  async generateMoodTransitionSuggestions(fromMood: string, toMood: string): Promise<AtmosphereEnhancement[]> {
    const transitionKey = `${fromMood}-${toMood}`;
    const transitions = this.moodTransitions.get(transitionKey) || [];
    
    const suggestions: AtmosphereEnhancement[] = [];
    
    for (const transition of transitions) {
      suggestions.push({
        type: 'mood_transition',
        priority: 'high',
        description: `Transition from ${fromMood} to ${toMood} using ${transition.transitionType} approach`,
        implementation: transition.techniques.join('; '),
        expectedImpact: `Successfully shifts scene mood from ${fromMood} to ${toMood}`,
        targetArea: 'mood',
        examples: transition.examples
      });
    }
    
    return suggestions;
  }

  async getGenreAtmosphereGuidance(genre: string): Promise<GenreAtmosphereGuide | null> {
    return this.genreGuides.get(genre.toLowerCase()) || null;
  }

  async validateAtmosphereForGenre(scene: Scene, genre: string): Promise<{ valid: boolean; issues: string[] }> {
    const guide = this.genreGuides.get(genre.toLowerCase());
    if (!guide) {
      return { valid: true, issues: ['Unknown genre - cannot validate'] };
    }
    
    const issues: string[] = [];
    const content = scene.content.toLowerCase();
    
    // Check for avoided elements
    for (const avoidElement of guide.avoidElements) {
      if (content.includes(avoidElement.toLowerCase())) {
        issues.push(`Contains element that should be avoided in ${genre}: ${avoidElement}`);
      }
    }
    
    // Check for presence of typical elements
    const hasTypicalElements = guide.atmosphericElements.some(element =>
      content.includes(element.toLowerCase().split(' ')[0])
    );
    
    if (!hasTypicalElements) {
      issues.push(`Missing typical ${genre} atmospheric elements`);
    }
    
    // Check mood appropriateness
    const sceneMood = scene.mood || 'neutral';
    if (!guide.commonMoods.includes(sceneMood)) {
      issues.push(`Mood '${sceneMood}' is uncommon for ${genre} genre`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}