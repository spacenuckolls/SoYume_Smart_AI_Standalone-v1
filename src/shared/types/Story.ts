export interface Story {
  id: string;
  title: string;
  genre: Genre[];
  structure: StoryStructure;
  characters: Character[];
  chapters: Chapter[];
  metadata: StoryMetadata;
  analysisCache: AnalysisCache;
  createdAt: Date;
  updatedAt: Date;
  // Additional properties for UI components
  author?: string;
  summary?: string;
  status?: 'draft' | 'in-progress' | 'completed' | 'published';
  favorite?: boolean;
  lastModified?: Date;
  wordCount?: number;
  targetWordCount?: number;
  scenes?: Scene[];
  worldBuilding?: {
    locations?: Array<{ name: string; description?: string }>;
    items?: Array<{ name: string; description?: string }>;
  };
  setting?: string;
}

export interface Character {
  id: string;
  name: string;
  archetype: CharacterArchetype;
  traits: CharacterTraits;
  relationships: Relationship[];
  developmentArc: CharacterArc;
  voiceProfile: VoiceProfile;
  aliases?: string[];
  description?: string;
}

export interface Chapter {
  id: string;
  storyId: string;
  title: string;
  content: string;
  scenes: Scene[];
  order: number;
  wordCount: number;
  analysis?: ChapterAnalysis;
}

export interface Scene {
  id: string;
  chapterId: string;
  setting: Setting;
  characters: string[]; // Character IDs
  mood: Mood;
  purpose: ScenePurpose;
  content: string;
  analysis?: SceneAnalysis;
  order: number;
  title?: string;
  summary?: string;
  isChapterBreak?: boolean;
  sensoryDetails?: SensoryDetails;
}

export interface Genre {
  name: string;
  subgenres: string[];
  conventions: string[];
  tropes: string[];
}

export interface StoryStructure {
  type: 'save-the-cat' | 'hero-journey' | 'three-act' | 'monogatari' | 'custom';
  beats: StructureBeat[];
  currentBeat?: string | undefined;
}

export interface StructureBeat {
  name: string;
  description: string;
  targetWordCount?: number;
  completed: boolean;
  chapterIds: string[];
}

export interface CharacterArchetype {
  primary: string;
  secondary?: string;
  description: string;
  commonTraits: string[];
}

export interface CharacterTraits {
  personality: string[];
  motivations: string[];
  fears: string[];
  strengths: string[];
  weaknesses: string[];
  quirks: string[];
}

export interface Relationship {
  characterId: string;
  type: RelationshipType;
  intensity: number; // 1-10
  direction: 'mutual' | 'one-way';
  status: 'hidden' | 'revealed' | 'developing';
  description: string;
}

export interface CharacterArc {
  startState: string;
  endState: string;
  keyMoments: ArcMoment[];
  completed: boolean;
}

export interface ArcMoment {
  chapterId: string;
  sceneId?: string;
  description: string;
  arcProgress: number; // 0-100
}

export interface VoiceProfile {
  vocabulary: string[];
  speechPatterns: string[];
  commonPhrases: string[];
  formalityLevel: number; // 1-10
  emotionalRange: string[];
}

export interface Setting {
  location: string;
  timeOfDay: string;
  weather?: string;
  atmosphere: string;
  sensoryDetails: SensoryDetails;
}

export interface SensoryDetails {
  visual: string[];
  auditory: string[];
  tactile: string[];
  olfactory: string[];
  gustatory: string[];
}

export type Mood = string;

export interface ScenePurpose {
  type: 'plot' | 'character' | 'world-building' | 'transition' | 'climax';
  description: string;
  objectives: string[];
}

export interface StoryMetadata {
  targetWordCount: number;
  currentWordCount: number;
  targetAudience: string;
  contentRating: string;
  tags: string[];
  notes: string;
}

export interface AnalysisCache {
  lastAnalyzed: Date;
  structureAnalysis?: StructureAnalysis;
  characterAnalysis?: CharacterAnalysisResult;
  pacing?: PacingAnalysis;
  consistency?: ConsistencyReport;
}

export type RelationshipType = 
  | 'romantic' 
  | 'friendship' 
  | 'family' 
  | 'rivalry' 
  | 'mentor-student' 
  | 'enemy' 
  | 'ally' 
  | 'neutral';

// Analysis result types
export interface StructureAnalysis {
  identifiedStructure: string;
  completedBeats: string[];
  missingBeats: string[];
  suggestions: string[];
  confidence: number;
}

export interface CharacterAnalysisResult {
  consistencyScore: number;
  voiceConsistency: number;
  developmentProgress: number;
  relationshipHealth: RelationshipHealth[];
  suggestions: string[];
}

export interface RelationshipHealth {
  characterIds: string[];
  healthScore: number;
  issues: string[];
  suggestions: string[];
}

export interface PacingAnalysis {
  overallPacing: 'too-fast' | 'good' | 'too-slow';
  tensionCurve: TensionPoint[];
  recommendations: string[];
}

export interface TensionPoint {
  chapterId?: string;
  sceneId?: string;
  sceneIndex?: number;
  position?: number;
  tensionLevel: number; // 1-10
  emotionalIntensity?: number;
  actionLevel?: number;
  overallIntensity?: number;
  type: 'rising' | 'falling' | 'climax' | 'resolution';
}

export interface ConsistencyReport {
  overallScore: number;
  plotHoles: PlotHole[];
  characterInconsistencies: CharacterInconsistency[];
  worldBuildingIssues: WorldBuildingIssue[];
}

export interface PlotHole {
  id?: string;
  type?: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  location: {
    chapterId: string;
    sceneId?: string;
  };
  scenes?: number[];
  suggestions: string[];
}

