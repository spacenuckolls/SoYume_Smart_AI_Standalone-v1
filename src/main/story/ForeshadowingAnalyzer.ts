import { Story, Scene, ForeshadowingElement, ForeshadowingAnalysisResult } from '../../shared/types/Story';
import { AIProviderRegistry } from '../ai/providers/AIProviderRegistry';

export interface ForeshadowingPattern {
  id: string;
  type: 'symbolic' | 'dialogue' | 'event' | 'character' | 'setting' | 'object';
  setup: ForeshadowingSetup;
  payoff: ForeshadowingPayoff | null;
  strength: number; // 0-10 scale
  subtlety: number; // 0-10 scale (10 = very subtle)
  effectiveness: number; // 0-10 scale
  suggestions: string[];
}

export interface ForeshadowingSetup {
  sceneIndex: number;
  content: string;
  context: string;
  confidence: number; // 0-1 scale
  techniques: ForeshadowingTechnique[];
}

export interface ForeshadowingPayoff {
  sceneIndex: number;
  content: string;
  context: string;
  fulfillment: 'complete' | 'partial' | 'subverted' | 'unfulfilled';
  satisfaction: number; // 0-10 scale
}

export interface ForeshadowingTechnique {
  name: string;
  description: string;
  examples: string[];
  effectiveness: number;
}

export interface ForeshadowingSuggestion {
  type: 'add_setup' | 'add_payoff' | 'strengthen_connection' | 'improve_subtlety' | 'enhance_symbolism';
  priority: 'low' | 'medium' | 'high';
  description: string;
  targetScene: number;
  implementation: string[];
  expectedImpact: string;
  examples: string[];
}

export interface SymbolicElement {
  symbol: string;
  meaning: string;
  appearances: Array<{
    sceneIndex: number;
    context: string;
    significance: number;
  }>;
  development: 'consistent' | 'evolving' | 'contradictory';
  effectiveness: number;
}

export class ForeshadowingAnalyzer {
  private aiRegistry: AIProviderRegistry;
  private foreshadowingTechniques: Map<string, ForeshadowingTechnique> = new Map();
  private symbolLibrary: Map<string, SymbolicMeaning> = new Map();

  constructor(aiRegistry: AIProviderRegistry) {
    this.aiRegistry = aiRegistry;
    this.initializeTechniques();
    this.initializeSymbolLibrary();
  }

  private initializeTechniques(): void {
    // Chekhov's Gun
    this.foreshadowingTechniques.set('chekhovs_gun', {
      name: "Chekhov's Gun",
      description: 'An element introduced early that becomes significant later',
      examples: [
        'A weapon mentioned in Act 1 that is used in Act 3',
        'A character trait revealed early that becomes crucial',
        'An object that seems insignificant but drives the plot'
      ],
      effectiveness: 9
    });

    // Red Herring
    this.foreshadowingTechniques.set('red_herring', {
      name: 'Red Herring',
      description: 'Misleading clues that divert attention from the truth',
      examples: [
        'False suspects in a mystery',
        'Misleading evidence that points to wrong conclusion',
        'Character actions that suggest false motivations'
      ],
      effectiveness: 7
    });

    // Symbolic Foreshadowing
    this.foreshadowingTechniques.set('symbolic', {
      name: 'Symbolic Foreshadowing',
      description: 'Using symbols and metaphors to hint at future events',
      examples: [
        'Weather patterns reflecting character emotions',
        'Animals representing character traits',
        'Colors associated with themes or outcomes'
      ],
      effectiveness: 8
    });

    // Dialogue Foreshadowing
    this.foreshadowingTechniques.set('dialogue', {
      name: 'Dialogue Foreshadowing',
      description: 'Characters unknowingly predicting future events through speech',
      examples: [
        'Casual remarks that prove prophetic',
        'Warnings that come true',
        'Promises that are tested'
      ],
      effectiveness: 8
    });

    // Dramatic Irony
    this.foreshadowingTechniques.set('dramatic_irony', {
      name: 'Dramatic Irony',
      description: 'Reader knows something characters do not',
      examples: [
        'Reader aware of impending danger',
        'Knowledge of character\'s true identity',
        'Understanding of consequences characters cannot see'
      ],
      effectiveness: 9
    });

    // Parallel Structure
    this.foreshadowingTechniques.set('parallel', {
      name: 'Parallel Structure',
      description: 'Similar events or patterns that echo throughout the story',
      examples: [
        'Repeated scenarios with different outcomes',
        'Character actions that mirror earlier events',
        'Cyclical patterns in plot development'
      ],
      effectiveness: 7
    });
  }

