import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { app } from 'electron';
import { Story, Character, Chapter, Scene } from '../../shared/types/Story';

// Simple in-memory database for initial development
// This will be replaced with a proper database in later iterations
interface DatabaseStore {
  stories: Map<string, any>;
  characters: Map<string, any>;
  chapters: Map<string, any>;
  scenes: Map<string, any>;
  settings: Map<string, any>;
  analysisCache: Map<string, any>;
}

export class DatabaseManager {
  private store: DatabaseStore;
  private encryptionKey: Buffer;
  private dataPath: string;

  constructor() {
    // Create user data directory if it doesn't exist
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'data');
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dataPath = path.join(dbDir, 'soyume-data.json');
    this.encryptionKey = this.getOrCreateEncryptionKey();
    this.store = {
      stories: new Map(),
      characters: new Map(),
      chapters: new Map(),
      scenes: new Map(),
      settings: new Map(),
      analysisCache: new Map()
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.loadFromFile();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      if (fs.existsSync(this.dataPath)) {
        const encryptedData = fs.readFileSync(this.dataPath, 'utf8');
        const decryptedData = this.decrypt(encryptedData);
        const data = JSON.parse(decryptedData);
        
        // Convert plain objects back to Maps
        this.store.stories = new Map(data.stories || []);
        this.store.characters = new Map(data.characters || []);
        this.store.chapters = new Map(data.chapters || []);
        this.store.scenes = new Map(data.scenes || []);
        this.store.settings = new Map(data.settings || []);
        this.store.analysisCache = new Map(data.analysisCache || []);
      }
    } catch (error) {
      console.warn('Could not load existing data, starting fresh:', error);
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      // Convert Maps to plain objects for serialization
      const data = {
        stories: Array.from(this.store.stories.entries()),
        characters: Array.from(this.store.characters.entries()),
        chapters: Array.from(this.store.chapters.entries()),
        scenes: Array.from(this.store.scenes.entries()),
        settings: Array.from(this.store.settings.entries()),
        analysisCache: Array.from(this.store.analysisCache.entries())
      };
      
      const serializedData = JSON.stringify(data);
      const encryptedData = this.encrypt(serializedData);
      fs.writeFileSync(this.dataPath, encryptedData, 'utf8');
    } catch (error) {
      console.error('Failed to save data to file:', error);
    }
  }

  // Encryption/Decryption methods
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const textParts = encryptedText.split(':');
    textParts.shift(); // Remove IV (not used in this simple implementation)
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getOrCreateEncryptionKey(): Buffer {
    const keyPath = path.join(app.getPath('userData'), 'encryption.key');
    
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    } else {
      const key = crypto.randomBytes(32);
      fs.writeFileSync(keyPath, key, { mode: 0o600 });
      return key;
    }
  }

  // Story operations
  async saveStory(story: Story): Promise<void> {
    try {
      // Store the story with encrypted sensitive data
      const storyData = {
        ...story,
        genre: this.encrypt(JSON.stringify(story.genre)),
        structure: this.encrypt(JSON.stringify(story.structure)),
        metadata: this.encrypt(JSON.stringify(story.metadata)),
        analysisCache: this.encrypt(JSON.stringify(story.analysisCache)),
        updatedAt: new Date()
      };

      this.store.stories.set(story.id, storyData);

      // Save characters
      for (const character of story.characters) {
        await this.saveCharacter(character);
      }

      // Save chapters
      for (const chapter of story.chapters) {
        await this.saveChapter(chapter);
      }

      await this.saveToFile();
    } catch (error) {
      console.error('Failed to save story:', error);
      throw error;
    }
  }

  async loadStory(storyId: string): Promise<Story | null> {
    try {
      const storyData = this.store.stories.get(storyId);
      if (!storyData) return null;

      // Load characters
      const characters = await this.loadCharactersByStoryId(storyId);
      
      // Load chapters
      const chapters = await this.loadChaptersByStoryId(storyId);

      return {
        id: storyData.id,
        title: storyData.title,
        genre: JSON.parse(this.decrypt(storyData.genre)),
        structure: JSON.parse(this.decrypt(storyData.structure)),
        characters,
        chapters,
        metadata: JSON.parse(this.decrypt(storyData.metadata)),
        analysisCache: JSON.parse(this.decrypt(storyData.analysisCache)),
        createdAt: new Date(storyData.createdAt),
        updatedAt: new Date(storyData.updatedAt)
      };
    } catch (error) {
      console.error('Failed to load story:', error);
      return null;
    }
  }

  async getAllStories(): Promise<Story[]> {
    try {
      const stories: Story[] = [];
      
      for (const [storyId] of this.store.stories) {
        const story = await this.loadStory(storyId);
        if (story) stories.push(story);
      }

      // Sort by updated date
      return stories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to get all stories:', error);
      return [];
    }
  }

  async deleteStory(storyId: string): Promise<void> {
    try {
      this.store.stories.delete(storyId);
      
      // Delete related characters
      for (const [charId, character] of this.store.characters) {
        if (character.storyId === storyId) {
          this.store.characters.delete(charId);
        }
      }
      
      // Delete related chapters and scenes
      for (const [chapterId, chapter] of this.store.chapters) {
        if (chapter.storyId === storyId) {
          this.store.chapters.delete(chapterId);
          
          // Delete scenes in this chapter
          for (const [sceneId, scene] of this.store.scenes) {
            if (scene.chapterId === chapterId) {
              this.store.scenes.delete(sceneId);
            }
          }
        }
      }

      await this.saveToFile();
    } catch (error) {
      console.error('Failed to delete story:', error);
      throw error;
    }
  }

  // Character operations
  private async saveCharacter(character: Character): Promise<void> {
    try {
      const characterData = {
        ...character,
        storyId: character.id.split('-')[0], // Extract story ID from character ID
        archetype: this.encrypt(JSON.stringify(character.archetype)),
        traits: this.encrypt(JSON.stringify(character.traits)),
        relationships: this.encrypt(JSON.stringify(character.relationships)),
        developmentArc: this.encrypt(JSON.stringify(character.developmentArc)),
        voiceProfile: this.encrypt(JSON.stringify(character.voiceProfile)),
        updatedAt: new Date()
      };

      this.store.characters.set(character.id, characterData);
    } catch (error) {
      console.error('Failed to save character:', error);
      throw error;
    }
  }

  private async loadCharactersByStoryId(storyId: string): Promise<Character[]> {
    try {
      const characters: Character[] = [];
      
      for (const [, characterData] of this.store.characters) {
        if (characterData.storyId === storyId) {
          characters.push({
            id: characterData.id,
            name: characterData.name,
            archetype: JSON.parse(this.decrypt(characterData.archetype)),
            traits: JSON.parse(this.decrypt(characterData.traits)),
            relationships: JSON.parse(this.decrypt(characterData.relationships)),
            developmentArc: JSON.parse(this.decrypt(characterData.developmentArc)),
            voiceProfile: JSON.parse(this.decrypt(characterData.voiceProfile))
          });
        }
      }

      return characters;
    } catch (error) {
      console.error('Failed to load characters:', error);
      return [];
    }
  }

  // Chapter operations
  private async saveChapter(chapter: Chapter): Promise<void> {
    try {
      const chapterData = {
        ...chapter,
        content: this.encrypt(chapter.content),
        analysis: chapter.analysis ? this.encrypt(JSON.stringify(chapter.analysis)) : null,
        updatedAt: new Date()
      };

      this.store.chapters.set(chapter.id, chapterData);

      // Save scenes
      for (const scene of chapter.scenes) {
        await this.saveScene(scene);
      }
    } catch (error) {
      console.error('Failed to save chapter:', error);
      throw error;
    }
  }

  private async loadChaptersByStoryId(storyId: string): Promise<Chapter[]> {
    try {
      const chapters: Chapter[] = [];

      for (const [chapterId, chapterData] of this.store.chapters) {
        if (chapterData.storyId === storyId) {
          const scenes = await this.loadScenesByChapterId(chapterId);
          
          chapters.push({
            id: chapterData.id,
            storyId: chapterData.storyId,
            title: chapterData.title,
            content: this.decrypt(chapterData.content),
            scenes,
            order: chapterData.order,
            wordCount: chapterData.wordCount,
            analysis: chapterData.analysis ? JSON.parse(this.decrypt(chapterData.analysis)) : undefined
          });
        }
      }

      // Sort by order
      return chapters.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Failed to load chapters:', error);
      return [];
    }
  }

  // Scene operations
  private async saveScene(scene: Scene): Promise<void> {
    try {
      const sceneData = {
        ...scene,
        setting: this.encrypt(JSON.stringify(scene.setting)),
        characters: this.encrypt(JSON.stringify(scene.characters)),
        mood: this.encrypt(JSON.stringify(scene.mood)),
        purpose: this.encrypt(JSON.stringify(scene.purpose)),
        content: this.encrypt(scene.content),
        analysis: scene.analysis ? this.encrypt(JSON.stringify(scene.analysis)) : null,
        updatedAt: new Date()
      };

      this.store.scenes.set(scene.id, sceneData);
    } catch (error) {
      console.error('Failed to save scene:', error);
      throw error;
    }
  }

  private async loadScenesByChapterId(chapterId: string): Promise<Scene[]> {
    try {
      const scenes: Scene[] = [];

      for (const [, sceneData] of this.store.scenes) {
        if (sceneData.chapterId === chapterId) {
          scenes.push({
            id: sceneData.id,
            chapterId: sceneData.chapterId,
            setting: JSON.parse(this.decrypt(sceneData.setting)),
            characters: JSON.parse(this.decrypt(sceneData.characters)),
            mood: JSON.parse(this.decrypt(sceneData.mood)),
            purpose: JSON.parse(this.decrypt(sceneData.purpose)),
            content: this.decrypt(sceneData.content),
            order: sceneData.order,
            analysis: sceneData.analysis ? JSON.parse(this.decrypt(sceneData.analysis)) : undefined
          });
        }
      }

      // Sort by order
      return scenes.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Failed to load scenes:', error);
      return [];
    }
  }

  // Settings operations
  async getSetting(key: string): Promise<any> {
    try {
      const settingData = this.store.settings.get(key);
      if (!settingData) return null;
      
      try {
        return JSON.parse(this.decrypt(settingData.value));
      } catch {
        return this.decrypt(settingData.value);
      }
    } catch (error) {
      console.error('Failed to get setting:', error);
      return null;
    }
  }

  async setSetting(key: string, value: any): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const settingData = {
        key,
        value: this.encrypt(serializedValue),
        updatedAt: new Date()
      };

      this.store.settings.set(key, settingData);
      await this.saveToFile();
    } catch (error) {
      console.error('Failed to set setting:', error);
      throw error;
    }
  }

  // Cache operations
  async getCachedAnalysis(contentHash: string, analysisType: string): Promise<any> {
    try {
      const cacheKey = `${contentHash}-${analysisType}`;
      const cacheData = this.store.analysisCache.get(cacheKey);
      
      if (!cacheData) return null;
      
      // Check if expired
      if (cacheData.expiresAt && new Date() > new Date(cacheData.expiresAt)) {
        this.store.analysisCache.delete(cacheKey);
        return null;
      }

      return JSON.parse(this.decrypt(cacheData.resultData));
    } catch (error) {
      console.error('Failed to get cached analysis:', error);
      return null;
    }
  }

  async setCachedAnalysis(contentHash: string, analysisType: string, result: any, expiresIn?: number): Promise<void> {
    try {
      const cacheKey = `${contentHash}-${analysisType}`;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
      
      const cacheData = {
        contentHash,
        analysisType,
        resultData: this.encrypt(JSON.stringify(result)),
        createdAt: new Date(),
        expiresAt
      };

      this.store.analysisCache.set(cacheKey, cacheData);
      await this.saveToFile();
    } catch (error) {
      console.error('Failed to set cached analysis:', error);
      throw error;
    }
  }

  async cleanExpiredCache(): Promise<void> {
    try {
      const now = new Date();
      const keysToDelete: string[] = [];

      for (const [key, cacheData] of this.store.analysisCache) {
        if (cacheData.expiresAt && now > new Date(cacheData.expiresAt)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.store.analysisCache.delete(key));
      
      if (keysToDelete.length > 0) {
        await this.saveToFile();
      }
    } catch (error) {
      console.error('Failed to clean expired cache:', error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.saveToFile();
      console.log('Database closed successfully');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}