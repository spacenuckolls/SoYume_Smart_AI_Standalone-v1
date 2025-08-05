import { Story, Character, Chapter, Scene, StoryStructure, StructureBeat, CharacterArc, Relationship, StoryMetadata } from '../types/Story';
export declare class IdGenerator {
    static generateStoryId(): string;
    static generateCharacterId(storyId: string): string;
    static generateChapterId(storyId: string): string;
    static generateSceneId(chapterId: string): string;
}
export declare class StoryUtils {
    static createEmptyStory(title: string): Story;
    static createDefaultStructure(): StoryStructure;
    static createDefaultMetadata(): StoryMetadata;
    static getThreeActBeats(): StructureBeat[];
    static getSaveTheCatBeats(): StructureBeat[];
    static calculateProgress(story: Story): number;
    static updateWordCount(story: Story): Story;
    static getCompletedBeats(story: Story): StructureBeat[];
    static getNextBeat(story: Story): StructureBeat | null;
    static markBeatComplete(story: Story, beatName: string, chapterIds: string[]): Story;
}
export declare class CharacterUtils {
    static createEmptyCharacter(storyId: string, name: string): Character;
    static addRelationship(character: Character, targetCharacterId: string, relationship: Omit<Relationship, 'characterId'>): Character;
    static removeRelationship(character: Character, targetCharacterId: string): Character;
    static getRelationshipWith(character: Character, targetCharacterId: string): Relationship | null;
    static calculateArcProgress(character: Character): number;
    static addArcMoment(character: Character, moment: Omit<CharacterArc['keyMoments'][0], 'arcProgress'>, progress: number): Character;
}
export declare class ChapterUtils {
    static createEmptyChapter(storyId: string, title: string, order: number): Chapter;
    static calculateWordCount(content: string): number;
    static updateWordCount(chapter: Chapter): Chapter;
    static addScene(chapter: Chapter, scene: Omit<Scene, 'id' | 'chapterId' | 'order'>): Chapter;
    static removeScene(chapter: Chapter, sceneId: string): Chapter;
    static reorderScenes(chapter: Chapter, sceneIds: string[]): Chapter;
    static estimateReadingTime(chapter: Chapter): number;
}
export declare class SceneUtils {
    static createEmptyScene(): Omit<Scene, 'id' | 'chapterId' | 'order'>;
    static addCharacter(scene: Scene, characterId: string): Scene;
    static removeCharacter(scene: Scene, characterId: string): Scene;
    static updateMood(scene: Scene, mood: Partial<Scene['mood']>): Scene;
    static addSensoryDetail(scene: Scene, sense: keyof Scene['setting']['sensoryDetails'], detail: string): Scene;
    static removeSensoryDetail(scene: Scene, sense: keyof Scene['setting']['sensoryDetails'], detail: string): Scene;
}
export declare class StorySearchUtils {
    static searchCharacters(story: Story, query: string): Character[];
    static searchChapters(story: Story, query: string): Chapter[];
    static searchScenes(story: Story, query: string): {
        chapter: Chapter;
        scene: Scene;
    }[];
    static filterCharactersByArchetype(story: Story, archetype: string): Character[];
    static filterScenesByPurpose(story: Story, purpose: Scene['purpose']['type']): {
        chapter: Chapter;
        scene: Scene;
    }[];
}
//# sourceMappingURL=StoryUtils.d.ts.map