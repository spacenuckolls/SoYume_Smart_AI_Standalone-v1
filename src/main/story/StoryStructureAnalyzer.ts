import { Story, Scene, Character, StoryStructure, PlotPoint, StoryArc } from '../../shared/types/Story';

export interface StructureAnalysisResult {
  structure: StoryStructure;
  plotPoints: PlotPoint[];
  pacing: PacingAnalysis;
  suggestions: StructureSuggestion[];
  confidence: number;
}

export interface PacingAnalysis {
  overallPace: 'slow' | 'moderate' | 'fast' | 'uneven';
  tensionCurve: TensionPoint[];
  climaxPosition: number;
  pacingIssues: PacingIssue[];
}

export interface TensionPoint {
  sceneIndex: number;
  tensionLevel: number; // 0-10 scale
  emotionalIntensity: number;
  conflictLevel: number;
}

export interface PacingIssue {
  type: 'slow_start' | 'rushed_climax' | 'sagging_middle' | 'abrupt_ending' | 'uneven_tension';
  severity: 'low' | 'medium' | 'high';
  location: { start: number; end: number };
  description: string;
  suggestions: string[];
}

export interface StructureSuggestion {
  type: 'missing_plot_point' | 'weak_structure' | 'pacing_issue' | 'character_arc';
  priority: 'low' | 'medium' | 'high';
  description: string;
  location?: number;
  actionable: string[];
}

export interface StoryStructureTemplate {
  name: string;
  description: string;
  plotPoints: PlotPointTemplate[];
  expectedLength: { min: number; max: number };
  genre: string[];
}

export interface PlotPointTemplate {
  name: string;
  description: string;
  position: number; // Percentage of story (0-100)
  required: boolean;
  characteristics: string[];
}

export class StoryStructureAnalyzer {
  private structureTemplates: Map<string, StoryStructureTemplate> = new Map();

  constructor() {
    this.initializeStructureTemplates();
  }

