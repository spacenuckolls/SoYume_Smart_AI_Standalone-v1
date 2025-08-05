import { Story, Character, Chapter, Scene, Genre, StoryStructure, CharacterTraits } from '../types/Story';
export declare class StoryFactory {
    static createStory(options: {
        title: string;
        genre?: Genre[];
        structure?: 'save-the-cat' | 'hero-journey' | 'three-act' | 'monogatari';
        targetWordCount?: number;
        targetAudience?: string;
    }): Story;
    static createFromTemplate(template: StoryTemplate): Story;
    private static createStructure;
    private static createMetadata;
    private static getThreeActBeats;
    private static getSaveTheCatBeats;
    private static getHeroJourneyBeats;
    private static getMonogatariBeats;
}
export declare class CharacterFactory {
    static createCharacter(storyId: string, options: {
        name: string;
        archetype?: string;
        role?: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    }): Character;
    static createFromTemplate(storyId: string, template: CharacterTemplate): Character;
    private static getArchetype;
    private static getDefaultTraits;
}
export declare class ChapterFactory {
    static createChapter(storyId: string, options: {
        title: string;
        order: number;
        purpose?: 'setup' | 'development' | 'climax' | 'resolution';
    }): Chapter;
    static createFromTemplate(storyId: string, template: ChapterTemplate, order: number): Chapter;
}
export declare class SceneFactory {
    static createScene(chapterId: string, options: {
        purpose?: Scene['purpose']['type'];
        location?: string;
        characters?: string[];
        mood?: string;
    }): Omit<Scene, 'id' | 'chapterId' | 'order'>;
    static createFromTemplate(chapterId: string, template: SceneTemplate, order: number): Scene;
}
export interface StoryTemplate {
    title: string;
    genres: Genre[];
    structure: StoryStructure['type'];
    targetWordCount: number;
    targetAudience: string;
    characterTemplates: CharacterTemplate[];
    chapterTemplates: ChapterTemplate[];
}
export interface CharacterTemplate {
    name: string;
    archetype: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    traits: Partial<CharacterTraits>;
    startState?: string;
    endState?: string;
}
export interface ChapterTemplate {
    title: string;
    purpose: 'setup' | 'development' | 'climax' | 'resolution';
    sceneTemplates: SceneTemplate[];
}
export interface SceneTemplate {
    purpose: Scene['purpose']['type'];
    location?: string;
    timeOfDay?: string;
    atmosphere?: string;
    characters?: string[];
    mood?: string;
    description?: string;
}
export declare class StoryTemplates {
    static getFantasyAdventureTemplate(): StoryTemplate;
    static getRomanceTemplate(): StoryTemplate;
    static getMysteryTemplate(): StoryTemplate;
}
//# sourceMappingURL=StoryFactory.d.ts.map