export interface CharacterInconsistency {
  characterId: string;
  issue: string;
  locations: Array<{
    chapterId: string;
    sceneId?: string;
  }>;
  suggestions: string[];
}

export interface WorldBuildingIssue {
  type: string;
  description: string;
  locations: Array<{
    chapterId: string;
    sceneId?: string;
  }>;
  suggestions: string[];
}

export interface SceneAnalysis {
  mood: Mood;
  pacing: number; // 1-10
  tension: number; // 1-10
  characterDevelopment: number; // 1-10
  plotAdvancement: number; // 1-10
  suggestions: string[];
}

export interface ChapterAnalysis {
  wordCount: number;
  readingTime: number; // minutes
  pacing: number; // 1-10
  tension: number; // 1-10
  characterFocus: string[]; // Character IDs
  plotAdvancement: number; // 1-10
  suggestions: string[];
}

// Additional types for StoryProjectManager
export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  genre: Genre[];
  structure: StoryStructure;
  defaultCharacters?: Character[];
  defaultChapters?: Partial<Chapter>[];
}

export interface ProjectStats {
  totalWords: number;
  totalCharacters: number;
  totalScenes: number;
  completionPercentage: number;
  lastModified: Date;
  averageWordsPerDay?: number;
  estimatedCompletionDate?: Date;
}

// Additional missing types that are imported by other files
export interface PlotPoint {
  name: string;
  description: string;
  position: number;
  sceneIndex: number;
  confidence: number;
  missing: boolean;
  characteristics: string[];
  scene?: Scene;
}

export interface StoryArc {
  id: string;
  name: string;
  description: string;
  startChapter: string;
  endChapter: string;
  keyMoments: ArcMoment[];
  completed: boolean;
}

export interface PlotThread {
  id: string;
  name: string;
  description: string;
  introduced: number;
  resolved?: number;
  status: 'active' | 'resolved' | 'abandoned' | 'forgotten';
  importance: 'minor' | 'major' | 'critical';
  relatedCharacters: string[];
  keyScenes: number[];
}

export interface StoryElement {
  id: string;
  type: string;
  name: string;
  description: string;
  properties: Record<string, any>;
}

export type ExportFormat = 'html' | 'markdown' | 'rtf' | 'pdf' | 'docx' | 'txt';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeAnalysis: boolean;
  customSettings?: Record<string, any>;
  title?: string;
  author?: string;
  fileName?: string;
  sceneBreaks?: boolean;
  chapterBreaks?: boolean;
  scenesPerChapter?: number;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AtmosphereProfile {
  mood: string;
  intensity: number;
  sensoryElements: SensoryDetails;
  emotionalTone: string[];
  suggestions: string[];
  dominantSenses?: string[];
  lightingStyle?: string;
  soundscape?: string[];
}

export interface AtmosphereEnhancement {
  originalText: string;
  enhancedText: string;
  improvements: string[];
  confidence: number;
  type?: string;
  description?: string;
  implementation?: string;
  expectedImpact?: string;
  targetArea?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface CrossStoryAnalysisResult {
  consistencyScore: number;
  characterEvolution: CharacterEvolution[];
  themeConsistency: number;
  worldBuildingConsistency: number;
  suggestions: string[];
}

export interface ConsistencyIssue {
  id?: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  locations: Array<{
    storyId: string;
    chapterId?: string;
    sceneId?: string;
  }>;
  suggestions: string[];
  affectedStories?: string[];
}

export interface CharacterEvolution {
  characterId: string;
  characterName: string;
  evolutionScore: number;
  keyChanges: Array<{
    storyId: string;
    description: string;
    impact: number;
  }>;
  consistency: number;
  evolutionType?: string;
}

export interface ForeshadowingElement {
  id: string;
  type: 'hint' | 'symbol' | 'prophecy' | 'setup';
  content: string;
  location: {
    chapterId: string;
    sceneId?: string;
  };
  payoff?: {
    chapterId: string;
    sceneId?: string;
    description: string;
  };
  subtlety: number; // 1-10
  effectiveness: number; // 1-10
}

export interface ForeshadowingAnalysisResult {
  elements: ForeshadowingElement[];
  overallScore: number;
  unresolved: ForeshadowingElement[];
  suggestions: string[];
  overallEffectiveness?: number;
  setupPayoffRatio?: number;
  subtletyScore?: number;
  missedOpportunities?: any[];
  symbols?: any[];
}

export interface TensionCurve {
  points: TensionPoint[];
  peaks: TensionPoint[];
  valleys: TensionPoint[];
  overallTrend: 'rising' | 'falling' | 'stable' | 'erratic';
  peakTension?: number;
  climaxPosition?: number;
}

export interface PacingIssue {
  id?: string;
  type: 'slow_start' | 'rushed_climax' | 'sagging_middle' | 'abrupt_ending' | 'uneven_tension' | 'pacing' | 'structure';
  severity: 'low' | 'medium' | 'high';
  location: { start: number; end: number };
  description: string;
  suggestions: string[];
  title?: string;
  affectedScenes?: number[];
  impact?: string;
}

export interface SceneGenerationRequest {
  title?: string;
  setting: Setting;
  characters: string[];
  purpose: ScenePurpose;
  mood: Mood;
  previousScene?: Scene;
  nextScene?: Scene;
  constraints?: string[];
  style?: string;
  length?: 'short' | 'medium' | 'long';
  participants: Character[];
  options?: {
    sensoryFocus?: string[];
    [key: string]: any;
  };
}

export interface SceneGenerationResult {
  scene: Scene;
  alternatives: Scene[];
  confidence: number;
  suggestions: string[];
  atmosphereResult?: any;
}