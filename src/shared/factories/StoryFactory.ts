import { 
  Story, 
  Character, 
  Chapter, 
  Scene, 
  Genre,
  StoryStructure,
  CharacterArchetype,
  CharacterTraits,
  Relationship,
  Setting,
  Mood,
  ScenePurpose,
  StoryMetadata
} from '../types/Story';
import { IdGenerator } from '../utils/StoryUtils';

// Story factory with templates and presets
export class StoryFactory {
  static createStory(options: {
    title: string;
    genre?: Genre[];
    structure?: 'save-the-cat' | 'hero-journey' | 'three-act' | 'monogatari';
    targetWordCount?: number;
    targetAudience?: string;
  }): Story {
    const storyId = IdGenerator.generateStoryId();
    const now = new Date();

    return {
      id: storyId,
      title: options.title.trim(),
      genre: options.genre || [],
      structure: this.createStructure(options.structure || 'three-act'),
      characters: [],
      chapters: [],
      metadata: this.createMetadata({
        targetWordCount: options.targetWordCount || 80000,
        targetAudience: options.targetAudience || ''
      }),
      analysisCache: {
        lastAnalyzed: now
      },
      createdAt: now,
      updatedAt: now
    };
  }

  static createFromTemplate(template: StoryTemplate): Story {
    const story = this.createStory({
      title: template.title,
      genre: template.genres,
      structure: template.structure,
      targetWordCount: template.targetWordCount,
      targetAudience: template.targetAudience
    });

    // Add template characters
    const characters = template.characterTemplates.map(charTemplate => 
      CharacterFactory.createFromTemplate(story.id, charTemplate)
    );

    // Add template chapters
    const chapters = template.chapterTemplates.map((chapterTemplate, index) =>
      ChapterFactory.createFromTemplate(story.id, chapterTemplate, index + 1)
    );

    return {
      ...story,
      characters,
      chapters
    };
  }

  private static createStructure(type: StoryStructure['type']): StoryStructure {
    switch (type) {
      case 'save-the-cat':
        return {
          type,
          beats: this.getSaveTheCatBeats()
        };
      case 'hero-journey':
        return {
          type,
          beats: this.getHeroJourneyBeats()
        };
      case 'monogatari':
        return {
          type,
          beats: this.getMonogatariBeats()
        };
      case 'three-act':
      default:
        return {
          type: 'three-act',
          beats: this.getThreeActBeats()
        };
    }
  }

  private static createMetadata(options: Partial<StoryMetadata>): StoryMetadata {
    return {
      targetWordCount: options.targetWordCount || 80000,
      currentWordCount: 0,
      targetAudience: options.targetAudience || '',
      contentRating: options.contentRating || 'PG-13',
      tags: options.tags || [],
      notes: options.notes || ''
    };
  }

  private static getThreeActBeats() {
    return [
      { name: 'Setup', description: 'Introduce characters and world', completed: false, chapterIds: [] },
      { name: 'Inciting Incident', description: 'The event that starts the story', completed: false, chapterIds: [] },
      { name: 'Plot Point 1', description: 'Enter the new world', completed: false, chapterIds: [] },
      { name: 'Midpoint', description: 'Major revelation or turning point', completed: false, chapterIds: [] },
      { name: 'Plot Point 2', description: 'Final push toward climax', completed: false, chapterIds: [] },
      { name: 'Climax', description: 'Final confrontation', completed: false, chapterIds: [] },
      { name: 'Resolution', description: 'New normal established', completed: false, chapterIds: [] }
    ];
  }

  private static getSaveTheCatBeats() {
    return [
      { name: 'Opening Image', description: 'Visual representing the story', completed: false, chapterIds: [] },
      { name: 'Theme Stated', description: 'The message of the story', completed: false, chapterIds: [] },
      { name: 'Set-Up', description: 'Introduce the world and characters', completed: false, chapterIds: [] },
      { name: 'Catalyst', description: 'Life-changing moment', completed: false, chapterIds: [] },
      { name: 'Debate', description: 'Should I go on this journey?', completed: false, chapterIds: [] },
      { name: 'Break into Two', description: 'The journey begins', completed: false, chapterIds: [] },
      { name: 'B Story', description: 'Subplot introduction', completed: false, chapterIds: [] },
      { name: 'Fun and Games', description: 'Promise of the premise', completed: false, chapterIds: [] },
      { name: 'Midpoint', description: 'Stakes are raised', completed: false, chapterIds: [] },
      { name: 'Bad Guys Close In', description: 'Forces of antagonism', completed: false, chapterIds: [] },
      { name: 'All Is Lost', description: 'Lowest point', completed: false, chapterIds: [] },
      { name: 'Dark Night of the Soul', description: 'Contemplating giving up', completed: false, chapterIds: [] },
      { name: 'Break into Three', description: 'Finding the solution', completed: false, chapterIds: [] },
      { name: 'Finale', description: 'Climax and resolution', completed: false, chapterIds: [] },
      { name: 'Final Image', description: 'Opposite of opening image', completed: false, chapterIds: [] }
    ];
  }

