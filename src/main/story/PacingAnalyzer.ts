import { Story, Scene, Character, PacingAnalysis, TensionCurve, PacingIssue } from '../../shared/types/Story';

export interface PacingAnalysisResult {
  overallPacing: PacingMetrics;
  tensionCurve: TensionCurve;
  sceneAnalysis: ScenePacingAnalysis[];
  pacingIssues: PacingIssue[];
  recommendations: PacingRecommendation[];
  visualData: PacingVisualizationData;
}

export interface PacingMetrics {
  averageTension: number;
  tensionVariance: number;
  climaxIntensity: number;
  climaxPosition: number; // Percentage through story
  pacingRating: 'excellent' | 'good' | 'fair' | 'poor';
  readabilityScore: number;
  engagementScore: number;
}

export interface ScenePacingAnalysis {
  sceneIndex: number;
  sceneTitle: string;
  tensionLevel: number; // 0-10
  emotionalIntensity: number; // 0-10
  actionLevel: number; // 0-10
  dialogueRatio: number; // 0-1
  descriptionRatio: number; // 0-1
  paceRating: 'very_slow' | 'slow' | 'moderate' | 'fast' | 'very_fast';
  wordCount: number;
  readingTime: number; // minutes
  suggestions: string[];
}

export interface PacingRecommendation {
  id: string;
  type: 'tension' | 'pacing' | 'structure' | 'engagement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  targetScenes: number[];
  implementation: string[];
  expectedImpact: string;
}

export interface PacingVisualizationData {
  tensionPoints: Array<{ x: number; y: number; label: string }>;
  pacingCurve: Array<{ x: number; y: number }>;
  climaxMarkers: Array<{ x: number; label: string }>;
  issueMarkers: Array<{ x: number; type: string; severity: string }>;
  idealCurve: Array<{ x: number; y: number }>;
}

export interface TensionAnalysisConfig {
  actionKeywords: string[];
  emotionKeywords: string[];
  conflictKeywords: string[];
  dialogueMarkers: string[];
  descriptionMarkers: string[];
  transitionWords: string[];
}

