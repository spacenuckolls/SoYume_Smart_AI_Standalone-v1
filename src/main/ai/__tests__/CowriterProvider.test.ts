import { CowriterProvider } from '../providers/CowriterProvider';
import { StoryContext, ProviderConfig } from '../../../shared/types/AI';
import { Character } from '../../../shared/types/Story';

describe('CowriterProvider', () => {
  let provider: CowriterProvider;
  let mockConfig: ProviderConfig;

  beforeEach(() => {
    mockConfig = {
      localPath: './test-models/cowriter.onnx',
      quantization: '8bit',
      maxTokens: 1024,
      temperature: 0.7
    };
    
    provider = new CowriterProvider(
      'test-cowriter',
      'Test Co-writer',
      'cowriter',
      '1.0.0',
      [],
      10,
      {
        description: 'Test Co-writer AI',
        author: 'Test',
        supportedLanguages: ['en'],
        requirements: {
          internetRequired: false,
          apiKeyRequired: false
        }
      }
    );
  });

  afterEach(async () => {
    if (provider.isAvailable()) {
      await provider.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await provider.initialize(mockConfig);
      expect(provider.isAvailable()).toBe(true);
    });

    it('should handle missing model gracefully', async () => {
      const configWithMissingModel = {
        ...mockConfig,
        localPath: './non-existent-model.onnx'
      };
      
      await provider.initialize(configWithMissingModel);
      // Should still initialize with rule-based fallback
      expect(provider.isAvailable()).toBe(true);
    });

    it('should load knowledge base during initialization', async () => {
      await provider.initialize(mockConfig);
      
      // Test that knowledge base is loaded by checking if it can generate responses
      const context: StoryContext = {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'adult'
      };
      
      const response = await provider.generateText('Create a character outline', context);
      expect(response.content).toBeTruthy();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  describe('Text Generation', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should generate text with proper context', async () => {
      const context: StoryContext = {
        characters: [],
        genre: ['fantasy', 'adventure'],
        targetAudience: 'young-adult'
      };

      const response = await provider.generateText('Describe a magical forest', context);
      
      expect(response).toMatchObject({
        content: expect.any(String),
        confidence: expect.any(Number),
        metadata: expect.objectContaining({
          provider: 'Test Co-writer',
          responseTime: expect.any(Number)
        })
      });
      
      expect(response.content.length).toBeGreaterThan(10);
      expect(response.confidence).toBeGreaterThan(0);
    });

    it('should handle different genres appropriately', async () => {
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

      const fantasyResponse = await provider.generateText('Create a scene', fantasyContext);
      const romanceResponse = await provider.generateText('Create a scene', romanceContext);

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

      const yaResponse = await provider.generateText('Create a character', yaContext);
      const adultResponse = await provider.generateText('Create a character', adultContext);

      expect(yaResponse.content).toBeTruthy();
      expect(adultResponse.content).toBeTruthy();
    });
  });

  describe('Story Analysis', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should analyze story structure', async () => {
      const storyContent = `
        Once upon a time, there was a young wizard named Alex who lived in a small village.
        One day, a dragon attacked the village, and Alex had to find the courage to fight it.
        After a long battle, Alex defeated the dragon and saved the village.
        The villagers celebrated Alex as a hero.
      `;

      const analysis = await provider.analyzeStory(storyContent);

      expect(analysis).toMatchObject({
        structure: expect.objectContaining({
          identifiedStructure: expect.any(String),
          confidence: expect.any(Number)
        }),
        characters: expect.objectContaining({
          consistencyScore: expect.any(Number)
        }),
        pacing: expect.objectContaining({
          overallPacing: expect.any(String)
        }),
        consistency: expect.objectContaining({
          overallScore: expect.any(Number)
        }),
        overallScore: expect.any(Number),
        recommendations: expect.any(Array)
      });
    });

    it('should provide meaningful recommendations', async () => {
      const shortStory = 'A character did something.';
      
      const analysis = await provider.analyzeStory(shortStory);
      
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Character Generation', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should generate character from traits', async () => {
      const traits = {
        name: 'Elena',
        personality: ['brave', 'curious', 'stubborn'],
        motivations: ['save her family', 'discover the truth'],
        fears: ['losing loved ones', 'failure']
      };

      const character = await provider.generateCharacter(traits);

      expect(character).toMatchObject({
        id: expect.any(String),
        name: 'Elena',
        archetype: expect.objectContaining({
          primary: expect.any(String)
        }),
        traits: expect.objectContaining({
          personality: expect.arrayContaining(['brave', 'curious', 'stubborn'])
        }),
        voiceProfile: expect.objectContaining({
          formalityLevel: expect.any(Number)
        })
      });
    });

    it('should create different characters for different traits', async () => {
      const heroTraits = {
        name: 'Hero',
        personality: ['brave', 'noble', 'determined']
      };

      const villainTraits = {
        name: 'Villain',
        personality: ['cunning', 'ruthless', 'ambitious']
      };

      const hero = await provider.generateCharacter(heroTraits);
      const villain = await provider.generateCharacter(villainTraits);

      expect(hero.name).toBe('Hero');
      expect(villain.name).toBe('Villain');
      expect(hero.archetype.primary).not.toBe(villain.archetype.primary);
    });
  });

  describe('Specialized Co-writer Functions', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should generate story outline', async () => {
      const premise = 'A young mage discovers they have the power to control time';
      const structure = { type: 'three-act' };

      const outline = await provider.generateOutline(premise, structure);

      expect(outline).toMatchObject({
        title: expect.any(String),
        premise,
        structure,
        chapters: expect.any(Array),
        characters: expect.any(Array),
        themes: expect.any(Array),
        estimatedWordCount: expect.any(Number)
      });

      expect(outline.chapters.length).toBeGreaterThan(0);
    });

    it('should analyze manuscript and extract elements', async () => {
      const manuscript = `
        Chapter 1: The Beginning
        
        Sarah walked through the dark forest, her heart pounding with fear.
        She knew the ancient wizard Merlin was somewhere nearby, waiting.
        
        "Who goes there?" called a voice from the shadows.
        
        Chapter 2: The Meeting
        
        Merlin stepped into the moonlight, his long beard flowing in the wind.
        "I have been expecting you, young one," he said with a knowing smile.
      `;

      const analysis = await provider.analyzeManuscript(manuscript);

      expect(analysis).toMatchObject({
        extractedElements: expect.objectContaining({
          characters: expect.any(Array),
          settings: expect.any(Array),
          plotPoints: expect.any(Array),
          themes: expect.any(Array)
        }),
        structure: expect.any(Object),
        suggestions: expect.any(Array),
        confidence: expect.any(Number)
      });

      // Should extract character names
      const characterNames = analysis.extractedElements.characters.map((c: Character) => c.name);
      expect(characterNames).toContain('Sarah');
      expect(characterNames).toContain('Merlin');
    });

    it('should suggest scene structure', async () => {
      const sceneContext = {
        purpose: 'introduce conflict',
        characters: ['protagonist', 'antagonist'],
        setting: 'abandoned castle',
        mood: 'tense',
        targetWordCount: 800
      };

      const sceneOutline = await provider.suggestSceneStructure(sceneContext);

      expect(sceneOutline).toMatchObject({
        summary: expect.any(String),
        purpose: 'introduce conflict',
        characters: ['protagonist', 'antagonist'],
        setting: 'abandoned castle',
        mood: 'tense',
        estimatedWordCount: expect.any(Number)
      });
    });
  });

  describe('Health Check', () => {
    it('should report healthy status when properly initialized', async () => {
      await provider.initialize(mockConfig);
      
      const healthResult = await provider.healthCheck();
      
      expect(healthResult.healthy).toBe(true);
      expect(healthResult.responseTime).toBeGreaterThan(0);
    });

    it('should report unhealthy status when not initialized', async () => {
      const healthResult = await provider.healthCheck();
      
      expect(healthResult.healthy).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should update configuration successfully', async () => {
      const newConfig = {
        ...mockConfig,
        temperature: 0.9,
        maxTokens: 2048
      };

      await provider.updateConfig(newConfig);
      
      const updatedConfig = provider.getConfig();
      expect(updatedConfig.temperature).toBe(0.9);
      expect(updatedConfig.maxTokens).toBe(2048);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      await provider.initialize(mockConfig);

      // Test with empty input
      const response = await provider.generateText('', {
        characters: [],
        genre: [],
        targetAudience: ''
      });

      expect(response.content).toBeTruthy();
    });

    it('should provide meaningful error messages', async () => {
      // Test without initialization
      await expect(provider.generateText('test', {
        characters: [],
        genre: [],
        targetAudience: ''
      })).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await provider.generateText('Generate a short story opening', {
        characters: [],
        genre: ['fantasy'],
        targetAudience: 'adult'
      });
      
      const responseTime = Date.now() - startTime;
      
      // Should respond within 5 seconds (generous for testing)
      expect(responseTime).toBeLessThan(5000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        provider.generateText(`Request ${i}`, {
          characters: [],
          genre: ['fantasy'],
          targetAudience: 'adult'
        })
      );

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.content).toBeTruthy();
      });
    });
  });
});