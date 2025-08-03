import { 
  StoryValidator, 
  CharacterValidator, 
  ChapterValidator, 
  SceneValidator 
} from '../StoryValidation';
import { Story, Character, Chapter, Scene } from '../../types/Story';

describe('StoryValidator', () => {
  const validStory: Partial<Story> = {
    id: 'story-123',
    title: 'Test Story',
    genre: [
      {
        name: 'Fantasy',
        subgenres: ['High Fantasy'],
        conventions: ['Magic'],
        tropes: ['Chosen One']
      }
    ],
    structure: {
      type: 'three-act',
      beats: [
        {
          name: 'Setup',
          description: 'Beginning',
          completed: false,
          chapterIds: []
        }
      ]
    },
    characters: [],
    chapters: [],
    metadata: {
      targetWordCount: 80000,
      currentWordCount: 0,
      targetAudience: 'Young Adult',
      contentRating: 'PG-13',
      tags: ['fantasy', 'adventure'],
      notes: ''
    }
  };

  describe('validate', () => {
    it('should validate a complete story successfully', () => {
      const result = StoryValidator.validate(validStory);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require story ID', () => {
      const storyWithoutId = { ...validStory };
      delete storyWithoutId.id;
      
      const result = StoryValidator.validate(storyWithoutId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'Story ID is required',
        code: 'STORY_ID_REQUIRED'
      });
    });

    it('should require story title', () => {
      const storyWithoutTitle = { ...validStory };
      delete storyWithoutTitle.title;
      
      const result = StoryValidator.validate(storyWithoutTitle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Story title is required',
        code: 'STORY_TITLE_REQUIRED'
      });
    });

    it('should validate title length', () => {
      const storyWithLongTitle = {
        ...validStory,
        title: 'A'.repeat(201)
      };
      
      const result = StoryValidator.validate(storyWithLongTitle);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Story title must be 200 characters or less',
        code: 'STORY_TITLE_TOO_LONG'
      });
    });

    it('should warn about missing genre', () => {
      const storyWithoutGenre = { ...validStory };
      delete storyWithoutGenre.genre;
      
      const result = StoryValidator.validate(storyWithoutGenre);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'genre',
        message: 'Consider adding at least one genre to help categorize your story',
        code: 'STORY_GENRE_MISSING'
      });
    });

    it('should validate metadata', () => {
      const storyWithInvalidMetadata = {
        ...validStory,
        metadata: {
          ...validStory.metadata!,
          targetWordCount: -100
        }
      };
      
      const result = StoryValidator.validate(storyWithInvalidMetadata);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'metadata.targetWordCount',
        message: 'Target word count must be greater than 0',
        code: 'INVALID_TARGET_WORD_COUNT'
      });
    });
  });
});

describe('CharacterValidator', () => {
  const validCharacter: Partial<Character> = {
    id: 'char-123',
    name: 'Test Character',
    archetype: {
      primary: 'Hero',
      description: 'The main protagonist',
      commonTraits: ['brave', 'determined']
    },
    traits: {
      personality: ['brave', 'kind'],
      motivations: ['save the world'],
      fears: ['failure'],
      strengths: ['courage'],
      weaknesses: ['impulsive'],
      quirks: ['always hungry']
    },
    relationships: []
  };

  describe('validate', () => {
    it('should validate a complete character successfully', () => {
      const result = CharacterValidator.validate(validCharacter);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require character ID', () => {
      const characterWithoutId = { ...validCharacter };
      delete characterWithoutId.id;
      
      const result = CharacterValidator.validate(characterWithoutId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'Character ID is required',
        code: 'CHARACTER_ID_REQUIRED'
      });
    });

    it('should require character name', () => {
      const characterWithoutName = { ...validCharacter };
      delete characterWithoutName.name;
      
      const result = CharacterValidator.validate(characterWithoutName);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Character name is required',
        code: 'CHARACTER_NAME_REQUIRED'
      });
    });

    it('should validate name length', () => {
      const characterWithLongName = {
        ...validCharacter,
        name: 'A'.repeat(101)
      };
      
      const result = CharacterValidator.validate(characterWithLongName);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Character name must be 100 characters or less',
        code: 'CHARACTER_NAME_TOO_LONG'
      });
    });

    it('should warn about missing personality traits', () => {
      const characterWithoutTraits = {
        ...validCharacter,
        traits: {
          ...validCharacter.traits!,
          personality: []
        }
      };
      
      const result = CharacterValidator.validate(characterWithoutTraits);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'traits.personality',
        message: 'Consider adding personality traits to develop the character',
        code: 'PERSONALITY_TRAITS_MISSING'
      });
    });

    it('should warn about unbalanced character (too perfect)', () => {
      const perfectCharacter = {
        ...validCharacter,
        traits: {
          ...validCharacter.traits!,
          strengths: ['courage', 'wisdom', 'strength'],
          weaknesses: [],
          fears: []
        }
      };
      
      const result = CharacterValidator.validate(perfectCharacter);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'traits',
        message: 'Consider adding weaknesses or fears to create a more balanced character',
        code: 'CHARACTER_TOO_PERFECT'
      });
    });

    it('should validate relationships', () => {
      const characterWithInvalidRelationship = {
        ...validCharacter,
        relationships: [
          {
            characterId: '',
            type: 'friendship' as const,
            intensity: 15, // Invalid intensity
            direction: 'mutual' as const,
            status: 'revealed' as const,
            description: 'Best friends'
          }
        ]
      };
      
      const result = CharacterValidator.validate(characterWithInvalidRelationship);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'relationships[0].characterId',
        message: 'Related character ID is required',
        code: 'RELATIONSHIP_CHARACTER_ID_REQUIRED'
      });
      expect(result.errors).toContainEqual({
        field: 'relationships[0].intensity',
        message: 'Relationship intensity must be between 1 and 10',
        code: 'INVALID_RELATIONSHIP_INTENSITY'
      });
    });
  });
});