export class PacingAnalyzer {
  private config: TensionAnalysisConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): TensionAnalysisConfig {
    return {
      actionKeywords: [
        'run', 'chase', 'fight', 'battle', 'struggle', 'race', 'rush', 'hurry',
        'attack', 'defend', 'strike', 'hit', 'punch', 'kick', 'shoot', 'stab',
        'jump', 'leap', 'dive', 'climb', 'fall', 'crash', 'explode', 'shatter',
        'urgent', 'quick', 'fast', 'rapid', 'sudden', 'immediate', 'instant'
      ],
      emotionKeywords: [
        'love', 'hate', 'fear', 'anger', 'joy', 'sadness', 'excitement', 'anxiety',
        'terror', 'rage', 'fury', 'ecstasy', 'despair', 'hope', 'passion', 'desire',
        'jealousy', 'envy', 'pride', 'shame', 'guilt', 'relief', 'surprise', 'shock',
        'devastated', 'elated', 'thrilled', 'horrified', 'amazed', 'confused'
      ],
      conflictKeywords: [
        'conflict', 'tension', 'argument', 'disagreement', 'fight', 'battle',
        'oppose', 'against', 'versus', 'challenge', 'obstacle', 'problem',
        'struggle', 'resist', 'confront', 'face', 'enemy', 'rival', 'antagonist',
        'threat', 'danger', 'risk', 'peril', 'crisis', 'emergency'
      ],
      dialogueMarkers: [
        'said', 'asked', 'replied', 'answered', 'whispered', 'shouted', 'yelled',
        'muttered', 'declared', 'announced', 'exclaimed', 'gasped', 'sighed',
        'laughed', 'cried', 'sobbed', 'screamed', 'growled', 'hissed'
      ],
      descriptionMarkers: [
        'looked', 'appeared', 'seemed', 'was', 'were', 'had', 'stood', 'sat',
        'lay', 'walked', 'moved', 'turned', 'faced', 'wore', 'carried', 'held'
      ],
      transitionWords: [
        'meanwhile', 'however', 'therefore', 'consequently', 'furthermore',
        'moreover', 'nevertheless', 'nonetheless', 'subsequently', 'eventually',
        'suddenly', 'immediately', 'finally', 'then', 'next', 'later', 'before', 'after'
      ]
    };
  }

  async analyzePacing(story: Story): Promise<PacingAnalysisResult> {
    const scenes = story.scenes || [];
    
    // Analyze each scene individually
    const sceneAnalysis = await this.analyzeScenes(scenes);
    
    // Generate tension curve
    const tensionCurve = this.generateTensionCurve(sceneAnalysis);
    
    // Calculate overall pacing metrics
    const overallPacing = this.calculateOverallMetrics(sceneAnalysis, tensionCurve);
    
    // Identify pacing issues
    const pacingIssues = this.identifyPacingIssues(sceneAnalysis, tensionCurve);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(sceneAnalysis, pacingIssues, overallPacing);
    
    // Create visualization data
    const visualData = this.createVisualizationData(sceneAnalysis, tensionCurve, pacingIssues);
    
    return {
      overallPacing,
      tensionCurve,
      sceneAnalysis,
      pacingIssues,
      recommendations,
      visualData
    };
  }

  private async analyzeScenes(scenes: Scene[]): Promise<ScenePacingAnalysis[]> {
    const analyses: ScenePacingAnalysis[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const analysis = await this.analyzeScene(scene, i);
      analyses.push(analysis);
    }
    
    return analyses;
  }

  private async analyzeScene(scene: Scene, index: number): Promise<ScenePacingAnalysis> {
    const content = scene.content || '';
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    
    // Calculate reading time (average 250 words per minute)
    const readingTime = Math.max(1, Math.round(wordCount / 250));
    
    // Analyze content composition
    const tensionLevel = await this.calculateTensionLevel(content, words);
    const emotionalIntensity = await this.calculateEmotionalIntensity(content, words);
    const actionLevel = await this.calculateActionLevel(content, words);
    const dialogueRatio = this.calculateDialogueRatio(content);
    const descriptionRatio = this.calculateDescriptionRatio(content);
    
    // Determine pace rating
    const paceRating = this.determinePaceRating(tensionLevel, actionLevel, wordCount, dialogueRatio);
    
    // Generate scene-specific suggestions
    const suggestions = this.generateSceneSuggestions(
      tensionLevel, emotionalIntensity, actionLevel, dialogueRatio, descriptionRatio, paceRating
    );
    
    return {
      sceneIndex: index,
      sceneTitle: scene.title || `Scene ${index + 1}`,
      tensionLevel,
      emotionalIntensity,
      actionLevel,
      dialogueRatio,
      descriptionRatio,
      paceRating,
      wordCount,
      readingTime,
      suggestions
    };
  }

  private async calculateTensionLevel(content: string, words: string[]): Promise<number> {
    const lowerContent = content.toLowerCase();
    let tensionScore = 0;
    
    // Count tension-building elements
    for (const keyword of this.config.conflictKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        tensionScore += matches.length * 2;
      }
    }
    
    // Count suspense indicators
    const suspensePatterns = [
      /\\b(?:suddenly|unexpectedly|without warning|out of nowhere)\\b/gi,
      /\\b(?:danger|threat|risk|peril|crisis)\\b/gi,
      /\\b(?:afraid|scared|terrified|worried|anxious)\\b/gi,
      /[!]{2,}/g, // Multiple exclamation marks
      /[?]{2,}/g  // Multiple question marks
    ];
    
    for (const pattern of suspensePatterns) {
      const matches = lowerContent.match(pattern);
      if (matches) {
        tensionScore += matches.length * 1.5;
      }
    }
    
    // Normalize to 0-10 scale
    const normalizedScore = Math.min(10, (tensionScore / words.length) * 100);
    return Math.round(normalizedScore * 10) / 10;
  }

  private async calculateEmotionalIntensity(content: string, words: string[]): Promise<number> {
    const lowerContent = content.toLowerCase();
    let emotionScore = 0;
    
    // High-intensity emotions (weight: 3)
    const highIntensityEmotions = [
      'love', 'hate', 'rage', 'fury', 'terror', 'ecstasy', 'despair', 'devastated',
      'elated', 'thrilled', 'horrified', 'amazed', 'shocked', 'stunned'
    ];
    
    // Medium-intensity emotions (weight: 2)
    const mediumIntensityEmotions = [
      'happy', 'sad', 'angry', 'afraid', 'excited', 'worried', 'pleased',
      'upset', 'concerned', 'hopeful', 'disappointed', 'surprised'
    ];
    
    // Low-intensity emotions (weight: 1)
    const lowIntensityEmotions = [
      'content', 'calm', 'peaceful', 'relaxed', 'comfortable', 'satisfied',
      'curious', 'interested', 'thoughtful', 'contemplative'
    ];
    
    for (const emotion of highIntensityEmotions) {
      const regex = new RegExp(`\\b${emotion}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        emotionScore += matches.length * 3;
      }
    }
    
    for (const emotion of mediumIntensityEmotions) {
      const regex = new RegExp(`\\b${emotion}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        emotionScore += matches.length * 2;
      }
    }
    
    for (const emotion of lowIntensityEmotions) {
      const regex = new RegExp(`\\b${emotion}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        emotionScore += matches.length * 1;
      }
    }
    
    // Normalize to 0-10 scale
    const normalizedScore = Math.min(10, (emotionScore / words.length) * 50);
    return Math.round(normalizedScore * 10) / 10;
  }

  private async calculateActionLevel(content: string, words: string[]): Promise<number> {
    const lowerContent = content.toLowerCase();
    let actionScore = 0;
    
    // Count action verbs and phrases
    for (const keyword of this.config.actionKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        actionScore += matches.length * 2;
      }
    }
    
    // Count short, punchy sentences (indicate fast pacing)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const shortSentences = sentences.filter(s => s.trim().split(/\s+/).length <= 8);
    actionScore += (shortSentences.length / sentences.length) * 5;
    
    // Count present tense verbs (more immediate)
    const presentTensePattern = /\\b\\w+(?:s|es|ies)\\b/g;
    const presentTenseMatches = lowerContent.match(presentTensePattern);
    if (presentTenseMatches) {
      actionScore += (presentTenseMatches.length / words.length) * 10;
    }
    
    // Normalize to 0-10 scale
    const normalizedScore = Math.min(10, (actionScore / words.length) * 100);
    return Math.round(normalizedScore * 10) / 10;
  }

  private calculateDialogueRatio(content: string): number {
    // Count dialogue (text within quotes)
    const dialogueMatches = content.match(/["']([^"']*?)["']/g);
    const dialogueWords = dialogueMatches 
      ? dialogueMatches.join(' ').split(/\s+/).length 
      : 0;
    
    const totalWords = content.split(/\s+/).length;
    return totalWords > 0 ? Math.round((dialogueWords / totalWords) * 100) / 100 : 0;
  }

  private calculateDescriptionRatio(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let descriptiveSentences = 0;
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Check for descriptive markers
      const hasDescriptiveMarkers = this.config.descriptionMarkers.some(marker => 
        lowerSentence.includes(marker)
      );
      
      // Check for adjectives and adverbs
      const adjectivePattern = /\\b\\w+(?:ly|ful|ous|ive|able|ible)\\b/g;
      const adjectiveMatches = lowerSentence.match(adjectivePattern);
      
      if (hasDescriptiveMarkers || (adjectiveMatches && adjectiveMatches.length > 2)) {
        descriptiveSentences++;
      }
    }
    
    return sentences.length > 0 ? Math.round((descriptiveSentences / sentences.length) * 100) / 100 : 0;
  }

  private determinePaceRating(
    tensionLevel: number, 
    actionLevel: number, 
    wordCount: number, 
    dialogueRatio: number
  ): ScenePacingAnalysis['paceRating'] {
    const paceScore = (tensionLevel + actionLevel) / 2;
    const dialogueBoost = dialogueRatio > 0.5 ? 1 : 0; // Dialogue tends to increase pace
    const lengthPenalty = wordCount > 2000 ? -1 : 0; // Very long scenes feel slower
    
    const adjustedScore = paceScore + dialogueBoost + lengthPenalty;
    
    if (adjustedScore >= 8) return 'very_fast';
    if (adjustedScore >= 6) return 'fast';
    if (adjustedScore >= 4) return 'moderate';
    if (adjustedScore >= 2) return 'slow';
    return 'very_slow';
  }

  private generateSceneSuggestions(
    tensionLevel: number,
    emotionalIntensity: number,
    actionLevel: number,
    dialogueRatio: number,
    descriptionRatio: number,
    paceRating: ScenePacingAnalysis['paceRating']
  ): string[] {
    const suggestions: string[] = [];
    
    // Tension-based suggestions
    if (tensionLevel < 3) {
      suggestions.push('Consider adding conflict or suspense to increase tension');
      suggestions.push('Introduce obstacles or complications for the characters');
    } else if (tensionLevel > 8) {
      suggestions.push('Consider adding moments of relief to prevent reader fatigue');
      suggestions.push('Balance high tension with character development');
    }
    
    // Emotional intensity suggestions
    if (emotionalIntensity < 2) {
      suggestions.push('Add more emotional depth to character interactions');
      suggestions.push('Show character reactions and internal thoughts');
    }
    
    // Action level suggestions
    if (actionLevel < 2 && paceRating === 'very_slow') {
      suggestions.push('Add more dynamic action or movement');
      suggestions.push('Use shorter sentences to increase pace');
    } else if (actionLevel > 8) {
      suggestions.push('Consider adding moments of reflection or dialogue');
      suggestions.push('Balance action with character development');
    }
    
    // Dialogue ratio suggestions
    if (dialogueRatio < 0.1) {
      suggestions.push('Consider adding dialogue to break up narrative');
      suggestions.push('Use character conversations to reveal information');
    } else if (dialogueRatio > 0.8) {
      suggestions.push('Balance dialogue with action and description');
      suggestions.push('Add narrative context to ground the conversation');
    }
    
    // Description ratio suggestions
    if (descriptionRatio > 0.7) {
      suggestions.push('Reduce descriptive passages to improve pacing');
      suggestions.push('Integrate description with action and dialogue');
    } else if (descriptionRatio < 0.1) {
      suggestions.push('Add more sensory details to immerse readers');
      suggestions.push('Describe settings and character appearances');
    }
    
    return suggestions;
  }

  private generateTensionCurve(sceneAnalysis: ScenePacingAnalysis[]): TensionCurve {
    const points = sceneAnalysis.map((analysis, index) => ({
      sceneIndex: index,
      position: (index / (sceneAnalysis.length - 1)) * 100,
      tensionLevel: analysis.tensionLevel,
      emotionalIntensity: analysis.emotionalIntensity,
      actionLevel: analysis.actionLevel,
      overallIntensity: (analysis.tensionLevel + analysis.emotionalIntensity + analysis.actionLevel) / 3
    }));
    
    return {
      points,
      peakTension: Math.max(...points.map(p => p.overallIntensity)),
      averageTension: points.reduce((sum, p) => sum + p.overallIntensity, 0) / points.length,
      climaxPosition: this.findClimaxPosition(points)
    };
  }

  private findClimaxPosition(points: Array<{ overallIntensity: number; position: number }>): number {
    let maxIntensity = 0;
    let climaxPosition = 50; // Default to middle
    
    for (const point of points) {
      if (point.overallIntensity > maxIntensity) {
        maxIntensity = point.overallIntensity;
        climaxPosition = point.position;
      }
    }
    
    return climaxPosition;
  }

  private calculateOverallMetrics(sceneAnalysis: ScenePacingAnalysis[], tensionCurve: TensionCurve): PacingMetrics {
    const tensions = sceneAnalysis.map(s => s.tensionLevel);
    const averageTension = tensions.reduce((sum, t) => sum + t, 0) / tensions.length;
    
    // Calculate variance
    const tensionVariance = tensions.reduce((sum, t) => sum + Math.pow(t - averageTension, 2), 0) / tensions.length;
    
    // Find climax intensity and position
    const climaxIntensity = tensionCurve.peakTension;
    const climaxPosition = tensionCurve.climaxPosition;
    
    // Calculate readability score (based on sentence variety and pacing)
    const readabilityScore = this.calculateReadabilityScore(sceneAnalysis);
    
    // Calculate engagement score (based on tension variation and emotional intensity)
    const engagementScore = this.calculateEngagementScore(sceneAnalysis, tensionVariance);
    
    // Determine overall pacing rating
    const pacingRating = this.determinePacingRating(averageTension, tensionVariance, climaxIntensity, climaxPosition);
    
    return {
      averageTension: Math.round(averageTension * 10) / 10,
      tensionVariance: Math.round(tensionVariance * 10) / 10,
      climaxIntensity: Math.round(climaxIntensity * 10) / 10,
      climaxPosition: Math.round(climaxPosition),
      pacingRating,
      readabilityScore: Math.round(readabilityScore),
      engagementScore: Math.round(engagementScore)
    };
  }

  private calculateReadabilityScore(sceneAnalysis: ScenePacingAnalysis[]): number {
    let score = 100;
    
    // Penalize for too much description
    const avgDescriptionRatio = sceneAnalysis.reduce((sum, s) => sum + s.descriptionRatio, 0) / sceneAnalysis.length;
    if (avgDescriptionRatio > 0.6) score -= 20;
    
    // Penalize for too little dialogue
    const avgDialogueRatio = sceneAnalysis.reduce((sum, s) => sum + s.dialogueRatio, 0) / sceneAnalysis.length;
    if (avgDialogueRatio < 0.2) score -= 15;
    
    // Penalize for very long scenes
    const longScenes = sceneAnalysis.filter(s => s.wordCount > 3000).length;
    score -= (longScenes / sceneAnalysis.length) * 25;
    
    // Reward variety in pacing
    const paceVariety = new Set(sceneAnalysis.map(s => s.paceRating)).size;
    if (paceVariety >= 3) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateEngagementScore(sceneAnalysis: ScenePacingAnalysis[], tensionVariance: number): number {
    let score = 50; // Base score
    
    // Reward good tension variation
    if (tensionVariance > 2 && tensionVariance < 8) score += 20;
    else if (tensionVariance <= 2) score -= 15; // Too flat
    else score -= 10; // Too chaotic
    
    // Reward emotional intensity
    const avgEmotionalIntensity = sceneAnalysis.reduce((sum, s) => sum + s.emotionalIntensity, 0) / sceneAnalysis.length;
    score += Math.min(20, avgEmotionalIntensity * 3);
    
    // Reward action variety
    const actionLevels = sceneAnalysis.map(s => s.actionLevel);
    const actionVariance = actionLevels.reduce((sum, a) => sum + Math.pow(a - (actionLevels.reduce((s, l) => s + l, 0) / actionLevels.length), 2), 0) / actionLevels.length;
    if (actionVariance > 1) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private determinePacingRating(
    averageTension: number,
    tensionVariance: number,
    climaxIntensity: number,
    climaxPosition: number
  ): PacingMetrics['pacingRating'] {
    let score = 0;
    
    // Good average tension (4-7 range)
    if (averageTension >= 4 && averageTension <= 7) score += 25;
    else if (averageTension >= 3 && averageTension <= 8) score += 15;
    else score += 5;
    
    // Good tension variation (2-6 range)
    if (tensionVariance >= 2 && tensionVariance <= 6) score += 25;
    else if (tensionVariance >= 1 && tensionVariance <= 8) score += 15;
    else score += 5;
    
    // Strong climax (7+ intensity)
    if (climaxIntensity >= 7) score += 25;
    else if (climaxIntensity >= 5) score += 15;
    else score += 5;
    
    // Good climax position (60-85% through story)
    if (climaxPosition >= 60 && climaxPosition <= 85) score += 25;
    else if (climaxPosition >= 50 && climaxPosition <= 90) score += 15;
    else score += 5;
    
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  private identifyPacingIssues(sceneAnalysis: ScenePacingAnalysis[], tensionCurve: TensionCurve): PacingIssue[] {
    const issues: PacingIssue[] = [];
    
    // Identify slow start
    const firstQuarter = sceneAnalysis.slice(0, Math.ceil(sceneAnalysis.length / 4));
    const avgStartTension = firstQuarter.reduce((sum, s) => sum + s.tensionLevel, 0) / firstQuarter.length;
    
    if (avgStartTension < 3) {
      issues.push({
        id: 'slow_start',
        type: 'pacing',
        severity: 'medium',
        title: 'Slow Start',
        description: 'The story begins with low tension and may not immediately engage readers',
        affectedScenes: firstQuarter.map(s => s.sceneIndex),
        suggestions: [
          'Start closer to the inciting incident',
          'Add immediate conflict or intrigue',
          'Begin with action or dialogue',
          'Introduce compelling questions early'
        ],
        impact: 'Reader engagement may be low in opening scenes'
      });
    }
    
    // Identify sagging middle
    const middleStart = Math.floor(sceneAnalysis.length * 0.3);
    const middleEnd = Math.floor(sceneAnalysis.length * 0.7);
    const middleSection = sceneAnalysis.slice(middleStart, middleEnd);
    
    if (middleSection.length > 0) {
      const avgMiddleTension = middleSection.reduce((sum, s) => sum + s.tensionLevel, 0) / middleSection.length;
      
      if (avgMiddleTension < 4) {
        issues.push({
          id: 'sagging_middle',
          type: 'structure',
          severity: 'high',
          title: 'Sagging Middle',
          description: 'The middle section lacks sufficient tension and forward momentum',
          affectedScenes: middleSection.map(s => s.sceneIndex),
          suggestions: [
            'Add subplot complications',
            'Introduce new obstacles or revelations',
            'Increase character conflicts',
            'Add time pressure or urgency'
          ],
          impact: 'Readers may lose interest in the middle of the story'
        });
      }
    }
    
    // Identify rushed climax
    if (tensionCurve.climaxPosition > 90) {
      issues.push({
        id: 'rushed_climax',
        type: 'structure',
        severity: 'high',
        title: 'Rushed Climax',
        description: 'The climax occurs too late, leaving insufficient time for resolution',
        affectedScenes: [Math.floor(sceneAnalysis.length * 0.9)],
        suggestions: [
          'Move the climax earlier in the story',
          'Extend the story to allow for proper resolution',
          'Build up to the climax more gradually'
        ],
        impact: 'The ending may feel abrupt or unsatisfying'
      });
    }
    
    // Identify pacing inconsistencies
    const paceChanges = this.identifyAbruptPaceChanges(sceneAnalysis);
    for (const change of paceChanges) {
      issues.push({
        id: `pace_change_${change.sceneIndex}`,
        type: 'pacing',
        severity: 'medium',
        title: 'Abrupt Pace Change',
        description: `Sudden change from ${change.fromPace} to ${change.toPace} pacing`,
        affectedScenes: [change.sceneIndex - 1, change.sceneIndex],
        suggestions: [
          'Add transitional scenes to smooth pace changes',
          'Use bridging techniques between different pacing styles',
          'Ensure pace changes serve the story structure'
        ],
        impact: 'Jarring pace changes can disrupt reader immersion'
      });
    }
    
    // Identify scenes with extreme pacing issues
    for (const scene of sceneAnalysis) {
      if (scene.paceRating === 'very_slow' && scene.tensionLevel < 2) {
        issues.push({
          id: `slow_scene_${scene.sceneIndex}`,
          type: 'pacing',
          severity: 'low',
          title: `Slow Scene: ${scene.sceneTitle}`,
          description: 'Scene has very slow pacing with minimal tension',
          affectedScenes: [scene.sceneIndex],
          suggestions: scene.suggestions,
          impact: 'May cause readers to lose interest'
        });
      }
      
      if (scene.paceRating === 'very_fast' && scene.emotionalIntensity < 3) {
        issues.push({
          id: `rushed_scene_${scene.sceneIndex}`,
          type: 'pacing',
          severity: 'low',
          title: `Rushed Scene: ${scene.sceneTitle}`,
          description: 'Scene moves very quickly without emotional grounding',
          affectedScenes: [scene.sceneIndex],
          suggestions: scene.suggestions,
          impact: 'Readers may feel disconnected from characters'
        });
      }
    }
    
    return issues;
  }

  private identifyAbruptPaceChanges(sceneAnalysis: ScenePacingAnalysis[]): Array<{
    sceneIndex: number;
    fromPace: string;
    toPace: string;
  }> {
    const changes: Array<{ sceneIndex: number; fromPace: string; toPace: string }> = [];
    
    const paceOrder = ['very_slow', 'slow', 'moderate', 'fast', 'very_fast'];
    
    for (let i = 1; i < sceneAnalysis.length; i++) {
      const prevPace = sceneAnalysis[i - 1].paceRating;
      const currentPace = sceneAnalysis[i].paceRating;
      
      const prevIndex = paceOrder.indexOf(prevPace);
      const currentIndex = paceOrder.indexOf(currentPace);
      
      // Consider it abrupt if there's a change of 2+ levels
      if (Math.abs(currentIndex - prevIndex) >= 2) {
        changes.push({
          sceneIndex: i,
          fromPace: prevPace,
          toPace: currentPace
        });
      }
    }
    
    return changes;
  }

  private async generateRecommendations(
    sceneAnalysis: ScenePacingAnalysis[],
    pacingIssues: PacingIssue[],
    overallPacing: PacingMetrics
  ): Promise<PacingRecommendation[]> {
    const recommendations: PacingRecommendation[] = [];
    
    // Generate recommendations based on overall pacing rating
    if (overallPacing.pacingRating === 'poor' || overallPacing.pacingRating === 'fair') {
      recommendations.push({
        id: 'improve_overall_pacing',
        type: 'pacing',
        priority: 'high',
        title: 'Improve Overall Pacing',
        description: 'The story\'s overall pacing needs improvement to better engage readers',
        targetScenes: [],
        implementation: [
          'Review tension curve and identify flat sections',
          'Add more variety in scene pacing',
          'Ensure proper buildup to climactic moments',
          'Balance action, dialogue, and description'
        ],
        expectedImpact: 'Significantly improved reader engagement and story flow'
      });
    }
    
    // Generate recommendations based on specific issues
    for (const issue of pacingIssues) {
      if (issue.severity === 'high' || issue.severity === 'medium') {
        recommendations.push({
          id: `fix_${issue.id}`,
          type: issue.type as PacingRecommendation['type'],
          priority: issue.severity === 'high' ? 'high' : 'medium',
          title: `Address ${issue.title}`,
          description: issue.description,
          targetScenes: issue.affectedScenes,
          implementation: issue.suggestions,
          expectedImpact: issue.impact
        });
      }
    }
    
    // Generate recommendations for tension curve optimization
    if (overallPacing.tensionVariance < 2) {
      recommendations.push({
        id: 'increase_tension_variety',
        type: 'tension',
        priority: 'medium',
        title: 'Increase Tension Variety',
        description: 'The story maintains too consistent tension levels, which may feel monotonous',
        targetScenes: [],
        implementation: [
          'Add more peaks and valleys in tension',
          'Alternate between high-tension and relief scenes',
          'Use subplots to create tension variation',
          'Vary conflict types and intensities'
        ],
        expectedImpact: 'More dynamic and engaging reading experience'
      });
    }
    
    if (overallPacing.climaxIntensity < 6) {
      recommendations.push({
        id: 'strengthen_climax',
        type: 'structure',
        priority: 'high',
        title: 'Strengthen Climax',
        description: 'The story\'s climax lacks sufficient intensity and impact',
        targetScenes: [Math.floor(sceneAnalysis.length * (overallPacing.climaxPosition / 100))],
        implementation: [
          'Increase stakes and consequences',
          'Add more emotional weight to the climax',
          'Ensure all story threads converge',
          'Make the resolution more challenging for characters'
        ],
        expectedImpact: 'More satisfying and memorable story conclusion'
      });
    }
    
    // Sort recommendations by priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private createVisualizationData(
    sceneAnalysis: ScenePacingAnalysis[],
    tensionCurve: TensionCurve,
    pacingIssues: PacingIssue[]
  ): PacingVisualizationData {
    // Create tension points for visualization
    const tensionPoints = sceneAnalysis.map((scene, index) => ({
      x: (index / (sceneAnalysis.length - 1)) * 100,
      y: scene.tensionLevel,
      label: scene.sceneTitle
    }));
    
    // Create pacing curve (combination of tension, emotion, and action)
    const pacingCurve = sceneAnalysis.map((scene, index) => ({
      x: (index / (sceneAnalysis.length - 1)) * 100,
      y: (scene.tensionLevel + scene.emotionalIntensity + scene.actionLevel) / 3
    }));
    
    // Create climax markers
    const climaxMarkers = [{
      x: tensionCurve.climaxPosition,
      label: 'Climax'
    }];
    
    // Create issue markers
    const issueMarkers = pacingIssues.map(issue => ({
      x: issue.affectedScenes.length > 0 
        ? (issue.affectedScenes[0] / (sceneAnalysis.length - 1)) * 100 
        : 50,
      type: issue.type,
      severity: issue.severity
    }));
    
    // Create ideal curve for comparison (basic three-act structure)
    const idealCurve = this.generateIdealCurve();
    
    return {
      tensionPoints,
      pacingCurve,
      climaxMarkers,
      issueMarkers,
      idealCurve
    };
  }

  private generateIdealCurve(): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    
    // Generate ideal three-act structure curve
    for (let x = 0; x <= 100; x += 5) {
      let y: number;
      
      if (x <= 25) {
        // Act 1: Rising action
        y = 2 + (x / 25) * 3; // 2 to 5
      } else if (x <= 50) {
        // Early Act 2: Continued rise with midpoint peak
        y = 5 + ((x - 25) / 25) * 2; // 5 to 7
      } else if (x <= 75) {
        // Late Act 2: Dip then rise to climax
        const midPoint = (x - 50) / 25;
        y = 7 - midPoint * 2 + Math.pow(midPoint, 2) * 4; // Dip then rise
      } else {
        // Act 3: Climax and resolution
        if (x <= 85) {
          y = 8 + ((x - 75) / 10) * 2; // Rise to climax (10)
        } else {
          y = 10 - ((x - 85) / 15) * 7; // Fall to resolution (3)
        }
      }
      
      points.push({ x, y: Math.max(0, Math.min(10, y)) });
    }
    
    return points;
  }

  // Public API methods
  async getScenePacingAnalysis(story: Story, sceneIndex: number): Promise<ScenePacingAnalysis | null> {
    const scenes = story.scenes || [];
    if (sceneIndex < 0 || sceneIndex >= scenes.length) {
      return null;
    }
    
    return await this.analyzeScene(scenes[sceneIndex], sceneIndex);
  }

  async getTensionCurveData(story: Story): Promise<TensionCurve> {
    const analysis = await this.analyzePacing(story);
    return analysis.tensionCurve;
  }

  async validatePacing(story: Story): Promise<{ valid: boolean; issues: string[] }> {
    const analysis = await this.analyzePacing(story);
    const issues: string[] = [];
    
    if (analysis.overallPacing.pacingRating === 'poor') {
      issues.push('Overall pacing needs significant improvement');
    }
    
    const highSeverityIssues = analysis.pacingIssues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length > 0) {
      issues.push(`Found ${highSeverityIssues.length} high-severity pacing issues`);
    }
    
    if (analysis.overallPacing.climaxIntensity < 5) {
      issues.push('Climax lacks sufficient intensity');
    }
    
    if (analysis.overallPacing.engagementScore < 50) {
      issues.push('Story may not sufficiently engage readers');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}