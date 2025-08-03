import { CowriterProvider } from '../providers/CowriterProvider';
import { StoryContext, CharacterTraits } from '../../../shared/types/AI';
import { Story, Character, Scene, Chapter } from '../../../shared/types/Story';

describe('CowriterProvider', () => {
  let provider: CowriterProvider;

  beforeEach(async () => {
    provider = new CowriterProvider();
    await provider.initialize({
      localPath: './test-models/soyume-cowriter',
      temperature: 0.7,
      maxTokens: 1024
    });
  });

  afterEach(async () => {
    if (provider.isAvailable()) {
      await provider.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(provider.isAvailable()).toBe(true);
      expect(provider.name).toBe('SoYume Co-writer');
      expect(provider.type).toBe('cowriter');
      expect(provider.priority).toBe(10);
    });

    it('should have all required capabilities', () => {
      const capabilityNames = provider.capabilities.map(cap => cap.name);
      
      expect(capabilityNames).toContain('outline_generation');
      expect(capabilityNames).toContain('character_analysis');
      expect(capabilityNames).toContain('scene_structure');
      expect(capabilityNames).toContain('story_analysis');
      expect(capabilityNames).toContain('plot_hole_detection');
      expect(capabilityNames).toContain('pacing_analysis');
      expect(capabilityNames).toContain('manuscript_analysis');
      expect(capabilityNames).toContain('foreshadowing_suggestions');
    });

    it('should mark all capabilities as offline', () => {
      provider.capabilities.forEach(capability => {
        expect(capability.offline).toBe(true);
      });
    });
  });

  describe('text generation', () => {
    it('should generate text with proper context', async () => {
      const context: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'young-adult'
      };

      const response = await provider.generateText('Write a scene about a magical forest', context);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('confidence');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata.provider).toBe('SoYume Co-writer');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.content).toBeTruthy();
    });

    it('should adapt to different genres', async () => {
      const fantasyContext: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'adult'
      };

      const romanceContext: StoryContext = {
        characters: [],
        genre: ['romance'],
        targetAudience: 'adult'
      };

      const fantasyResponse = await provider.generateText('Describe the setting', fantasyContext);
      const romanceResponse = await provider.generateText('Describe the setting', romanceContext);

      expect(fantasyResponse.content).toBeTruthy();
      expect(romanceResponse.content).toBeTruthy();
      // Responses should be different based on genre
      expect(fantasyResponse.content).not.toBe(romanceResponse.content);
    });

    it('should adjust for target audience', async () => {
      const yaContext: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'young-adult'
      };

      const adultContext: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'adult'
      };

      const yaResponse = await provider.generateText('Write about character growth', yaContext);
      const adultResponse = await provider.generateText('Write about character growth', adultContext);

      expect(yaResponse.content).toContain('YA');
      expect(adultResponse.content).toContain('adult');
    });
  });

  describe('story analysis', () => {
    it('should analyze story structure', async () => {
      const storyContent = `
        Once upon a time, there was a young hero named Alex who lived in a small village.
        One day, a terrible dragon attacked the village, and Alex decided to stop it.
        After a long journey and many challenges, Alex defeated the dragon and saved everyone.
        The village celebrated, and Alex became a legend.
      `;

      const analysis = await provider.analyzeStory(storyContent);

      expect(analysis).toHaveProperty('structure');
      expect(analysis).toHaveProperty('characters');
      expect(analysis).toHaveProperty('pacing');
      expect(analysis).toHaveProperty('consistency');
      expect(analysis).toHaveProperty('overallScore');
      expect(analysis).toHaveProperty('recommendations');

      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should provide detailed structure analysis', async () => {
      const storyContent = 'A simple story with beginning, middle, and end.';
      const analysis = await provider.analyzeStory(storyContent);

      expect(analysis.structure).toHaveProperty('identifiedStructure');
      expect(analysis.structure).toHaveProperty('completedBeats');
      expect(analysis.structure).toHaveProperty('missingBeats');
      expect(analysis.structure).toHaveProperty('suggestions');
      expect(analysis.structure).toHaveProperty('confidence');

      expect(Array.isArray(analysis.structure.completedBeats)).toBe(true);
      expect(Array.isArray(analysis.structure.missingBeats)).toBe(true);
      expect(Array.isArray(analysis.structure.suggestions)).toBe(true);
    });

    it('should analyze character consistency', async () => {
      const storyContent = 'Alex was brave and determined throughout the adventure.';
      const analysis = await provider.analyzeStory(storyContent);

      expect(analysis.characters).toHaveProperty('consistencyScore');
      expect(analysis.characters).toHaveProperty('voiceConsistency');
      expect(analysis.characters).toHaveProperty('developmentProgress');
      expect(analysis.characters).toHaveProperty('suggestions');

      expect(analysis.characters.consistencyScore).toBeGreaterThan(0);
      expect(analysis.characters.consistencyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('character generation', () => {
    it('should generate complete character from traits', async () => {
      const traits: CharacterTraits = {
        name: 'Elena',
        personality: ['brave', 'compassionate', 'stubborn'],
        motivations: ['protect her family', 'seek justice'],
        fears: ['losing loved ones', 'failure'],
        strengths: ['swordsmanship', 'leadership'],
        weaknesses: ['impulsive', 'trusts too easily'],
        quirks: ['always carries a lucky charm']
      };

      const character = await provider.generateCharacter(traits);

      expect(character).toHaveProperty('id');
      expect(character).toHaveProperty('name');
      expect(character).toHaveProperty('archetype');
      expect(character).toHaveProperty('traits');
      expect(character).toHaveProperty('voiceProfile');
      expect(character).toHaveProperty('relationships');
      expect(character).toHaveProperty('developmentArc');

      expect(character.name).toBe('Elena');
      expect(character.traits.personality).toContain('brave');
      expect(character.traits.motivations).toContain('protect her family');
    });

    it('should select appropriate archetype', async () => {
      const heroTraits: CharacterTraits = {
        personality: ['brave', 'determined'],
        motivations: ['save the world'],
        fears: ['failure'],
        strengths: ['courage'],
        weaknesses: ['impulsive'],
        quirks: []
      };

      const character = await provider.generateCharacter(heroTraits);

      expect(character.archetype.primary).toBe('Hero');
      expect(character.archetype.commonTraits).toContain('brave');
    });

    it('should generate voice profile', async () => {
      const traits: CharacterTraits = {
        personality: ['wise', 'patient'],
        motivations: ['guide others'],
        fears: ['being forgotten'],
        strengths: ['knowledge'],
        weaknesses: ['physical frailty'],
        quirks: ['speaks in riddles']
      };

      const character = await provider.generateCharacter(traits);

      expect(character.voiceProfile).toHaveProperty('vocabulary');
      expect(character.voiceProfile).toHaveProperty('speechPatterns');
      expect(character.voiceProfile).toHaveProperty('commonPhrases');
      expect(character.voiceProfile).toHaveProperty('formalityLevel');
      expect(character.voiceProfile).toHaveProperty('emotionalRange');

      expect(Array.isArray(character.voiceProfile.vocabulary)).toBe(true);
      expect(typeof character.voiceProfile.formalityLevel).toBe('number');
    });
  });

  describe('outline generation', () => {
    it('should generate story outline from premise', async () => {
      const premise = 'A young mage discovers they have the power to control time but must learn to use it responsibly.';
      const structure = {
        type: 'three-act' as const,
        beats: [],
        currentBeat: 'setup'
      };

      const outline = await provider.generateOutline(premise, structure);

      expect(outline).toHaveProperty('title');
      expect(outline).toHaveProperty('premise');
      expect(outline).toHaveProperty('structure');
      expect(outline).toHaveProperty('chapters');
      expect(outline).toHaveProperty('characters');
      expect(outline).toHaveProperty('themes');
      expect(outline).toHaveProperty('estimatedWordCount');

      expect(outline.premise).toBe(premise);
      expect(Array.isArray(outline.chapters)).toBe(true);
      expect(Array.isArray(outline.characters)).toBe(true);
      expect(Array.isArray(outline.themes)).toBe(true);
      expect(typeof outline.estimatedWordCount).toBe('number');
    });

    it('should generate chapters based on structure', async () => {
      const premise = 'A detective solves a mysterious case.';
      const structure = {
        type: 'three-act' as const,
        beats: ['Setup', 'Investigation', 'Resolution'],
        currentBeat: 'setup'
      };

      const outline = await provider.generateOutline(premise, structure);

      expect(outline.chapters.length).toBeGreaterThan(0);
      outline.chapters.forEach(chapter => {
        expect(chapter).toHaveProperty('title');
        expect(chapter).toHaveProperty('summary');
        expect(chapter).toHaveProperty('estimatedWordCount');
      });
    });
  });

  describe('manuscript analysis', () => {
    it('should extract story elements from manuscript', async () => {
      const manuscript = `
        Chapter 1: The Beginning
        
        Sarah walked through the dark forest, her heart pounding with fear.
        She knew the ancient castle held secrets that could change everything.
        The mysterious stranger had warned her about the dangers ahead.
        
        Chapter 2: The Discovery
        
        Inside the castle, Sarah found an old book filled with magical spells.
        The book revealed the truth about her family's past and her own destiny.
      `;

      const analysis = await provider.analyzeManuscript(manuscript);

      expect(analysis).toHaveProperty('extractedElements');
      expect(analysis).toHaveProperty('structure');
      expect(analysis).toHaveProperty('suggestions');
      expect(analysis).toHaveProperty('confidence');

      expect(analysis.extractedElements).toHaveProperty('characters');
      expect(analysis.extractedElements).toHaveProperty('settings');
      expect(analysis.extractedElements).toHaveProperty('plotPoints');
      expect(analysis.extractedElements).toHaveProperty('themes');

      expect(Array.isArray(analysis.extractedElements.characters)).toBe(true);
      expect(Array.isArray(analysis.extractedElements.settings)).toBe(true);
      expect(Array.isArray(analysis.suggestions)).toBe(true);
    });

    it('should extract character names', async () => {
      const manuscript = 'Alice met Bob at the library. Charlie was there too, reading a book about dragons.';
      const characters = await provider.extractCharacters(manuscript);

      expect(Array.isArray(characters)).toBe(true);
      expect(characters.length).toBeGreaterThan(0);
      
      const characterNames = characters.map(char => char.name);
      expect(characterNames).toContain('Alice');
      expect(characterNames).toContain('Bob');
      expect(characterNames).toContain('Charlie');
    });
  });

  describe('scene structure suggestions', () => {
    it('should suggest scene structure based on context', async () => {
      const sceneContext = {
        purpose: 'introduce conflict',
        characters: ['protagonist', 'antagonist'],
        setting: 'abandoned warehouse',
        mood: 'tense',
        targetWordCount: 1500
      };

      const sceneOutline = await provider.suggestSceneStructure(sceneContext);

      expect(sceneOutline).toHaveProperty('summary');
      expect(sceneOutline).toHaveProperty('purpose');
      expect(sceneOutline).toHaveProperty('characters');
      expect(sceneOutline).toHaveProperty('setting');
      expect(sceneOutline).toHaveProperty('mood');
      expect(sceneOutline).toHaveProperty('estimatedWordCount');

      expect(sceneOutline.purpose).toBe('introduce conflict');
      expect(sceneOutline.characters).toEqual(['protagonist', 'antagonist']);
      expect(sceneOutline.setting).toBe('abandoned warehouse');
      expect(sceneOutline.estimatedWordCount).toBe(1500);
    });
  });

  describe('character consistency checking', () => {
    it('should check character consistency across scenes', async () => {
      const character: Character = {
        id: 'char-1',
        name: 'Alex',
        archetype: { primary: 'Hero', description: 'Brave protagonist', commonTraits: ['brave'] },
        traits: {
          personality: ['brave', 'loyal'],
          motivations: ['save friends'],
          fears: ['failure'],
          strengths: ['courage'],
          weaknesses: ['impulsive'],
          quirks: ['lucky charm']
        },
        relationships: [],
        developmentArc: {
          startState: 'naive',
          endState: 'wise',
          keyMoments: [],
          completed: false
        },
        voiceProfile: {
          vocabulary: ['determined'],
          speechPatterns: ['short sentences'],
          commonPhrases: ['I can do this'],
          formalityLevel: 5,
          emotionalRange: ['determined']
        }
      };

      const scenes: Scene[] = [
        {
          id: 'scene-1',
          title: 'First encounter',
          content: 'Alex bravely faced the challenge.',
          wordCount: 100,
          characters: ['char-1'],
          setting: 'forest',
          mood: 'tense',
          purpose: 'introduce hero'
        }
      ];

      const consistencyReport = await provider.checkCharacterConsistency(character, scenes);

      expect(consistencyReport).toHaveProperty('overallScore');
      expect(consistencyReport).toHaveProperty('plotHoles');
      expect(consistencyReport).toHaveProperty('characterInconsistencies');
      expect(consistencyReport).toHaveProperty('worldBuildingIssues');

      expect(consistencyReport.overallScore).toBeGreaterThan(0);
      expect(consistencyReport.overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('plot hole detection', () => {
    it('should identify plot holes in story', async () => {
      const story: Story = {
        id: 'story-1',
        title: 'Test Story',
        premise: 'A hero saves the world',
        genre: ['fantasy'],
        targetAudience: 'adult',
        characters: [],
        chapters: [],
        scenes: [],
        worldBuilding: {
          settings: [],
          rules: [],
          history: [],
          cultures: []
        },
        themes: [],
        status: 'draft',
        wordCount: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const plotIssues = await provider.identifyPlotHoles(story);

      expect(Array.isArray(plotIssues)).toBe(true);
      // For a simple story, there might not be plot holes
      expect(plotIssues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('foreshadowing suggestions', () => {
    it('should suggest foreshadowing opportunities', async () => {
      const story: Story = {
        id: 'story-1',
        title: 'Test Story',
        premise: 'A hero discovers their true destiny',
        genre: ['fantasy'],
        targetAudience: 'adult',
        characters: [],
        chapters: [],
        scenes: [],
        worldBuilding: {
          settings: [],
          rules: [],
          history: [],
          cultures: []
        },
        themes: [],
        status: 'draft',
        wordCount: 1000,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const suggestions = await provider.suggestForeshadowing(story);

      expect(Array.isArray(suggestions)).toBe(true);
      // Suggestions might be empty for a simple story
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pacing analysis', () => {
    it('should analyze story pacing', async () => {
      const chapters: Chapter[] = [
        {
          id: 'ch-1',
          title: 'Chapter 1',
          content: 'Beginning of the story...',
          wordCount: 3000,
          scenes: [],
          summary: 'Introduction'
        },
        {
          id: 'ch-2',
          title: 'Chapter 2',
          content: 'The adventure continues...',
          wordCount: 3500,
          scenes: [],
          summary: 'Development'
        },
        {
          id: 'ch-3',
          title: 'Chapter 3',
          content: 'The climactic conclusion...',
          wordCount: 2800,
          scenes: [],
          summary: 'Conclusion'
        }
      ];

      const pacingAnalysis = await provider.analyzePacing(chapters);

      expect(pacingAnalysis).toHaveProperty('overallPacing');
      expect(pacingAnalysis).toHaveProperty('tensionCurve');
      expect(pacingAnalysis).toHaveProperty('recommendations');

      expect(['too-fast', 'good', 'too-slow']).toContain(pacingAnalysis.overallPacing);
      expect(Array.isArray(pacingAnalysis.tensionCurve)).toBe(true);
      expect(Array.isArray(pacingAnalysis.recommendations)).toBe(true);

      // Should have tension data for each chapter
      expect(pacingAnalysis.tensionCurve.length).toBe(chapters.length);
    });
  });

  describe('health check', () => {
    it('should pass health check when available', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should fail health check when not available', async () => {
      await provider.shutdown();
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('provider information', () => {
    it('should return comprehensive provider info', () => {
      const info = provider.getInfo();

      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('type');
      expect(info).toHaveProperty('capabilities');
      expect(info).toHaveProperty('priority');
      expect(info).toHaveProperty('initialized');
      expect(info).toHaveProperty('available');
      expect(info).toHaveProperty('config');

      expect(info.name).toBe('SoYume Co-writer');
      expect(info.type).toBe('cowriter');
      expect(info.priority).toBe(10);
      expect(info.initialized).toBe(true);
      expect(info.available).toBe(true);
    });

    it('should not expose sensitive configuration', () => {
      const info = provider.getInfo();
      
      expect(info.config).not.toHaveProperty('apiKey');
      expect(info.config).not.toHaveProperty('password');
      expect(info.config).not.toHaveProperty('token');
    });
  });
});