describe('ChapterValidator', () => {
  const validChapter: Partial<Chapter> = {
    id: 'chapter-123',
    storyId: 'story-123',
    title: 'Test Chapter',
    content: 'This is the chapter content.',
    scenes: [],
    order: 1,
    wordCount: 100
  };

  describe('validate', () => {
    it('should validate a complete chapter successfully', () => {
      const result = ChapterValidator.validate(validChapter);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require chapter ID', () => {
      const chapterWithoutId = { ...validChapter };
      delete chapterWithoutId.id;
      
      const result = ChapterValidator.validate(chapterWithoutId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'Chapter ID is required',
        code: 'CHAPTER_ID_REQUIRED'
      });
    });

    it('should require story ID', () => {
      const chapterWithoutStoryId = { ...validChapter };
      delete chapterWithoutStoryId.storyId;
      
      const result = ChapterValidator.validate(chapterWithoutStoryId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'storyId',
        message: 'Story ID is required',
        code: 'CHAPTER_STORY_ID_REQUIRED'
      });
    });

    it('should validate chapter order', () => {
      const chapterWithInvalidOrder = {
        ...validChapter,
        order: 0
      };
      
      const result = ChapterValidator.validate(chapterWithInvalidOrder);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'order',
        message: 'Chapter order must be 1 or greater',
        code: 'INVALID_CHAPTER_ORDER'
      });
    });

    it('should validate word count', () => {
      const chapterWithNegativeWordCount = {
        ...validChapter,
        wordCount: -10
      };
      
      const result = ChapterValidator.validate(chapterWithNegativeWordCount);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'wordCount',
        message: 'Word count cannot be negative',
        code: 'NEGATIVE_WORD_COUNT'
      });
    });

    it('should warn about empty content', () => {
      const chapterWithEmptyContent = {
        ...validChapter,
        content: '   '
      };
      
      const result = ChapterValidator.validate(chapterWithEmptyContent);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'content',
        message: 'Chapter appears to be empty',
        code: 'EMPTY_CHAPTER_CONTENT'
      });
    });
  });
});

describe('SceneValidator', () => {
  const validScene: Partial<Scene> = {
    id: 'scene-123',
    chapterId: 'chapter-123',
    setting: {
      location: 'Forest',
      timeOfDay: 'Morning',
      atmosphere: 'Peaceful',
      sensoryDetails: {
        visual: ['Green trees'],
        auditory: ['Bird songs'],
        tactile: ['Cool breeze'],
        olfactory: ['Fresh air'],
        gustatory: []
      }
    },
    characters: ['char-1', 'char-2'],
    mood: {
      primary: 'calm',
      intensity: 5,
      tags: ['peaceful']
    },
    purpose: {
      type: 'character',
      description: 'Character development scene',
      objectives: ['Show character growth']
    },
    content: 'Scene content here.',
    order: 1
  };

  describe('validate', () => {
    it('should validate a complete scene successfully', () => {
      const result = SceneValidator.validate(validScene);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require scene ID', () => {
      const sceneWithoutId = { ...validScene };
      delete sceneWithoutId.id;
      
      const result = SceneValidator.validate(sceneWithoutId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'Scene ID is required',
        code: 'SCENE_ID_REQUIRED'
      });
    });

    it('should validate scene order', () => {
      const sceneWithInvalidOrder = {
        ...validScene,
        order: 0
      };
      
      const result = SceneValidator.validate(sceneWithInvalidOrder);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'order',
        message: 'Scene order must be 1 or greater',
        code: 'INVALID_SCENE_ORDER'
      });
    });

    it('should validate mood intensity', () => {
      const sceneWithInvalidMood = {
        ...validScene,
        mood: {
          ...validScene.mood!,
          intensity: 15
        }
      };
      
      const result = SceneValidator.validate(sceneWithInvalidMood);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'mood.intensity',
        message: 'Mood intensity must be between 1 and 10',
        code: 'INVALID_MOOD_INTENSITY'
      });
    });

    it('should validate scene purpose type', () => {
      const sceneWithInvalidPurpose = {
        ...validScene,
        purpose: {
          ...validScene.purpose!,
          type: 'invalid' as any
        }
      };
      
      const result = SceneValidator.validate(sceneWithInvalidPurpose);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'purpose.type',
        message: 'Invalid scene purpose type. Must be one of: plot, character, world-building, transition, climax',
        code: 'INVALID_SCENE_PURPOSE_TYPE'
      });
    });

    it('should warn about missing characters', () => {
      const sceneWithoutCharacters = {
        ...validScene,
        characters: []
      };
      
      const result = SceneValidator.validate(sceneWithoutCharacters);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'characters',
        message: 'Consider adding characters to make the scene more engaging',
        code: 'SCENE_CHARACTERS_MISSING'
      });
    });
  });
});