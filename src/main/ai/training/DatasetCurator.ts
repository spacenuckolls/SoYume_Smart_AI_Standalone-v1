import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Dataset curation and preparation for creative writing training
 * Handles collection, cleaning, and structuring of training data
 */
export class DatasetCurator extends EventEmitter {
  private datasetPath: string;
  private curationConfig: CurationConfig;
  private qualityFilters: QualityFilter[];
  private genreClassifier: GenreClassifier;
  private structureAnalyzer: StructureAnalyzer;

  constructor(options: DatasetCuratorOptions = {}) {
    super();
    
    this.datasetPath = options.datasetPath || path.join(process.cwd(), 'data', 'training');
    this.curationConfig = {
      minWordCount: options.minWordCount || 100,
      maxWordCount: options.maxWordCount || 10000,
      minQualityScore: options.minQualityScore || 0.7,
      supportedLanguages: options.supportedLanguages || ['en'],
      genreCategories: options.genreCategories || [
        'fantasy', 'science-fiction', 'romance', 'mystery', 'thriller',
        'horror', 'literary', 'young-adult', 'light-novel', 'manga'
      ],
      structureTypes: options.structureTypes || [
        'three-act', 'heros-journey', 'save-the-cat', 'kishōtenketsu'
      ],
      ...options.curationConfig
    };
    
    this.qualityFilters = this.initializeQualityFilters();
    this.genreClassifier = new GenreClassifier(this.curationConfig.genreCategories);
    this.structureAnalyzer = new StructureAnalyzer(this.curationConfig.structureTypes);
    
    this.initialize();
  }

  /**
   * Initialize dataset curator
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.datasetPath, { recursive: true });
      await this.genreClassifier.initialize();
      await this.structureAnalyzer.initialize();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize dataset curator: ${(error as Error).message}`);
    }
  }

  /**
   * Curate dataset from multiple sources
   */
  async curateDataset(sources: DataSource[]): Promise<CurationResult> {
    const result: CurationResult = {
      totalSamples: 0,
      acceptedSamples: 0,
      rejectedSamples: 0,
      qualityDistribution: {},
      genreDistribution: {},
      structureDistribution: {},
      processingTime: 0,
      errors: []
    };
    
    const startTime = Date.now();
    
    try {
      for (const source of sources) {
        this.emit('sourceProcessingStarted', { source: source.name });
        
        const sourceResult = await this.processDataSource(source);
        
        result.totalSamples += sourceResult.totalSamples;
        result.acceptedSamples += sourceResult.acceptedSamples;
        result.rejectedSamples += sourceResult.rejectedSamples;
        result.errors.push(...sourceResult.errors);
        
        // Merge distributions
        this.mergeDistribution(result.qualityDistribution, sourceResult.qualityDistribution);
        this.mergeDistribution(result.genreDistribution, sourceResult.genreDistribution);
        this.mergeDistribution(result.structureDistribution, sourceResult.structureDistribution);
        
        this.emit('sourceProcessingCompleted', { 
          source: source.name, 
          result: sourceResult 
        });
      }
      
      result.processingTime = Date.now() - startTime;
      
      // Generate dataset statistics
      await this.generateDatasetStatistics(result);
      
      this.emit('curationCompleted', result);
      return result;
      
    } catch (error) {
      result.errors.push((error as Error).message);
      result.processingTime = Date.now() - startTime;
      
      this.emit('curationFailed', { result, error });
      throw error;
    }
  }

