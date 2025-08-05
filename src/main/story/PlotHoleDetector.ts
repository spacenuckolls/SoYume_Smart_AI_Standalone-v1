import { Story, Scene, Character, PlotHole, PlotThread, StoryElement } from '../../shared/types/Story';

export interface PlotHoleAnalysisResult {
  plotHoles: PlotHole[];
  plotThreads: PlotThread[];
  continuityIssues: ContinuityIssue[];
  characterInconsistencies: CharacterInconsistency[];
  suggestions: PlotHoleSuggestion[];
  overallScore: number;
}

export interface ContinuityIssue {
  id: string;
  type: 'timeline' | 'location' | 'object' | 'ability' | 'knowledge';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  scenes: number[];
  conflictingElements: string[];
  suggestions: string[];
}

export interface CharacterInconsistency {
  id: string;
  characterId: string;
  characterName: string;
  type: 'personality' | 'motivation' | 'ability' | 'knowledge' | 'relationship';
  severity: 'low' | 'medium' | 'high';
  description: string;
  scenes: number[];
  conflictingTraits: string[];
  suggestions: string[];
}

export interface PlotHoleSuggestion {
  id: string;
  type: 'add_scene' | 'modify_scene' | 'add_dialogue' | 'character_development' | 'world_building';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  targetScene?: number;
  implementation: string[];
  relatedPlotHoles: string[];
}

export interface PlotThreadTracker {
  id: string;
  name: string;
  description: string;
  introduced: number; // Scene index
  resolved?: number; // Scene index
  status: 'active' | 'resolved' | 'abandoned' | 'forgotten';
  importance: 'minor' | 'major' | 'critical';
  relatedCharacters: string[];
  keyScenes: number[];
}

export class PlotHoleDetector {
  private plotThreads: Map<string, PlotThreadTracker> = new Map();
  private characterStates: Map<string, CharacterStateTracker> = new Map();
  private worldElements: Map<string, WorldElementTracker> = new Map();
  private timelineEvents: TimelineEvent[] = [];

  async analyzeStoryForPlotHoles(story: Story): Promise<PlotHoleAnalysisResult> {
    // Initialize tracking structures
    this.initializeTracking(story);
    
    // Analyze each scene
    for (let i = 0; i < (story.scenes || []).length; i++) {
      await this.analyzeScene(story.scenes![i], i, story);
    }
    
    // Detect issues
    const plotHoles = await this.detectPlotHoles();
    const continuityIssues = await this.detectContinuityIssues();
    const characterInconsistencies = await this.detectCharacterInconsistencies();
    
    // Generate suggestions
    const suggestions = await this.generateSuggestions(plotHoles, continuityIssues, characterInconsistencies);
    
    // Calculate overall score
    const overallScore = this.calculateConsistencyScore(plotHoles, continuityIssues, characterInconsistencies);
    
    return {
      plotHoles,
      plotThreads: Array.from(this.plotThreads.values()).map(t => this.convertToPlotThread(t)),
      continuityIssues,
      characterInconsistencies,
      suggestions,
      overallScore
    };
  }

  private initializeTracking(story: Story): void {
    // Initialize character state tracking
    for (const character of story.characters || []) {
      this.characterStates.set(character.id, new CharacterStateTracker(character));
    }
    
    // Initialize world element tracking
    const worldElements = this.extractWorldElements(story);
    for (const element of worldElements) {
      this.worldElements.set(element, new WorldElementTracker(element));
    }
    
    // Clear previous analysis
    this.plotThreads.clear();
    this.timelineEvents = [];
  }

  private extractWorldElements(story: Story): string[] {
    // Extract important world elements from story metadata and scenes
    const elements: Set<string> = new Set();
    
    // Add elements from story metadata
    if (story.worldBuilding) {
      for (const location of story.worldBuilding.locations || []) {
        elements.add(location.name);
      }
      for (const item of story.worldBuilding.items || []) {
        elements.add(item.name);
      }
    }
    
    // Add frequently mentioned elements from scenes
    const wordCounts: Map<string, number> = new Map();
    for (const scene of story.scenes || []) {
      const words = (scene.content || '').toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) { // Only consider longer words
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }
    
    // Add words that appear frequently (potential world elements)
    for (const [word, count] of wordCounts) {
      if (count >= 3) { // Appears in multiple scenes
        elements.add(word);
      }
    }
    
    return Array.from(elements);
  }

