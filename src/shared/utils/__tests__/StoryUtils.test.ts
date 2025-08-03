import { 
  IdGenerator, 
  StoryUtils, 
  CharacterUtils, 
  ChapterUtils,
  StorySearchUtils
} from '../StoryUtils';
import { Story, Chapter, Scene } from '../../types/Story';

describe('IdGenerator', () => {
  it('should generate unique story IDs', () => {
    const id1 = IdGenerator.generateStoryId();
    const id2 = IdGenerator.generateStoryId();
    
    expect(id1).toMatch(/^story-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^story-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('should generate character IDs with story prefix', () => {
    const storyId = 'story-123';
    const charId = IdGenerator.generateCharacterId(storyId);
    
    expect(charId).toMatch(/^story-123-char-\d+-[a-z0-9]+$/);
  });

  it('should generate chapter IDs with story prefix', () => {
    const storyId = 'story-123';
    const chapterId = IdGenerator.generateChapterId(storyId);
    
    expect(chapterId).toMatch(/^story-123-chap-\d+-[a-z0-9]+$/);
  });

  it('should generate scene IDs with chapter prefix', () => {
    const chapterId = 'story-123-chap-456';
    const sceneId = IdGenerator.generateSceneId(chapterId);
    
    expect(sceneId).toMatch(/^story-123-chap-456-scene-\d+-[a-z0-9]+$/);
  });
});

describe('StoryUtils', () => {
  describe('createEmptyStory', () => {
    it('should create a story with default values', () => {
      const story = StoryUtils.createEmptyStory('Test Story');
      
      expect(story.title).toBe('Test Story');
      expect(story.id).toMatch(/^story-\d+-[a-z0-9]+$/);
      expect(story.genre).toEqual([]);
      expect(story.characters).toEqual([]);
      expect(story.chapters).toEqual([]);
      expect(story.structure.type).toBe('three-act');
      expect(story.metadata.targetWordCount).toBe(80000);
      expect(story.metadata.currentWordCount).toBe(0);
    });

    it('should trim whitespace from title', () => {
      const story = StoryUtils.createEmptyStory('  Test Story  ');
      expect(story.title).toBe('Test Story');
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress percentage', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.metadata.targetWordCount = 1000;
      story.metadata.currentWordCount = 250;
      
      const progress = StoryUtils.calculateProgress(story);
      expect(progress).toBe(25);
    });

    it('should return 0 for zero target word count', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.metadata.targetWordCount = 0;
      story.metadata.currentWordCount = 100;
      
      const progress = StoryUtils.calculateProgress(story);
      expect(progress).toBe(0);
    });

    it('should cap progress at 100%', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.metadata.targetWordCount = 1000;
      story.metadata.currentWordCount = 1500;
      
      const progress = StoryUtils.calculateProgress(story);
      expect(progress).toBe(100);
    });
  });

  describe('updateWordCount', () => {
    it('should calculate total word count from chapters', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.chapters = [
        { wordCount: 100 } as Chapter,
        { wordCount: 200 } as Chapter,
        { wordCount: 150 } as Chapter
      ];
      
      const updatedStory = StoryUtils.updateWordCount(story);
      expect(updatedStory.metadata.currentWordCount).toBe(450);
    });

    it('should handle chapters without word count', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.chapters = [
        { wordCount: 100 } as Chapter,
        {} as Chapter, // No wordCount property
        { wordCount: 200 } as Chapter
      ];
      
      const updatedStory = StoryUtils.updateWordCount(story);
      expect(updatedStory.metadata.currentWordCount).toBe(300);
    });
  });

  describe('getNextBeat', () => {
    it('should return first incomplete beat', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.structure.beats[0].completed = true;
      story.structure.beats[1].completed = false;
      
      const nextBeat = StoryUtils.getNextBeat(story);
      expect(nextBeat?.name).toBe(story.structure.beats[1].name);
    });

    it('should return null if all beats are complete', () => {
      const story = StoryUtils.createEmptyStory('Test');
      story.structure.beats.forEach(beat => beat.completed = true);
      
      const nextBeat = StoryUtils.getNextBeat(story);
      expect(nextBeat).toBeNull();
    });
  });

  describe('markBeatComplete', () => {
    it('should mark beat as complete and add chapter IDs', () => {
      const story = StoryUtils.createEmptyStory('Test');
      const beatName = story.structure.beats[0].name;
      const chapterIds = ['chapter-1', 'chapter-2'];
      
      const updatedStory = StoryUtils.markBeatComplete(story, beatName, chapterIds);
      
      expect(updatedStory.structure.beats[0].completed).toBe(true);
      expect(updatedStory.structure.beats[0].chapterIds).toEqual(chapterIds);
    });

    it('should update current beat to next incomplete beat', () => {
      const story = StoryUtils.createEmptyStory('Test');
      const beatName = story.structure.beats[0].name;
      
      const updatedStory = StoryUtils.markBeatComplete(story, beatName, []);
      
      expect(updatedStory.structure.currentBeat).toBe(story.structure.beats[1].name);
    });
  });
});