  private initializeStructureTemplates(): void {
    // Three-Act Structure
    this.structureTemplates.set('three-act', {
      name: 'Three-Act Structure',
      description: 'Classic three-act dramatic structure',
      plotPoints: [
        {
          name: 'Inciting Incident',
          description: 'The event that sets the story in motion',
          position: 12,
          required: true,
          characteristics: ['introduces_conflict', 'disrupts_status_quo', 'hooks_reader']
        },
        {
          name: 'Plot Point 1',
          description: 'End of Act 1, protagonist commits to the journey',
          position: 25,
          required: true,
          characteristics: ['point_of_no_return', 'enters_new_world', 'stakes_established']
        },
        {
          name: 'Midpoint',
          description: 'Major revelation or reversal at story center',
          position: 50,
          required: true,
          characteristics: ['revelation', 'false_victory', 'raises_stakes', 'character_growth']
        },
        {
          name: 'Plot Point 2',
          description: 'End of Act 2, all seems lost',
          position: 75,
          required: true,
          characteristics: ['dark_moment', 'final_obstacle', 'character_transformation']
        },
        {
          name: 'Climax',
          description: 'Final confrontation and resolution',
          position: 90,
          required: true,
          characteristics: ['final_battle', 'character_proves_growth', 'resolves_conflict']
        }
      ],
      expectedLength: { min: 50000, max: 120000 },
      genre: ['general', 'drama', 'thriller', 'romance']
    });

    // Hero's Journey
    this.structureTemplates.set('heros-journey', {
      name: "Hero's Journey",
      description: 'Joseph Campbell\'s monomyth structure',
      plotPoints: [
        {
          name: 'Ordinary World',
          description: 'Hero\'s normal life before transformation',
          position: 5,
          required: true,
          characteristics: ['establishes_normal', 'shows_character', 'hints_at_need']
        },
        {
          name: 'Call to Adventure',
          description: 'Hero is presented with a problem or challenge',
          position: 10,
          required: true,
          characteristics: ['introduces_quest', 'disrupts_normal', 'presents_choice']
        },
        {
          name: 'Refusal of the Call',
          description: 'Hero hesitates or refuses the adventure',
          position: 15,
          required: false,
          characteristics: ['shows_fear', 'establishes_stakes', 'humanizes_hero']
        },
        {
          name: 'Meeting the Mentor',
          description: 'Hero encounters wise figure who gives advice/magical gifts',
          position: 20,
          required: false,
          characteristics: ['provides_guidance', 'gives_tools', 'encourages_hero']
        },
        {
          name: 'Crossing the Threshold',
          description: 'Hero commits to the adventure and enters special world',
          position: 25,
          required: true,
          characteristics: ['point_of_no_return', 'enters_special_world', 'faces_first_challenge']
        },
        {
          name: 'Tests, Allies, and Enemies',
          description: 'Hero faces challenges and makes allies and enemies',
          position: 40,
          required: true,
          characteristics: ['character_development', 'world_building', 'skill_building']
        },
        {
          name: 'Approach to the Inmost Cave',
          description: 'Hero prepares for major challenge in special world',
          position: 60,
          required: true,
          characteristics: ['preparation', 'team_building', 'final_planning']
        },
        {
          name: 'Ordeal',
          description: 'Hero faces greatest fear or most difficult challenge',
          position: 75,
          required: true,
          characteristics: ['death_and_rebirth', 'greatest_challenge', 'transformation']
        },
        {
          name: 'Reward',
          description: 'Hero survives and gains something from the experience',
          position: 80,
          required: true,
          characteristics: ['gains_object', 'new_knowledge', 'character_growth']
        },
        {
          name: 'The Road Back',
          description: 'Hero begins journey back to ordinary world',
          position: 85,
          required: true,
          characteristics: ['return_journey', 'chase_scene', 'renewed_commitment']
        },
        {
          name: 'Resurrection',
          description: 'Final test where hero must use everything learned',
          position: 90,
          required: true,
          characteristics: ['final_battle', 'purification', 'transformation_complete']
        },
        {
          name: 'Return with the Elixir',
          description: 'Hero returns home transformed and able to help others',
          position: 95,
          required: true,
          characteristics: ['returns_home', 'shares_wisdom', 'helps_others']
        }
      ],
      expectedLength: { min: 60000, max: 150000 },
      genre: ['fantasy', 'adventure', 'sci-fi', 'mythology']
    });

    // Save the Cat Beat Sheet
    this.structureTemplates.set('save-the-cat', {
      name: 'Save the Cat',
      description: 'Blake Snyder\'s 15-beat structure',
      plotPoints: [
        {
          name: 'Opening Image',
          description: 'Visual that represents the struggle & tone of the story',
          position: 1,
          required: true,
          characteristics: ['sets_tone', 'visual_metaphor', 'story_theme']
        },
        {
          name: 'Theme Stated',
          description: 'What your story is about; the message',
          position: 5,
          required: true,
          characteristics: ['states_theme', 'life_lesson', 'moral_premise']
        },
        {
          name: 'Set-Up',
          description: 'Introduce hero, stakes, and goal',
          position: 10,
          required: true,
          characteristics: ['introduces_hero', 'establishes_world', 'shows_flaw']
        },
        {
          name: 'Catalyst',
          description: 'Life-changing event that happens TO the hero',
          position: 12,
          required: true,
          characteristics: ['inciting_incident', 'disrupts_life', 'creates_urgency']
        },
        {
          name: 'Debate',
          description: 'Hero hesitates, weighs options',
          position: 17,
          required: true,
          characteristics: ['internal_conflict', 'weighs_options', 'shows_stakes']
        },
        {
          name: 'Break into Two',
          description: 'Hero makes choice and enters Act 2',
          position: 25,
          required: true,
          characteristics: ['active_choice', 'enters_new_world', 'commits_to_goal']
        },
        {
          name: 'B Story',
          description: 'Subplot that carries theme of the story',
          position: 30,
          required: false,
          characteristics: ['love_story', 'theme_carrier', 'character_growth']
        },
        {
          name: 'Fun and Games',
          description: 'Promise of the premise; why we came to see the movie',
          position: 40,
          required: true,
          characteristics: ['genre_elements', 'audience_expectations', 'exploration']
        },
        {
          name: 'Midpoint',
          description: 'Apparent victory or defeat',
          position: 50,
          required: true,
          characteristics: ['false_victory', 'stakes_raised', 'time_clock']
        },
        {
          name: 'Bad Guys Close In',
          description: 'Doubt, jealousy, fear, foes both external and internal',
          position: 62,
          required: true,
          characteristics: ['increasing_pressure', 'internal_doubt', 'external_forces']
        },
        {
          name: 'All Is Lost',
          description: 'Opposite of Midpoint; apparent defeat',
          position: 75,
          required: true,
          characteristics: ['dark_moment', 'hope_lost', 'whiff_of_death']
        },
        {
          name: 'Dark Night of the Soul',
          description: 'Hero\'s reaction to All Is Lost',
          position: 80,
          required: true,
          characteristics: ['emotional_low', 'contemplation', 'final_lesson']
        },
        {
          name: 'Break into Three',
          description: 'Thanks to new info, hero has the solution',
          position: 85,
          required: true,
          characteristics: ['new_plan', 'synthesis', 'final_push']
        },
        {
          name: 'Finale',
          description: 'Hero confronts problem and solves it',
          position: 92,
          required: true,
          characteristics: ['final_battle', 'applies_lesson', 'transformation']
        },
        {
          name: 'Final Image',
          description: 'Opposite of Opening Image; proof of change',
          position: 99,
          required: true,
          characteristics: ['transformation_proof', 'visual_bookend', 'new_world']
        }
      ],
      expectedLength: { min: 80000, max: 100000 },
      genre: ['screenplay', 'commercial_fiction', 'thriller', 'romance']
    });

    // Kishōtenketsu (Four-Act Structure)
    this.structureTemplates.set('kishotenketsu', {
      name: 'Kishōtenketsu',
      description: 'Japanese four-act structure without conflict',
      plotPoints: [
        {
          name: 'Ki (Introduction)',
          description: 'Introduces characters, setting, and situation',
          position: 25,
          required: true,
          characteristics: ['character_introduction', 'world_building', 'establishes_normal']
        },
        {
          name: 'Shō (Development)',
          description: 'Develops the situation and characters',
          position: 50,
          required: true,
          characteristics: ['character_development', 'situation_expansion', 'relationship_building']
        },
        {
          name: 'Ten (Twist)',
          description: 'Introduces unexpected element or perspective',
          position: 75,
          required: true,
          characteristics: ['unexpected_element', 'new_perspective', 'complication']
        },
        {
          name: 'Ketsu (Conclusion)',
          description: 'Resolves the story with new understanding',
          position: 95,
          required: true,
          characteristics: ['resolution', 'new_understanding', 'emotional_conclusion']
        }
      ],
      expectedLength: { min: 30000, max: 80000 },
      genre: ['literary', 'slice_of_life', 'contemplative', 'eastern_narrative']
    });
  }  
async analyzeStoryStructure(story: Story, preferredStructure?: string): Promise<StructureAnalysisResult> {
    // Determine the best structure template to use
    const structureTemplate = this.selectBestStructure(story, preferredStructure);
    
    // Analyze the story against the template
    const plotPoints = await this.identifyPlotPoints(story, structureTemplate);
    const pacing = await this.analyzePacing(story, plotPoints);
    const suggestions = await this.generateStructureSuggestions(story, structureTemplate, plotPoints, pacing);
    
    // Calculate confidence based on how well the story fits the structure
    const confidence = this.calculateStructureConfidence(story, structureTemplate, plotPoints);
    
    return {
      structure: {
        type: structureTemplate.name,
        template: structureTemplate,
        adherence: confidence
      },
      plotPoints,
      pacing,
      suggestions,
      confidence
    };
  }

