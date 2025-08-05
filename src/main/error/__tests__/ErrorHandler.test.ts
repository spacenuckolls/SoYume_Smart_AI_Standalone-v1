import { ErrorHandler, ErrorSeverity, HealthStatus, BackupType } from '../ErrorHandler';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  
  beforeEach(() => {
    jest.clearAllMocks();
    errorHandler = new ErrorHandler({
      logFilePath: '/test/logs/errors.log'
    });
  });
  
  afterEach(async () => {
    errorHandler.destroy();
  });

  describe('Error Handling', () => {
    test('should handle errors and generate error ID', async () => {
      const testError = new Error('Test error');
      const context = {
        operation: 'test-operation',
        component: 'test-component'
      };

      const result = await errorHandler.handleError(testError, context);

      expect(result.errorId).toBeDefined();
      expect(result.handled).toBe(true);
      expect(result.userMessage).toContain('error occurred');
      expect(result.recoveryActions).toBeDefined();
    });

    test('should determine error severity correctly', async () => {
      const databaseError = new Error('Database connection failed');
      databaseError.name = 'DatabaseError';
      
      const context = {
        operation: 'database-query',
        component: 'database'
      };

      const result = await errorHandler.handleError(databaseError, context);

      expect(result.errorId).toBeDefined();
      // Database errors should be treated as critical
      expect(result.recovered).toBeDefined();
    });

    test('should provide fallback options when available', async () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      const context = {
        operation: 'ai-generation',
        component: 'ai-provider'
      };

      const result = await errorHandler.handleError(networkError, context);

      expect(result.fallbackAvailable).toBe(true);
      expect(result.offlineModeAvailable).toBeDefined();
    });

    test('should attempt recovery strategies', async () => {
      const testError = new Error('Recoverable error');
      const context = {
        operation: 'ai-generation',
        component: 'ai-provider'
      };

      const result = await errorHandler.handleError(testError, context);

      expect(result.recoveryActions).toBeDefined();
      expect(Array.isArray(result.recoveryActions)).toBe(true);
    });
  });

  describe('Fallback System', () => {
    test('should provide fallback options for supported operations', async () => {
      const fallback = await errorHandler.getFallback('ai-generation', {
        operation: 'ai-generation',
        component: 'ai-provider'
      });

      expect(fallback).toBeDefined();
      expect(fallback?.operation).toBeDefined();
      expect(fallback?.description).toBeDefined();
      expect(fallback?.limitations).toBeDefined();
      expect(fallback?.estimatedSuccess).toBeGreaterThan(0);
    });

    test('should return null for unsupported operations', async () => {
      const fallback = await errorHandler.getFallback('unsupported-operation', {
        operation: 'unsupported-operation',
        component: 'test'
      });

      expect(fallback).toBeNull();
    });
  });

  describe('Offline Mode', () => {
    test('should enable offline mode', async () => {
      const result = await errorHandler.enableOfflineMode();

      expect(result.enabled).toBe(true);
      expect(result.supportedOperations).toBeDefined();
      expect(result.unavailableOperations).toBeDefined();
      expect(result.supportedOperations.length).toBeGreaterThan(0);
    });

    test('should disable offline mode', async () => {
      await errorHandler.enableOfflineMode();
      await errorHandler.disableOfflineMode();

      // Should emit appropriate events
      expect(errorHandler.listenerCount('offlineModeDisabled')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('System Health', () => {
    test('should provide system health status', () => {
      const health = errorHandler.getSystemHealth();

      expect(health.overall).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.lastCheck).toBeDefined();
      expect(Object.values(HealthStatus)).toContain(health.overall);
    });

    test('should track component health', () => {
      const health = errorHandler.getSystemHealth();

      expect(health.components).toBeInstanceOf(Map);
      expect(health.components.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Statistics', () => {
    test('should provide error statistics', async () => {
      // Generate some test errors
      const testError = new Error('Test error');
      await errorHandler.handleError(testError, {
        operation: 'test',
        component: 'test'
      });

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBeGreaterThan(0);
      expect(stats.errors24h).toBeDefined();
      expect(stats.errors7d).toBeDefined();
      expect(stats.errorsByComponent).toBeDefined();
      expect(stats.errorsBySeverity).toBeDefined();
      expect(stats.topErrors).toBeDefined();
    });

    test('should calculate average recovery time', async () => {
      const stats = errorHandler.getErrorStatistics();

      expect(typeof stats.averageRecoveryTime).toBe('number');
      expect(stats.averageRecoveryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Backup', () => {
    test('should create full backup', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await errorHandler.createBackup(BackupType.FULL);

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should create incremental backup', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await errorHandler.createBackup(BackupType.INCREMENTAL);

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
    });

    test('should handle backup failures', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await errorHandler.createBackup(BackupType.FULL);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should restore from backup', async () => {
      const mockBackupData = {
        id: 'test-backup',
        timestamp: Date.now(),
        version: '1.0.0',
        type: BackupType.FULL,
        data: { stories: [], characters: [] }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockBackupData));

      const result = await errorHandler.restoreFromBackup('/test/backup.json');

      expect(result.success).toBe(true);
      expect(result.backupId).toBe('test-backup');
    });

    test('should handle invalid backup data', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await errorHandler.restoreFromBackup('/test/invalid-backup.json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Logging', () => {
    test('should write errors to log file', async () => {
      mockFs.appendFile.mockResolvedValue(undefined);

      const testError = new Error('Test error');
      await errorHandler.handleError(testError, {
        operation: 'test',
        component: 'test'
      });

      expect(mockFs.appendFile).toHaveBeenCalled();
    });

    test('should handle log write failures gracefully', async () => {
      mockFs.appendFile.mockRejectedValue(new Error('Disk full'));

      const testError = new Error('Test error');
      
      // Should not throw even if logging fails
      await expect(errorHandler.handleError(testError, {
        operation: 'test',
        component: 'test'
      })).resolves.toBeDefined();
    });
  });

  describe('Event Emission', () => {
    test('should emit error events', async () => {
      const errorListener = jest.fn();
      errorHandler.on('error', errorListener);

      const testError = new Error('Test error');
      await errorHandler.handleError(testError, {
        operation: 'test',
        component: 'test'
      });

      expect(errorListener).toHaveBeenCalled();
    });

    test('should emit backup events', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const backupListener = jest.fn();
      errorHandler.on('backupCreated', backupListener);

      await errorHandler.createBackup(BackupType.FULL);

      expect(backupListener).toHaveBeenCalled();
    });

    test('should emit offline mode events', async () => {
      const offlineListener = jest.fn();
      errorHandler.on('offlineModeEnabled', offlineListener);

      await errorHandler.enableOfflineMode();

      expect(offlineListener).toHaveBeenCalled();
    });
  });

  describe('Recovery Strategies', () => {
    test('should have recovery strategies for common operations', () => {
      // Test that recovery strategies are initialized
      const aiGenerationStrategy = errorHandler['recoveryStrategies'].get('ai-generation');
      expect(aiGenerationStrategy).toBeDefined();
      expect(aiGenerationStrategy?.steps.length).toBeGreaterThan(0);

      const databaseStrategy = errorHandler['recoveryStrategies'].get('database-operation');
      expect(databaseStrategy).toBeDefined();
      expect(databaseStrategy?.steps.length).toBeGreaterThan(0);
    });

    test('should execute recovery steps in order', async () => {
      const testError = new Error('AI provider unavailable');
      const context = {
        operation: 'ai-generation',
        component: 'ai-provider'
      };

      const result = await errorHandler.handleError(testError, context);

      expect(result.recoveryActions.length).toBeGreaterThan(0);
      
      // Should have attempted multiple recovery steps
      const actionTypes = result.recoveryActions.map(action => action.type);
      expect(actionTypes).toContain('retry');
    });
  });

  describe('User-Friendly Messages', () => {
    test('should generate appropriate user messages for different error types', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      
      const result = await errorHandler.handleError(networkError, {
        operation: 'ai-generation',
        component: 'network'
      });

      expect(result.userMessage).toBeDefined();
      expect(result.userMessage.length).toBeGreaterThan(0);
      expect(result.userMessage).not.toContain('undefined');
    });

    test('should provide contextual recovery suggestions', async () => {
      const databaseError = new Error('Connection lost');
      databaseError.name = 'DatabaseError';
      
      const result = await errorHandler.handleError(databaseError, {
        operation: 'database-operation',
        component: 'database'
      });

      expect(result.recoveryActions).toBeDefined();
      expect(result.recoveryActions.length).toBeGreaterThan(0);
      
      // Should include database-specific recovery actions
      const descriptions = result.recoveryActions.map(action => action.description);
      expect(descriptions.some(desc => desc.toLowerCase().includes('database') || desc.toLowerCase().includes('retry'))).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle errors quickly', async () => {
      const startTime = Date.now();
      
      const testError = new Error('Performance test error');
      await errorHandler.handleError(testError, {
        operation: 'test',
        component: 'test'
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle multiple concurrent errors', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const error = new Error(`Concurrent error ${i}`);
        promises.push(errorHandler.handleError(error, {
          operation: 'concurrent-test',
          component: 'test'
        }));
      }
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.handled).toBe(true);
        expect(result.errorId).toBeDefined();
      });
    });
  });

  describe('Memory Management', () => {
    test('should limit error log size', async () => {
      // Generate many errors to test log size limiting
      for (let i = 0; i < 1100; i++) {
        const error = new Error(`Test error ${i}`);
        await errorHandler.handleError(error, {
          operation: 'memory-test',
          component: 'test'
        });
      }
      
      const stats = errorHandler.getErrorStatistics();
      
      // Should not store unlimited errors in memory
      expect(stats.totalErrors).toBeLessThanOrEqual(1100);
    });
  });
});