  private initializeSymbolLibrary(): void {
    // Common symbolic meanings
    this.symbolLibrary.set('storm', {
      commonMeanings: ['conflict', 'change', 'turmoil', 'cleansing', 'revelation'],
      contexts: ['emotional upheaval', 'plot climax', 'character transformation'],
      effectiveness: 8
    });

    this.symbolLibrary.set('dawn', {
      commonMeanings: ['new beginning', 'hope', 'revelation', 'rebirth', 'clarity'],
      contexts: ['character growth', 'plot resolution', 'thematic conclusion'],
      effectiveness: 7
    });

    this.symbolLibrary.set('mirror', {
      commonMeanings: ['self-reflection', 'truth', 'duality', 'illusion', 'identity'],
      contexts: ['character development', 'theme exploration', 'plot revelation'],
      effectiveness: 8
    });

    this.symbolLibrary.set('door', {
      commonMeanings: ['opportunity', 'transition', 'choice', 'barrier', 'mystery'],
      contexts: ['plot advancement', 'character decision', 'thematic development'],
      effectiveness: 6
    });

    this.symbolLibrary.set('fire', {
      commonMeanings: ['passion', 'destruction', 'purification', 'knowledge', 'danger'],
      contexts: ['character emotion', 'plot climax', 'thematic resolution'],
      effectiveness: 9
    });

    this.symbolLibrary.set('water', {
      commonMeanings: ['life', 'cleansing', 'emotion', 'unconscious', 'flow'],
      contexts: ['character emotion', 'spiritual journey', 'thematic development'],
      effectiveness: 7
    });

    this.symbolLibrary.set('bird', {
      commonMeanings: ['freedom', 'spirit', 'messenger', 'transcendence', 'fragility'],
      contexts: ['character aspiration', 'thematic symbol', 'plot device'],
      effectiveness: 6
    });

    this.symbolLibrary.set('shadow', {
      commonMeanings: ['hidden truth', 'dark side', 'mystery', 'fear', 'unconscious'],
      contexts: ['character psychology', 'plot mystery', 'thematic exploration'],
      effectiveness: 8
    });
  }

  async analyzeForeshadowing(story: Story): Promise<ForeshadowingAnalysisResult> {
    const scenes = story.scenes || [];
    
    // Identify potential foreshadowing elements
    const patterns = await this.identifyForeshadowingPatterns(scenes);
    
    // Analyze symbolic elements
    const symbols = await this.analyzeSymbolicElements(scenes);
    
    // Find setup-payoff relationships
    const relationships = await this.findSetupPayoffRelationships(patterns);
    
    // Evaluate effectiveness
    const effectiveness = this.evaluateOverallEffectiveness(patterns, symbols);
    
    // Generate suggestions
    const suggestions = await this.generateForeshadowingSuggestions(patterns, symbols, scenes);
    
    // Identify missed opportunities
    const missedOpportunities = await this.identifyMissedOpportunities(scenes, patterns);

    return {
      overallEffectiveness: effectiveness,
      patterns,
      symbols,
      suggestions,
      missedOpportunities,
      setupPayoffRatio: this.calculateSetupPayoffRatio(patterns),
      subtletyScore: this.calculateSubtletyScore(patterns),
      satisfactionScore: this.calculateSatisfactionScore(patterns)
    };
  }

  private async identifyForeshadowingPatterns(scenes: Scene[]): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const content = scene.content || '';

      // Identify different types of foreshadowing
      const dialoguePatterns = await this.identifyDialogueForeshadowing(content, i);
      const objectPatterns = await this.identifyObjectForeshadowing(content, i);
      const eventPatterns = await this.identifyEventForeshadowing(content, i);
      const characterPatterns = await this.identifyCharacterForeshadowing(content, i);
      const settingPatterns = await this.identifySettingForeshadowing(content, i);

