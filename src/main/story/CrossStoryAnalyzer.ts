import { Story, Character, Scene, CrossStoryAnalysisResult, ConsistencyIssue, CharacterEvolution } from '../../shared/types/Story';
import { AIProviderRegistry } from '../ai/providers/AIProviderRegistry';

export interface CrossStoryConsistencyResult {
  overallConsistency: number; // 0-100
  characterConsistency: CharacterConsistencyAnalysis[];
  worldConsistency: WorldConsistencyAnalysis;
  timelineConsistency: TimelineConsistencyAnalysis;
  themeConsistency: ThemeConsistencyAnalysis;
  inconsistencies: ConsistencyIssue[];
  recommendations: ConsistencyRecommendation[];
}

export interface CharacterConsistencyAnalysis {
  characterId: string;
  characterName: string;
  consistencyScore: number; // 0-100
  evolution: CharacterEvolution;
  inconsistencies: CharacterInconsistency[];
  appearances: CharacterAppearance[];
}

export interface CharacterInconsistency {
  type: 'personality' | 'appearance' | 'ability' | 'knowledge' | 'relationship' | 'motivation';
  description: string;
  conflictingStories: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string[];
  suggestions: string[];
}

export interface CharacterAppearance {
  storyId: string;
  storyTitle: string;
  sceneCount: number;
  firstAppearance: number;
  lastAppearance: number;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  characterArc: string;
}

export interface WorldConsistencyAnalysis {
  consistencyScore: number;
  locations: LocationConsistency[];
  rules: WorldRuleConsistency[];
  technology: TechnologyConsistency[];
  magic: MagicSystemConsistency[];
  inconsistencies: WorldInconsistency[];
}

export interface LocationConsistency {
  name: string;
  descriptions: Array<{ storyId: string; description: string }>;
  consistencyScore: number;
  conflicts: string[];
}

export interface WorldRuleConsistency {
  rule: string;
  applications: Array<{ storyId: string; application: string }>;
  consistencyScore: number;
  violations: string[];
}

export interface TimelineConsistencyAnalysis {
  consistencyScore: number;
  chronology: ChronologicalEvent[];
  conflicts: TimelineConflict[];
  gaps: TimelineGap[];
}

export interface ChronologicalEvent {
  event: string;
  storyId: string;
  timestamp: string;
  relativeOrder: number;
  confidence: number;
}

export interface TimelineConflict {
  description: string;
  conflictingEvents: ChronologicalEvent[];
  severity: 'low' | 'medium' | 'high';
  resolution: string[];
}

export interface ThemeConsistencyAnalysis {
  consistencyScore: number;
  coreThemes: ThemeAnalysis[];
  themeEvolution: ThemeEvolution[];
  contradictions: ThemeContradiction[];
}

export interface ThemeAnalysis {
  theme: string;
  strength: number; // 0-10
  stories: Array<{ storyId: string; presence: number }>;
  development: string;
}

export interface ConsistencyRecommendation {
  type: 'character' | 'world' | 'timeline' | 'theme';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedStories: string[];
  implementation: string[];
  impact: string;
}

export class CrossStoryAnalyzer {
  private aiRegistry: AIProviderRegistry;
  private characterTracker: Map<string, CrossStoryCharacterData> = new Map();
  private worldElementTracker: Map<string, CrossStoryWorldData> = new Map();
  private timelineTracker: CrossStoryTimelineData[] = [];

  constructor(aiRegistry: AIProviderRegistry) {
    this.aiRegistry = aiRegistry;
  }

  async analyzeStoryConsistency(stories: Story[]): Promise<CrossStoryConsistencyResult> {
    if (stories.length < 2) {
      throw new Error('Cross-story analysis requires at least 2 stories');
    }

    // Initialize tracking data
    await this.initializeTracking(stories);

    // Analyze different consistency aspects
    const characterConsistency = await this.analyzeCharacterConsistency(stories);
    const worldConsistency = await this.analyzeWorldConsistency(stories);
    const timelineConsistency = await this.analyzeTimelineConsistency(stories);
    const themeConsistency = await this.analyzeThemeConsistency(stories);

    // Identify overall inconsistencies
    const inconsistencies = this.compileInconsistencies(
      characterConsistency,
      worldConsistency,
      timelineConsistency,
      themeConsistency
    );

    // Calculate overall consistency score
    const overallConsistency = this.calculateOverallConsistency(
      characterConsistency,
      worldConsistency,
      timelineConsistency,
      themeConsistency
    );

    // Generate recommendations
    const recommendations = await this.generateConsistencyRecommendations(
      inconsistencies,
      characterConsistency,
      worldConsistency
    );

    return {
      overallConsistency,
      characterConsistency,
      worldConsistency,
      timelineConsistency,
      themeConsistency,
      inconsistencies,
      recommendations
    };
  }