  /**
   * Process individual data source
   */
  private async processDataSource(source: DataSource): Promise<CurationResult> {
    const result: CurationResult = {
      totalSamples: 0,
      acceptedSamples: 0,
      rejectedSamples: 0,
      qualityDistribution: {},
      genreDistribution: {},
      structureDistribution: {},
      processingTime: 0,
      errors: []
    };
    
    try {
      const samples = await this.loadDataFromSource(source);
      result.totalSamples = samples.length;
      
      for (const sample of samples) {
        try {
          const processedSample = await this.processSample(sample, source);
          
          if (processedSample) {
            await this.storeCuratedSample(processedSample);
            result.acceptedSamples++;
            
            // Update distributions
            this.updateDistribution(result.qualityDistribution, processedSample.qualityScore);
            this.updateDistribution(result.genreDistribution, processedSample.genre);
            this.updateDistribution(result.structureDistribution, processedSample.structure);
          } else {
            result.rejectedSamples++;
          }
        } catch (error) {
          result.rejectedSamples++;
          result.errors.push(`Sample processing error: ${(error as Error).message}`);
        }
      }
      
    } catch (error) {
      result.errors.push(`Source processing error: ${(error as Error).message}`);
    }
    
    return result;
  }

  /**
   * Process individual sample
   */
  private async processSample(sample: RawSample, source: DataSource): Promise<CuratedSample | null> {
    // Basic validation
    if (!this.validateSample(sample)) {
      return null;
    }
    
    // Clean and normalize text
    const cleanedText = this.cleanText(sample.text);
    
    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(cleanedText, sample);
    
    if (qualityScore < this.curationConfig.minQualityScore) {
      return null;
    }
    
    // Classify genre
    const genre = await this.genreClassifier.classify(cleanedText, sample.metadata);
    
    // Analyze structure
    const structure = await this.structureAnalyzer.analyze(cleanedText);
    
    // Extract creative writing elements
    const elements = await this.extractCreativeElements(cleanedText);
    
    // Create curated sample
    const curatedSample: CuratedSample = {
      id: crypto.randomUUID(),
      text: cleanedText,
      originalSource: source.name,
      qualityScore,
      genre,
      structure,
      elements,
      metadata: {
        ...sample.metadata,
        wordCount: this.countWords(cleanedText),
        language: this.detectLanguage(cleanedText),
        processedAt: Date.now(),
        curationVersion: '1.0.0'
      },
      trainingTasks: this.generateTrainingTasks(cleanedText, elements)
    };
    
    return curatedSample;
  }