describe('CharacterUtils', () => {
  describe('createEmptyCharacter', () => {
    it('should create character with default values', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test Character');
      
      expect(character.name).toBe('Test Character');
      expect(character.id).toMatch(/^story-123-char-\d+-[a-z0-9]+$/);
      expect(character.traits.personality).toEqual([]);
      expect(character.relationships).toEqual([]);
      expect(character.voiceProfile.formalityLevel).toBe(5);
    });

    it('should trim whitespace from name', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', '  Test Character  ');
      expect(character.name).toBe('Test Character');
    });
  });

  describe('addRelationship', () => {
    it('should add new relationship', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test');
      const relationship = {
        type: 'friendship' as const,
        intensity: 8,
        direction: 'mutual' as const,
        status: 'revealed' as const,
        description: 'Best friends'
      };
      
      const updatedCharacter = CharacterUtils.addRelationship(character, 'char-456', relationship);
      
      expect(updatedCharacter.relationships).toHaveLength(1);
      expect(updatedCharacter.relationships[0].characterId).toBe('char-456');
      expect(updatedCharacter.relationships[0].type).toBe('friendship');
    });

    it('should update existing relationship', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test');
      character.relationships = [{
        characterId: 'char-456',
        type: 'neutral',
        intensity: 5,
        direction: 'mutual',
        status: 'revealed',
        description: 'Acquaintances'
      }];
      
      const newRelationship = {
        type: 'friendship' as const,
        intensity: 8,
        direction: 'mutual' as const,
        status: 'revealed' as const,
        description: 'Best friends'
      };
      
      const updatedCharacter = CharacterUtils.addRelationship(character, 'char-456', newRelationship);
      
      expect(updatedCharacter.relationships).toHaveLength(1);
      expect(updatedCharacter.relationships[0].type).toBe('friendship');
      expect(updatedCharacter.relationships[0].intensity).toBe(8);
    });
  });

  describe('removeRelationship', () => {
    it('should remove relationship by character ID', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test');
      character.relationships = [
        {
          characterId: 'char-456',
          type: 'friendship',
          intensity: 8,
          direction: 'mutual',
          status: 'revealed',
          description: 'Friend'
        },
        {
          characterId: 'char-789',
          type: 'rivalry',
          intensity: 6,
          direction: 'mutual',
          status: 'revealed',
          description: 'Rival'
        }
      ];
      
      const updatedCharacter = CharacterUtils.removeRelationship(character, 'char-456');
      
      expect(updatedCharacter.relationships).toHaveLength(1);
      expect(updatedCharacter.relationships[0].characterId).toBe('char-789');
    });
  });

  describe('calculateArcProgress', () => {
    it('should calculate average progress from key moments', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test');
      character.developmentArc.keyMoments = [
        {
          chapterId: 'chap-1',
          description: 'First growth',
          arcProgress: 25
        },
        {
          chapterId: 'chap-2',
          description: 'Second growth',
          arcProgress: 75
        }
      ];
      
      const progress = CharacterUtils.calculateArcProgress(character);
      expect(progress).toBe(50);
    });

    it('should return 0 for no key moments', () => {
      const character = CharacterUtils.createEmptyCharacter('story-123', 'Test');
      
      const progress = CharacterUtils.calculateArcProgress(character);
      expect(progress).toBe(0);
    });
  });
});

describe('ChapterUtils', () => {
  describe('createEmptyChapter', () => {
    it('should create chapter with default values', () => {
      const chapter = ChapterUtils.createEmptyChapter('story-123', 'Test Chapter', 1);
      
      expect(chapter.title).toBe('Test Chapter');
      expect(chapter.storyId).toBe('story-123');
      expect(chapter.order).toBe(1);
      expect(chapter.content).toBe('');
      expect(chapter.scenes).toEqual([]);
      expect(chapter.wordCount).toBe(0);
    });
  });

  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      const content = 'This is a test sentence with seven words.';
      const wordCount = ChapterUtils.calculateWordCount(content);
      expect(wordCount).toBe(8); // Actual word count
    });

    it('should handle empty content', () => {
      const wordCount = ChapterUtils.calculateWordCount('');
      expect(wordCount).toBe(0);
    });

    it('should handle whitespace-only content', () => {
      const wordCount = ChapterUtils.calculateWordCount('   \n\t  ');
      expect(wordCount).toBe(0);
    });

    it('should handle multiple spaces between words', () => {
      const content = 'Word1    Word2\n\nWord3\tWord4';
      const wordCount = ChapterUtils.calculateWordCount(content);
      expect(wordCount).toBe(4);
    });
  });

  describe('updateWordCount', () => {
    it('should calculate word count from content and scenes', () => {
      const chapter = ChapterUtils.createEmptyChapter('story-123', 'Test', 1);
      chapter.content = 'This chapter has five words.'; // 5 words
      chapter.scenes = [
        { content: 'Scene one has four words.' } as Scene, // 5 words
        { content: 'Scene two also has five words.' } as Scene // 6 words
      ];
      
      const updatedChapter = ChapterUtils.updateWordCount(chapter);
      expect(updatedChapter.wordCount).toBe(5 + 5 + 6); // 16 total
    });
  });

  describe('estimateReadingTime', () => {
    it('should estimate reading time based on word count', () => {
      const chapter = ChapterUtils.createEmptyChapter('story-123', 'Test', 1);
      chapter.wordCount = 450; // Should be 2 minutes at 225 words per minute
      
      const readingTime = ChapterUtils.estimateReadingTime(chapter);
      expect(readingTime).toBe(2);
    });

    it('should round up partial minutes', () => {
      const chapter = ChapterUtils.createEmptyChapter('story-123', 'Test', 1);
      chapter.wordCount = 300; // Should be 1.33 minutes, rounded up to 2
      
      const readingTime = ChapterUtils.estimateReadingTime(chapter);
      expect(readingTime).toBe(2);
    });
  });
});

