import { PerformanceOptimizer } from '../PerformanceOptimizer';
import { CacheManager } from '../CacheManager';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { BackgroundProcessor } from '../BackgroundProcessor';
import { MemoryManager } from '../MemoryManager';

// Mock the subsystems
jest.mock('../CacheManager');
jest.mock('../PerformanceMonitor');
jest.mock('../BackgroundProcessor');
jest.mock('../MemoryManager');

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;
  let mockBackgroundProcessor: jest.Mocked<BackgroundProcessor>;
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create optimizer instance
    optimizer = new PerformanceOptimizer();
    
    // Get mock instances
    mockCacheManager = optimizer['cacheManager'] as jest.Mocked<CacheManager>;
    mockPerformanceMonitor = optimizer['performanceMonitor'] as jest.Mocked<PerformanceMonitor>;
    mockBackgroundProcessor = optimizer['backgroundProcessor'] as jest.Mocked<BackgroundProcessor>;
    mockMemoryManager = optimizer['memoryManager'] as jest.Mocked<MemoryManager>;
  });

  afterEach(async () => {
    await optimizer.destroy();
  });

  describe('Initialization', () => {
    test('should initialize all subsystems', () => {
      expect(CacheManager).toHaveBeenCalled();
      expect(PerformanceMonitor).toHaveBeenCalled();
      expect(BackgroundProcessor).toHaveBeenCalled();
      expect(MemoryManager).toHaveBeenCalled();
    });

    test('should start optimization systems', () => {
      expect(mockPerformanceMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockMemoryManager.startMonitoring).toHaveBeenCalled();
    });

    test('should emit optimizationStarted event', (done) => {
      const newOptimizer = new PerformanceOptimizer();
      
      newOptimizer.on('optimizationStarted', () => {
        done();
      });
      
      newOptimizer.startOptimization();
    });
  });

  describe('Performance Optimization', () => {
    test('should perform comprehensive optimization', async () => {
      // Mock subsystem optimization methods
      mockCacheManager.optimize.mockResolvedValue({
        duration: 100,
        entriesRemoved: 5,
        memoryFreed: 1024,
        expiredEntriesRemoved: 2
      });

      mockMemoryManager.optimizeMemory.mockResolvedValue({
        duration: 200,
        memoryFreed: 2048,
        optimizationsPerformed: 3,
        beforeMemory: { heapUsed: 100000, heapTotal: 200000, external: 0, rss: 150000 },
        afterMemory: { heapUsed: 98000, heapTotal: 200000, external: 0, rss: 148000 },
        gcPerformed: true
      });

      mockBackgroundProcessor.getQueueStats.mockReturnValue({
        queuedTasks: 2,
        runningTasks: 1,
        completedTasks: 10,
        failedTasks: 0,
        activeWorkers: 2,
        maxWorkers: 4,
        averageWaitTime: 100,
        averageProcessingTime: 500
      });

      const result = await optimizer.performOptimization();

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(4);
      expect(result.summary).toBeDefined();
      expect(mockCacheManager.optimize).toHaveBeenCalled();
      expect(mockMemoryManager.optimizeMemory).toHaveBeenCalled();
    });

    test('should handle optimization errors gracefully', async () => {
      mockCacheManager.optimize.mockRejectedValue(new Error('Cache optimization failed'));

      const result = await optimizer.performOptimization();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should prevent concurrent optimizations', async () => {
      // Start first optimization
      const promise1 = optimizer.performOptimization();
      
      // Try to start second optimization immediately
      const result2 = await optimizer.performOptimization();
      
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('already in progress');
      
      // Wait for first optimization to complete
      await promise1;
    });
  });

  describe('Performance Metrics', () => {
    test('should collect comprehensive performance metrics', () => {
      // Mock subsystem stats
      mockCacheManager.getStats.mockReturnValue({
        size: 100,
        memoryUsage: 1024,
        maxSize: 1000,
        maxMemoryUsage: 10240,
        hitRate: 0.85,
        averageAccessCount: 5,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now(),
        expiredEntries: 2,
        compressionRatio: 0.7,
        memoryEfficiency: 10
      });

      mockPerformanceMonitor.getSummary.mockReturnValue({
        uptime: 3600000,
        averageCPU: 45,
        averageMemory: 50 * 1024 * 1024,
        eventLoopLag: 5,
        totalOperations: 1000,
        totalRenders: 500,
        slowestOperations: [{ name: 'ai-generation', averageDuration: 2000 }],
        slowestRenders: [{ name: 'story-list', averageDuration: 50 }],
        healthScore: 85
      });

      mockMemoryManager.getMemoryStats.mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 80 * 1024 * 1024,
        heapUsagePercent: 50,
        isNearLimit: false,
        isCritical: false,
        poolStats: [],
        lastGCTime: Date.now() - 60000,
        timeSinceLastGC: 60000
      });

      mockBackgroundProcessor.getQueueStats.mockReturnValue({
        queuedTasks: 5,
        runningTasks: 2,
        completedTasks: 100,
        failedTasks: 1,
        activeWorkers: 2,
        maxWorkers: 4,
        averageWaitTime: 200,
        averageProcessingTime: 1000
      });

      const metrics = optimizer.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.cache).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.backgroundTasks).toBeDefined();
      expect(metrics.optimization).toBeDefined();
    });
  });

  describe('Optimization Suggestions', () => {
    test('should generate cache optimization suggestions for low hit rate', () => {
      mockCacheManager.getStats.mockReturnValue({
        size: 100,
        memoryUsage: 1024,
        maxSize: 1000,
        maxMemoryUsage: 10240,
        hitRate: 0.6, // Low hit rate
        averageAccessCount: 5,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now(),
        expiredEntries: 2,
        compressionRatio: 0.7,
        memoryEfficiency: 10
      });

      mockPerformanceMonitor.getSummary.mockReturnValue({
        uptime: 3600000,
        averageCPU: 45,
        averageMemory: 50 * 1024 * 1024,
        eventLoopLag: 5,
        totalOperations: 1000,
        totalRenders: 500,
        slowestOperations: [],
        slowestRenders: [],
        healthScore: 85
      });

      mockMemoryManager.getMemoryStats.mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 80 * 1024 * 1024,
        heapUsagePercent: 50,
        isNearLimit: false,
        isCritical: false,
        poolStats: [],
        lastGCTime: Date.now() - 60000,
        timeSinceLastGC: 60000
      });

      mockBackgroundProcessor.getQueueStats.mockReturnValue({
        queuedTasks: 5,
        runningTasks: 2,
        completedTasks: 100,
        failedTasks: 1,
        activeWorkers: 2,
        maxWorkers: 4,
        averageWaitTime: 200,
        averageProcessingTime: 1000
      });

      const suggestions = optimizer.getOptimizationSuggestions();

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].category).toBe('cache');
      expect(suggestions[0].priority).toBe('high');
      expect(suggestions[0].title).toContain('Low Cache Hit Rate');
    });

    test('should generate memory optimization suggestions for high usage', () => {
      mockCacheManager.getStats.mockReturnValue({
        size: 100,
        memoryUsage: 1024,
        maxSize: 1000,
        maxMemoryUsage: 10240,
        hitRate: 0.85,
        averageAccessCount: 5,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now(),
        expiredEntries: 2,
        compressionRatio: 0.7,
        memoryEfficiency: 10
      });

      mockPerformanceMonitor.getSummary.mockReturnValue({
        uptime: 3600000,
        averageCPU: 45,
        averageMemory: 50 * 1024 * 1024,
        eventLoopLag: 5,
        totalOperations: 1000,
        totalRenders: 500,
        slowestOperations: [],
        slowestRenders: [],
        healthScore: 85
      });

      mockMemoryManager.getMemoryStats.mockReturnValue({
        heapUsed: 85 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 95 * 1024 * 1024,
        heapUsagePercent: 85, // High memory usage
        isNearLimit: true,
        isCritical: false,
        poolStats: [],
        lastGCTime: Date.now() - 60000,
        timeSinceLastGC: 60000
      });

      mockBackgroundProcessor.getQueueStats.mockReturnValue({
        queuedTasks: 5,
        runningTasks: 2,
        completedTasks: 100,
        failedTasks: 1,
        activeWorkers: 2,
        maxWorkers: 4,
        averageWaitTime: 200,
        averageProcessingTime: 1000
      });

      const suggestions = optimizer.getOptimizationSuggestions();

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].category).toBe('memory');
      expect(suggestions[0].priority).toBe('critical');
      expect(suggestions[0].title).toContain('High Memory Usage');
    });
  });

  describe('Auto Optimization', () => {
    test('should apply automatic optimizations', async () => {
      // Mock low cache hit rate to trigger optimization
      mockCacheManager.getStats.mockReturnValue({
        size: 100,
        memoryUsage: 1024,
        maxSize: 1000,
        maxMemoryUsage: 10240,
        hitRate: 0.6,
        averageAccessCount: 5,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now(),
        expiredEntries: 2,
        compressionRatio: 0.7,
        memoryEfficiency: 10
      });

      mockPerformanceMonitor.getSummary.mockReturnValue({
        uptime: 3600000,
        averageCPU: 45,
        averageMemory: 50 * 1024 * 1024,
        eventLoopLag: 5,
        totalOperations: 1000,
        totalRenders: 500,
        slowestOperations: [],
        slowestRenders: [],
        healthScore: 85
      });

      mockMemoryManager.getMemoryStats.mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 80 * 1024 * 1024,
        heapUsagePercent: 50,
        isNearLimit: false,
        isCritical: false,
        poolStats: [],
        lastGCTime: Date.now() - 60000,
        timeSinceLastGC: 60000
      });

      mockBackgroundProcessor.getQueueStats.mockReturnValue({
        queuedTasks: 5,
        runningTasks: 2,
        completedTasks: 100,
        failedTasks: 1,
        activeWorkers: 2,
        maxWorkers: 4,
        averageWaitTime: 200,
        averageProcessingTime: 1000
      });

      const result = await optimizer.applyAutoOptimizations();

      expect(result.totalSuggestions).toBeGreaterThan(0);
      expect(result.appliedOptimizations).toHaveLength(result.totalSuggestions);
      expect(result.successCount).toBeGreaterThan(0);
    });
  });

  describe('Data Export', () => {
    test('should export comprehensive performance data', () => {
      // Mock all subsystem data
      mockCacheManager.getStats.mockReturnValue({
        size: 100,
        memoryUsage: 1024,
        maxSize: 1000,
        maxMemoryUsage: 10240,
        hitRate: 0.85,
        averageAccessCount: 5,
        oldestEntry: Date.now() - 3600000,
        newestEntry: Date.now(),
        expiredEntries: 2,
        compressionRatio: 0.7,
        memoryEfficiency: 10
      });

      const exportData = optimizer.exportPerformanceData();

      expect(exportData).toBeDefined();
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.metrics).toBeDefined();
      expect(exportData.suggestions).toBeDefined();
      expect(exportData.optimizationHistory).toBeDefined();
      expect(exportData.configuration).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    test('should emit cache events', (done) => {
      optimizer.on('cacheHit', (data) => {
        expect(data).toBeDefined();
        done();
      });

      // Simulate cache hit event
      mockCacheManager.emit('hit', { key: 'test-key', accessCount: 1 });
    });

    test('should emit performance events', (done) => {
      optimizer.on('slowOperation', (data) => {
        expect(data).toBeDefined();
        done();
      });

      // Simulate slow operation event
      mockPerformanceMonitor.emit('slowOperation', { 
        operation: 'test-operation', 
        duration: 5000 
      });
    });

    test('should emit memory events', (done) => {
      optimizer.on('memoryWarning', (data) => {
        expect(data).toBeDefined();
        done();
      });

      // Simulate memory warning event
      mockMemoryManager.emit('memoryWarning', { 
        level: 'warning', 
        heapUsagePercent: 85 
      });
    });
  });

  describe('Cleanup', () => {
    test('should stop optimization when destroyed', async () => {
      await optimizer.destroy();

      expect(mockPerformanceMonitor.stopMonitoring).toHaveBeenCalled();
      expect(mockMemoryManager.stopMonitoring).toHaveBeenCalled();
      expect(mockCacheManager.destroy).toHaveBeenCalled();
      expect(mockPerformanceMonitor.destroy).toHaveBeenCalled();
      expect(mockMemoryManager.destroy).toHaveBeenCalled();
      expect(mockBackgroundProcessor.destroy).toHaveBeenCalled();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet response time requirements', async () => {
      const startTime = Date.now();
      
      // Mock fast optimization
      mockCacheManager.optimize.mockResolvedValue({
        duration: 50,
        entriesRemoved: 1,
        memoryFreed: 100,
        expiredEntriesRemoved: 1
      });

      await optimizer.performOptimization();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle high load efficiently', async () => {
      const promises = [];
      
      // Simulate multiple concurrent metric requests
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(optimizer.getPerformanceMetrics()));
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should handle 100 requests within 1 second
    });
  });
});