      patterns.push(
        ...dialoguePatterns,
        ...objectPatterns,
        ...eventPatterns,
        ...characterPatterns,
        ...settingPatterns
      );
    }

    // Find payoffs for setups
    for (const pattern of patterns) {
      if (!pattern.payoff) {
        pattern.payoff = await this.findPayoffForSetup(pattern, scenes);
      }
    }

    return patterns;
  }

  private async identifyDialogueForeshadowing(content: string, sceneIndex: number): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];
    
    // Look for prophetic statements, warnings, promises
    const foreshadowingPhrases = [
      /(?:i have a feeling|something tells me|mark my words|you'll see|i predict|i fear|beware|watch out for|be careful of)[\s\S]*?[.!?]/gi,
      /(?:if you|when you|should you)[\s\S]*?(?:will|would|might)[\s\S]*?[.!?]/gi,
      /(?:one day|someday|eventually|in time|before long)[\s\S]*?[.!?]/gi
    ];

    for (const pattern of foreshadowingPhrases) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const confidence = this.calculateForeshadowingConfidence(match[0], 'dialogue');
        
        if (confidence > 0.3) {
          patterns.push({
            id: `dialogue_${sceneIndex}_${patterns.length}`,
            type: 'dialogue',
            setup: {
              sceneIndex,
              content: match[0],
              context: this.extractContext(content, match.index, 200),
              confidence,
              techniques: [this.foreshadowingTechniques.get('dialogue')!]
            },
            payoff: null,
            strength: confidence * 10,
            subtlety: this.calculateSubtlety(match[0], 'dialogue'),
            effectiveness: 0, // Will be calculated after finding payoff
            suggestions: []
          });
        }
      }
    }

    return patterns;
  }

  private async identifyObjectForeshadowing(content: string, sceneIndex: number): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];
    
    // Look for objects that are emphasized or described in detail
    const objectPatterns = [
      /(?:the|a|an)\s+([a-zA-Z\s]+?)\s+(?:gleamed|glinted|caught|drew|seemed|appeared|looked|felt)[\s\S]*?[.!?]/gi,
      /(?:noticed|saw|found|discovered|picked up|examined)\s+(?:the|a|an)\s+([a-zA-Z\s]+?)[.!?]/gi,
      /(?:ancient|old|mysterious|strange|unusual|peculiar)\s+([a-zA-Z\s]+?)[\s\S]*?[.!?]/gi
    ];

    for (const pattern of objectPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const objectName = match[1].trim();
        const confidence = this.calculateForeshadowingConfidence(match[0], 'object');
        
        if (confidence > 0.4 && objectName.length > 2 && objectName.length < 30) {
          patterns.push({
            id: `object_${sceneIndex}_${patterns.length}`,
            type: 'object',
            setup: {
              sceneIndex,
              content: match[0],
              context: this.extractContext(content, match.index, 150),
              confidence,
              techniques: [this.foreshadowingTechniques.get('chekhovs_gun')!]
            },
            payoff: null,
            strength: confidence * 10,
            subtlety: this.calculateSubtlety(match[0], 'object'),
            effectiveness: 0,
            suggestions: []
          });
        }
      }
    }

    return patterns;
  }

  private async identifyEventForeshadowing(content: string, sceneIndex: number): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];
    
    // Look for events that might foreshadow larger events
    const eventPatterns = [
      /(?:suddenly|unexpectedly|without warning|out of nowhere)[\s\S]*?[.!?]/gi,
      /(?:first time|never before|unusual|strange|odd)[\s\S]*?(?:happened|occurred|appeared|seemed)[.!?]/gi,
      /(?:omen|sign|portent|warning|indication)[\s\S]*?[.!?]/gi
    ];

    for (const pattern of eventPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const confidence = this.calculateForeshadowingConfidence(match[0], 'event');
        
        if (confidence > 0.3) {
          patterns.push({
            id: `event_${sceneIndex}_${patterns.length}`,
            type: 'event',
            setup: {
              sceneIndex,
              content: match[0],
              context: this.extractContext(content, match.index, 200),
              confidence,
              techniques: [this.foreshadowingTechniques.get('parallel')!]
            },
            payoff: null,
            strength: confidence * 10,
            subtlety: this.calculateSubtlety(match[0], 'event'),
            effectiveness: 0,
            suggestions: []
          });
        }
      }
    }

    return patterns;
  }

  private async identifyCharacterForeshadowing(content: string, sceneIndex: number): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];
    
    // Look for character behaviors or traits that might be significant
    const characterPatterns = [
      /([A-Z][a-z]+)\s+(?:always|never|often|rarely|sometimes)[\s\S]*?[.!?]/gi,
      /([A-Z][a-z]+)\s+(?:had a habit of|was known for|tended to|was prone to)[\s\S]*?[.!?]/gi,
      /(?:there was something about|something in|the way)\s+([A-Z][a-z]+)[\s\S]*?[.!?]/gi
    ];

    for (const pattern of characterPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const confidence = this.calculateForeshadowingConfidence(match[0], 'character');
        
        if (confidence > 0.3) {
          patterns.push({
            id: `character_${sceneIndex}_${patterns.length}`,
            type: 'character',
            setup: {
              sceneIndex,
              content: match[0],
              context: this.extractContext(content, match.index, 200),
              confidence,
              techniques: [this.foreshadowingTechniques.get('dramatic_irony')!]
            },
            payoff: null,
            strength: confidence * 10,
            subtlety: this.calculateSubtlety(match[0], 'character'),
            effectiveness: 0,
            suggestions: []
          });
        }
      }
    }

    return patterns;
  }

  private async identifySettingForeshadowing(content: string, sceneIndex: number): Promise<ForeshadowingPattern[]> {
    const patterns: ForeshadowingPattern[] = [];
    
    // Look for atmospheric or environmental details that might be significant
    const settingPatterns = [
      /(?:the weather|the sky|the air|the atmosphere)[\s\S]*?(?:seemed|felt|appeared|looked)[\s\S]*?[.!?]/gi,
      /(?:dark clouds|storm|mist|fog|shadows)[\s\S]*?(?:gathered|approached|crept|loomed)[\s\S]*?[.!?]/gi,
      /(?:the place|the room|the building|the area)[\s\S]*?(?:felt|seemed|appeared)[\s\S]*?(?:ominous|foreboding|peaceful|welcoming)[\s\S]*?[.!?]/gi
    ];

    for (const pattern of settingPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const confidence = this.calculateForeshadowingConfidence(match[0], 'setting');
        
        if (confidence > 0.3) {
          patterns.push({
            id: `setting_${sceneIndex}_${patterns.length}`,
            type: 'setting',
            setup: {
              sceneIndex,
              content: match[0],
              context: this.extractContext(content, match.index, 200),
              confidence,
              techniques: [this.foreshadowingTechniques.get('symbolic')!]
            },
            payoff: null,
            strength: confidence * 10,
            subtlety: this.calculateSubtlety(match[0], 'setting'),
            effectiveness: 0,
            suggestions: []
          });
        }
      }
    }

    return patterns;
  }

  private calculateForeshadowingConfidence(text: string, type: string): number {
    let confidence = 0.5; // Base confidence
    
    const lowerText = text.toLowerCase();
    
    // Increase confidence for certain keywords
    const strongIndicators = ['will', 'shall', 'must', 'inevitable', 'destined', 'fate', 'doom'];
    const mediumIndicators = ['might', 'could', 'perhaps', 'maybe', 'possibly', 'likely'];
    const weakIndicators = ['seem', 'appear', 'look', 'feel', 'suggest'];
    
    for (const indicator of strongIndicators) {
      if (lowerText.includes(indicator)) confidence += 0.2;
    }
    
    for (const indicator of mediumIndicators) {
      if (lowerText.includes(indicator)) confidence += 0.1;
    }
    
    for (const indicator of weakIndicators) {
      if (lowerText.includes(indicator)) confidence += 0.05;
    }
    
    // Adjust based on type
    switch (type) {
      case 'dialogue':
        if (lowerText.includes('said') || lowerText.includes('told')) confidence += 0.1;
        break;
      case 'object':
        if (lowerText.includes('gleamed') || lowerText.includes('mysterious')) confidence += 0.15;
        break;
      case 'event':
        if (lowerText.includes('suddenly') || lowerText.includes('unexpected')) confidence += 0.1;
        break;
    }
    
    return Math.min(1, confidence);
  }

  private calculateSubtlety(text: string, type: string): number {
    let subtlety = 5; // Base subtlety (medium)
    
    const lowerText = text.toLowerCase();
    
    // Obvious foreshadowing reduces subtlety
    const obviousWords = ['will happen', 'going to', 'predict', 'foresee', 'prophesy'];
    for (const word of obviousWords) {
      if (lowerText.includes(word)) subtlety -= 2;
    }
    
    // Subtle techniques increase subtlety
    const subtleWords = ['seem', 'appear', 'suggest', 'hint', 'imply'];
    for (const word of subtleWords) {
      if (lowerText.includes(word)) subtlety += 1;
    }
    
    // Symbolic language increases subtlety
    if (type === 'setting' || type === 'symbolic') {
      subtlety += 2;
    }
    
    // Direct dialogue reduces subtlety
    if (type === 'dialogue' && (lowerText.includes('i tell you') || lowerText.includes('mark my words'))) {
      subtlety -= 1;
    }
    
    return Math.max(1, Math.min(10, subtlety));
  }

  private extractContext(content: string, index: number, radius: number): string {
    const start = Math.max(0, index - radius);
    const end = Math.min(content.length, index + radius);
    return content.substring(start, end).trim();
  }

  private async findPayoffForSetup(setup: ForeshadowingPattern, scenes: Scene[]): Promise<ForeshadowingPayoff | null> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    // Look for payoffs in later scenes
    for (let i = setup.setup.sceneIndex + 1; i < scenes.length; i++) {
      const scene = scenes[i];
      const content = scene.content || '';
      
      // Use AI to determine if this scene contains a payoff for the setup
      const prompt = `Analyze if this scene contains a payoff for the following foreshadowing setup:

Setup: "${setup.setup.content}"
Setup Context: "${setup.setup.context}"
Setup Type: ${setup.type}

Scene Content: "${content.substring(0, 500)}..."

Does this scene fulfill, resolve, or pay off the foreshadowing setup? Respond with:
1. "YES" if there's a clear payoff
2. "PARTIAL" if there's a partial fulfillment
3. "SUBVERTED" if the expectation is deliberately subverted
4. "NO" if there's no payoff

Then briefly explain why.`;

      const response = await provider.generateText({
        prompt,
        maxTokens: 150,
        temperature: 0.3
      });

      const responseText = response.text.toLowerCase();
      
      if (responseText.startsWith('yes')) {
        return {
          sceneIndex: i,
          content: this.extractRelevantPayoff(content, setup.setup.content),
          context: content.substring(0, 200),
          fulfillment: 'complete',
          satisfaction: this.calculateSatisfaction(setup, content)
        };
      } else if (responseText.startsWith('partial')) {
        return {
          sceneIndex: i,
          content: this.extractRelevantPayoff(content, setup.setup.content),
          context: content.substring(0, 200),
          fulfillment: 'partial',
          satisfaction: this.calculateSatisfaction(setup, content) * 0.7
        };
      } else if (responseText.startsWith('subverted')) {
        return {
          sceneIndex: i,
          content: this.extractRelevantPayoff(content, setup.setup.content),
          context: content.substring(0, 200),
          fulfillment: 'subverted',
          satisfaction: this.calculateSatisfaction(setup, content) * 0.8
        };
      }
    }
    
    return null; // No payoff found
  }

  private extractRelevantPayoff(content: string, setupContent: string): string {
    // Simple extraction - in a real implementation, this would be more sophisticated
    const sentences = content.split(/[.!?]+/);
    
    // Look for sentences that might relate to the setup
    const setupWords = setupContent.toLowerCase().split(/\s+/);
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      const commonWords = setupWords.filter(word => sentenceWords.includes(word));
      
      if (commonWords.length > 2) {
        return sentence.trim();
      }
    }
    
    return content.substring(0, 200); // Fallback to beginning of content
  }

  private calculateSatisfaction(setup: ForeshadowingPattern, payoffContent: string): number {
    let satisfaction = 5; // Base satisfaction
    
    // Increase satisfaction based on setup strength
    satisfaction += setup.strength * 0.3;
    
    // Increase satisfaction based on subtlety (more subtle = more satisfying when paid off)
    satisfaction += setup.subtlety * 0.2;
    
    // Analyze payoff content for satisfaction indicators
    const lowerPayoff = payoffContent.toLowerCase();
    
    const satisfyingWords = ['revealed', 'fulfilled', 'came true', 'happened', 'occurred', 'realized'];
    for (const word of satisfyingWords) {
      if (lowerPayoff.includes(word)) satisfaction += 0.5;
    }
    
    return Math.min(10, satisfaction);
  }

  private async analyzeSymbolicElements(scenes: Scene[]): Promise<SymbolicElement[]> {
    const symbols: Map<string, SymbolicElement> = new Map();
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const content = scene.content || '';
      
      // Look for symbolic elements
      for (const [symbolName, symbolData] of this.symbolLibrary) {
        const appearances = this.findSymbolAppearances(content, symbolName, i);
        
        if (appearances.length > 0) {
          const existing = symbols.get(symbolName);
          if (existing) {
            existing.appearances.push(...appearances);
          } else {
            symbols.set(symbolName, {
              symbol: symbolName,
              meaning: symbolData.commonMeanings[0], // Primary meaning
              appearances,
              development: 'consistent', // Will be analyzed later
              effectiveness: symbolData.effectiveness
            });
          }
        }
      }
    }
    
    // Analyze development patterns for each symbol
    for (const symbol of symbols.values()) {
      symbol.development = this.analyzeSymbolDevelopment(symbol.appearances);
    }
    
    return Array.from(symbols.values());
  }

  private findSymbolAppearances(content: string, symbolName: string, sceneIndex: number): Array<{
    sceneIndex: number;
    context: string;
    significance: number;
  }> {
    const appearances: Array<{ sceneIndex: number; context: string; significance: number }> = [];
    const lowerContent = content.toLowerCase();
    const lowerSymbol = symbolName.toLowerCase();
    
    let index = lowerContent.indexOf(lowerSymbol);
    while (index !== -1) {
      const context = this.extractContext(content, index, 100);
      const significance = this.calculateSymbolSignificance(context, symbolName);
      
      appearances.push({
        sceneIndex,
        context,
        significance
      });
      
      index = lowerContent.indexOf(lowerSymbol, index + 1);
    }
    
    return appearances;
  }

  private calculateSymbolSignificance(context: string, symbolName: string): number {
    let significance = 5; // Base significance
    
    const lowerContext = context.toLowerCase();
    
    // Increase significance for descriptive language
    const descriptiveWords = ['gleaming', 'dark', 'bright', 'mysterious', 'ancient', 'powerful'];
    for (const word of descriptiveWords) {
      if (lowerContext.includes(word)) significance += 1;
    }
    
    // Increase significance for emotional language
    const emotionalWords = ['fear', 'hope', 'dread', 'joy', 'sorrow', 'anger'];
    for (const word of emotionalWords) {
      if (lowerContext.includes(word)) significance += 1;
    }
    
    // Increase significance for action words
    const actionWords = ['appeared', 'vanished', 'emerged', 'transformed', 'shattered'];
    for (const word of actionWords) {
      if (lowerContext.includes(word)) significance += 1;
    }
    
    return Math.min(10, significance);
  }

  private analyzeSymbolDevelopment(appearances: Array<{ sceneIndex: number; context: string; significance: number }>): SymbolicElement['development'] {
    if (appearances.length < 2) return 'consistent';
    
    // Analyze if the symbol's treatment changes over time
    const significances = appearances.map(app => app.significance);
    const variance = this.calculateVariance(significances);
    
    if (variance < 2) return 'consistent';
    if (variance > 5) return 'contradictory';
    return 'evolving';
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private async findSetupPayoffRelationships(patterns: ForeshadowingPattern[]): Promise<Array<{
    setup: ForeshadowingPattern;
    payoff: ForeshadowingPattern | null;
    strength: number;
  }>> {
    const relationships: Array<{ setup: ForeshadowingPattern; payoff: ForeshadowingPattern | null; strength: number }> = [];
    
    for (const pattern of patterns) {
      const payoffPattern = patterns.find(p => 
        p.setup.sceneIndex > pattern.setup.sceneIndex && 
        this.areRelated(pattern, p)
      );
      
      relationships.push({
        setup: pattern,
        payoff: payoffPattern || null,
        strength: pattern.payoff ? pattern.strength : 0
      });
    }
    
    return relationships;
  }

  private areRelated(pattern1: ForeshadowingPattern, pattern2: ForeshadowingPattern): boolean {
    // Simple relatedness check - in a real implementation, this would be more sophisticated
    const words1 = pattern1.setup.content.toLowerCase().split(/\s+/);
    const words2 = pattern2.setup.content.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    return commonWords.length > 2;
  }

  private evaluateOverallEffectiveness(patterns: ForeshadowingPattern[], symbols: SymbolicElement[]): number {
    if (patterns.length === 0) return 0;
    
    let totalEffectiveness = 0;
    let count = 0;
    
    // Evaluate pattern effectiveness
    for (const pattern of patterns) {
      if (pattern.payoff) {
        pattern.effectiveness = (pattern.strength + pattern.subtlety + pattern.payoff.satisfaction) / 3;
        totalEffectiveness += pattern.effectiveness;
        count++;
      }
    }
    
    // Add symbol effectiveness
    for (const symbol of symbols) {
      totalEffectiveness += symbol.effectiveness;
      count++;
    }
    
    return count > 0 ? totalEffectiveness / count : 0;
  }

  private async generateForeshadowingSuggestions(
    patterns: ForeshadowingPattern[],
    symbols: SymbolicElement[],
    scenes: Scene[]
  ): Promise<ForeshadowingSuggestion[]> {
    const suggestions: ForeshadowingSuggestion[] = [];
    
    // Suggest payoffs for setups without them
    const unfulfilledSetups = patterns.filter(p => !p.payoff);
    for (const setup of unfulfilledSetups) {
      suggestions.push({
        type: 'add_payoff',
        priority: 'high',
        description: `Add payoff for ${setup.type} foreshadowing setup`,
        targetScene: Math.min(scenes.length - 1, setup.setup.sceneIndex + Math.floor(scenes.length / 2)),
        implementation: [
          `Reference the ${setup.type} element from scene ${setup.setup.sceneIndex + 1}`,
          'Fulfill the expectation created by the setup',
          'Ensure the payoff feels satisfying and earned'
        ],
        expectedImpact: 'Improved story satisfaction and coherence',
        examples: this.generatePayoffExamples(setup)
      });
    }
    
    // Suggest strengthening weak connections
    const weakPatterns = patterns.filter(p => p.strength < 5);
    for (const pattern of weakPatterns) {
      suggestions.push({
        type: 'strengthen_connection',
        priority: 'medium',
        description: `Strengthen ${pattern.type} foreshadowing in scene ${pattern.setup.sceneIndex + 1}`,
        targetScene: pattern.setup.sceneIndex,
        implementation: [
          'Add more specific details to the setup',
          'Increase the emotional weight of the moment',
          'Make the element more memorable'
        ],
        expectedImpact: 'More impactful foreshadowing',
        examples: [`Make the ${pattern.type} more prominent or significant`]
      });
    }
    
    // Suggest improving subtlety for obvious foreshadowing
    const obviousPatterns = patterns.filter(p => p.subtlety < 4);
    for (const pattern of obviousPatterns) {
      suggestions.push({
        type: 'improve_subtlety',
        priority: 'medium',
        description: `Make ${pattern.type} foreshadowing more subtle`,
        targetScene: pattern.setup.sceneIndex,
        implementation: [
          'Use more indirect language',
          'Embed the foreshadowing in natural dialogue or action',
          'Let readers discover the significance themselves'
        ],
        expectedImpact: 'More sophisticated and satisfying foreshadowing',
        examples: ['Show rather than tell', 'Use subtext and implication']
      });
    }
    
    // Suggest symbolic enhancements
    const underusedSymbols = symbols.filter(s => s.appearances.length === 1);
    for (const symbol of underusedSymbols) {
      suggestions.push({
        type: 'enhance_symbolism',
        priority: 'low',
        description: `Develop the ${symbol.symbol} symbol further`,
        targetScene: symbol.appearances[0].sceneIndex + 1,
        implementation: [
          `Reference the ${symbol.symbol} again in a later scene`,
          'Develop its symbolic meaning',
          'Connect it to character or theme development'
        ],
        expectedImpact: 'Richer symbolic depth',
        examples: [`Use ${symbol.symbol} to represent ${symbol.meaning}`]
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generatePayoffExamples(setup: ForeshadowingPattern): string[] {
    const examples: string[] = [];
    
    switch (setup.type) {
      case 'dialogue':
        examples.push('Have the prediction come true');
        examples.push('Reference the earlier statement when it\'s fulfilled');
        examples.push('Show the character remembering their words');
        break;
      case 'object':
        examples.push('Have the object play a crucial role in the climax');
        examples.push('Reveal the object\'s true significance');
        examples.push('Use the object to solve a major problem');
        break;
      case 'event':
        examples.push('Echo the earlier event in a larger context');
        examples.push('Show how the small event predicted the larger one');
        examples.push('Have characters recognize the pattern');
        break;
      case 'character':
        examples.push('Have the character trait become crucial to the plot');
        examples.push('Show the trait\'s consequences');
        examples.push('Use the trait to drive character development');
        break;
      case 'setting':
        examples.push('Return to the setting for a crucial scene');
        examples.push('Have the atmosphere reflect the story\'s climax');
        examples.push('Use the setting to mirror character emotions');
        break;
    }
    
    return examples;
  }

  private async identifyMissedOpportunities(scenes: Scene[], patterns: ForeshadowingPattern[]): Promise<string[]> {
    const opportunities: string[] = [];
    
    // Look for scenes that could benefit from foreshadowing
    for (let i = 0; i < scenes.length - 2; i++) {
      const scene = scenes[i];
      const content = scene.content || '';
      
      // Check if this scene has any foreshadowing
      const scenePatterns = patterns.filter(p => p.setup.sceneIndex === i);
      
      if (scenePatterns.length === 0) {
        // Look for potential foreshadowing opportunities
        if (this.hasImportantElements(content)) {
          opportunities.push(`Scene ${i + 1} contains important elements that could foreshadow later events`);
        }
        
        if (this.hasCharacterMoments(content)) {
          opportunities.push(`Scene ${i + 1} has character moments that could hint at future development`);
        }
        
        if (this.hasSymbolicPotential(content)) {
          opportunities.push(`Scene ${i + 1} contains elements with symbolic potential`);
        }
      }
    }
    
    return opportunities;
  }

  private hasImportantElements(content: string): boolean {
    const importantWords = ['weapon', 'key', 'letter', 'book', 'ring', 'sword', 'artifact', 'treasure'];
    const lowerContent = content.toLowerCase();
    
    return importantWords.some(word => lowerContent.includes(word));
  }

  private hasCharacterMoments(content: string): boolean {
    const characterWords = ['decided', 'promised', 'vowed', 'swore', 'realized', 'understood', 'learned'];
    const lowerContent = content.toLowerCase();
    
    return characterWords.some(word => lowerContent.includes(word));
  }

  private hasSymbolicPotential(content: string): boolean {
    const symbolicWords = Array.from(this.symbolLibrary.keys());
    const lowerContent = content.toLowerCase();
    
    return symbolicWords.some(symbol => lowerContent.includes(symbol));
  }

  private calculateSetupPayoffRatio(patterns: ForeshadowingPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const paidOffPatterns = patterns.filter(p => p.payoff).length;
    return paidOffPatterns / patterns.length;
  }

  private calculateSubtletyScore(patterns: ForeshadowingPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const totalSubtlety = patterns.reduce((sum, p) => sum + p.subtlety, 0);
    return totalSubtlety / patterns.length;
  }

  private calculateSatisfactionScore(patterns: ForeshadowingPattern[]): number {
    const paidOffPatterns = patterns.filter(p => p.payoff);
    if (paidOffPatterns.length === 0) return 0;
    
    const totalSatisfaction = paidOffPatterns.reduce((sum, p) => sum + (p.payoff?.satisfaction || 0), 0);
    return totalSatisfaction / paidOffPatterns.length;
  }

  // Public API methods
  async validateForeshadowing(story: Story): Promise<{ effective: boolean; issues: string[] }> {
    const analysis = await this.analyzeForeshadowing(story);
    const issues: string[] = [];
    
    if (analysis.overallEffectiveness < 5) {
      issues.push('Overall foreshadowing effectiveness is low');
    }
    
    if (analysis.setupPayoffRatio < 0.6) {
      issues.push('Many foreshadowing setups lack payoffs');
    }
    
    if (analysis.subtletyScore < 4) {
      issues.push('Foreshadowing is too obvious');
    } else if (analysis.subtletyScore > 8) {
      issues.push('Foreshadowing may be too subtle');
    }
    
    if (analysis.missedOpportunities.length > 3) {
      issues.push('Multiple missed opportunities for foreshadowing');
    }
    
    return {
      effective: analysis.overallEffectiveness >= 6 && analysis.setupPayoffRatio >= 0.7,
      issues
    };
  }

  async getForeshadowingTechniques(): Promise<ForeshadowingTechnique[]> {
    return Array.from(this.foreshadowingTechniques.values());
  }

  async getSymbolicElements(story: Story): Promise<SymbolicElement[]> {
    const analysis = await this.analyzeForeshadowing(story);
    return analysis.symbols;
  }
}

// Helper interfaces
interface SymbolicMeaning {
  commonMeanings: string[];
  contexts: string[];
  effectiveness: number;
}