  private async analyzeScene(scene: Scene, sceneIndex: number, story: Story): Promise<void> {
    const content = scene.content || '';
    
    // Track plot threads
    await this.trackPlotThreads(scene, sceneIndex, content);
    
    // Update character states
    await this.updateCharacterStates(scene, sceneIndex, content, story.characters || []);
    
    // Track world elements
    await this.trackWorldElements(scene, sceneIndex, content);
    
    // Record timeline events
    await this.recordTimelineEvents(scene, sceneIndex, content);
  }

  private async trackPlotThreads(scene: Scene, sceneIndex: number, content: string): Promise<void> {
    // Detect new plot threads being introduced
    const newThreads = await this.detectNewPlotThreads(content, sceneIndex);
    for (const thread of newThreads) {
      this.plotThreads.set(thread.id, thread);
    }
    
    // Update existing plot threads
    for (const [threadId, thread] of this.plotThreads) {
      const isReferenced = await this.isPlotThreadReferenced(content, thread);
      if (isReferenced) {
        thread.keyScenes.push(sceneIndex);
        
        // Check if thread is being resolved
        const isResolved = await this.isPlotThreadResolved(content, thread);
        if (isResolved && thread.status === 'active') {
          thread.resolved = sceneIndex;
          thread.status = 'resolved';
        }
      }
    }
  }