  private static getHeroJourneyBeats() {
    return [
      { name: 'Ordinary World', description: 'Hero in familiar surroundings', completed: false, chapterIds: [] },
      { name: 'Call to Adventure', description: 'Hero faces a problem', completed: false, chapterIds: [] },
      { name: 'Refusal of the Call', description: 'Hero hesitates or refuses', completed: false, chapterIds: [] },
      { name: 'Meeting the Mentor', description: 'Hero gains advice/magical aid', completed: false, chapterIds: [] },
      { name: 'Crossing the Threshold', description: 'Hero commits to adventure', completed: false, chapterIds: [] },
      { name: 'Tests and Trials', description: 'Hero faces challenges', completed: false, chapterIds: [] },
      { name: 'Approach to the Inmost Cave', description: 'Hero prepares for major challenge', completed: false, chapterIds: [] },
      { name: 'Ordeal', description: 'Hero faces greatest fear', completed: false, chapterIds: [] },
      { name: 'Reward', description: 'Hero survives and gains something', completed: false, chapterIds: [] },
      { name: 'The Road Back', description: 'Hero begins journey back', completed: false, chapterIds: [] },
      { name: 'Resurrection', description: 'Final test and transformation', completed: false, chapterIds: [] },
      { name: 'Return with the Elixir', description: 'Hero returns with wisdom', completed: false, chapterIds: [] }
    ];
  }

  private static getMonogatariBeats() {
    return [
      { name: 'Kishōtenketsu Introduction', description: 'Introduce characters and setting', completed: false, chapterIds: [] },
      { name: 'Development', description: 'Develop characters and relationships', completed: false, chapterIds: [] },
      { name: 'Twist', description: 'Unexpected development or revelation', completed: false, chapterIds: [] },
      { name: 'Conclusion', description: 'Resolution and reflection', completed: false, chapterIds: [] }
    ];
  }
}

