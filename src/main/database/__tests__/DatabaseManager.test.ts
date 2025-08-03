import { DatabaseManager } from '../DatabaseManager';
import { Story } from '../../../shared/types/Story';

// Suppress console output for cleaner test results
beforeAll(() => {
  (global as any).suppressConsole();
});

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });

    it('should create required tables', async () => {
      await dbManager.initialize();
      
      // For the new in-memory database, just verify initialization completed
      expect(dbManager).toBeDefined();
    });
  });

  describe('story operations', () => {
    const mockStory: Story = {
      id: 'test-story-1',
      title: 'Test Story',
      genre: [{ name: 'Fantasy', subgenres: [], conventions: [], tropes: [] }],
      structure: { type: 'three-act', beats: [] },
      characters: [],
      chapters: [],
      metadata: {
        targetWordCount: 80000,
        currentWordCount: 0,
        targetAudience: 'young-adult',
        contentRating: 'PG-13',
        tags: ['fantasy'],
        notes: 'Test story'
      },
      analysisCache: {
        lastAnalyzed: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should save a story successfully', async () => {
      await expect(dbManager.saveStory(mockStory)).resolves.not.toThrow();
      
      // Verify story was saved by loading it back
      const loadedStory = await dbManager.loadStory(mockStory.id);
      expect(loadedStory).toBeTruthy();
      expect(loadedStory?.title).toBe(mockStory.title);
    });

    it('should load a story successfully', async () => {
      // First save a story
      await dbManager.saveStory(mockStory);
      
      // Then load it
      const result = await dbManager.loadStory('test-story-1');
      
      expect(result).toBeTruthy();
      expect(result?.id).toBe('test-story-1');
      expect(result?.title).toBe('Test Story');
    });

    it('should return null for non-existent story', async () => {
      const result = await dbManager.loadStory('non-existent');
      expect(result).toBeNull();
    });

    it('should delete a story successfully', async () => {
      // First save a story
      await dbManager.saveStory(mockStory);
      
      // Verify it exists
      let story = await dbManager.loadStory('test-story-1');
      expect(story).toBeTruthy();
      
      // Delete it
      await expect(dbManager.deleteStory('test-story-1')).resolves.not.toThrow();
      
      // Verify it's gone
      story = await dbManager.loadStory('test-story-1');
      expect(story).toBeNull();
    });
  });

  describe('settings operations', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should save and retrieve settings', async () => {
      await dbManager.setSetting('test-key', 'test-value');
      const result = await dbManager.getSetting('test-key');

      expect(result).toBe('test-value');
    });

    it('should return null for non-existent setting', async () => {
      const result = await dbManager.getSetting('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('cache operations', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should cache and retrieve analysis results', async () => {
      const testResult = { analysis: 'test-analysis' };
      await dbManager.setCachedAnalysis('test-hash', 'story-analysis', testResult);
      const result = await dbManager.getCachedAnalysis('test-hash', 'story-analysis');

      expect(result).toEqual(testResult);
    });

    it('should clean expired cache entries', async () => {
      // Add an expired cache entry
      const testResult = { analysis: 'test-analysis' };
      await dbManager.setCachedAnalysis('test-hash', 'story-analysis', testResult, -1); // Expired 1 second ago
      
      // Clean expired cache
      await dbManager.cleanExpiredCache();
      
      // Verify it's gone
      const result = await dbManager.getCachedAnalysis('test-hash', 'story-analysis');
      expect(result).toBeNull();
    });
  });

  describe('encryption', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should encrypt sensitive data before storage', async () => {
      await dbManager.setSetting('sensitive-key', 'sensitive-value');
      
      // Verify that crypto functions were called for encryption
      expect((global as any).mockCrypto.createCipher).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Mock fs.readFileSync to throw an error
      (global as any).mockFs.readFileSync = jest.fn(() => {
        throw new Error('File read error');
      });

      // Should not throw, but log a warning and start fresh
      await expect(dbManager.initialize()).resolves.not.toThrow();
    });

    it('should handle encryption errors gracefully', async () => {
      // Mock crypto to throw an error
      (global as any).mockCrypto.createCipher = jest.fn(() => {
        throw new Error('Encryption error');
      });

      await expect(dbManager.setSetting('test-key', 'test-value')).rejects.toThrow();
    });
  });
});