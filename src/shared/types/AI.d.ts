import { Story, Character, Scene, StructureAnalysis, CharacterAnalysisResult, PacingAnalysis, ConsistencyReport } from './Story';
export interface AIProvider {
    name: string;
    type: 'cowriter' | 'local' | 'cloud';
    capabilities: AICapability[];
    priority: number;
    initialize(config: ProviderConfig): Promise<void>;
    generateText(prompt: string, context: StoryContext): Promise<AIResponse>;
    analyzeStory(content: string): Promise<StoryAnalysis>;
    generateCharacter(traits: CharacterTraits): Promise<Character>;
    isAvailable(): boolean;
    shutdown(): Promise<void>;
}
export interface CowriterAI extends AIProvider {
    type: 'cowriter';
    generateOutline(premise: string, structure: StoryStructure): Promise<Outline>;
    analyzeManuscript(content: string): Promise<ManuscriptAnalysis>;
    extractCharacters(content: string): Promise<Character[]>;
    suggestSceneStructure(context: SceneContext): Promise<SceneOutline>;
    checkCharacterConsistency(character: Character, scenes: Scene[]): Promise<ConsistencyReport>;
    identifyPlotHoles(story: Story): Promise<PlotIssue[]>;
    suggestForeshadowing(story: Story): Promise<ForeshadowingSuggestion[]>;
    analyzePacing(chapters: Chapter[]): Promise<PacingAnalysis>;
}
export interface ProviderConfig {
    apiKey?: string;
    endpoint?: string;
    modelName?: string;
    localPath?: string;
    parameters?: Record<string, any>;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
}
export interface AICapability {
    name: string;
    description: string;
    inputTypes: string[];
    outputTypes: string[];
    offline: boolean;
}
export interface StoryContext {
    storyId?: string;
    characters: Character[];
    currentChapter?: string;
    currentScene?: string;
    genre: string[];
    targetAudience: string;
    previousContext?: string;
}
export interface AIResponse {
    content: string;
    confidence: number;
    metadata: {
        model: string;
        provider: string;
        tokensUsed: number;
        responseTime: number;
    };
    suggestions?: string[];
    alternatives?: string[];
}
export interface StoryAnalysis {
    structure: StructureAnalysis;
    characters: CharacterAnalysisResult;
    pacing: PacingAnalysis;
    consistency: ConsistencyReport;
    overallScore: number;
    recommendations: string[];
}
export interface CharacterTraits {
    personality: string[];
    motivations: string[];
    fears: string[];
    strengths: string[];
    weaknesses: string[];
    quirks: string[];
}
export interface StoryStructure {
    type: 'save-the-cat' | 'hero-journey' | 'three-act' | 'monogatari' | 'custom';
    beats: StructureBeat[];
    currentBeat?: string;
}
export interface StructureBeat {
    name: string;
    description: string;
    targetWordCount?: number;
    completed: boolean;
    chapterIds: string[];
}
export interface Outline {
    title: string;
    premise: string;
    structure: StoryStructure;
    chapters: ChapterOutline[];
    characters: Character[];
    themes: string[];
    estimatedWordCount: number;
}
export interface ChapterOutline {
    title: string;
    summary: string;
    scenes: SceneOutline[];
    estimatedWordCount: number;
    structureBeat?: string;
}
export interface SceneOutline {
    summary: string;
    purpose: string;
    characters: string[];
    setting: string;
    mood: string;
    estimatedWordCount: number;
}
export interface ManuscriptAnalysis {
    extractedElements: {
        characters: Character[];
        settings: string[];
        plotPoints: string[];
        themes: string[];
    };
    structure: StructureAnalysis;
    suggestions: string[];
    confidence: number;
}
export interface SceneContext {
    previousScenes: Scene[];
    characters: Character[];
    setting: string;
    mood: string;
    purpose: string;
    targetWordCount: number;
}
export interface PlotIssue {
    type: 'plot-hole' | 'inconsistency' | 'pacing' | 'character';
    severity: 'minor' | 'moderate' | 'major';
    description: string;
    location: {
        chapterId: string;
        sceneId?: string;
    };
    suggestions: string[];
}
export interface ForeshadowingSuggestion {
    element: string;
    currentLocation: {
        chapterId: string;
        sceneId?: string;
    };
    suggestedPlacement: {
        chapterId: string;
        sceneId?: string;
    };
    technique: string;
    description: string;
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
export interface ChapterAnalysis {
    wordCount: number;
    readingTime: number;
    pacing: number;
    tension: number;
    characterFocus: string[];
    plotAdvancement: number;
    suggestions: string[];
}
export interface AIRouter {
    routeRequest(request: AIRequest): Promise<AIProvider>;
    getAvailableProviders(): AIProvider[];
    setProviderPriority(providerName: string, priority: number): void;
}
export interface AIRequest {
    type: AIRequestType;
    content: string;
    context: StoryContext;
    options?: {
        preferredProvider?: string;
        maxTokens?: number;
        temperature?: number;
        requireOffline?: boolean;
    };
}
export type AIRequestType = 'outline' | 'character_analysis' | 'scene_structure' | 'prose_generation' | 'dialogue_generation' | 'story_analysis' | 'plot_hole_detection' | 'pacing_analysis' | 'consistency_check' | 'manuscript_analysis' | 'research' | 'brainstorming';
export interface OpenAIProvider extends AIProvider {
    type: 'cloud';
    models: string[];
}
export interface AnthropicProvider extends AIProvider {
    type: 'cloud';
    models: string[];
}
export interface OllamaProvider extends AIProvider {
    type: 'local';
    installedModels: string[];
    isRunning(): boolean;
    startService(): Promise<void>;
    stopService(): Promise<void>;
}
export interface LMStudioProvider extends AIProvider {
    type: 'local';
    availableModels: string[];
    currentModel?: string;
}
export interface SetupWizardStep {
    id: string;
    title: string;
    description: string;
    component: string;
    canSkip: boolean;
    isComplete: boolean;
}
export interface LocalAIOption {
    name: string;
    description: string;
    requirements: string[];
    installationMethod: 'automatic' | 'manual' | 'docker';
    isInstalled: boolean;
    downloadSize?: string;
    systemRequirements: {
        minRAM: string;
        minStorage: string;
        gpu?: string;
    };
}
export interface InstallationProgress {
    step: string;
    progress: number;
    message: string;
    error?: string;
}
//# sourceMappingURL=AI.d.ts.map