  private selectBestStructure(story: Story, preferredStructure?: string): StoryStructureTemplate {
    if (preferredStructure && this.structureTemplates.has(preferredStructure)) {
      return this.structureTemplates.get(preferredStructure)!;
    }

    // Analyze story characteristics to suggest best structure
    const wordCount = this.estimateWordCount(story);
    const genre = story.genre || 'general';
    const hasConflict = this.detectConflictElements(story);
    
    // Score each template based on story characteristics
    let bestTemplate = this.structureTemplates.get('three-act')!;
    let bestScore = 0;
    
    for (const [key, template] of this.structureTemplates) {
      let score = 0;
      
      // Word count fit
      if (wordCount >= template.expectedLength.min && wordCount <= template.expectedLength.max) {
        score += 3;
      } else if (wordCount < template.expectedLength.max * 1.2 && wordCount > template.expectedLength.min * 0.8) {
        score += 1;
      }
      
      // Genre fit
      if (template.genre.includes(genre) || template.genre.includes('general')) {
        score += 2;
      }
      
      // Conflict-based vs non-conflict structures
      if (key === 'kishotenketsu' && !hasConflict) {
        score += 2;
      } else if (key !== 'kishotenketsu' && hasConflict) {
        score += 1;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }
    
    return bestTemplate;
  }

  private async identifyPlotPoints(story: Story, template: StoryStructureTemplate): Promise<PlotPoint[]> {
    const scenes = story.scenes || [];
    const totalScenes = scenes.length;
    const plotPoints: PlotPoint[] = [];
    
    for (const plotPointTemplate of template.plotPoints) {
      const expectedPosition = Math.floor((plotPointTemplate.position / 100) * totalScenes);
      const searchRange = Math.max(1, Math.floor(totalScenes * 0.1)); // 10% range
      
      // Search for the plot point in the expected range
      const foundPlotPoint = await this.findPlotPointInRange(
        scenes,
        expectedPosition,
        searchRange,
        plotPointTemplate
      );
      
      if (foundPlotPoint) {
        plotPoints.push(foundPlotPoint);
      } else if (plotPointTemplate.required) {
        // Create a missing plot point entry
        plotPoints.push({
          name: plotPointTemplate.name,
          description: plotPointTemplate.description,
          position: expectedPosition,
          sceneIndex: expectedPosition,
          confidence: 0,
          missing: true,
          characteristics: plotPointTemplate.characteristics
        });
      }
    }
    
    return plotPoints.sort((a, b) => a.position - b.position);
  }

  private async findPlotPointInRange(
    scenes: Scene[],
    expectedPosition: number,
    searchRange: number,
    template: PlotPointTemplate
  ): Promise<PlotPoint | null> {
    const startIndex = Math.max(0, expectedPosition - searchRange);
    const endIndex = Math.min(scenes.length - 1, expectedPosition + searchRange);
    
    let bestMatch: PlotPoint | null = null;
    let bestScore = 0;
    
    for (let i = startIndex; i <= endIndex; i++) {
      const scene = scenes[i];
      const score = await this.scoreSceneForPlotPoint(scene, template);
      
      if (score > bestScore && score > 0.3) { // Minimum confidence threshold
        bestScore = score;
        bestMatch = {
          name: template.name,
          description: template.description,
          position: (i / scenes.length) * 100,
          sceneIndex: i,
          confidence: score,
          missing: false,
          characteristics: template.characteristics,
          scene: scene
        };
      }
    }
    
    return bestMatch;
  }

  private async scoreSceneForPlotPoint(scene: Scene, template: PlotPointTemplate): Promise<number> {
    let score = 0;
    const sceneText = scene.content || '';
    const sceneTitle = scene.title || '';
    const sceneSummary = scene.summary || '';
    
    // Analyze scene characteristics against template characteristics
    for (const characteristic of template.characteristics) {
      const characteristicScore = await this.analyzeCharacteristic(sceneText, sceneTitle, sceneSummary, characteristic);
      score += characteristicScore;
    }
    
    // Normalize score
    return Math.min(1, score / template.characteristics.length);
  }

  private async analyzeCharacteristic(text: string, title: string, summary: string, characteristic: string): Promise<number> {
    const combinedText = `${title} ${summary} ${text}`.toLowerCase();
    
    // Define keyword patterns for different characteristics
    const characteristicPatterns: Record<string, string[]> = {
      'introduces_conflict': ['conflict', 'problem', 'challenge', 'obstacle', 'tension', 'disagreement'],
      'disrupts_status_quo': ['change', 'different', 'unexpected', 'surprise', 'disruption', 'break'],
      'hooks_reader': ['mystery', 'question', 'intrigue', 'curious', 'wonder', 'suspense'],
      'point_of_no_return': ['decision', 'choice', 'commit', 'no turning back', 'must', 'have to'],
      'enters_new_world': ['new', 'different', 'strange', 'unfamiliar', 'journey', 'travel'],
      'stakes_established': ['important', 'matter', 'consequence', 'risk', 'danger', 'lose'],
      'revelation': ['discover', 'realize', 'learn', 'reveal', 'truth', 'secret'],
      'false_victory': ['win', 'success', 'triumph', 'victory', 'achieve', 'accomplish'],
      'raises_stakes': ['worse', 'danger', 'risk', 'threat', 'escalate', 'intensify'],
      'character_growth': ['learn', 'grow', 'change', 'understand', 'mature', 'develop'],
      'dark_moment': ['lost', 'defeat', 'fail', 'hopeless', 'despair', 'give up'],
      'final_obstacle': ['last', 'final', 'ultimate', 'biggest', 'greatest', 'hardest'],
      'character_transformation': ['become', 'transform', 'change', 'new person', 'different'],
      'final_battle': ['fight', 'battle', 'confrontation', 'showdown', 'face', 'against'],
      'resolves_conflict': ['resolve', 'solve', 'end', 'finish', 'complete', 'conclusion']
    };
    
    const patterns = characteristicPatterns[characteristic] || [];
    let matches = 0;
    
    for (const pattern of patterns) {
      if (combinedText.includes(pattern)) {
        matches++;
      }
    }
    
    // Return score based on pattern matches
    return patterns.length > 0 ? matches / patterns.length : 0;
  }

  private async analyzePacing(story: Story, plotPoints: PlotPoint[]): Promise<PacingAnalysis> {
    const scenes = story.scenes || [];
    const tensionCurve = await this.calculateTensionCurve(scenes);
    const climaxPosition = this.findClimaxPosition(plotPoints, tensionCurve);
    const overallPace = this.assessOverallPace(scenes, tensionCurve);
    const pacingIssues = this.identifyPacingIssues(scenes, tensionCurve, plotPoints);
    
    return {
      overallPace,
      tensionCurve,
      climaxPosition,
      pacingIssues
    };
  }

  private async calculateTensionCurve(scenes: Scene[]): Promise<TensionPoint[]> {
    const tensionPoints: TensionPoint[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const tensionLevel = await this.analyzeTensionLevel(scene);
      const emotionalIntensity = await this.analyzeEmotionalIntensity(scene);
      const conflictLevel = await this.analyzeConflictLevel(scene);
      
      tensionPoints.push({
        sceneIndex: i,
        tensionLevel,
        emotionalIntensity,
        conflictLevel
      });
    }
    
    return tensionPoints;
  }

  private async analyzeTensionLevel(scene: Scene): Promise<number> {
    const content = scene.content || '';
    const tensionKeywords = [
      'tension', 'suspense', 'anxiety', 'worry', 'fear', 'nervous',
      'edge', 'anticipation', 'dread', 'unease', 'stress', 'pressure'
    ];
    
    const actionKeywords = [
      'run', 'chase', 'fight', 'battle', 'struggle', 'race',
      'urgent', 'quick', 'fast', 'hurry', 'rush', 'immediate'
    ];
    
    let score = 0;
    const words = content.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (tensionKeywords.includes(word)) score += 2;
      if (actionKeywords.includes(word)) score += 1;
    }
    
    // Normalize to 0-10 scale
    return Math.min(10, (score / words.length) * 1000);
  }