// Character factory with archetypes and presets
export class CharacterFactory {
  static createCharacter(storyId: string, options: {
    name: string;
    archetype?: string;
    role?: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  }): Character {
    const characterId = IdGenerator.generateCharacterId(storyId);
    
    return {
      id: characterId,
      name: options.name.trim(),
      archetype: this.getArchetype(options.archetype || 'custom'),
      traits: this.getDefaultTraits(options.archetype),
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

  static createFromTemplate(storyId: string, template: CharacterTemplate): Character {
    const character = this.createCharacter(storyId, {
      name: template.name,
      archetype: template.archetype,
      role: template.role
    });

    return {
      ...character,
      traits: {
        ...character.traits,
        ...template.traits
      },
      developmentArc: {
        startState: template.startState || '',
        endState: template.endState || '',
        keyMoments: [],
        completed: false
      }
    };
  }

  private static getArchetype(type: string): CharacterArchetype {
    const archetypes: Record<string, CharacterArchetype> = {
      hero: {
        primary: 'Hero',
        description: 'The protagonist who goes on a journey and changes',
        commonTraits: ['brave', 'determined', 'flawed', 'growing']
      },
      mentor: {
        primary: 'Mentor',
        description: 'The wise guide who helps the hero',
        commonTraits: ['wise', 'experienced', 'supportive', 'mysterious']
      },
      villain: {
        primary: 'Villain',
        description: 'The primary antagonist opposing the hero',
        commonTraits: ['powerful', 'ruthless', 'charismatic', 'driven']
      },
      ally: {
        primary: 'Ally',
        description: 'A loyal companion who supports the hero',
        commonTraits: ['loyal', 'supportive', 'skilled', 'trustworthy']
      },
      trickster: {
        primary: 'Trickster',
        description: 'The comic relief who provides levity and wisdom',
        commonTraits: ['humorous', 'unpredictable', 'clever', 'insightful']
      },
      threshold_guardian: {
        primary: 'Threshold Guardian',
        description: 'Tests the hero before they can proceed',
        commonTraits: ['challenging', 'protective', 'testing', 'gatekeeping']
      },
      shapeshifter: {
        primary: 'Shapeshifter',
        description: 'Character whose loyalty and nature are unclear',
        commonTraits: ['mysterious', 'changeable', 'unpredictable', 'complex']
      },
      shadow: {
        primary: 'Shadow',
        description: 'Represents the dark side of the hero',
        commonTraits: ['dark', 'tempting', 'powerful', 'corrupting']
      }
    };

    return archetypes[type] || {
      primary: 'Custom',
      description: 'A unique character archetype',
      commonTraits: []
    };
  }

  private static getDefaultTraits(archetype?: string): CharacterTraits {
    const defaultTraits: Record<string, Partial<CharacterTraits>> = {
      hero: {
        personality: ['brave', 'determined', 'compassionate'],
        motivations: ['protect others', 'do what\'s right', 'grow as a person'],
        fears: ['failure', 'losing loved ones', 'not being good enough'],
        strengths: ['courage', 'perseverance', 'empathy'],
        weaknesses: ['impulsiveness', 'self-doubt', 'stubbornness']
      },
      mentor: {
        personality: ['wise', 'patient', 'mysterious'],
        motivations: ['guide others', 'pass on knowledge', 'protect the innocent'],
        fears: ['failing their student', 'past mistakes repeating'],
        strengths: ['wisdom', 'experience', 'magical knowledge'],
        weaknesses: ['cryptic communication', 'living in the past']
      },
      villain: {
        personality: ['charismatic', 'ruthless', 'intelligent'],
        motivations: ['gain power', 'prove superiority', 'reshape the world'],
        fears: ['losing control', 'being forgotten', 'weakness'],
        strengths: ['strategic thinking', 'resources', 'determination'],
        weaknesses: ['arrogance', 'obsession', 'inability to trust']
      }
    };

    const base: CharacterTraits = {
      personality: [],
      motivations: [],
      fears: [],
      strengths: [],
      weaknesses: [],
      quirks: []
    };

    if (archetype && defaultTraits[archetype]) {
      return { ...base, ...defaultTraits[archetype] };
    }

    return base;
  }
}

// Chapter factory with templates
export class ChapterFactory {
  static createChapter(storyId: string, options: {
    title: string;
    order: number;
    purpose?: 'setup' | 'development' | 'climax' | 'resolution';
  }): Chapter {
    return {
      id: IdGenerator.generateChapterId(storyId),
      storyId,
      title: options.title.trim(),
      content: '',
      scenes: [],
      order: options.order,
      wordCount: 0
    };
  }

  static createFromTemplate(storyId: string, template: ChapterTemplate, order: number): Chapter {
    const chapter = this.createChapter(storyId, {
      title: template.title,
      order,
      purpose: template.purpose
    });

    // Add template scenes
    const scenes = template.sceneTemplates.map((sceneTemplate, index) =>
      SceneFactory.createFromTemplate(chapter.id, sceneTemplate, index + 1)
    );

    return {
      ...chapter,
      scenes
    };
  }
}

// Scene factory with presets
export class SceneFactory {
  static createScene(chapterId: string, options: {
    purpose?: Scene['purpose']['type'];
    location?: string;
    characters?: string[];
    mood?: string;
  }): Omit<Scene, 'id' | 'chapterId' | 'order'> {
    return {
      setting: {
        location: options.location || '',
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
      characters: options.characters || [],
      mood: {
        primary: options.mood || '',
        intensity: 5,
        tags: []
      },
      purpose: {
        type: options.purpose || 'plot',
        description: '',
        objectives: []
      },
      content: ''
    };
  }

  static createFromTemplate(chapterId: string, template: SceneTemplate, order: number): Scene {
    const sceneBase = this.createScene(chapterId, {
      purpose: template.purpose,
      location: template.location,
      characters: template.characters,
      mood: template.mood
    });

    return {
      id: IdGenerator.generateSceneId(chapterId),
      chapterId,
      order,
      ...sceneBase,
      setting: {
        ...sceneBase.setting,
        location: template.location || '',
        timeOfDay: template.timeOfDay || '',
        atmosphere: template.atmosphere || ''
      },
      purpose: {
        ...sceneBase.purpose,
        description: template.description || ''
      }
    };
  }
}

// Template interfaces
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

// Predefined story templates
export class StoryTemplates {
  static getFantasyAdventureTemplate(): StoryTemplate {
    return {
      title: 'Fantasy Adventure',
      genres: [
        {
          name: 'Fantasy',
          subgenres: ['High Fantasy', 'Adventure'],
          conventions: ['Magic system', 'Mythical creatures', 'Quest structure'],
          tropes: ['Chosen one', 'Magic sword', 'Ancient prophecy']
        }
      ],
      structure: 'hero-journey',
      targetWordCount: 100000,
      targetAudience: 'Young Adult',
      characterTemplates: [
        {
          name: 'Hero',
          archetype: 'hero',
          role: 'protagonist',
          traits: {
            personality: ['brave', 'curious', 'determined'],
            motivations: ['save the kingdom', 'discover their destiny'],
            fears: ['failing everyone', 'dark magic'],
            strengths: ['sword fighting', 'leadership'],
            weaknesses: ['impulsive', 'inexperienced']
          }
        },
        {
          name: 'Wise Mentor',
          archetype: 'mentor',
          role: 'supporting',
          traits: {
            personality: ['wise', 'patient', 'mysterious'],
            motivations: ['guide the hero', 'protect ancient knowledge'],
            strengths: ['magic', 'wisdom', 'experience'],
            weaknesses: ['cryptic', 'haunted by past']
          }
        },
        {
          name: 'Dark Lord',
          archetype: 'villain',
          role: 'antagonist',
          traits: {
            personality: ['ruthless', 'charismatic', 'ancient'],
            motivations: ['conquer the world', 'obtain ultimate power'],
            strengths: ['dark magic', 'army of minions', 'strategic mind'],
            weaknesses: ['arrogance', 'underestimates heroes']
          }
        }
      ],
      chapterTemplates: [
        {
          title: 'The Ordinary World',
          purpose: 'setup',
          sceneTemplates: [
            {
              purpose: 'character',
              location: 'Village',
              timeOfDay: 'Morning',
              atmosphere: 'Peaceful',
              mood: 'calm',
              description: 'Introduce the hero in their normal life'
            }
          ]
        },
        {
          title: 'The Call to Adventure',
          purpose: 'development',
          sceneTemplates: [
            {
              purpose: 'plot',
              location: 'Village Square',
              timeOfDay: 'Afternoon',
              atmosphere: 'Urgent',
              mood: 'tense',
              description: 'A messenger arrives with dire news'
            }
          ]
        }
      ]
    };
  }

  static getRomanceTemplate(): StoryTemplate {
    return {
      title: 'Contemporary Romance',
      genres: [
        {
          name: 'Romance',
          subgenres: ['Contemporary', 'Workplace'],
          conventions: ['Meet cute', 'Conflict', 'Happy ending'],
          tropes: ['Enemies to lovers', 'Fake dating', 'Second chance']
        }
      ],
      structure: 'save-the-cat',
      targetWordCount: 80000,
      targetAudience: 'Adult',
      characterTemplates: [
        {
          name: 'Female Lead',
          archetype: 'hero',
          role: 'protagonist',
          traits: {
            personality: ['independent', 'witty', 'guarded'],
            motivations: ['career success', 'protect her heart'],
            fears: ['vulnerability', 'repeating past mistakes'],
            strengths: ['intelligence', 'determination', 'humor'],
            weaknesses: ['trust issues', 'workaholic tendencies']
          }
        },
        {
          name: 'Male Lead',
          archetype: 'ally',
          role: 'protagonist',
          traits: {
            personality: ['charming', 'persistent', 'caring'],
            motivations: ['win her heart', 'prove himself'],
            fears: ['not being good enough', 'losing her'],
            strengths: ['charisma', 'loyalty', 'emotional intelligence'],
            weaknesses: ['past baggage', 'fear of commitment']
          }
        }
      ],
      chapterTemplates: [
        {
          title: 'The Meet Cute',
          purpose: 'setup',
          sceneTemplates: [
            {
              purpose: 'character',
              location: 'Coffee Shop',
              timeOfDay: 'Morning',
              atmosphere: 'Bustling',
              mood: 'awkward',
              description: 'The protagonists meet in an embarrassing way'
            }
          ]
        }
      ]
    };
  }

  static getMysteryTemplate(): StoryTemplate {
    return {
      title: 'Murder Mystery',
      genres: [
        {
          name: 'Mystery',
          subgenres: ['Cozy Mystery', 'Detective'],
          conventions: ['Crime', 'Investigation', 'Red herrings', 'Resolution'],
          tropes: ['Locked room', 'Unreliable witness', 'Hidden motive']
        }
      ],
      structure: 'three-act',
      targetWordCount: 70000,
      targetAudience: 'Adult',
      characterTemplates: [
        {
          name: 'Detective',
          archetype: 'hero',
          role: 'protagonist',
          traits: {
            personality: ['observant', 'logical', 'persistent'],
            motivations: ['solve the case', 'seek justice'],
            fears: ['missing crucial evidence', 'innocent person convicted'],
            strengths: ['deductive reasoning', 'attention to detail'],
            weaknesses: ['obsessive', 'difficulty with emotions']
          }
        },
        {
          name: 'Suspect',
          archetype: 'shapeshifter',
          role: 'supporting',
          traits: {
            personality: ['secretive', 'charming', 'nervous'],
            motivations: ['hide the truth', 'protect someone'],
            strengths: ['manipulation', 'acting ability'],
            weaknesses: ['guilt', 'inconsistent story']
          }
        }
      ],
      chapterTemplates: [
        {
          title: 'The Crime',
          purpose: 'setup',
          sceneTemplates: [
            {
              purpose: 'plot',
              location: 'Crime Scene',
              timeOfDay: 'Night',
              atmosphere: 'Ominous',
              mood: 'tense',
              description: 'The murder is discovered'
            }
          ]
        }
      ]
    };
  }
}