import { SceneGenerator, SceneGenerationOptions, ActionChoreographyRequest } from '../SceneGenerator';
import { AtmosphereEnhancer } from '../AtmosphereEnhancer';
import { AIProviderRegistry } from '../../ai/providers/AIProviderRegistry';
import { MockCowriterProvider } from '../../ai/providers/MockCowriterProvider';

// Mock AI Provider Registry
const mockAIRegistry = {
  getProvider: jest.fn().mockResolvedValue(new MockCowriterProvider())
} as unknown as AIProviderRegistry;

describe('SceneGenerator', () => {
  let sceneGenerator: SceneGenerator;

  beforeEach(() => {
    sceneGenerator = new SceneGenerator(mockAIRegistry);
    jest.clearAllMocks();
  });

  describe('Scene Generation', () => {
    const basicOptions: SceneGenerationOptions = {
      mood: 'peaceful',
      setting: 'outdoor',
      timeOfDay: 'morning',
      weather: 'clear',
      season: 'spring',
      sensoryFocus: 'balanced',
      detailLevel: 'moderate',
      genre: 'fantasy'
    };

    it('should generate a complete scene with all components', async () => {
      const request = {
        title: 'Test Scene',
        options: basicOptions,
        characters: ['Alice', 'Bob'],
        setting: 'Enchanted Forest',
        purpose: 'Character introduction'
      };

      const result = await sceneGenerator.generateScene(request);

      expect(result).toHaveProperty('scene');
      expect(result).toHaveProperty('atmosphereResult');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('metadata');

      expect(result.scene.title).toBe('Test Scene');
      expect(result.scene.characters).toEqual(['Alice', 'Bob']);
      expect(result.scene.mood).toBe('peaceful');
      expect(result.scene.content).toBeDefined();
      expect(result.scene.summary).toBeDefined();
    });

    it('should generate appropriate atmosphere for different moods', async () => {
      const tenseMoodOptions: SceneGenerationOptions = {
        ...basicOptions,
        mood: 'tense'
      };

      const request = {
        title: 'Tense Scene',
        options: tenseMoodOptions
      };

      const result = await sceneGenerator.generateScene(request);

      expect(result.atmosphereResult.atmosphereProfile.mood).toBe('tense');
      expect(result.atmosphereResult.atmosphereProfile.intensity).toBeGreaterThan(5);
      expect(result.atmosphereResult.moodDescriptors).toContain('oppressive');
    });

    it('should adapt to different genres', async () => {
      const sciFiOptions: SceneGenerationOptions = {
        ...basicOptions,
        genre: 'sci-fi',
        setting: 'indoor'
      };

      const request = {
        title: 'Sci-Fi Scene',
        options: sciFiOptions
      };

      const result = await sceneGenerator.generateScene(request);

      expect(result.scene.content).toBeDefined();
      expect(result.metadata.options.genre).toBe('sci-fi');
    });

    it('should handle different sensory focus options', async () => {
      const visualFocusOptions: SceneGenerationOptions = {
        ...basicOptions,
        sensoryFocus: 'visual'
      };

      const request = {
        title: 'Visual Scene',
        options: visualFocusOptions
      };

      const result = await sceneGenerator.generateScene(request);

      expect(result.atmosphereResult.atmosphereProfile.dominantSenses).toContain('visual');
    });

    it('should generate sensory details based on focus', async () => {
      const auditoryFocusOptions: SceneGenerationOptions = {
        ...basicOptions,
        sensoryFocus: 'auditory'
      };

      const request = {
        title: 'Auditory Scene',
        options: auditoryFocusOptions
      };

      const result = await sceneGenerator.generateScene(request);

      expect(result.atmosphereResult.sensoryDetails.auditory).toBeDefined();
      expect(result.atmosphereResult.sensoryDetails.auditory!.length).toBeGreaterThan(0);
    });
  });

  describe('Atmosphere Generation', () => {
    it('should generate atmosphere profile with all required components', async () => {
      const options: SceneGenerationOptions = {
        mood: 'mysterious',
        setting: 'indoor',
        timeOfDay: 'night',
        weather: 'foggy',
        season: 'autumn',
        sensoryFocus: 'balanced',
        detailLevel: 'rich',
        genre: 'mystery'
      };

      const result = await sceneGenerator.generateAtmosphere(options);

      expect(result.atmosphereProfile).toHaveProperty('mood', 'mysterious');
      expect(result.atmosphereProfile).toHaveProperty('intensity');
      expect(result.atmosphereProfile).toHaveProperty('dominantSenses');
      expect(result.atmosphereProfile).toHaveProperty('environmentalFactors');
      expect(result.atmosphereProfile).toHaveProperty('colorPalette');
      expect(result.atmosphereProfile).toHaveProperty('lightingStyle');
      expect(result.atmosphereProfile).toHaveProperty('soundscape');

      expect(result.sensoryDetails).toBeDefined();
      expect(result.moodDescriptors).toContain('enigmatic');
      expect(result.environmentalElements.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should calculate mood intensity correctly', async () => {
      const highIntensityOptions: SceneGenerationOptions = {
        mood: 'action',
        setting: 'outdoor',
        timeOfDay: 'night',
        weather: 'stormy',
        season: 'winter',
        sensoryFocus: 'balanced',
        detailLevel: 'immersive',
        genre: 'thriller'
      };

      const result = await sceneGenerator.generateAtmosphere(highIntensityOptions);

      expect(result.atmosphereProfile.intensity).toBeGreaterThan(7);
    });

    it('should generate appropriate environmental elements', async () => {
      const options: SceneGenerationOptions = {
        mood: 'romantic',
        setting: 'indoor',
        timeOfDay: 'evening',
        weather: 'clear',
        season: 'spring',
        sensoryFocus: 'balanced',
        detailLevel: 'moderate',
        genre: 'romance'
      };

      const result = await sceneGenerator.generateAtmosphere(options);

      const lightingElement = result.environmentalElements.find(e => e.type === 'lighting');
      const soundElement = result.environmentalElements.find(e => e.type === 'sound');

      expect(lightingElement).toBeDefined();
      expect(soundElement).toBeDefined();
      expect(lightingElement!.moodContribution).toBeDefined();
    });
  });

  describe('Action Choreography', () => {
    it('should generate complete action choreography', async () => {
      const request: ActionChoreographyRequest = {
        actionType: 'fight',
        participants: ['Hero', 'Villain'],
        setting: 'Ancient Arena',
        intensity: 'high',
        duration: 'medium',
        complexity: 'complex'
      };

      const result = await sceneGenerator.generateActionChoreography(request);

      expect(result).toHaveProperty('sequence');
      expect(result).toHaveProperty('timing');
      expect(result).toHaveProperty('spatialLayout');
      expect(result).toHaveProperty('suggestions');

      expect(result.sequence.length).toBeGreaterThan(0);
      expect(result.timing.totalDuration).toBeDefined();
      expect(result.spatialLayout.layout).toBeDefined();
    });

    it('should generate action sequence with proper structure', async () => {
      const request: ActionChoreographyRequest = {
        actionType: 'chase',
        participants: ['Runner', 'Pursuer'],
        setting: 'City Streets',
        intensity: 'medium',
        duration: 'short',
        complexity: 'moderate'
      };

      const result = await sceneGenerator.generateActionChoreography(request);

      for (const step of result.sequence) {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('participants');
        expect(step).toHaveProperty('duration');
        expect(step).toHaveProperty('intensity');
        expect(step).toHaveProperty('consequences');

        expect(step.intensity).toBeGreaterThanOrEqual(1);
        expect(step.intensity).toBeLessThanOrEqual(10);
      }
    });

    it('should calculate timing correctly', async () => {
      const request: ActionChoreographyRequest = {
        actionType: 'dance',
        participants: ['Dancer1', 'Dancer2'],
        setting: 'Ballroom',
        intensity: 'low',
        duration: 'extended',
        complexity: 'intricate'
      };

      const result = await sceneGenerator.generateActionChoreography(request);

      expect(result.timing.totalDuration).toBeDefined();
      expect(result.timing.pacing).toMatch(/^(slow|moderate|fast|variable)$/);
      expect(result.timing.beats.length).toBeGreaterThan(0);

      for (const beat of result.timing.beats) {
        expect(beat).toHaveProperty('timestamp');
        expect(beat).toHaveProperty('event');
        expect(beat).toHaveProperty('emphasis');
        expect(beat.emphasis).toMatch(/^(low|medium|high)$/);
      }
    });

    it('should generate spatial layout', async () => {
      const request: ActionChoreographyRequest = {
        actionType: 'stealth',
        participants: ['Infiltrator'],
        setting: 'Guarded Facility',
        intensity: 'medium',
        duration: 'medium',
        complexity: 'complex'
      };

      const result = await sceneGenerator.generateActionChoreography(request);

      expect(result.spatialLayout.layout).toBeDefined();
      expect(result.spatialLayout.keyPositions.length).toBeGreaterThan(0);
      expect(result.spatialLayout.movementPaths.length).toBeGreaterThan(0);
      expect(result.spatialLayout.obstacles).toBeDefined();

      for (const position of result.spatialLayout.keyPositions) {
        expect(position).toHaveProperty('name');
        expect(position).toHaveProperty('description');
      }
    });

    it('should provide actionable suggestions', async () => {
      const request: ActionChoreographyRequest = {
        actionType: 'combat',
        participants: ['Warrior1', 'Warrior2', 'Warrior3'],
        setting: 'Battlefield',
        intensity: 'extreme',
        duration: 'extended',
        complexity: 'intricate'
      };

      const result = await sceneGenerator.generateActionChoreography(request);

      expect(result.suggestions.length).toBeGreaterThan(0);

      for (const suggestion of result.suggestions) {
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('implementation');
        expect(suggestion.type).toMatch(/^(pacing|detail|consequence|realism)$/);
      }
    });
  });

  describe('Scene Enhancement', () => {
    const mockScene = {
      id: 'test-scene',
      title: 'Test Scene',
      content: 'The sun shone brightly in the clear blue sky. Birds sang in the trees.',
      summary: 'A peaceful morning scene',
      characters: ['Alice'],
      setting: 'Forest',
      mood: 'peaceful' as const
    };

    it('should enhance existing scene with atmosphere suggestions', async () => {
      const suggestions = await sceneGenerator.enhanceExistingScene(mockScene, 'atmosphere');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => typeof s === 'string')).toBe(true);
    });

    it('should enhance existing scene with sensory suggestions', async () => {
      const suggestions = await sceneGenerator.enhanceExistingScene(mockScene, 'sensory');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('auditory') || s.includes('sound'))).toBe(true);
    });

    it('should enhance existing scene with action suggestions', async () => {
      const staticScene = {
        ...mockScene,
        content: 'Alice sat quietly in the room. She thought about her day.'
      };

      const suggestions = await sceneGenerator.enhanceExistingScene(staticScene, 'action');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('movement') || s.includes('action'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown mood gracefully', async () => {
      const invalidOptions = {
        ...{
          mood: 'peaceful',
          setting: 'outdoor',
          timeOfDay: 'morning',
          weather: 'clear',
          season: 'spring',
          sensoryFocus: 'balanced',
          detailLevel: 'moderate',
          genre: 'fantasy'
        },
        mood: 'nonexistent_mood' as any
      };

      await expect(sceneGenerator.generateAtmosphere(invalidOptions))
        .rejects.toThrow('Unknown mood: nonexistent_mood');
    });

    it('should handle empty action choreography request', async () => {
      const emptyRequest: ActionChoreographyRequest = {
        actionType: 'fight',
        participants: [],
        setting: '',
        intensity: 'medium',
        duration: 'medium',
        complexity: 'moderate'
      };

      const result = await sceneGenerator.generateActionChoreography(emptyRequest);

      expect(result).toBeDefined();
      expect(result.sequence).toBeDefined();
    });
  });

  describe('Integration with AI Provider', () => {
    it('should call AI provider for scene content generation', async () => {
      const request = {
        title: 'AI Test Scene',
        options: {
          mood: 'mysterious' as const,
          setting: 'indoor' as const,
          timeOfDay: 'night' as const,
          weather: 'clear' as const,
          season: 'autumn' as const,
          sensoryFocus: 'balanced' as const,
          detailLevel: 'moderate' as const,
          genre: 'mystery' as const
        }
      };

      await sceneGenerator.generateScene(request);

      expect(mockAIRegistry.getProvider).toHaveBeenCalledWith('cowriter');
    });

    it('should generate scene summary using AI', async () => {
      const content = 'This is a test scene with some content for summarization.';
      
      const summary = await sceneGenerator.generateSceneSummary(content);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(mockAIRegistry.getProvider).toHaveBeenCalledWith('cowriter');
    });
  });
});

