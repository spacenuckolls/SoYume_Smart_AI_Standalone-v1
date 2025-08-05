"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorySearchUtils = exports.SceneUtils = exports.ChapterUtils = exports.CharacterUtils = exports.StoryUtils = exports.IdGenerator = void 0;
// ID generation utilities
class IdGenerator {
    static generateStoryId() {
        return `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateCharacterId(storyId) {
        return `${storyId}-char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateChapterId(storyId) {
        return `${storyId}-chap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateSceneId(chapterId) {
        return `${chapterId}-scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.IdGenerator = IdGenerator;
// Story creation and manipulation utilities
class StoryUtils {
    static createEmptyStory(title) {
        const storyId = IdGenerator.generateStoryId();
        const now = new Date();
        return {
            id: storyId,
            title: title.trim(),
            genre: [],
            structure: this.createDefaultStructure(),
            characters: [],
            chapters: [],
            metadata: this.createDefaultMetadata(),
            analysisCache: {
                lastAnalyzed: now
            },
            createdAt: now,
            updatedAt: now
        };
    }
    static createDefaultStructure() {
        return {
            type: 'three-act',
            beats: this.getThreeActBeats(),
            currentBeat: undefined
        };
    }
    static createDefaultMetadata() {
        return {
            targetWordCount: 80000,
            currentWordCount: 0,
            targetAudience: '',
            contentRating: 'PG-13',
            tags: [],
            notes: ''
        };
    }
    static getThreeActBeats() {
        return [
            {
                name: 'Opening Image',
                description: 'A visual that represents the struggle and tone of the story',
                targetWordCount: 1000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Inciting Incident',
                description: 'The event that sets the story in motion',
                targetWordCount: 2000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Plot Point 1',
                description: 'The protagonist enters the new world or situation',
                targetWordCount: 5000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Midpoint',
                description: 'A major revelation or turning point',
                targetWordCount: 10000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Plot Point 2',
                description: 'The final push toward the climax',
                targetWordCount: 15000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Climax',
                description: 'The final confrontation and resolution',
                targetWordCount: 20000,
                completed: false,
                chapterIds: []
            },
            {
                name: 'Resolution',
                description: 'The aftermath and new normal',
                targetWordCount: 25000,
                completed: false,
                chapterIds: []
            }
        ];
    }
    static getSaveTheCatBeats() {
        return [
            {
                name: 'Opening Image',
                description: 'A visual that represents the struggle and tone of the story',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Theme Stated',
                description: 'What your story is about; the message, the truth',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Set-Up',
                description: 'Expand on the opening image and introduce characters',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Catalyst',
                description: 'The moment where life as it is changes',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Debate',
                description: 'The question is asked: what should I do?',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Break into Two',
                description: 'The protagonist makes a choice and the journey begins',
                completed: false,
                chapterIds: []
            },
            {
                name: 'B Story',
                description: 'The subplot kicks in, often romantic or friendship',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Fun and Games',
                description: 'The promise of the premise is explored',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Midpoint',
                description: 'Halfway point where stakes are raised',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Bad Guys Close In',
                description: 'Forces of antagonism gather',
                completed: false,
                chapterIds: []
            },
            {
                name: 'All Is Lost',
                description: 'The lowest point for the hero',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Dark Night of the Soul',
                description: 'The hero contemplates giving up',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Break into Three',
                description: 'The hero finds the solution',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Finale',
                description: 'The climax and resolution',
                completed: false,
                chapterIds: []
            },
            {
                name: 'Final Image',
                description: 'The opposite of the opening image',
                completed: false,
                chapterIds: []
            }
        ];
    }
    static calculateProgress(story) {
        if (story.metadata.targetWordCount === 0)
            return 0;
        return Math.min(100, (story.metadata.currentWordCount / story.metadata.targetWordCount) * 100);
    }
    static updateWordCount(story) {
        const totalWords = story.chapters.reduce((total, chapter) => {
            return total + (chapter.wordCount || 0);
        }, 0);
        return {
            ...story,
            metadata: {
                ...story.metadata,
                currentWordCount: totalWords
            },
            updatedAt: new Date()
        };
    }
    static getCompletedBeats(story) {
        return story.structure.beats.filter(beat => beat.completed);
    }
    static getNextBeat(story) {
        const incompleteBeat = story.structure.beats.find(beat => !beat.completed);
        return incompleteBeat || null;
    }
    static markBeatComplete(story, beatName, chapterIds) {
        const updatedBeats = story.structure.beats.map(beat => {
            if (beat.name === beatName) {
                return {
                    ...beat,
                    completed: true,
                    chapterIds: [...new Set([...beat.chapterIds, ...chapterIds])]
                };
            }
            return beat;
        });
        return {
            ...story,
            structure: {
                ...story.structure,
                beats: updatedBeats,
                currentBeat: this.getNextBeat({ ...story, structure: { ...story.structure, beats: updatedBeats } })?.name
            },
            updatedAt: new Date()
        };
    }
}
exports.StoryUtils = StoryUtils;
// Character utilities
class CharacterUtils {
    static createEmptyCharacter(storyId, name) {
        return {
            id: IdGenerator.generateCharacterId(storyId),
            name: name.trim(),
            archetype: {
                primary: '',
                description: '',
                commonTraits: []
            },
            traits: {
                personality: [],
                motivations: [],
                fears: [],
                strengths: [],
                weaknesses: [],
                quirks: []
            },
            relationships: [],
            developmentArc: {
                startState: '',
                endState: '',
                keyMoments: [],
                completed: false
            },
            voiceProfile: {
                vocabulary: [],
                speechPatterns: [],
                commonPhrases: [],
                formalityLevel: 5,
                emotionalRange: []
            }
        };
    }
    static addRelationship(character, targetCharacterId, relationship) {
        const existingRelationshipIndex = character.relationships.findIndex(rel => rel.characterId === targetCharacterId);
        const newRelationship = {
            characterId: targetCharacterId,
            ...relationship
        };
        let updatedRelationships;
        if (existingRelationshipIndex >= 0) {
            updatedRelationships = [...character.relationships];
            updatedRelationships[existingRelationshipIndex] = newRelationship;
        }
        else {
            updatedRelationships = [...character.relationships, newRelationship];
        }
        return {
            ...character,
            relationships: updatedRelationships
        };
    }
    static removeRelationship(character, targetCharacterId) {
        return {
            ...character,
            relationships: character.relationships.filter(rel => rel.characterId !== targetCharacterId)
        };
    }
    static getRelationshipWith(character, targetCharacterId) {
        return character.relationships.find(rel => rel.characterId === targetCharacterId) || null;
    }
    static calculateArcProgress(character) {
        if (character.developmentArc.keyMoments.length === 0)
            return 0;
        const totalProgress = character.developmentArc.keyMoments.reduce((sum, moment) => sum + moment.arcProgress, 0);
        return totalProgress / character.developmentArc.keyMoments.length;
    }
    static addArcMoment(character, moment, progress) {
        const newMoment = {
            ...moment,
            arcProgress: Math.max(0, Math.min(100, progress))
        };
        const updatedArc = {
            ...character.developmentArc,
            keyMoments: [...character.developmentArc.keyMoments, newMoment],
            completed: progress >= 100
        };
        return {
            ...character,
            developmentArc: updatedArc
        };
    }
}
exports.CharacterUtils = CharacterUtils;
// Chapter utilities
class ChapterUtils {
    static createEmptyChapter(storyId, title, order) {
        return {
            id: IdGenerator.generateChapterId(storyId),
            storyId,
            title: title.trim(),
            content: '',
            scenes: [],
            order,
            wordCount: 0
        };
    }
    static calculateWordCount(content) {
        if (!content || content.trim() === '')
            return 0;
        // Remove extra whitespace and split by words
        const words = content.trim().split(/\s+/);
        return words.filter(word => word.length > 0).length;
    }
    static updateWordCount(chapter) {
        const contentWordCount = this.calculateWordCount(chapter.content);
        const sceneWordCount = chapter.scenes.reduce((total, scene) => {
            return total + this.calculateWordCount(scene.content);
        }, 0);
        return {
            ...chapter,
            wordCount: contentWordCount + sceneWordCount
        };
    }
    static addScene(chapter, scene) {
        const newScene = {
            id: IdGenerator.generateSceneId(chapter.id),
            chapterId: chapter.id,
            order: chapter.scenes.length + 1,
            ...scene
        };
        return {
            ...chapter,
            scenes: [...chapter.scenes, newScene]
        };
    }
    static removeScene(chapter, sceneId) {
        const updatedScenes = chapter.scenes
            .filter(scene => scene.id !== sceneId)
            .map((scene, index) => ({ ...scene, order: index + 1 }));
        return {
            ...chapter,
            scenes: updatedScenes
        };
    }
    static reorderScenes(chapter, sceneIds) {
        const sceneMap = new Map(chapter.scenes.map(scene => [scene.id, scene]));
        const reorderedScenes = sceneIds
            .map(id => sceneMap.get(id))
            .filter((scene) => scene !== undefined)
            .map((scene, index) => ({ ...scene, order: index + 1 }));
        return {
            ...chapter,
            scenes: reorderedScenes
        };
    }
    static estimateReadingTime(chapter) {
        // Average reading speed: 200-250 words per minute
        const wordsPerMinute = 225;
        return Math.ceil(chapter.wordCount / wordsPerMinute);
    }
}
exports.ChapterUtils = ChapterUtils;
// Scene utilities
class SceneUtils {
    static createEmptyScene() {
        return {
            setting: {
                location: '',
                timeOfDay: '',
                atmosphere: '',
                sensoryDetails: {
                    visual: [],
                    auditory: [],
                    tactile: [],
                    olfactory: [],
                    gustatory: []
                }
            },
            characters: [],
            mood: {
                primary: '',
                intensity: 5,
                tags: []
            },
            purpose: {
                type: 'plot',
                description: '',
                objectives: []
            },
            content: ''
        };
    }
    static addCharacter(scene, characterId) {
        if (scene.characters.includes(characterId)) {
            return scene; // Character already in scene
        }
        return {
            ...scene,
            characters: [...scene.characters, characterId]
        };
    }
    static removeCharacter(scene, characterId) {
        return {
            ...scene,
            characters: scene.characters.filter(id => id !== characterId)
        };
    }
    static updateMood(scene, mood) {
        return {
            ...scene,
            mood: {
                ...scene.mood,
                ...mood
            }
        };
    }
    static addSensoryDetail(scene, sense, detail) {
        const currentDetails = scene.setting.sensoryDetails[sense];
        if (currentDetails.includes(detail)) {
            return scene; // Detail already exists
        }
        return {
            ...scene,
            setting: {
                ...scene.setting,
                sensoryDetails: {
                    ...scene.setting.sensoryDetails,
                    [sense]: [...currentDetails, detail]
                }
            }
        };
    }
    static removeSensoryDetail(scene, sense, detail) {
        return {
            ...scene,
            setting: {
                ...scene.setting,
                sensoryDetails: {
                    ...scene.setting.sensoryDetails,
                    [sense]: scene.setting.sensoryDetails[sense].filter(d => d !== detail)
                }
            }
        };
    }
}
exports.SceneUtils = SceneUtils;
// Search and filter utilities
class StorySearchUtils {
    static searchCharacters(story, query) {
        const lowercaseQuery = query.toLowerCase();
        return story.characters.filter(character => {
            return (character.name.toLowerCase().includes(lowercaseQuery) ||
                character.archetype.primary.toLowerCase().includes(lowercaseQuery) ||
                character.traits.personality.some(trait => trait.toLowerCase().includes(lowercaseQuery)) ||
                character.traits.motivations.some(motivation => motivation.toLowerCase().includes(lowercaseQuery)));
        });
    }
    static searchChapters(story, query) {
        const lowercaseQuery = query.toLowerCase();
        return story.chapters.filter(chapter => {
            return (chapter.title.toLowerCase().includes(lowercaseQuery) ||
                chapter.content.toLowerCase().includes(lowercaseQuery));
        });
    }
    static searchScenes(story, query) {
        const lowercaseQuery = query.toLowerCase();
        const results = [];
        story.chapters.forEach(chapter => {
            chapter.scenes.forEach(scene => {
                if (scene.content.toLowerCase().includes(lowercaseQuery) ||
                    scene.setting.location.toLowerCase().includes(lowercaseQuery) ||
                    scene.mood.primary.toLowerCase().includes(lowercaseQuery) ||
                    scene.purpose.description.toLowerCase().includes(lowercaseQuery)) {
                    results.push({ chapter, scene });
                }
            });
        });
        return results;
    }
    static filterCharactersByArchetype(story, archetype) {
        return story.characters.filter(character => character.archetype.primary.toLowerCase() === archetype.toLowerCase());
    }
    static filterScenesByPurpose(story, purpose) {
        const results = [];
        story.chapters.forEach(chapter => {
            chapter.scenes.forEach(scene => {
                if (scene.purpose.type === purpose) {
                    results.push({ chapter, scene });
                }
            });
        });
        return results;
    }
}
exports.StorySearchUtils = StorySearchUtils;
//# sourceMappingURL=StoryUtils.js.map