  /**
   * Load data from source
   */
  private async loadDataFromSource(source: DataSource): Promise<RawSample[]> {
    switch (source.type) {
      case 'file':
        return await this.loadFromFile(source);
      case 'directory':
        return await this.loadFromDirectory(source);
      case 'api':
        return await this.loadFromAPI(source);
      case 'database':
        return await this.loadFromDatabase(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  /**
   * Load from file source
   */
  private async loadFromFile(source: DataSource): Promise<RawSample[]> {
    const content = await fs.readFile(source.path!, 'utf8');
    
    switch (source.format) {
      case 'json':
        return JSON.parse(content);
      case 'jsonl':
        return content.split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      case 'txt':
        return [{
          text: content,
          metadata: { filename: path.basename(source.path!) }
        }];
      case 'csv':
        return this.parseCSV(content);
      default:
        throw new Error(`Unsupported file format: ${source.format}`);
    }
  }

  /**
   * Load from directory source
   */
  private async loadFromDirectory(source: DataSource): Promise<RawSample[]> {
    const samples: RawSample[] = [];
    const files = await fs.readdir(source.path!);
    
    for (const file of files) {
      const filePath = path.join(source.path!, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isFile() && this.isSupportedFile(file)) {
        try {
          const fileSource: DataSource = {
            ...source,
            type: 'file',
            path: filePath,
            format: this.getFileFormat(file)
          };
          
          const fileSamples = await this.loadFromFile(fileSource);
          samples.push(...fileSamples);
        } catch (error) {
          this.emit('warning', `Failed to load file ${file}: ${(error as Error).message}`);
        }
      }
    }
    
    return samples;
  }

  /**
   * Load from API source
   */
  private async loadFromAPI(source: DataSource): Promise<RawSample[]> {
    // Implementation would depend on specific API
    // This is a placeholder for API integration
    throw new Error('API source loading not implemented');
  }

  /**
   * Load from database source
   */
  private async loadFromDatabase(source: DataSource): Promise<RawSample[]> {
    // Implementation would depend on specific database
    // This is a placeholder for database integration
    throw new Error('Database source loading not implemented');
  }

  /**
   * Validate sample
   */
  private validateSample(sample: RawSample): boolean {
    if (!sample.text || typeof sample.text !== 'string') {
      return false;
    }
    
    const wordCount = this.countWords(sample.text);
    
    if (wordCount < this.curationConfig.minWordCount || 
        wordCount > this.curationConfig.maxWordCount) {
      return false;
    }
    
    // Check for supported language
    const language = this.detectLanguage(sample.text);
    if (!this.curationConfig.supportedLanguages.includes(language)) {
      return false;
    }
    
    return true;
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove control characters
    text = text.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Normalize quotes
    text = text.replace(/[""]/g, '"');
    text = text.replace(/['']/g, "'");
    
    // Normalize dashes
    text = text.replace(/[—–]/g, '-');
    
    // Remove excessive punctuation
    text = text.replace(/[.]{3,}/g, '...');
    text = text.replace(/[!]{2,}/g, '!');
    text = text.replace(/[?]{2,}/g, '?');
    
    return text;
  }

  /**
   * Calculate quality score
   */
  private async calculateQualityScore(text: string, sample: RawSample): Promise<number> {
    let score = 1.0;
    
    // Apply quality filters
    for (const filter of this.qualityFilters) {
      const filterScore = await filter.evaluate(text, sample);
      score *= filterScore;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Extract creative writing elements
   */
  private async extractCreativeElements(text: string): Promise<CreativeElements> {
    const elements: CreativeElements = {
      characters: [],
      settings: [],
      plotPoints: [],
      themes: [],
      dialogueRatio: 0,
      narrativeStyle: 'third-person',
      tense: 'past',
      pov: 'third-person-limited'
    };
    
    // Extract characters (simplified)
    const characterMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    elements.characters = [...new Set(characterMatches)].slice(0, 10);
    
    // Extract settings (simplified)
    const settingKeywords = ['castle', 'forest', 'city', 'village', 'mountain', 'ocean', 'desert'];
    elements.settings = settingKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    );
    
    // Calculate dialogue ratio
    const dialogueMatches = text.match(/"[^"]*"/g) || [];
    const totalDialogueLength = dialogueMatches.reduce((sum, match) => sum + match.length, 0);
    elements.dialogueRatio = totalDialogueLength / text.length;
    
    // Detect narrative style (simplified)
    if (text.includes(' I ') || text.startsWith('I ')) {
      elements.narrativeStyle = 'first-person';
      elements.pov = 'first-person';
    } else if (text.includes(' you ') || text.startsWith('You ')) {
      elements.narrativeStyle = 'second-person';
      elements.pov = 'second-person';
    }
    
    // Detect tense (simplified)
    const pastTenseWords = ['was', 'were', 'had', 'did', 'went', 'came', 'said'];
    const presentTenseWords = ['is', 'are', 'has', 'does', 'goes', 'comes', 'says'];
    
    const pastCount = pastTenseWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    const presentCount = presentTenseWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    elements.tense = presentCount > pastCount ? 'present' : 'past';
    
    return elements;
  }

  /**
   * Generate training tasks for sample
   */
  private generateTrainingTasks(text: string, elements: CreativeElements): TrainingTask[] {
    const tasks: TrainingTask[] = [];
    
    // Character development task
    if (elements.characters.length > 0) {
      tasks.push({
        type: 'character-analysis',
        input: text,
        target: {
          characters: elements.characters,
          relationships: this.extractCharacterRelationships(text, elements.characters)
        }
      });
    }
    
    // Scene structure task
    tasks.push({
      type: 'scene-structure',
      input: text,
      target: {
        structure: elements.pov,
        setting: elements.settings[0] || 'unknown',
        mood: this.extractMood(text)
      }
    });
    
    // Dialogue generation task
    if (elements.dialogueRatio > 0.1) {
      const dialogues = this.extractDialogues(text);
      if (dialogues.length > 0) {
        tasks.push({
          type: 'dialogue-generation',
          input: this.removeDialogues(text),
          target: {
            dialogues: dialogues
          }
        });
      }
    }
    
    // Outline generation task
    const outline = this.generateOutline(text);
    if (outline.length > 1) {
      tasks.push({
        type: 'outline-generation',
        input: text.substring(0, Math.min(500, text.length)),
        target: {
          outline: outline
        }
      });
    }
    
    return tasks;
  }

  /**
   * Store curated sample
   */
  private async storeCuratedSample(sample: CuratedSample): Promise<void> {
    const genreDir = path.join(this.datasetPath, 'curated', sample.genre);
    await fs.mkdir(genreDir, { recursive: true });
    
    const filePath = path.join(genreDir, `${sample.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(sample, null, 2));
  }

  /**
   * Generate dataset statistics
   */
  private async generateDatasetStatistics(result: CurationResult): Promise<void> {
    const stats = {
      summary: {
        totalSamples: result.totalSamples,
        acceptedSamples: result.acceptedSamples,
        rejectedSamples: result.rejectedSamples,
        acceptanceRate: result.totalSamples > 0 ? result.acceptedSamples / result.totalSamples : 0
      },
      distributions: {
        quality: result.qualityDistribution,
        genre: result.genreDistribution,
        structure: result.structureDistribution
      },
      processingTime: result.processingTime,
      generatedAt: Date.now()
    };
    
    const statsPath = path.join(this.datasetPath, 'statistics.json');
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  }

  /**
   * Initialize quality filters
   */
  private initializeQualityFilters(): QualityFilter[] {
    return [
      new LanguageQualityFilter(),
      new ContentQualityFilter(),
      new StructureQualityFilter(),
      new CreativityQualityFilter()
    ];
  }

  /**
   * Utility methods
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private detectLanguage(text: string): string {
    // Simplified language detection - would use proper library in production
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'];
    const englishCount = englishWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0
    );
    
    return englishCount > 5 ? 'en' : 'unknown';
  }

  private parseCSV(content: string): RawSample[] {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const samples: RawSample[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === headers.length) {
        const sample: RawSample = {
          text: values[headers.indexOf('text')] || '',
          metadata: {}
        };
        
        headers.forEach((header, index) => {
          if (header !== 'text') {
            sample.metadata[header] = values[index];
          }
        });
        
        samples.push(sample);
      }
    }
    
    return samples;
  }

  private isSupportedFile(filename: string): boolean {
    const supportedExtensions = ['.txt', '.json', '.jsonl', '.csv'];
    return supportedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private getFileFormat(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.json': return 'json';
      case '.jsonl': return 'jsonl';
      case '.txt': return 'txt';
      case '.csv': return 'csv';
      default: return 'txt';
    }
  }

  private mergeDistribution(target: Record<string, number>, source: Record<string, number>): void {
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + value;
    }
  }

  private updateDistribution(distribution: Record<string, number>, key: string | number): void {
    const keyStr = String(key);
    distribution[keyStr] = (distribution[keyStr] || 0) + 1;
  }

  private extractCharacterRelationships(text: string, characters: string[]): string[] {
    // Simplified relationship extraction
    const relationships: string[] = [];
    
    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const char1 = characters[i];
        const char2 = characters[j];
        
        if (text.includes(char1) && text.includes(char2)) {
          relationships.push(`${char1}-${char2}`);
        }
      }
    }
    
    return relationships;
  }

  private extractMood(text: string): string {
    const moodKeywords = {
      'dark': ['dark', 'shadow', 'fear', 'death', 'evil'],
      'light': ['bright', 'hope', 'joy', 'love', 'peace'],
      'mysterious': ['mystery', 'secret', 'hidden', 'unknown'],
      'romantic': ['love', 'heart', 'kiss', 'romance', 'passion'],
      'adventurous': ['adventure', 'quest', 'journey', 'explore']
    };
    
    let maxScore = 0;
    let dominantMood = 'neutral';
    
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      const score = keywords.reduce((count, keyword) => 
        count + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length, 0
      );
      
      if (score > maxScore) {
        maxScore = score;
        dominantMood = mood;
      }
    }
    
    return dominantMood;
  }

  private extractDialogues(text: string): string[] {
    const dialogueMatches = text.match(/"[^"]*"/g) || [];
    return dialogueMatches.map(match => match.slice(1, -1)); // Remove quotes
  }

  private removeDialogues(text: string): string {
    return text.replace(/"[^"]*"/g, '[DIALOGUE]');
  }

  private generateOutline(text: string): string[] {
    // Simplified outline generation - split by paragraphs and summarize
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
    
    return paragraphs.slice(0, 5).map((paragraph, index) => {
      const firstSentence = paragraph.split('.')[0];
      return `${index + 1}. ${firstSentence.substring(0, 100)}...`;
    });
  }

  /**
   * Export curated dataset
   */
  async exportDataset(format: 'json' | 'jsonl' | 'parquet', outputPath: string): Promise<void> {
    const curatedDir = path.join(this.datasetPath, 'curated');
    const samples: CuratedSample[] = [];
    
    // Collect all curated samples
    const genres = await fs.readdir(curatedDir);
    
    for (const genre of genres) {
      const genreDir = path.join(curatedDir, genre);
      const files = await fs.readdir(genreDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(genreDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const sample: CuratedSample = JSON.parse(content);
          samples.push(sample);
        }
      }
    }
    
    // Export in requested format
    switch (format) {
      case 'json':
        await fs.writeFile(outputPath, JSON.stringify(samples, null, 2));
        break;
      case 'jsonl':
        const jsonlContent = samples.map(sample => JSON.stringify(sample)).join('\n');
        await fs.writeFile(outputPath, jsonlContent);
        break;
      case 'parquet':
        // Would use a parquet library in production
        throw new Error('Parquet export not implemented');
    }
    
    this.emit('datasetExported', { format, outputPath, sampleCount: samples.length });
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStatistics(): Promise<DatasetStatistics> {
    try {
      const statsPath = path.join(this.datasetPath, 'statistics.json');
      const content = await fs.readFile(statsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error('Dataset statistics not found. Run curation first.');
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Genre classifier
 */
class GenreClassifier {
  private genres: string[];
  private keywords: Map<string, string[]>;

  constructor(genres: string[]) {
    this.genres = genres;
    this.keywords = new Map();
  }

  async initialize(): Promise<void> {
    // Initialize genre keywords
    this.keywords.set('fantasy', ['magic', 'dragon', 'wizard', 'spell', 'kingdom', 'quest']);
    this.keywords.set('science-fiction', ['space', 'robot', 'alien', 'future', 'technology', 'laser']);
    this.keywords.set('romance', ['love', 'heart', 'kiss', 'romance', 'relationship', 'wedding']);
    this.keywords.set('mystery', ['mystery', 'detective', 'clue', 'murder', 'investigate', 'suspect']);
    this.keywords.set('horror', ['horror', 'fear', 'ghost', 'monster', 'nightmare', 'scream']);
    // Add more genre keywords...
  }

  async classify(text: string, metadata?: Record<string, any>): Promise<string> {
    const scores: Record<string, number> = {};
    
    // Check metadata first
    if (metadata?.genre && this.genres.includes(metadata.genre)) {
      return metadata.genre;
    }
    
    // Score based on keywords
    for (const [genre, keywords] of this.keywords) {
      scores[genre] = keywords.reduce((score, keyword) => 
        score + (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length, 0
      );
    }
    
    // Find highest scoring genre
    const maxScore = Math.max(...Object.values(scores));
    const bestGenre = Object.entries(scores).find(([, score]) => score === maxScore)?.[0];
    
    return bestGenre || 'literary';
  }
}

/**
 * Structure analyzer
 */
class StructureAnalyzer {
  private structureTypes: string[];

  constructor(structureTypes: string[]) {
    this.structureTypes = structureTypes;
  }

  async initialize(): Promise<void> {
    // Initialize structure analysis
  }

  async analyze(text: string): Promise<string> {
    // Simplified structure analysis
    const paragraphs = text.split('\n\n').length;
    
    if (paragraphs <= 3) {
      return 'single-scene';
    } else if (paragraphs <= 10) {
      return 'three-act';
    } else {
      return 'multi-chapter';
    }
  }
}

/**
 * Quality filters
 */
abstract class QualityFilter {
  abstract evaluate(text: string, sample: RawSample): Promise<number>;
}

class LanguageQualityFilter extends QualityFilter {
  async evaluate(text: string, sample: RawSample): Promise<number> {
    // Check for proper grammar, spelling, etc.
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    // Penalize very short or very long sentences
    if (avgSentenceLength < 20 || avgSentenceLength > 200) {
      return 0.7;
    }
    
    return 1.0;
  }
}

class ContentQualityFilter extends QualityFilter {
  async evaluate(text: string, sample: RawSample): Promise<number> {
    // Check for repetitive content, spam, etc.
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    
    // Penalize repetitive content
    if (uniqueRatio < 0.3) {
      return 0.5;
    }
    
    return 1.0;
  }
}

class StructureQualityFilter extends QualityFilter {
  async evaluate(text: string, sample: RawSample): Promise<number> {
    // Check for proper story structure
    const hasDialogue = text.includes('"');
    const hasNarration = !text.match(/^".*"$/);
    const hasParagraphs = text.includes('\n');
    
    let score = 1.0;
    
    if (!hasDialogue && !hasNarration) score *= 0.8;
    if (!hasParagraphs && text.length > 500) score *= 0.9;
    
    return score;
  }
}

class CreativityQualityFilter extends QualityFilter {
  async evaluate(text: string, sample: RawSample): Promise<number> {
    // Check for creative elements
    const hasMetaphors = /like|as.*as|metaphor/i.test(text);
    const hasDescriptiveLanguage = /beautiful|mysterious|ancient|gleaming/i.test(text);
    const hasEmotionalContent = /felt|emotion|heart|soul/i.test(text);
    
    let score = 0.8; // Base score
    
    if (hasMetaphors) score += 0.1;
    if (hasDescriptiveLanguage) score += 0.1;
    if (hasEmotionalContent) score += 0.1;
    
    return Math.min(1.0, score);
  }
}

// Types and interfaces
export interface DatasetCuratorOptions {
  datasetPath?: string;
  minWordCount?: number;
  maxWordCount?: number;
  minQualityScore?: number;
  supportedLanguages?: string[];
  genreCategories?: string[];
  structureTypes?: string[];
  curationConfig?: Partial<CurationConfig>;
}

export interface CurationConfig {
  minWordCount: number;
  maxWordCount: number;
  minQualityScore: number;
  supportedLanguages: string[];
  genreCategories: string[];
  structureTypes: string[];
}

export interface DataSource {
  name: string;
  type: 'file' | 'directory' | 'api' | 'database';
  path?: string;
  format?: string;
  config?: Record<string, any>;
}

export interface RawSample {
  text: string;
  metadata: Record<string, any>;
}

export interface CuratedSample {
  id: string;
  text: string;
  originalSource: string;
  qualityScore: number;
  genre: string;
  structure: string;
  elements: CreativeElements;
  metadata: Record<string, any>;
  trainingTasks: TrainingTask[];
}

export interface CreativeElements {
  characters: string[];
  settings: string[];
  plotPoints: string[];
  themes: string[];
  dialogueRatio: number;
  narrativeStyle: string;
  tense: string;
  pov: string;
}

export interface TrainingTask {
  type: string;
  input: string;
  target: Record<string, any>;
}

export interface CurationResult {
  totalSamples: number;
  acceptedSamples: number;
  rejectedSamples: number;
  qualityDistribution: Record<string, number>;
  genreDistribution: Record<string, number>;
  structureDistribution: Record<string, number>;
  processingTime: number;
  errors: string[];
}

export interface DatasetStatistics {
  summary: {
    totalSamples: number;
    acceptedSamples: number;
    rejectedSamples: number;
    acceptanceRate: number;
  };
  distributions: {
    quality: Record<string, number>;
    genre: Record<string, number>;
    structure: Record<string, number>;
  };
  processingTime: number;
  generatedAt: number;
}