  private async analyzeEmotionalIntensity(scene: Scene): Promise<number> {
    const content = scene.content || '';
    const highIntensityEmotions = [
      'love', 'hate', 'rage', 'fury', 'terror', 'ecstasy',
      'despair', 'joy', 'anguish', 'passion', 'devastated', 'elated'
    ];
    
    const mediumIntensityEmotions = [
      'happy', 'sad', 'angry', 'afraid', 'excited', 'worried',
      'pleased', 'upset', 'concerned', 'hopeful', 'disappointed'
    ];
    
    let score = 0;
    const words = content.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (highIntensityEmotions.includes(word)) score += 3;
      if (mediumIntensityEmotions.includes(word)) score += 1;
    }
    
    return Math.min(10, (score / words.length) * 1000);
  }

  private async analyzeConflictLevel(scene: Scene): Promise<number> {
    const content = scene.content || '';
    const conflictKeywords = [
      'argue', 'fight', 'disagree', 'oppose', 'conflict', 'struggle',
      'against', 'versus', 'battle', 'confrontation', 'challenge', 'obstacle'
    ];
    
    let score = 0;
    const words = content.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (conflictKeywords.includes(word)) score += 1;
    }
    
    return Math.min(10, (score / words.length) * 1000);
  }

  private findClimaxPosition(plotPoints: PlotPoint[], tensionCurve: TensionPoint[]): number {
    // Look for climax plot point first
    const climaxPoint = plotPoints.find(p => 
      p.name.toLowerCase().includes('climax') || 
      p.characteristics.includes('final_battle')
    );
    
    if (climaxPoint && !climaxPoint.missing) {
      return climaxPoint.sceneIndex;
    }
    
    // Find highest tension point
    let maxTension = 0;
    let climaxIndex = 0;
    
    for (const point of tensionCurve) {
      const totalTension = point.tensionLevel + point.emotionalIntensity + point.conflictLevel;
      if (totalTension > maxTension) {
        maxTension = totalTension;
        climaxIndex = point.sceneIndex;
      }
    }
    
    return climaxIndex;
  }

  private assessOverallPace(scenes: Scene[], tensionCurve: TensionPoint[]): 'slow' | 'moderate' | 'fast' | 'uneven' {
    if (tensionCurve.length === 0) return 'moderate';
    
    const averageTension = tensionCurve.reduce((sum, point) => 
      sum + point.tensionLevel + point.emotionalIntensity + point.conflictLevel, 0
    ) / (tensionCurve.length * 3);
    
    // Calculate variance to detect uneven pacing
    const variance = tensionCurve.reduce((sum, point) => {
      const totalTension = (point.tensionLevel + point.emotionalIntensity + point.conflictLevel) / 3;
      return sum + Math.pow(totalTension - averageTension, 2);
    }, 0) / tensionCurve.length;
    
    if (variance > 4) return 'uneven';
    if (averageTension < 3) return 'slow';
    if (averageTension > 7) return 'fast';
    return 'moderate';
  }

  private identifyPacingIssues(scenes: Scene[], tensionCurve: TensionPoint[], plotPoints: PlotPoint[]): PacingIssue[] {
    const issues: PacingIssue[] = [];
    
    // Check for slow start
    if (tensionCurve.length > 0) {
      const firstQuarter = tensionCurve.slice(0, Math.floor(tensionCurve.length / 4));
      const avgStartTension = firstQuarter.reduce((sum, point) => 
        sum + point.tensionLevel + point.emotionalIntensity + point.conflictLevel, 0
      ) / (firstQuarter.length * 3);
      
      if (avgStartTension < 2) {
        issues.push({
          type: 'slow_start',
          severity: 'medium',
          location: { start: 0, end: firstQuarter.length - 1 },
          description: 'The story starts slowly with low tension and engagement',
          suggestions: [
            'Consider starting closer to the inciting incident',
            'Add more conflict or intrigue to the opening scenes',
            'Introduce compelling questions or mysteries early'
          ]
        });
      }
    }
    
    // Check for sagging middle
    if (tensionCurve.length > 4) {
      const middleStart = Math.floor(tensionCurve.length * 0.3);
      const middleEnd = Math.floor(tensionCurve.length * 0.7);
      const middleSection = tensionCurve.slice(middleStart, middleEnd);
      
      const avgMiddleTension = middleSection.reduce((sum, point) => 
        sum + point.tensionLevel + point.emotionalIntensity + point.conflictLevel, 0
      ) / (middleSection.length * 3);
      
      if (avgMiddleTension < 3) {
        issues.push({
          type: 'sagging_middle',
          severity: 'high',
          location: { start: middleStart, end: middleEnd },
          description: 'The middle section lacks tension and forward momentum',
          suggestions: [
            'Add subplot complications or character conflicts',
            'Introduce new obstacles or revelations',
            'Increase stakes or add time pressure',
            'Develop character relationships and internal conflicts'
          ]
        });
      }
    }
    
    // Check for rushed climax
    const climaxPoint = plotPoints.find(p => p.characteristics.includes('final_battle'));
    if (climaxPoint && !climaxPoint.missing) {
      const climaxIndex = climaxPoint.sceneIndex;
      const storyLength = scenes.length;
      
      if (climaxIndex > storyLength * 0.95) {
        issues.push({
          type: 'rushed_climax',
          severity: 'high',
          location: { start: climaxIndex, end: storyLength - 1 },
          description: 'The climax occurs too late, leaving insufficient time for resolution',
          suggestions: [
            'Move the climax earlier to allow for proper resolution',
            'Extend the story to provide adequate falling action',
            'Ensure the climax has sufficient buildup and consequences'
          ]
        });
      }
    }
    
    return issues;
  }

  private async generateStructureSuggestions(
    story: Story,
    template: StoryStructureTemplate,
    plotPoints: PlotPoint[],
    pacing: PacingAnalysis
  ): Promise<StructureSuggestion[]> {
    const suggestions: StructureSuggestion[] = [];
    
    // Check for missing required plot points
    const missingPlotPoints = plotPoints.filter(p => p.missing && template.plotPoints.find(t => t.name === p.name)?.required);
    
    for (const missingPoint of missingPlotPoints) {
      suggestions.push({
        type: 'missing_plot_point',
        priority: 'high',
        description: `Missing required plot point: ${missingPoint.name}`,
        location: missingPoint.sceneIndex,
        actionable: [
          `Add a scene around position ${missingPoint.sceneIndex} that serves as the ${missingPoint.name}`,
          `Ensure this scene ${missingPoint.description.toLowerCase()}`,
          `Include elements: ${missingPoint.characteristics.join(', ')}`
        ]
      });
    }
    
    // Add pacing-related suggestions
    for (const issue of pacing.pacingIssues) {
      suggestions.push({
        type: 'pacing_issue',
        priority: issue.severity === 'high' ? 'high' : 'medium',
        description: issue.description,
        location: issue.location.start,
        actionable: issue.suggestions
      });
    }
    
    // Check structure adherence
    const adherenceScore = this.calculateStructureConfidence(story, template, plotPoints);
    if (adherenceScore < 0.6) {
      suggestions.push({
        type: 'weak_structure',
        priority: 'medium',
        description: `Story structure doesn't strongly follow ${template.name} pattern`,
        actionable: [
          `Consider restructuring to better fit ${template.name} beats`,
          'Review plot point placement and timing',
          'Ensure each act serves its intended purpose'
        ]
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateStructureConfidence(story: Story, template: StoryStructureTemplate, plotPoints: PlotPoint[]): number {
    const requiredPlotPoints = template.plotPoints.filter(p => p.required);
    const foundRequiredPoints = plotPoints.filter(p => !p.missing && requiredPlotPoints.some(r => r.name === p.name));
    
    const structuralScore = foundRequiredPoints.length / requiredPlotPoints.length;
    const confidenceScore = plotPoints.reduce((sum, point) => sum + (point.confidence || 0), 0) / plotPoints.length;
    
    return (structuralScore + confidenceScore) / 2;
  }

  private estimateWordCount(story: Story): number {
    const scenes = story.scenes || [];
    let totalWords = 0;
    
    for (const scene of scenes) {
      const content = scene.content || '';
      totalWords += content.split(/\s+/).length;
    }
    
    return totalWords;
  }

  private detectConflictElements(story: Story): boolean {
    const scenes = story.scenes || [];
    const conflictKeywords = [
      'conflict', 'fight', 'battle', 'struggle', 'oppose', 'against',
      'enemy', 'villain', 'antagonist', 'problem', 'challenge', 'obstacle'
    ];
    
    for (const scene of scenes) {
      const content = (scene.content || '').toLowerCase();
      for (const keyword of conflictKeywords) {
        if (content.includes(keyword)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Public API methods
  getAvailableStructures(): StoryStructureTemplate[] {
    return Array.from(this.structureTemplates.values());
  }

  getStructureTemplate(name: string): StoryStructureTemplate | null {
    return this.structureTemplates.get(name) || null;
  }

  async validateStructure(story: Story, structureName: string): Promise<{ valid: boolean; issues: string[] }> {
    const template = this.structureTemplates.get(structureName);
    if (!template) {
      return { valid: false, issues: ['Unknown structure template'] };
    }
    
    const analysis = await this.analyzeStoryStructure(story, structureName);
    const issues: string[] = [];
    
    if (analysis.confidence < 0.5) {
      issues.push('Story does not strongly follow the selected structure');
    }
    
    const missingRequired = analysis.plotPoints.filter(p => p.missing && 
      template.plotPoints.find(t => t.name === p.name)?.required
    );
    
    if (missingRequired.length > 0) {
      issues.push(`Missing required plot points: ${missingRequired.map(p => p.name).join(', ')}`);
    }
    
    if (analysis.pacing.pacingIssues.filter(i => i.severity === 'high').length > 0) {
      issues.push('Story has significant pacing issues');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}