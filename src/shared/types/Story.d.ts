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
    author?: string;
    summary?: string;
    status?: 'draft' | 'in-progress' | 'completed' | 'published';
    favorite?: boolean;
    lastModified?: Date;
    wordCount?: number;
    targetWordCount?: number;
    scenes?: Scene[];
}
export interface Character {
    id: string;
    name: string;
    archetype: CharacterArchetype;
    traits: CharacterTraits;
    relationships: Relationship[];
    developmentArc: CharacterArc;
    voiceProfile: VoiceProfile;
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
    characters: string[];
    mood: Mood;
    purpose: ScenePurpose;
    content: string;
    analysis?: SceneAnalysis;
    order: number;
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
    intensity: number;
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
    arcProgress: number;
}
export interface VoiceProfile {
    vocabulary: string[];
    speechPatterns: string[];
    commonPhrases: string[];
    formalityLevel: number;
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
export interface Mood {
    primary: string;
    secondary?: string;
    intensity: number;
    tags: string[];
}
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
export type RelationshipType = 'romantic' | 'friendship' | 'family' | 'rivalry' | 'mentor-student' | 'enemy' | 'ally' | 'neutral';
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
    chapterId: string;
    sceneId?: string;
    tensionLevel: number;
    type: 'rising' | 'falling' | 'climax' | 'resolution';
}
export interface ConsistencyReport {
    overallScore: number;
    plotHoles: PlotHole[];
    characterInconsistencies: CharacterInconsistency[];
    worldBuildingIssues: WorldBuildingIssue[];
}
export interface PlotHole {
    description: string;
    severity: 'minor' | 'moderate' | 'major';
    location: {
        chapterId: string;
        sceneId?: string;
    };
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
    pacing: number;
    tension: number;
    characterDevelopment: number;
    plotAdvancement: number;
    suggestions: string[];
}
export interface ChapterAnalysis {
    wordCount: number;
    readingTime: number;
    pacing: number;
    tension: number;
    characterFocus: string[];
    plotAdvancement: number;
    suggestions: string[];
}
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
//# sourceMappingURL=Story.d.ts.map