describe('AtmosphereEnhancer', () => {
  let atmosphereEnhancer: AtmosphereEnhancer;

  beforeEach(() => {
    atmosphereEnhancer = new AtmosphereEnhancer(mockAIRegistry);
    jest.clearAllMocks();
  });

  describe('Atmosphere Analysis', () => {
    const testScene = {
      id: 'test-scene',
      title: 'Test Scene',
      content: 'The dark shadows crept across the cold stone floor. A distant sound echoed through the empty halls. The air smelled of dust and decay.',
      summary: 'A dark, atmospheric scene',
      characters: ['Character1'],
      setting: 'Castle',
      mood: 'dark' as const
    };

    it('should analyze atmosphere comprehensively', async () => {
      const result = await atmosphereEnhancer.analyzeAtmosphere(testScene);

      expect(result).toHaveProperty('currentAtmosphere');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('weaknesses');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('moodConsistency');
      expect(result).toHaveProperty('sensoryBalance');
      expect(result).toHaveProperty('immersionScore');

      expect(result.moodConsistency).toBeGreaterThanOrEqual(0);
      expect(result.moodConsistency).toBeLessThanOrEqual(100);
      expect(result.immersionScore).toBeGreaterThanOrEqual(0);
      expect(result.immersionScore).toBeLessThanOrEqual(100);
    });

    it('should calculate mood consistency correctly', async () => {
      const consistentScene = {
        ...testScene,
        content: 'The dark, ominous shadows crept menacingly across the cold, grim stone floor. Sinister sounds echoed through the foreboding halls.',
        mood: 'dark' as const
      };

      const result = await atmosphereEnhancer.analyzeAtmosphere(consistentScene);

      expect(result.moodConsistency).toBeGreaterThan(70);
    });

    it('should analyze sensory balance accurately', async () => {
      const result = await atmosphereEnhancer.analyzeAtmosphere(testScene);

      expect(result.sensoryBalance).toHaveProperty('visual');
      expect(result.sensoryBalance).toHaveProperty('auditory');
      expect(result.sensoryBalance).toHaveProperty('tactile');
      expect(result.sensoryBalance).toHaveProperty('olfactory');
      expect(result.sensoryBalance).toHaveProperty('gustatory');
      expect(result.sensoryBalance).toHaveProperty('overall');

      // The test scene has visual (shadows), auditory (sound), and olfactory (smell) elements
      expect(result.sensoryBalance.visual).toBeGreaterThan(0);
      expect(result.sensoryBalance.auditory).toBeGreaterThan(0);
      expect(result.sensoryBalance.olfactory).toBeGreaterThan(0);
    });

    it('should identify atmospheric strengths', async () => {
      const richScene = {
        ...testScene,
        content: 'The dark shadows danced across the cold stone floor. Eerie sounds echoed through the halls. The musty smell of decay filled the air. The rough texture of the walls felt ominous under trembling fingers.'
      };

      const result = await atmosphereEnhancer.analyzeAtmosphere(richScene);

      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.strengths.some(s => s.includes('sensory'))).toBe(true);
    });

    it('should identify atmospheric weaknesses', async () => {
      const weakScene = {
        ...testScene,
        content: 'There was a room. It was dark.',
        mood: 'dark' as const
      };

      const result = await atmosphereEnhancer.analyzeAtmosphere(weakScene);

      expect(result.weaknesses.length).toBeGreaterThan(0);
      expect(result.weaknesses.some(w => w.includes('detail') || w.includes('sensory'))).toBe(true);
    });
  });

  describe('Enhancement Suggestions', () => {
    const basicScene = {
      id: 'basic-scene',
      title: 'Basic Scene',
      content: 'The room was bright. Someone walked in.',
      summary: 'A basic scene',
      characters: ['Person'],
      setting: 'Room',
      mood: 'neutral' as const
    };

    it('should generate enhancement suggestions', async () => {
      const suggestions = await atmosphereEnhancer.enhanceSceneAtmosphere(basicScene);

      expect(suggestions.length).toBeGreaterThan(0);

      for (const suggestion of suggestions) {
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('implementation');
        expect(suggestion).toHaveProperty('expectedImpact');
        expect(suggestion).toHaveProperty('targetArea');

        expect(suggestion.priority).toMatch(/^(low|medium|high)$/);
      }
    });

    it('should generate mood transition suggestions', async () => {
      const suggestions = await atmosphereEnhancer.generateMoodTransitionSuggestions('peaceful', 'tense');

      expect(suggestions.length).toBeGreaterThan(0);

      for (const suggestion of suggestions) {
        expect(suggestion.type).toBe('mood_transition');
        expect(suggestion.description).toContain('peaceful');
        expect(suggestion.description).toContain('tense');
      }
    });

    it('should handle mood transitions with target mood', async () => {
      const suggestions = await atmosphereEnhancer.enhanceSceneAtmosphere(basicScene, 'mysterious');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'mood_transition')).toBe(true);
    });
  });

  describe('Genre Guidance', () => {
    it('should provide genre atmosphere guidance', async () => {
      const fantasyGuide = await atmosphereEnhancer.getGenreAtmosphereGuidance('fantasy');

      expect(fantasyGuide).toBeDefined();
      expect(fantasyGuide!.genre).toBe('Fantasy');
      expect(fantasyGuide!.commonMoods.length).toBeGreaterThan(0);
      expect(fantasyGuide!.atmosphericElements.length).toBeGreaterThan(0);
      expect(fantasyGuide!.examples.length).toBeGreaterThan(0);
    });

    it('should return null for unknown genre', async () => {
      const unknownGuide = await atmosphereEnhancer.getGenreAtmosphereGuidance('unknown_genre');

      expect(unknownGuide).toBeNull();
    });

    it('should validate atmosphere for genre', async () => {
      const fantasyScene = {
        id: 'fantasy-scene',
        title: 'Fantasy Scene',
        content: 'The magical energy shimmered in the air around the ancient tower. Mystical runes glowed with ethereal light.',
        summary: 'A magical scene',
        characters: ['Wizard'],
        setting: 'Tower',
        mood: 'mysterious' as const
      };

      const validation = await atmosphereEnhancer.validateAtmosphereForGenre(fantasyScene, 'fantasy');

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(typeof validation.valid).toBe('boolean');
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    it('should identify genre violations', async () => {
      const modernScene = {
        id: 'modern-scene',
        title: 'Modern Scene',
        content: 'He pulled out his smartphone and checked his email while sitting in the coffee shop.',
        summary: 'A modern scene',
        characters: ['Person'],
        setting: 'Coffee Shop',
        mood: 'neutral' as const
      };

      const validation = await atmosphereEnhancer.validateAtmosphereForGenre(modernScene, 'fantasy');

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should work with AI provider for suggestions', async () => {
      const scene = {
        id: 'ai-test-scene',
        title: 'AI Test Scene',
        content: 'A simple scene for testing AI integration.',
        summary: 'Test scene',
        characters: ['Tester'],
        setting: 'Test Environment',
        mood: 'neutral' as const
      };

      const suggestions = await atmosphereEnhancer.enhanceSceneAtmosphere(scene);

      expect(mockAIRegistry.getProvider).toHaveBeenCalledWith('cowriter');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration: SceneGenerator + AtmosphereEnhancer', () => {
  let sceneGenerator: SceneGenerator;
  let atmosphereEnhancer: AtmosphereEnhancer;

  beforeEach(() => {
    sceneGenerator = new SceneGenerator(mockAIRegistry);
    atmosphereEnhancer = new AtmosphereEnhancer(mockAIRegistry);
    jest.clearAllMocks();
  });

  it('should generate scene and then enhance it', async () => {
    const request = {
      title: 'Integration Test Scene',
      options: {
        mood: 'peaceful' as const,
        setting: 'outdoor' as const,
        timeOfDay: 'morning' as const,
        weather: 'clear' as const,
        season: 'spring' as const,
        sensoryFocus: 'balanced' as const,
        detailLevel: 'moderate' as const,
        genre: 'fantasy' as const
      }
    };

    // Generate scene
    const sceneResult = await sceneGenerator.generateScene(request);
    expect(sceneResult.scene).toBeDefined();

    // Enhance the generated scene
    const enhancements = await atmosphereEnhancer.enhanceSceneAtmosphere(sceneResult.scene);
    expect(enhancements.length).toBeGreaterThan(0);

    // Analyze the enhanced scene
    const analysis = await atmosphereEnhancer.analyzeAtmosphere(sceneResult.scene);
    expect(analysis.immersionScore).toBeGreaterThan(0);
  });

  it('should validate generated scene against genre requirements', async () => {
    const request = {
      title: 'Genre Validation Test',
      options: {
        mood: 'mysterious' as const,
        setting: 'indoor' as const,
        timeOfDay: 'night' as const,
        weather: 'foggy' as const,
        season: 'autumn' as const,
        sensoryFocus: 'balanced' as const,
        detailLevel: 'rich' as const,
        genre: 'horror' as const
      }
    };

    const sceneResult = await sceneGenerator.generateScene(request);
    const validation = await atmosphereEnhancer.validateAtmosphereForGenre(sceneResult.scene, 'horror');

    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('issues');
  });
});