describe('StorySearchUtils', () => {
  const mockStory: Story = {
    id: 'story-123',
    title: 'Test Story',
    genre: [],
    structure: { type: 'three-act', beats: [] },
    characters: [
      {
        id: 'char-1',
        name: 'John Hero',
        archetype: { primary: 'Hero', description: '', commonTraits: [] },
        traits: {
          personality: ['brave', 'kind'],
          motivations: ['save the world'],
          fears: [],
          strengths: [],
          weaknesses: [],
          quirks: []
        },
        relationships: [],
        developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
        voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
      },
      {
        id: 'char-2',
        name: 'Jane Villain',
        archetype: { primary: 'Villain', description: '', commonTraits: [] },
        traits: {
          personality: ['cunning', 'ruthless'],
          motivations: ['gain power'],
          fears: [],
          strengths: [],
          weaknesses: [],
          quirks: []
        },
        relationships: [],
        developmentArc: { startState: '', endState: '', keyMoments: [], completed: false },
        voiceProfile: { vocabulary: [], speechPatterns: [], commonPhrases: [], formalityLevel: 5, emotionalRange: [] }
      }
    ],
    chapters: [
      {
        id: 'chap-1',
        storyId: 'story-123',
        title: 'The Beginning',
        content: 'This is the first chapter about heroes.',
        scenes: [
          {
            id: 'scene-1',
            chapterId: 'chap-1',
            setting: { location: 'Forest', timeOfDay: '', atmosphere: '', sensoryDetails: { visual: [], auditory: [], tactile: [], olfactory: [], gustatory: [] } },
            characters: ['char-1'],
            mood: { primary: 'mysterious', intensity: 5, tags: [] },
            purpose: { type: 'plot', description: 'Introduce the hero', objectives: [] },
            content: 'The hero walks through the dark forest.',
            order: 1
          }
        ],
        order: 1,
        wordCount: 100
      }
    ],
    metadata: { targetWordCount: 80000, currentWordCount: 0, targetAudience: '', contentRating: '', tags: [], notes: '' },
    analysisCache: { lastAnalyzed: new Date() },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('searchCharacters', () => {
    it('should find characters by name', () => {
      const results = StorySearchUtils.searchCharacters(mockStory, 'john');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Hero');
    });

    it('should find characters by archetype', () => {
      const results = StorySearchUtils.searchCharacters(mockStory, 'villain');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane Villain');
    });

    it('should find characters by personality traits', () => {
      const results = StorySearchUtils.searchCharacters(mockStory, 'brave');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Hero');
    });

    it('should be case insensitive', () => {
      const results = StorySearchUtils.searchCharacters(mockStory, 'HERO');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Hero');
    });
  });

  describe('searchChapters', () => {
    it('should find chapters by title', () => {
      const results = StorySearchUtils.searchChapters(mockStory, 'beginning');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('The Beginning');
    });

    it('should find chapters by content', () => {
      const results = StorySearchUtils.searchChapters(mockStory, 'heroes');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('The Beginning');
    });
  });

  describe('searchScenes', () => {
    it('should find scenes by content', () => {
      const results = StorySearchUtils.searchScenes(mockStory, 'forest');
      expect(results).toHaveLength(1);
      expect(results[0].scene.content).toContain('forest');
    });

    it('should find scenes by location', () => {
      const results = StorySearchUtils.searchScenes(mockStory, 'forest');
      expect(results).toHaveLength(1);
      expect(results[0].scene.setting.location).toBe('Forest');
    });

    it('should find scenes by mood', () => {
      const results = StorySearchUtils.searchScenes(mockStory, 'mysterious');
      expect(results).toHaveLength(1);
      expect(results[0].scene.mood.primary).toBe('mysterious');
    });
  });

  describe('filterCharactersByArchetype', () => {
    it('should filter characters by exact archetype match', () => {
      const results = StorySearchUtils.filterCharactersByArchetype(mockStory, 'Hero');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Hero');
    });

    it('should be case insensitive', () => {
      const results = StorySearchUtils.filterCharactersByArchetype(mockStory, 'hero');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Hero');
    });
  });

  describe('filterScenesByPurpose', () => {
    it('should filter scenes by purpose type', () => {
      const results = StorySearchUtils.filterScenesByPurpose(mockStory, 'plot');
      expect(results).toHaveLength(1);
      expect(results[0].scene.purpose.type).toBe('plot');
    });
  });
});