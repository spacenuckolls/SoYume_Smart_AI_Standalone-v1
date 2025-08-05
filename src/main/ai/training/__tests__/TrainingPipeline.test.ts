import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatasetCurator } from '../DatasetCurator';
import { FineTuningPipeline } from '../FineTuningPipeline';
import { EvaluationFramework } from '../EvaluationFramework';
import { ModelVersioning } from '../ModelVersioning';
import { ContinuousImprovement } from '../ContinuousImprovement';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

describe('SoYume Co-writer AI Training Pipeline', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp', crypto.randomUUID());
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('DatasetCurator', () => {
    let curator: DatasetCurator;
    
    beforeEach(() => {
      curator = new DatasetCurator({
        datasetPath: path.join(tempDir, 'datasets'),
        minWordCount: 50,
        maxWordCount: 5000,
        minQualityScore: 0.6
      });
    });
    
    afterEach(() => {
      curator.destroy();
    });

    it('should initialize successfully', async () => {
      const initPromise = new Promise((resolve) => {
        curator.once('initialized', resolve);
      });
      
      await initPromise;
      expect(true).toBe(true); // Initialization completed
    });

    it('should curate dataset from file source', async () => {
      // Create test data file
      const testData = [
        {
          text: 'This is a creative story about a brave knight who embarked on an epic quest to save the kingdom from an ancient dragon.',
          metadata: { genre: 'fantasy', author: 'test' }
        },
        {
          text: 'In a world where magic flows like rivers, young wizards learn to harness the power of the elements.',
          metadata: { genre: 'fantasy', author: 'test' }
        }
      ];
      
      const dataFile = path.join(tempDir, 'test_data.json');
      await fs.writeFile(dataFile, JSON.stringify(testData));
      
      const sources = [{
        name: 'test_source',
        type: 'file' as const,
        path: dataFile,
        format: 'json'
      }];
      
      const result = await curator.curateDataset(sources);
      
      expect(result.totalSamples).toBe(2);
      expect(result.acceptedSamples).toBeGreaterThan(0);
      expect(result.genreDistribution).toHaveProperty('fantasy');
    });
  });

  describe('FineTuningPipeline', () => {
    let pipeline: FineTuningPipeline;
    
    beforeEach(() => {
      pipeline = new FineTuningPipeline({
        batchSize: 2,
        epochs: 1,
        maxSequenceLength: 512
      });
    });
    
    afterEach(async () => {
      await pipeline.destroy();
    });

    it('should initialize successfully', async () => {
      const initPromise = new Promise((resolve) => {
        pipeline.once('initialized', resolve);
      });
      
      await initPromise;
      expect(true).toBe(true);
    });
  });

  describe('EvaluationFramework', () => {
    let framework: EvaluationFramework;
    
    beforeEach(() => {
      framework = new EvaluationFramework({
        outputDir: path.join(tempDir, 'evaluations'),
        includeHumanEval: false,
        maxSamples: 100
      });
    });
    
    afterEach(() => {
      framework.destroy();
    });

    it('should initialize successfully', async () => {
      const initPromise = new Promise((resolve) => {
        framework.once('initialized', resolve);
      });
      
      await initPromise;
      expect(true).toBe(true);
    });
  });
});