  private async initializeTracking(stories: Story[]): Promise<void> {
    this.characterTracker.clear();
    this.worldElementTracker.clear();
    this.timelineTracker = [];

    for (const story of stories) {
      await this.trackStoryElements(story);
    }
  }

  private async trackStoryElements(story: Story): Promise<void> {
    // Track characters
    for (const character of story.characters || []) {
      const trackingData = this.characterTracker.get(character.id) || {
        character,
        appearances: [],
        traits: new Map(),
        relationships: new Map(),
        abilities: new Map(),
        knowledge: new Map()
      };

      trackingData.appearances.push({
        storyId: story.id,
        storyTitle: story.title,
        sceneCount: this.countCharacterScenes(character.id, story.scenes || []),
        firstAppearance: this.findFirstAppearance(character.id, story.scenes || []),
        lastAppearance: this.findLastAppearance(character.id, story.scenes || []),
        role: this.determineCharacterRole(character, story),
        characterArc: await this.analyzeCharacterArc(character, story)
      });

      // Track character traits across stories
      await this.trackCharacterTraits(character, story, trackingData);

      this.characterTracker.set(character.id, trackingData);
    }

    // Track world elements
    await this.trackWorldElements(story);

    // Track timeline events
    await this.trackTimelineEvents(story);
  }

  private countCharacterScenes(characterId: string, scenes: Scene[]): number {
    return scenes.filter(scene => 
      scene.characters?.includes(characterId) || 
      scene.content?.toLowerCase().includes(this.getCharacterName(characterId).toLowerCase())
    ).length;
  }