  private async detectNewPlotThreads(content: string, sceneIndex: number): Promise<PlotThreadTracker[]> {
    const threads: PlotThreadTracker[] = [];
    
    // Detect mystery/question introductions
    const mysteryPatterns = [
      /(?:what|who|why|how|where|when)\s+(?:is|was|did|happened|caused)/gi,
      /(?:mystery|secret|hidden|unknown|missing)/gi,
      /(?:must find|need to discover|have to learn)/gi
    ];
    
    for (const pattern of mysteryPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const threadId = `mystery_${sceneIndex}_${threads.length}`;
          threads.push({
            id: threadId,
            name: `Mystery: ${match}`,
            description: `Plot thread introduced in scene ${sceneIndex}: ${match}`,
            introduced: sceneIndex,
            status: 'active',
            importance: 'major',
            relatedCharacters: [],
            keyScenes: [sceneIndex]
          });
        }
      }
    }
    
    // Detect conflict introductions
    const conflictPatterns = [
      /(?:conflict|fight|battle|war|struggle|oppose)/gi,
      /(?:enemy|villain|antagonist|rival)/gi,
      /(?:must stop|have to prevent|need to defeat)/gi
    ];
    
    for (const pattern of conflictPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const threadId = `conflict_${sceneIndex}_${threads.length}`;
          threads.push({
            id: threadId,
            name: `Conflict: ${match}`,
            description: `Conflict thread introduced in scene ${sceneIndex}: ${match}`,
            introduced: sceneIndex,
            status: 'active',
            importance: 'major',
            relatedCharacters: [],
            keyScenes: [sceneIndex]
          });
        }
      }
    }
    
    return threads;
  }

  private async isPlotThreadReferenced(content: string, thread: PlotThreadTracker): Promise<boolean> {
    const threadKeywords = thread.name.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    // Check if any thread keywords appear in the content
    return threadKeywords.some(keyword => contentLower.includes(keyword));
  }

  private async isPlotThreadResolved(content: string, thread: PlotThreadTracker): Promise<boolean> {
    const resolutionPatterns = [
      /(?:solved|resolved|answered|discovered|found|defeated|stopped)/gi,
      /(?:finally|at last|in the end|ultimately)/gi,
      /(?:mystery.*solved|question.*answered|conflict.*resolved)/gi
    ];
    
    for (const pattern of resolutionPatterns) {
      if (pattern.test(content)) {
        // Check if the resolution relates to this thread
        const threadKeywords = thread.name.toLowerCase().split(/\s+/);
        const contentLower = content.toLowerCase();
        
        if (threadKeywords.some(keyword => contentLower.includes(keyword))) {
          return true;
        }
      }
    }
    
    return false;
  }

  private async updateCharacterStates(scene: Scene, sceneIndex: number, content: string, characters: Character[]): Promise<void> {
    for (const character of characters) {
      const tracker = this.characterStates.get(character.id);
      if (!tracker) continue;
      
      // Check if character is present in scene
      const isPresent = await this.isCharacterPresent(content, character);
      if (isPresent) {
        tracker.recordPresence(sceneIndex);
        
        // Update character knowledge
        await this.updateCharacterKnowledge(tracker, content, sceneIndex);
        
        // Update character abilities
        await this.updateCharacterAbilities(tracker, content, sceneIndex);
        
        // Update character relationships
        await this.updateCharacterRelationships(tracker, content, sceneIndex, characters);
      }
    }
  }

  private async isCharacterPresent(content: string, character: Character): Promise<boolean> {
    const names = [character.name, ...(character.aliases || [])];
    const contentLower = content.toLowerCase();
    
    return names.some(name => contentLower.includes(name.toLowerCase()));
  }

  private async updateCharacterKnowledge(tracker: CharacterStateTracker, content: string, sceneIndex: number): Promise<void> {
    // Detect knowledge acquisition patterns
    const knowledgePatterns = [
      /(?:learned|discovered|found out|realized|understood)\s+(?:that\s+)?([^.!?]+)/gi,
      /(?:knows|aware|informed)\s+(?:that\s+)?([^.!?]+)/gi
    ];
    
    for (const pattern of knowledgePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        tracker.addKnowledge(match[1].trim(), sceneIndex);
      }
    }
  }

  private async updateCharacterAbilities(tracker: CharacterStateTracker, content: string, sceneIndex: number): Promise<void> {
    // Detect ability demonstrations or acquisitions
    const abilityPatterns = [
      /(?:can|able to|capable of)\s+([^.!?]+)/gi,
      /(?:learned to|mastered|gained the ability)\s+([^.!?]+)/gi,
      /(?:cast|performed|used)\s+([^.!?]+)/gi
    ];
    
    for (const pattern of abilityPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        tracker.addAbility(match[1].trim(), sceneIndex);
      }
    }
  }

  private async updateCharacterRelationships(tracker: CharacterStateTracker, content: string, sceneIndex: number, characters: Character[]): Promise<void> {
    // Detect relationship changes
    const relationshipPatterns = [
      /(?:loves|hates|trusts|distrusts|befriends|betrays)\s+([A-Z][a-z]+)/gi,
      /(?:ally|enemy|friend|rival)\s+(?:of\s+)?([A-Z][a-z]+)/gi
    ];
    
    for (const pattern of relationshipPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const otherCharacterName = match[1];
        const otherCharacter = characters.find(c => 
          c.name.toLowerCase() === otherCharacterName.toLowerCase() ||
          (c.aliases || []).some(alias => alias.toLowerCase() === otherCharacterName.toLowerCase())
        );
        
        if (otherCharacter) {
          tracker.updateRelationship(otherCharacter.id, content, sceneIndex);
        }
      }
    }
  }

  private async trackWorldElements(scene: Scene, sceneIndex: number, content: string): Promise<void> {
    for (const [elementName, tracker] of this.worldElements) {
      if (content.toLowerCase().includes(elementName.toLowerCase())) {
        tracker.recordAppearance(sceneIndex, content);
      }
    }
  }

  private async recordTimelineEvents(scene: Scene, sceneIndex: number, content: string): Promise<void> {
    // Extract temporal references
    const timePatterns = [
      /(?:after|before|during|while|when)\s+([^.!?]+)/gi,
      /(?:yesterday|today|tomorrow|last week|next month)/gi,
      /(?:\d+)\s+(?:days|weeks|months|years)\s+(?:ago|later)/gi
    ];
    
    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        this.timelineEvents.push({
          sceneIndex,
          description: match[0],
          type: 'temporal_reference',
          timestamp: this.extractTimestamp(match[0])
        });
      }
    }
  }

  private extractTimestamp(timeReference: string): number {
    // Simple timestamp extraction - in a real implementation, this would be more sophisticated
    const lowerRef = timeReference.toLowerCase();
    
    if (lowerRef.includes('ago')) {
      const match = lowerRef.match(/(\d+)\s+(?:days|weeks|months|years)\s+ago/);
      if (match) {
        const amount = parseInt(match[1]);
        if (lowerRef.includes('days')) return -amount;
        if (lowerRef.includes('weeks')) return -amount * 7;
        if (lowerRef.includes('months')) return -amount * 30;
        if (lowerRef.includes('years')) return -amount * 365;
      }
    }
    
    if (lowerRef.includes('later')) {
      const match = lowerRef.match(/(\d+)\s+(?:days|weeks|months|years)\s+later/);
      if (match) {
        const amount = parseInt(match[1]);
        if (lowerRef.includes('days')) return amount;
        if (lowerRef.includes('weeks')) return amount * 7;
        if (lowerRef.includes('months')) return amount * 30;
        if (lowerRef.includes('years')) return amount * 365;
      }
    }
    
    return 0; // Present time
  }

  private async detectPlotHoles(): Promise<PlotHole[]> {
    const plotHoles: PlotHole[] = [];
    
    // Detect unresolved plot threads
    for (const [threadId, thread] of this.plotThreads) {
      if (thread.status === 'active' && thread.importance === 'major') {
        plotHoles.push({
          id: `unresolved_${threadId}`,
          type: 'unresolved_thread',
          severity: 'high',
          description: `Major plot thread "${thread.name}" introduced in scene ${thread.introduced} but never resolved`,
          scenes: thread.keyScenes,
          suggestions: [
            `Add a resolution scene for the ${thread.name} plot thread`,
            'Provide closure or explanation for this story element',
            'Consider if this thread is necessary for the story'
          ]
        });
      }
    }
    
    // Detect character knowledge inconsistencies
    for (const [characterId, tracker] of this.characterStates) {
      const inconsistencies = tracker.detectKnowledgeInconsistencies();
      for (const inconsistency of inconsistencies) {
        plotHoles.push({
          id: `knowledge_${characterId}_${plotHoles.length}`,
          type: 'character_knowledge',
          severity: 'medium',
          description: `Character ${tracker.character.name} ${inconsistency.description}`,
          scenes: inconsistency.scenes,
          suggestions: [
            'Add a scene showing how the character acquired this knowledge',
            'Remove the knowledge reference if it\'s not needed',
            'Establish the knowledge earlier in the story'
          ]
        });
      }
    }
    
    // Detect ability inconsistencies
    for (const [characterId, tracker] of this.characterStates) {
      const inconsistencies = tracker.detectAbilityInconsistencies();
      for (const inconsistency of inconsistencies) {
        plotHoles.push({
          id: `ability_${characterId}_${plotHoles.length}`,
          type: 'character_ability',
          severity: 'medium',
          description: `Character ${tracker.character.name} ${inconsistency.description}`,
          scenes: inconsistency.scenes,
          suggestions: [
            'Show the character learning or acquiring this ability',
            'Establish the ability earlier in the story',
            'Provide explanation for the ability\'s sudden appearance'
          ]
        });
      }
    }
    
    return plotHoles;
  }

  private async detectContinuityIssues(): Promise<ContinuityIssue[]> {
    const issues: ContinuityIssue[] = [];
    
    // Detect timeline inconsistencies
    const timelineIssues = this.detectTimelineInconsistencies();
    issues.push(...timelineIssues);
    
    // Detect world element inconsistencies
    const worldIssues = this.detectWorldElementInconsistencies();
    issues.push(...worldIssues);
    
    return issues;
  }

  private detectTimelineInconsistencies(): ContinuityIssue[] {
    const issues: ContinuityIssue[] = [];
    
    // Sort timeline events by scene index
    const sortedEvents = [...this.timelineEvents].sort((a, b) => a.sceneIndex - b.sceneIndex);
    
    // Check for temporal contradictions
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];
      
      // Check if timestamps are inconsistent with scene order
      if (currentEvent.timestamp > nextEvent.timestamp && 
          currentEvent.sceneIndex < nextEvent.sceneIndex) {
        issues.push({
          id: `timeline_${i}`,
          type: 'timeline',
          severity: 'medium',
          description: `Timeline inconsistency between scenes ${currentEvent.sceneIndex} and ${nextEvent.sceneIndex}`,
          scenes: [currentEvent.sceneIndex, nextEvent.sceneIndex],
          conflictingElements: [currentEvent.description, nextEvent.description],
          suggestions: [
            'Adjust the temporal references to maintain chronological order',
            'Add clarifying information about the timeline',
            'Consider using flashbacks or flash-forwards explicitly'
          ]
        });
      }
    }
    
    return issues;
  }

  private detectWorldElementInconsistencies(): ContinuityIssue[] {
    const issues: ContinuityIssue[] = [];
    
    for (const [elementName, tracker] of this.worldElements) {
      const inconsistencies = tracker.detectInconsistencies();
      for (const inconsistency of inconsistencies) {
        issues.push({
          id: `world_${elementName}_${issues.length}`,
          type: 'object',
          severity: inconsistency.severity,
          description: `World element "${elementName}" ${inconsistency.description}`,
          scenes: inconsistency.scenes,
          conflictingElements: inconsistency.conflictingDescriptions,
          suggestions: [
            'Ensure consistent descriptions of world elements',
            'Establish clear rules for how world elements work',
            'Remove contradictory information'
          ]
        });
      }
    }
    
    return issues;
  }

  private async detectCharacterInconsistencies(): Promise<CharacterInconsistency[]> {
    const inconsistencies: CharacterInconsistency[] = [];
    
    for (const [characterId, tracker] of this.characterStates) {
      // Detect personality inconsistencies
      const personalityIssues = tracker.detectPersonalityInconsistencies();
      for (const issue of personalityIssues) {
        inconsistencies.push({
          id: `personality_${characterId}_${inconsistencies.length}`,
          characterId,
          characterName: tracker.character.name,
          type: 'personality',
          severity: issue.severity,
          description: issue.description,
          scenes: issue.scenes,
          conflictingTraits: issue.conflictingTraits,
          suggestions: [
            'Ensure character actions align with established personality',
            'Provide character development to explain personality changes',
            'Review character consistency across scenes'
          ]
        });
      }
      
      // Detect motivation inconsistencies
      const motivationIssues = tracker.detectMotivationInconsistencies();
      for (const issue of motivationIssues) {
        inconsistencies.push({
          id: `motivation_${characterId}_${inconsistencies.length}`,
          characterId,
          characterName: tracker.character.name,
          type: 'motivation',
          severity: issue.severity,
          description: issue.description,
          scenes: issue.scenes,
          conflictingTraits: issue.conflictingMotivations,
          suggestions: [
            'Clarify character motivations and goals',
            'Show character growth that explains motivation changes',
            'Ensure actions are consistent with stated motivations'
          ]
        });
      }
    }
    
    return inconsistencies;
  }

  private async generateSuggestions(
    plotHoles: PlotHole[],
    continuityIssues: ContinuityIssue[],
    characterInconsistencies: CharacterInconsistency[]
  ): Promise<PlotHoleSuggestion[]> {
    const suggestions: PlotHoleSuggestion[] = [];
    
    // Generate suggestions for plot holes
    for (const plotHole of plotHoles) {
      const suggestion: PlotHoleSuggestion = {
        id: `suggestion_${plotHole.id}`,
        type: this.getSuggestionType(plotHole.type),
        priority: this.mapSeverityToPriority(plotHole.severity),
        description: `Address ${plotHole.type}: ${plotHole.description}`,
        targetScene: plotHole.scenes[0],
        implementation: plotHole.suggestions,
        relatedPlotHoles: [plotHole.id]
      };
      suggestions.push(suggestion);
    }
    
    // Generate suggestions for continuity issues
    for (const issue of continuityIssues) {
      const suggestion: PlotHoleSuggestion = {
        id: `suggestion_${issue.id}`,
        type: 'modify_scene',
        priority: this.mapSeverityToPriority(issue.severity),
        description: `Fix continuity issue: ${issue.description}`,
        targetScene: issue.scenes[0],
        implementation: issue.suggestions,
        relatedPlotHoles: []
      };
      suggestions.push(suggestion);
    }
    
    // Generate suggestions for character inconsistencies
    for (const inconsistency of characterInconsistencies) {
      const suggestion: PlotHoleSuggestion = {
        id: `suggestion_${inconsistency.id}`,
        type: 'character_development',
        priority: this.mapSeverityToPriority(inconsistency.severity),
        description: `Fix character inconsistency: ${inconsistency.description}`,
        targetScene: inconsistency.scenes[0],
        implementation: inconsistency.suggestions,
        relatedPlotHoles: []
      };
      suggestions.push(suggestion);
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private getSuggestionType(plotHoleType: string): PlotHoleSuggestion['type'] {
    switch (plotHoleType) {
      case 'unresolved_thread': return 'add_scene';
      case 'character_knowledge': return 'character_development';
      case 'character_ability': return 'character_development';
      default: return 'modify_scene';
    }
  }

  private mapSeverityToPriority(severity: string): PlotHoleSuggestion['priority'] {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private calculateConsistencyScore(
    plotHoles: PlotHole[],
    continuityIssues: ContinuityIssue[],
    characterInconsistencies: CharacterInconsistency[]
  ): number {
    const totalIssues = plotHoles.length + continuityIssues.length + characterInconsistencies.length;
    
    if (totalIssues === 0) return 100;
    
    // Weight issues by severity
    let weightedIssues = 0;
    
    for (const plotHole of plotHoles) {
      weightedIssues += this.getSeverityWeight(plotHole.severity);
    }
    
    for (const issue of continuityIssues) {
      weightedIssues += this.getSeverityWeight(issue.severity);
    }
    
    for (const inconsistency of characterInconsistencies) {
      weightedIssues += this.getSeverityWeight(inconsistency.severity);
    }
    
    // Calculate score (0-100)
    const maxPossibleWeight = totalIssues * 4; // Assuming all issues are critical
    const score = Math.max(0, 100 - (weightedIssues / maxPossibleWeight) * 100);
    
    return Math.round(score);
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private convertToPlotThread(tracker: PlotThreadTracker): PlotThread {
    return {
      id: tracker.id,
      name: tracker.name,
      description: tracker.description,
      introduced: tracker.introduced,
      resolved: tracker.resolved,
      status: tracker.status,
      importance: tracker.importance,
      relatedCharacters: tracker.relatedCharacters,
      keyScenes: tracker.keyScenes
    };
  }

  // Public API methods
  async validateStoryConsistency(story: Story): Promise<{ consistent: boolean; issues: string[] }> {
    const analysis = await this.analyzeStoryForPlotHoles(story);
    const issues: string[] = [];
    
    if (analysis.plotHoles.length > 0) {
      issues.push(`Found ${analysis.plotHoles.length} plot holes`);
    }
    
    if (analysis.continuityIssues.length > 0) {
      issues.push(`Found ${analysis.continuityIssues.length} continuity issues`);
    }
    
    if (analysis.characterInconsistencies.length > 0) {
      issues.push(`Found ${analysis.characterInconsistencies.length} character inconsistencies`);
    }
    
    return {
      consistent: analysis.overallScore >= 80,
      issues
    };
  }

  async getPlotThreadSummary(story: Story): Promise<PlotThread[]> {
    const analysis = await this.analyzeStoryForPlotHoles(story);
    return analysis.plotThreads;
  }
}

// Helper classes
class CharacterStateTracker {
  public character: Character;
  private knowledge: Map<string, number> = new Map(); // knowledge -> scene where acquired
  private abilities: Map<string, number> = new Map(); // ability -> scene where acquired
  private relationships: Map<string, { status: string; scene: number }[]> = new Map();
  private appearances: number[] = [];

  constructor(character: Character) {
    this.character = character;
  }

  recordPresence(sceneIndex: number): void {
    this.appearances.push(sceneIndex);
  }

  addKnowledge(knowledge: string, sceneIndex: number): void {
    this.knowledge.set(knowledge, sceneIndex);
  }

  addAbility(ability: string, sceneIndex: number): void {
    this.abilities.set(ability, sceneIndex);
  }

  updateRelationship(otherCharacterId: string, context: string, sceneIndex: number): void {
    if (!this.relationships.has(otherCharacterId)) {
      this.relationships.set(otherCharacterId, []);
    }
    
    const relationshipHistory = this.relationships.get(otherCharacterId)!;
    relationshipHistory.push({
      status: this.extractRelationshipStatus(context),
      scene: sceneIndex
    });
  }

  private extractRelationshipStatus(context: string): string {
    const lowerContext = context.toLowerCase();
    if (lowerContext.includes('love')) return 'love';
    if (lowerContext.includes('hate')) return 'hate';
    if (lowerContext.includes('trust')) return 'trust';
    if (lowerContext.includes('distrust')) return 'distrust';
    if (lowerContext.includes('friend')) return 'friend';
    if (lowerContext.includes('enemy')) return 'enemy';
    return 'neutral';
  }

  detectKnowledgeInconsistencies(): Array<{ description: string; scenes: number[]; severity: string }> {
    const inconsistencies: Array<{ description: string; scenes: number[]; severity: string }> = [];
    
    // Check for knowledge used before acquisition
    for (const [knowledge, acquisitionScene] of this.knowledge) {
      const earlierUses = this.appearances.filter(scene => scene < acquisitionScene);
      if (earlierUses.length > 0) {
        inconsistencies.push({
          description: `uses knowledge "${knowledge}" before acquiring it`,
          scenes: [acquisitionScene, ...earlierUses],
          severity: 'medium'
        });
      }
    }
    
    return inconsistencies;
  }

  detectAbilityInconsistencies(): Array<{ description: string; scenes: number[]; severity: string }> {
    const inconsistencies: Array<{ description: string; scenes: number[]; severity: string }> = [];
    
    // Check for abilities used before acquisition
    for (const [ability, acquisitionScene] of this.abilities) {
      const earlierUses = this.appearances.filter(scene => scene < acquisitionScene);
      if (earlierUses.length > 0) {
        inconsistencies.push({
          description: `uses ability "${ability}" before acquiring it`,
          scenes: [acquisitionScene, ...earlierUses],
          severity: 'medium'
        });
      }
    }
    
    return inconsistencies;
  }

  detectPersonalityInconsistencies(): Array<{ description: string; scenes: number[]; conflictingTraits: string[]; severity: string }> {
    // This would be more sophisticated in a real implementation
    return [];
  }

  detectMotivationInconsistencies(): Array<{ description: string; scenes: number[]; conflictingMotivations: string[]; severity: string }> {
    // This would be more sophisticated in a real implementation
    return [];
  }
}

class WorldElementTracker {
  private elementName: string;
  private appearances: Array<{ scene: number; description: string }> = [];

  constructor(elementName: string) {
    this.elementName = elementName;
  }

  recordAppearance(sceneIndex: number, description: string): void {
    this.appearances.push({ scene: sceneIndex, description });
  }

  detectInconsistencies(): Array<{ description: string; scenes: number[]; conflictingDescriptions: string[]; severity: string }> {
    const inconsistencies: Array<{ description: string; scenes: number[]; conflictingDescriptions: string[]; severity: string }> = [];
    
    // Simple inconsistency detection - in reality, this would be much more sophisticated
    const descriptions = this.appearances.map(a => a.description);
    const uniqueDescriptions = [...new Set(descriptions)];
    
    if (uniqueDescriptions.length > 1) {
      inconsistencies.push({
        description: `has conflicting descriptions across scenes`,
        scenes: this.appearances.map(a => a.scene),
        conflictingDescriptions: uniqueDescriptions,
        severity: 'low'
      });
    }
    
    return inconsistencies;
  }
}

interface TimelineEvent {
  sceneIndex: number;
  description: string;
  type: string;
  timestamp: number; // Relative time in days
}