  private findFirstAppearance(characterId: string, scenes: Scene[]): number {
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].characters?.includes(characterId) || 
          scenes[i].content?.toLowerCase().includes(this.getCharacterName(characterId).toLowerCase())) {
        return i;
      }
    }
    return -1;
  }

  private findLastAppearance(characterId: string, scenes: Scene[]): number {
    for (let i = scenes.length - 1; i >= 0; i--) {
      if (scenes[i].characters?.includes(characterId) || 
          scenes[i].content?.toLowerCase().includes(this.getCharacterName(characterId).toLowerCase())) {
        return i;
      }
    }
    return -1;
  }

  private getCharacterName(characterId: string): string {
    const trackingData = this.characterTracker.get(characterId);
    return trackingData?.character.name || characterId;
  }

  private determineCharacterRole(character: Character, story: Story): CharacterAppearance['role'] {
    const scenes = story.scenes || [];
    const appearances = this.countCharacterScenes(character.id, scenes);
    const totalScenes = scenes.length;

    if (appearances / totalScenes > 0.7) return 'protagonist';
    if (appearances / totalScenes > 0.4) return 'supporting';
    if (appearances / totalScenes > 0.1) return 'minor';
    
    // Check if character is antagonistic based on description or role
    const description = character.description?.toLowerCase() || '';
    if (description.includes('villain') || description.includes('antagonist') || description.includes('enemy')) {
      return 'antagonist';
    }

    return 'minor';
  }

  private async analyzeCharacterArc(character: Character, story: Story): Promise<string> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    
    const scenes = story.scenes || [];
    const characterScenes = scenes.filter(scene => 
      scene.characters?.includes(character.id) || 
      scene.content?.toLowerCase().includes(character.name.toLowerCase())
    );

    if (characterScenes.length === 0) return 'No significant arc';

    const prompt = `Analyze the character arc for ${character.name} in this story:

Character Description: ${character.description || 'No description provided'}

Key Scenes:
${characterScenes.slice(0, 5).map((scene, i) => `${i + 1}. ${scene.content?.substring(0, 200)}...`).join('\n')}

Provide a brief 1-2 sentence summary of the character's arc or development.`;

    const response = await provider.generateText({
      prompt,
      maxTokens: 100,
      temperature: 0.3
    });

    return response.text.trim();
  }

  private async trackCharacterTraits(character: Character, story: Story, trackingData: CrossStoryCharacterData): Promise<void> {
    const scenes = story.scenes || [];
    const characterScenes = scenes.filter(scene => 
      scene.characters?.includes(character.id) || 
      scene.content?.toLowerCase().includes(character.name.toLowerCase())
    );

    // Extract traits from character description
    if (character.description) {
      const traits = await this.extractTraitsFromText(character.description);
      for (const trait of traits) {
        const existing = trackingData.traits.get(trait) || [];
        existing.push({ storyId: story.id, source: 'description', context: character.description });
        trackingData.traits.set(trait, existing);
      }
    }

    // Extract traits from scenes
    for (const scene of characterScenes) {
      const traits = await this.extractTraitsFromText(scene.content || '');
      for (const trait of traits) {
        const existing = trackingData.traits.get(trait) || [];
        existing.push({ storyId: story.id, source: 'scene', context: scene.content || '' });
        trackingData.traits.set(trait, existing);
      }
    }
  }

  private async extractTraitsFromText(text: string): Promise<string[]> {
    const traitKeywords = [
      'brave', 'cowardly', 'kind', 'cruel', 'intelligent', 'foolish', 'strong', 'weak',
      'honest', 'deceitful', 'loyal', 'treacherous', 'calm', 'anxious', 'confident', 'insecure',
      'generous', 'selfish', 'patient', 'impatient', 'wise', 'naive', 'ambitious', 'lazy'
    ];

    const foundTraits: string[] = [];
    const lowerText = text.toLowerCase();

    for (const trait of traitKeywords) {
      if (lowerText.includes(trait)) {
        foundTraits.push(trait);
      }
    }

    return foundTraits;
  }

  private async trackWorldElements(story: Story): Promise<void> {
    const scenes = story.scenes || [];
    
    for (const scene of scenes) {
      const elements = await this.extractWorldElements(scene.content || '');
      
      for (const element of elements) {
        const trackingData = this.worldElementTracker.get(element.name) || {
          name: element.name,
          type: element.type,
          descriptions: [],
          rules: [],
          properties: new Map()
        };

        trackingData.descriptions.push({
          storyId: story.id,
          description: element.description,
          context: scene.content || ''
        });

        this.worldElementTracker.set(element.name, trackingData);
      }
    }
  }

  private async extractWorldElements(text: string): Promise<Array<{ name: string; type: string; description: string }>> {
    const elements: Array<{ name: string; type: string; description: string }> = [];
    
    // Extract locations
    const locationPattern = /(?:in|at|to|from)\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|\?|!)/g;
    let match;
    while ((match = locationPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 50) {
        elements.push({
          name,
          type: 'location',
          description: this.extractSurroundingContext(text, match.index, 100)
        });
      }
    }

    // Extract objects/artifacts
    const objectPattern = /(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s+(?:sword|ring|book|scroll|artifact|weapon|tool|device)/g;
    while ((match = objectPattern.exec(text)) !== null) {
      const name = match[1].trim() + ' ' + match[0].split(' ').pop();
      elements.push({
        name,
        type: 'object',
        description: this.extractSurroundingContext(text, match.index, 100)
      });
    }

    return elements;
  }

  private extractSurroundingContext(text: string, index: number, radius: number): string {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return text.substring(start, end).trim();
  }

  private async trackTimelineEvents(story: Story): Promise<void> {
    const scenes = story.scenes || [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const events = await this.extractTimelineEvents(scene.content || '', story.id, i);
      this.timelineTracker.push(...events);
    }
  }

  private async extractTimelineEvents(text: string, storyId: string, sceneIndex: number): Promise<CrossStoryTimelineData[]> {
    const events: CrossStoryTimelineData[] = [];
    
    // Extract temporal references
    const timePatterns = [
      /(?:after|before|during|while|when)\s+([^.!?]+)/gi,
      /(?:yesterday|today|tomorrow|last\s+\w+|next\s+\w+)/gi,
      /(?:\d+)\s+(?:days|weeks|months|years)\s+(?:ago|later|before|after)/gi
    ];

    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        events.push({
          event: match[0],
          storyId,
          sceneIndex,
          timestamp: this.parseTimestamp(match[0]),
          confidence: this.calculateTimestampConfidence(match[0])
        });
      }
    }

    return events;
  }

  private parseTimestamp(timeReference: string): string {
    // Simple timestamp parsing - in a real implementation, this would be more sophisticated
    const lowerRef = timeReference.toLowerCase();
    
    if (lowerRef.includes('before')) return 'past';
    if (lowerRef.includes('after')) return 'future';
    if (lowerRef.includes('during') || lowerRef.includes('while')) return 'concurrent';
    if (lowerRef.includes('yesterday')) return 'past_day';
    if (lowerRef.includes('tomorrow')) return 'future_day';
    if (lowerRef.includes('ago')) return 'past';
    if (lowerRef.includes('later')) return 'future';
    
    return 'present';
  }

  private calculateTimestampConfidence(timeReference: string): number {
    const lowerRef = timeReference.toLowerCase();
    
    // Specific time references have higher confidence
    if (lowerRef.match(/\d+\s+(?:days|weeks|months|years)/)) return 0.9;
    if (lowerRef.includes('yesterday') || lowerRef.includes('tomorrow')) return 0.8;
    if (lowerRef.includes('before') || lowerRef.includes('after')) return 0.7;
    if (lowerRef.includes('during') || lowerRef.includes('while')) return 0.6;
    
    return 0.5;
  }

  private async analyzeCharacterConsistency(stories: Story[]): Promise<CharacterConsistencyAnalysis[]> {
    const analyses: CharacterConsistencyAnalysis[] = [];

    for (const [characterId, trackingData] of this.characterTracker) {
      if (trackingData.appearances.length < 2) continue; // Skip characters that appear in only one story

      const inconsistencies = await this.findCharacterInconsistencies(trackingData);
      const consistencyScore = this.calculateCharacterConsistencyScore(inconsistencies);
      const evolution = await this.analyzeCharacterEvolution(trackingData);

      analyses.push({
        characterId,
        characterName: trackingData.character.name,
        consistencyScore,
        evolution,
        inconsistencies,
        appearances: trackingData.appearances
      });
    }

    return analyses;
  }

  private async findCharacterInconsistencies(trackingData: CrossStoryCharacterData): Promise<CharacterInconsistency[]> {
    const inconsistencies: CharacterInconsistency[] = [];

    // Check trait consistency
    for (const [trait, occurrences] of trackingData.traits) {
      const stories = [...new Set(occurrences.map(o => o.storyId))];
      if (stories.length > 1) {
        // Check if trait is consistently applied
        const contexts = occurrences.map(o => o.context);
        const conflicting = await this.detectConflictingTraitUsage(trait, contexts);
        
        if (conflicting.length > 0) {
          inconsistencies.push({
            type: 'personality',
            description: `Inconsistent portrayal of trait "${trait}" across stories`,
            conflictingStories: stories,
            severity: 'medium',
            evidence: conflicting,
            suggestions: [
              `Ensure consistent portrayal of ${trait} trait`,
              'Review character development to explain any changes',
              'Consider if trait evolution is intentional'
            ]
          });
        }
      }
    }

    return inconsistencies;
  }

  private async detectConflictingTraitUsage(trait: string, contexts: string[]): Promise<string[]> {
    // Simple conflict detection - in a real implementation, this would use AI analysis
    const conflicting: string[] = [];
    
    const oppositeTrait = this.getOppositeTrait(trait);
    if (oppositeTrait) {
      for (const context of contexts) {
        if (context.toLowerCase().includes(oppositeTrait.toLowerCase())) {
          conflicting.push(context);
        }
      }
    }

    return conflicting;
  }

  private getOppositeTrait(trait: string): string | null {
    const opposites: { [key: string]: string } = {
      'brave': 'cowardly',
      'cowardly': 'brave',
      'kind': 'cruel',
      'cruel': 'kind',
      'intelligent': 'foolish',
      'foolish': 'intelligent',
      'strong': 'weak',
      'weak': 'strong',
      'honest': 'deceitful',
      'deceitful': 'honest',
      'loyal': 'treacherous',
      'treacherous': 'loyal',
      'calm': 'anxious',
      'anxious': 'calm',
      'confident': 'insecure',
      'insecure': 'confident'
    };

    return opposites[trait] || null;
  }

  private calculateCharacterConsistencyScore(inconsistencies: CharacterInconsistency[]): number {
    let score = 100;
    
    for (const inconsistency of inconsistencies) {
      switch (inconsistency.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  private async analyzeCharacterEvolution(trackingData: CrossStoryCharacterData): Promise<CharacterEvolution> {
    const appearances = trackingData.appearances.sort((a, b) => 
      a.storyId.localeCompare(b.storyId) // Simple sorting - in reality, would use story chronology
    );

    return {
      characterId: trackingData.character.id,
      evolutionType: this.determineEvolutionType(appearances),
      keyChanges: await this.identifyKeyChanges(trackingData),
      consistency: this.calculateEvolutionConsistency(trackingData),
      timeline: appearances.map(app => ({
        storyId: app.storyId,
        role: app.role,
        arc: app.characterArc,
        significance: this.calculateSignificance(app)
      }))
    };
  }

  private determineEvolutionType(appearances: CharacterAppearance[]): CharacterEvolution['evolutionType'] {
    if (appearances.length < 2) return 'static';
    
    const roles = appearances.map(app => app.role);
    const uniqueRoles = [...new Set(roles)];
    
    if (uniqueRoles.length === 1) return 'static';
    if (roles[0] === 'minor' && roles[roles.length - 1] === 'protagonist') return 'growth';
    if (roles[0] === 'protagonist' && roles[roles.length - 1] === 'minor') return 'decline';
    
    return 'dynamic';
  }

  private async identifyKeyChanges(trackingData: CrossStoryCharacterData): Promise<string[]> {
    const changes: string[] = [];
    
    // Analyze trait changes across stories
    for (const [trait, occurrences] of trackingData.traits) {
      const stories = [...new Set(occurrences.map(o => o.storyId))];
      if (stories.length > 1) {
        changes.push(`Development of ${trait} trait across multiple stories`);
      }
    }

    return changes;
  }

  private calculateEvolutionConsistency(trackingData: CrossStoryCharacterData): number {
    // Simple consistency calculation based on trait stability
    let consistentTraits = 0;
    let totalTraits = 0;

    for (const [trait, occurrences] of trackingData.traits) {
      totalTraits++;
      const stories = [...new Set(occurrences.map(o => o.storyId))];
      if (stories.length > 1) {
        // Check if trait usage is consistent across stories
        const contexts = occurrences.map(o => o.context);
        const hasConflicts = contexts.some(context => 
          context.toLowerCase().includes('not ' + trait) || 
          context.toLowerCase().includes('un' + trait)
        );
        
        if (!hasConflicts) {
          consistentTraits++;
        }
      } else {
        consistentTraits++; // Single story traits are considered consistent
      }
    }

    return totalTraits > 0 ? (consistentTraits / totalTraits) * 100 : 100;
  }

  private calculateSignificance(appearance: CharacterAppearance): number {
    let significance = 0;
    
    // Role-based significance
    switch (appearance.role) {
      case 'protagonist': significance += 40; break;
      case 'antagonist': significance += 35; break;
      case 'supporting': significance += 20; break;
      case 'minor': significance += 5; break;
    }
    
    // Scene count significance
    significance += Math.min(30, appearance.sceneCount * 2);
    
    // Character arc significance
    if (appearance.characterArc && appearance.characterArc !== 'No significant arc') {
      significance += 20;
    }

    return Math.min(100, significance);
  }

  private async analyzeWorldConsistency(stories: Story[]): Promise<WorldConsistencyAnalysis> {
    const locations = await this.analyzeLocationConsistency();
    const rules = await this.analyzeWorldRuleConsistency();
    const technology = await this.analyzeTechnologyConsistency();
    const magic = await this.analyzeMagicSystemConsistency();
    
    const inconsistencies = this.compileWorldInconsistencies(locations, rules, technology, magic);
    const consistencyScore = this.calculateWorldConsistencyScore(inconsistencies);

    return {
      consistencyScore,
      locations,
      rules,
      technology,
      magic,
      inconsistencies
    };
  }

  private async analyzeLocationConsistency(): Promise<LocationConsistency[]> {
    const locationAnalyses: LocationConsistency[] = [];

    for (const [name, trackingData] of this.worldElementTracker) {
      if (trackingData.type !== 'location') continue;

      const descriptions = trackingData.descriptions.map(desc => ({
        storyId: desc.storyId,
        description: desc.description
      }));

      const conflicts = await this.findLocationConflicts(descriptions);
      const consistencyScore = this.calculateLocationConsistencyScore(conflicts);

      locationAnalyses.push({
        name,
        descriptions,
        consistencyScore,
        conflicts
      });
    }

    return locationAnalyses;
  }

  private async findLocationConflicts(descriptions: Array<{ storyId: string; description: string }>): Promise<string[]> {
    const conflicts: string[] = [];
    
    // Simple conflict detection - compare descriptions for contradictions
    for (let i = 0; i < descriptions.length; i++) {
      for (let j = i + 1; j < descriptions.length; j++) {
        const desc1 = descriptions[i].description.toLowerCase();
        const desc2 = descriptions[j].description.toLowerCase();
        
        // Check for contradictory descriptors
        const contradictions = [
          ['large', 'small'], ['big', 'tiny'], ['bright', 'dark'],
          ['new', 'old'], ['clean', 'dirty'], ['beautiful', 'ugly']
        ];

        for (const [word1, word2] of contradictions) {
          if ((desc1.includes(word1) && desc2.includes(word2)) ||
              (desc1.includes(word2) && desc2.includes(word1))) {
            conflicts.push(`Contradictory descriptions: "${word1}" vs "${word2}"`);
          }
        }
      }
    }

    return conflicts;
  }

  private calculateLocationConsistencyScore(conflicts: string[]): number {
    return Math.max(0, 100 - (conflicts.length * 20));
  }

  private async analyzeWorldRuleConsistency(): Promise<WorldRuleConsistency[]> {
    // Placeholder implementation - would analyze magic systems, physics, etc.
    return [];
  }

  private async analyzeTechnologyConsistency(): Promise<TechnologyConsistency[]> {
    // Placeholder implementation - would analyze technology levels across stories
    return [];
  }

  private async analyzeMagicSystemConsistency(): Promise<MagicSystemConsistency[]> {
    // Placeholder implementation - would analyze magic system rules
    return [];
  }

  private compileWorldInconsistencies(
    locations: LocationConsistency[],
    rules: WorldRuleConsistency[],
    technology: TechnologyConsistency[],
    magic: MagicSystemConsistency[]
  ): WorldInconsistency[] {
    const inconsistencies: WorldInconsistency[] = [];

    // Add location inconsistencies
    for (const location of locations) {
      if (location.conflicts.length > 0) {
        inconsistencies.push({
          type: 'location',
          element: location.name,
          description: `Location "${location.name}" has conflicting descriptions`,
          conflicts: location.conflicts,
          severity: location.conflicts.length > 2 ? 'high' : 'medium',
          affectedStories: location.descriptions.map(d => d.storyId)
        });
      }
    }

    return inconsistencies;
  }

  private calculateWorldConsistencyScore(inconsistencies: WorldInconsistency[]): number {
    let score = 100;
    
    for (const inconsistency of inconsistencies) {
      switch (inconsistency.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  private async analyzeTimelineConsistency(stories: Story[]): Promise<TimelineConsistencyAnalysis> {
    const chronology = this.buildChronology();
    const conflicts = await this.findTimelineConflicts(chronology);
    const gaps = this.identifyTimelineGaps(chronology);
    const consistencyScore = this.calculateTimelineConsistencyScore(conflicts, gaps);

    return {
      consistencyScore,
      chronology,
      conflicts,
      gaps
    };
  }

  private buildChronology(): ChronologicalEvent[] {
    return this.timelineTracker
      .map(event => ({
        event: event.event,
        storyId: event.storyId,
        timestamp: event.timestamp,
        relativeOrder: this.calculateRelativeOrder(event),
        confidence: event.confidence
      }))
      .sort((a, b) => a.relativeOrder - b.relativeOrder);
  }

  private calculateRelativeOrder(event: CrossStoryTimelineData): number {
    // Simple ordering based on timestamp type
    const orderMap: { [key: string]: number } = {
      'past': -2,
      'past_day': -1,
      'present': 0,
      'concurrent': 0,
      'future_day': 1,
      'future': 2
    };

    return orderMap[event.timestamp] || 0;
  }

  private async findTimelineConflicts(chronology: ChronologicalEvent[]): Promise<TimelineConflict[]> {
    const conflicts: TimelineConflict[] = [];
    
    // Look for events that contradict each other temporally
    for (let i = 0; i < chronology.length; i++) {
      for (let j = i + 1; j < chronology.length; j++) {
        const event1 = chronology[i];
        const event2 = chronology[j];
        
        if (event1.storyId !== event2.storyId && 
            event1.relativeOrder > event2.relativeOrder &&
            event1.confidence > 0.7 && event2.confidence > 0.7) {
          
          conflicts.push({
            description: `Timeline conflict between stories`,
            conflictingEvents: [event1, event2],
            severity: 'medium',
            resolution: [
              'Review the chronological order of events',
              'Adjust timeline references for consistency',
              'Consider if events occur in parallel timelines'
            ]
          });
        }
      }
    }

    return conflicts;
  }

  private identifyTimelineGaps(chronology: ChronologicalEvent[]): TimelineGap[] {
    // Placeholder implementation - would identify missing time periods
    return [];
  }

  private calculateTimelineConsistencyScore(conflicts: TimelineConflict[], gaps: TimelineGap[]): number {
    let score = 100;
    
    score -= conflicts.length * 15;
    score -= gaps.length * 10;
    
    return Math.max(0, score);
  }

  private async analyzeThemeConsistency(stories: Story[]): Promise<ThemeConsistencyAnalysis> {
    const coreThemes = await this.identifyCoreThemes(stories);
    const themeEvolution = await this.analyzeThemeEvolution(coreThemes, stories);
    const contradictions = await this.findThemeContradictions(coreThemes);
    const consistencyScore = this.calculateThemeConsistencyScore(contradictions);

    return {
      consistencyScore,
      coreThemes,
      themeEvolution,
      contradictions
    };
  }

  private async identifyCoreThemes(stories: Story[]): Promise<ThemeAnalysis[]> {
    const provider = await this.aiRegistry.getProvider('cowriter');
    const themes: ThemeAnalysis[] = [];

    for (const story of stories) {
      const prompt = `Identify the main themes in this story:

Title: ${story.title}
Summary: ${story.summary || 'No summary provided'}
Genre: ${story.genre || 'Unknown'}

First few scenes:
${(story.scenes || []).slice(0, 3).map(scene => scene.content?.substring(0, 200)).join('\n')}

List 3-5 main themes, each on a new line.`;

      const response = await provider.generateText({
        prompt,
        maxTokens: 200,
        temperature: 0.3
      });

      const storyThemes = response.text.split('\n')
        .filter(line => line.trim())
        .map(theme => theme.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 5);

      for (const theme of storyThemes) {
        const existing = themes.find(t => t.theme.toLowerCase() === theme.toLowerCase());
        if (existing) {
          existing.stories.push({ storyId: story.id, presence: 8 }); // High presence since it's a main theme
          existing.strength = Math.min(10, existing.strength + 1);
        } else {
          themes.push({
            theme,
            strength: 7,
            stories: [{ storyId: story.id, presence: 8 }],
            development: `Theme appears in ${story.title}`
          });
        }
      }
    }

    return themes.sort((a, b) => b.strength - a.strength);
  }

  private async analyzeThemeEvolution(themes: ThemeAnalysis[], stories: Story[]): Promise<ThemeEvolution[]> {
    // Placeholder implementation - would analyze how themes develop across stories
    return [];
  }

  private async findThemeContradictions(themes: ThemeAnalysis[]): Promise<ThemeContradiction[]> {
    // Placeholder implementation - would find contradictory themes
    return [];
  }

  private calculateThemeConsistencyScore(contradictions: ThemeContradiction[]): number {
    return Math.max(0, 100 - (contradictions.length * 20));
  }

  private compileInconsistencies(
    characterConsistency: CharacterConsistencyAnalysis[],
    worldConsistency: WorldConsistencyAnalysis,
    timelineConsistency: TimelineConsistencyAnalysis,
    themeConsistency: ThemeConsistencyAnalysis
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Add character inconsistencies
    for (const charAnalysis of characterConsistency) {
      for (const inconsistency of charAnalysis.inconsistencies) {
        issues.push({
          id: `char_${charAnalysis.characterId}_${issues.length}`,
          type: 'character',
          severity: inconsistency.severity,
          title: `Character Inconsistency: ${charAnalysis.characterName}`,
          description: inconsistency.description,
          affectedStories: inconsistency.conflictingStories,
          evidence: inconsistency.evidence,
          suggestions: inconsistency.suggestions
        });
      }
    }

    // Add world inconsistencies
    for (const inconsistency of worldConsistency.inconsistencies) {
      issues.push({
        id: `world_${issues.length}`,
        type: 'world',
        severity: inconsistency.severity,
        title: `World Inconsistency: ${inconsistency.element}`,
        description: inconsistency.description,
        affectedStories: inconsistency.affectedStories,
        evidence: inconsistency.conflicts,
        suggestions: ['Review world-building elements for consistency', 'Create a world bible for reference']
      });
    }

    // Add timeline inconsistencies
    for (const conflict of timelineConsistency.conflicts) {
      issues.push({
        id: `timeline_${issues.length}`,
        type: 'timeline',
        severity: conflict.severity,
        title: 'Timeline Inconsistency',
        description: conflict.description,
        affectedStories: conflict.conflictingEvents.map(e => e.storyId),
        evidence: conflict.conflictingEvents.map(e => e.event),
        suggestions: conflict.resolution
      });
    }

    return issues;
  }

  private calculateOverallConsistency(
    characterConsistency: CharacterConsistencyAnalysis[],
    worldConsistency: WorldConsistencyAnalysis,
    timelineConsistency: TimelineConsistencyAnalysis,
    themeConsistency: ThemeConsistencyAnalysis
  ): number {
    const scores = [
      characterConsistency.length > 0 ? 
        characterConsistency.reduce((sum, c) => sum + c.consistencyScore, 0) / characterConsistency.length : 100,
      worldConsistency.consistencyScore,
      timelineConsistency.consistencyScore,
      themeConsistency.consistencyScore
    ];

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private async generateConsistencyRecommendations(
    inconsistencies: ConsistencyIssue[],
    characterConsistency: CharacterConsistencyAnalysis[],
    worldConsistency: WorldConsistencyAnalysis
  ): Promise<ConsistencyRecommendation[]> {
    const recommendations: ConsistencyRecommendation[] = [];

    // Generate recommendations based on inconsistencies
    const highPriorityIssues = inconsistencies.filter(i => i.severity === 'high' || i.severity === 'critical');
    
    if (highPriorityIssues.length > 0) {
      recommendations.push({
        type: 'character',
        priority: 'high',
        title: 'Address Critical Inconsistencies',
        description: `Found ${highPriorityIssues.length} high-priority consistency issues that need immediate attention`,
        affectedStories: [...new Set(highPriorityIssues.flatMap(i => i.affectedStories))],
        implementation: [
          'Review each high-priority inconsistency individually',
          'Create character and world reference documents',
          'Establish clear timelines for story events',
          'Consider retconning or explaining inconsistencies in-story'
        ],
        impact: 'Significantly improved story coherence and reader experience'
      });
    }

    // Character-specific recommendations
    const inconsistentCharacters = characterConsistency.filter(c => c.consistencyScore < 70);
    if (inconsistentCharacters.length > 0) {
      recommendations.push({
        type: 'character',
        priority: 'medium',
        title: 'Improve Character Consistency',
        description: `${inconsistentCharacters.length} characters show consistency issues across stories`,
        affectedStories: [...new Set(inconsistentCharacters.flatMap(c => c.appearances.map(a => a.storyId)))],
        implementation: [
          'Create detailed character profiles and trait lists',
          'Track character development across stories',
          'Ensure character growth is logical and well-motivated',
          'Review character voice and dialogue consistency'
        ],
        impact: 'More believable and engaging character development'
      });
    }

    // World consistency recommendations
    if (worldConsistency.consistencyScore < 80) {
      recommendations.push({
        type: 'world',
        priority: 'medium',
        title: 'Strengthen World Consistency',
        description: 'World-building elements show inconsistencies across stories',
        affectedStories: [...new Set(worldConsistency.inconsistencies.flatMap(i => i.affectedStories))],
        implementation: [
          'Create a comprehensive world bible',
          'Document all locations, rules, and systems',
          'Establish clear world-building guidelines',
          'Review and reconcile conflicting descriptions'
        ],
        impact: 'More immersive and believable story world'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Public API methods
  async validateCrossStoryConsistency(stories: Story[]): Promise<{ consistent: boolean; issues: string[] }> {
    const analysis = await this.analyzeStoryConsistency(stories);
    const issues: string[] = [];

    if (analysis.overallConsistency < 70) {
      issues.push(`Overall consistency score is low: ${analysis.overallConsistency}%`);
    }

    const criticalIssues = analysis.inconsistencies.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      issues.push(`Found ${criticalIssues.length} critical consistency issues`);
    }

    const highIssues = analysis.inconsistencies.filter(i => i.severity === 'high');
    if (highIssues.length > 0) {
      issues.push(`Found ${highIssues.length} high-priority consistency issues`);
    }

    return {
      consistent: analysis.overallConsistency >= 80 && criticalIssues.length === 0,
      issues
    };
  }

  async getCharacterEvolution(characterId: string, stories: Story[]): Promise<CharacterEvolution | null> {
    await this.initializeTracking(stories);
    const trackingData = this.characterTracker.get(characterId);
    
    if (!trackingData || trackingData.appearances.length < 2) {
      return null;
    }

    return await this.analyzeCharacterEvolution(trackingData);
  }
}

// Helper interfaces and types
interface CrossStoryCharacterData {
  character: Character;
  appearances: CharacterAppearance[];
  traits: Map<string, Array<{ storyId: string; source: string; context: string }>>;
  relationships: Map<string, Array<{ storyId: string; relationship: string; context: string }>>;
  abilities: Map<string, Array<{ storyId: string; ability: string; context: string }>>;
  knowledge: Map<string, Array<{ storyId: string; knowledge: string; context: string }>>;
}

interface CrossStoryWorldData {
  name: string;
  type: string;
  descriptions: Array<{ storyId: string; description: string; context: string }>;
  rules: Array<{ storyId: string; rule: string; context: string }>;
  properties: Map<string, Array<{ storyId: string; value: string; context: string }>>;
}

interface CrossStoryTimelineData {
  event: string;
  storyId: string;
  sceneIndex: number;
  timestamp: string;
  confidence: number;
}

interface TechnologyConsistency {
  technology: string;
  level: string;
  applications: Array<{ storyId: string; usage: string }>;
  consistencyScore: number;
  conflicts: string[];
}

interface MagicSystemConsistency {
  system: string;
  rules: Array<{ rule: string; storyId: string }>;
  consistencyScore: number;
  violations: string[];
}

interface WorldInconsistency {
  type: 'location' | 'rule' | 'technology' | 'magic';
  element: string;
  description: string;
  conflicts: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedStories: string[];
}

interface ThemeEvolution {
  theme: string;
  progression: Array<{ storyId: string; development: string }>;
  consistency: number;
}

interface ThemeContradiction {
  theme1: string;
  theme2: string;
  description: string;
  conflictingStories: string[];
  severity: 'low' | 'medium' | 'high';
}

interface TimelineGap {
  description: string;
  missingPeriod: string;
  affectedStories: string[];
  significance: 'low' | 'medium' | 'high';
}