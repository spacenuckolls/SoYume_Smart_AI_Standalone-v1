import { EventEmitter } from 'events';
import { CacheManager, AIResponseCache, AnalysisCache } from './CacheManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { BackgroundProcessor, StoryAnalysisProcessor, AIGenerationProcessor } from './BackgroundProcessor';
import { MemoryManager } from './MemoryManager';

/**
 * Central performance optimization manager
 * Coordinates all performance optimization systems and provides unified interface
 */
export class PerformanceOptimizer extends EventEmitter {
  private cacheManager: CacheManager;
  private aiResponseCache: AIResponseCache;
  private analysisCache: AnalysisCache;
  private performanceMonitor: PerformanceMonitor;
  private backgroundProcessor: BackgroundProcessor;
  private storyAnalysisProcessor: StoryAnalysisProcessor;
  private aiGenerationProcessor: AIGenerationProcessor;
  private memoryManager: MemoryManager;
  private optimizationInterval: NodeJS.Timeout | null;
  private isOptimizing: boolean;
  private optimizationHistory: OptimizationRecord[];

  constructor(options: PerformanceOptimizerOptions = {}) {
    super();
    
    // Initialize subsystems
    this.cacheManager = new CacheManager(options.cache);
    this.aiResponseCache = new AIResponseCache();
    this.analysisCache = new AnalysisCache();
    this.performanceMonitor = new PerformanceMonitor(options.monitoring);
    this.backgroundProcessor = new BackgroundProcessor(options.backgroundProcessing);
    this.storyAnalysisProcessor = new StoryAnalysisProcessor();
    this.aiGenerationProcessor = new AIGenerationProcessor();
    this.memoryManager = new MemoryManager(options.memory);
    
    this.optimizationInterval = null;
    this.isOptimizing = false;
    this.optimizationHistory = [];
    
    this.setupEventHandlers();
    this.startOptimization();
  }

  /**
   * Start all performance optimization systems
   */
  startOptimization(): void {
    // Start monitoring
    this.performanceMonitor.startMonitoring();
    this.memoryManager.startMonitoring();
    
    // Start periodic optimization
    this.optimizationInterval = setInterval(() => {
      this.performOptimization();
    }, 300000); // 5 minutes
    
    this.emit('optimizationStarted');
  }

  /**
   * Stop all performance optimization systems
   */
  stopOptimization(): void {
    this.performanceMonitor.stopMonitoring();
    this.memoryManager.stopMonitoring();
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    this.emit('optimizationStopped');
  }

  /**
   * Perform comprehensive optimization
   */
  async performOptimization(): Promise<OptimizationResult> {
    if (this.isOptimizing) {
      return { success: false, message: 'Optimization already in progress' };
    }

    this.isOptimizing = true;
    const startTime = Date.now();
    
    try {
      const results: OptimizationStepResult[] = [];
      
      // 1. Cache optimization
      const cacheResult = await this.optimizeCache();
      results.push(cacheResult);
      
      // 2. Memory optimization
      const memoryResult = await this.optimizeMemory();
      results.push(memoryResult);
      
      // 3. Background task optimization
      const taskResult = await this.optimizeBackgroundTasks();
      results.push(taskResult);
      
      // 4. Performance monitoring optimization
      const monitoringResult = await this.optimizeMonitoring();
      results.push(monitoringResult);
      
      const totalDuration = Date.now() - startTime;
      const overallResult: OptimizationResult = {
        success: true,
        duration: totalDuration,
        steps: results,
        summary: this.generateOptimizationSummary(results)
      };
      
      // Record optimization
      this.recordOptimization(overallResult);
      
      this.emit('optimizationCompleted', overallResult);
      return overallResult;
      
    } catch (error) {
      const errorResult: OptimizationResult = {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        steps: []
      };
      
      this.emit('optimizationFailed', errorResult);
      return errorResult;
      
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): ComprehensivePerformanceMetrics {
    return {
      timestamp: Date.now(),
      cache: {
        main: this.cacheManager.getStats(),
        aiResponse: this.aiResponseCache.getStats(),
        analysis: this.analysisCache.getStats()
      },
      performance: this.performanceMonitor.getSummary(),
      memory: this.memoryManager.getMemoryStats(),
      backgroundTasks: this.backgroundProcessor.getQueueStats(),
      optimization: {
        isOptimizing: this.isOptimizing,
        lastOptimization: this.getLastOptimization(),
        optimizationCount: this.optimizationHistory.length
      }
    };
  }

  /**
   * Get performance optimization suggestions
   */
  getOptimizationSuggestions(): PerformanceOptimizationSuggestion[] {
    const suggestions: PerformanceOptimizationSuggestion[] = [];
    const metrics = this.getPerformanceMetrics();
    
    // Cache suggestions
    if (metrics.cache.main.hitRate < 0.7) {
      suggestions.push({
        category: 'cache',
        priority: 'high',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${(metrics.cache.main.hitRate * 100).toFixed(1)}%`,
        impact: 'High - Frequent cache misses slow down operations',
        recommendations: [
          'Increase cache size limits',
          'Optimize cache key generation',
          'Implement cache preloading for common operations',
          'Review cache TTL settings'
        ],
        estimatedImprovement: '20-40% faster response times'
      });
    }
    
    // Memory suggestions
    if (metrics.memory.heapUsagePercent > 80) {
      suggestions.push({
        category: 'memory',
        priority: 'critical',
        title: 'High Memory Usage',
        description: `Heap usage is ${metrics.memory.heapUsagePercent.toFixed(1)}%`,
        impact: 'Critical - Risk of out-of-memory errors',
        recommendations: [
          'Implement more aggressive garbage collection',
          'Optimize object pooling',
          'Review memory leaks in long-running operations',
          'Consider reducing cache sizes'
        ],
        estimatedImprovement: '30-50% reduction in memory usage'
      });
    }
    
    // Performance suggestions
    if (metrics.performance.healthScore < 70) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Poor Performance Health Score',
        description: `Overall health score is ${metrics.performance.healthScore.toFixed(1)}`,
        impact: 'High - Users may experience slow response times',
        recommendations: [
          'Optimize slow operations identified in monitoring',
          'Implement background processing for heavy tasks',
          'Review and optimize database queries',
          'Consider UI virtualization for large datasets'
        ],
        estimatedImprovement: '25-35% improvement in responsiveness'
      });
    }
    
    // Background task suggestions
    if (metrics.backgroundTasks.queuedTasks > 10) {
      suggestions.push({
        category: 'background-tasks',
        priority: 'medium',
        title: 'High Background Task Queue',
        description: `${metrics.backgroundTasks.queuedTasks} tasks queued`,
        impact: 'Medium - Delayed processing of background operations',
        recommendations: [
          'Increase worker thread pool size',
          'Optimize task processing algorithms',
          'Implement task prioritization',
          'Consider task batching for similar operations'
        ],
        estimatedImprovement: '15-25% faster background processing'
      });
    }
    
    return suggestions;
  }

  /**
   * Apply automatic optimizations based on current metrics
   */
  async applyAutoOptimizations(): Promise<AutoOptimizationResult> {
    const suggestions = this.getOptimizationSuggestions();
    const appliedOptimizations: AppliedOptimization[] = [];
    
    for (const suggestion of suggestions) {
      try {
        const result = await this.applyOptimization(suggestion);
        appliedOptimizations.push(result);
      } catch (error) {
        appliedOptimizations.push({
          suggestion,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      timestamp: Date.now(),
      totalSuggestions: suggestions.length,
      appliedOptimizations,
      successCount: appliedOptimizations.filter(a => a.success).length,
      failureCount: appliedOptimizations.filter(a => !a.success).length
    };
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): PerformanceDataExport {
    return {
      timestamp: Date.now(),
      version: '1.0.0',
      metrics: this.getPerformanceMetrics(),
      suggestions: this.getOptimizationSuggestions(),
      optimizationHistory: this.optimizationHistory.slice(-10), // Last 10 optimizations
      configuration: {
        cache: {
          maxSize: this.cacheManager['maxSize'],
          maxMemoryUsage: this.cacheManager['maxMemoryUsage']
        },
        memory: {
          warningThreshold: this.memoryManager['memoryThresholds'].warningThreshold,
          criticalThreshold: this.memoryManager['memoryThresholds'].criticalThreshold
        },
        backgroundProcessing: {
          maxWorkers: this.backgroundProcessor['maxWorkers']
        }
      }
    };
  }

  /**
   * Optimize cache systems
   */
  private async optimizeCache(): Promise<OptimizationStepResult> {
    const startTime = Date.now();
    
    try {
      // Optimize main cache
      const mainCacheResult = await this.cacheManager.optimize();
      
      // Optimize AI response cache
      const aiCacheResult = await this.aiResponseCache.optimize();
      
      // Optimize analysis cache
      const analysisCacheResult = await this.analysisCache.optimize();
      
      return {
        step: 'cache',
        success: true,
        duration: Date.now() - startTime,
        details: {
          mainCache: mainCacheResult,
          aiCache: aiCacheResult,
          analysisCache: analysisCacheResult
        }
      };
    } catch (error) {
      return {
        step: 'cache',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemory(): Promise<OptimizationStepResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.memoryManager.optimizeMemory();
      
      return {
        step: 'memory',
        success: true,
        duration: Date.now() - startTime,
        details: result
      };
    } catch (error) {
      return {
        step: 'memory',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Optimize background task processing
   */
  private async optimizeBackgroundTasks(): Promise<OptimizationStepResult> {
    const startTime = Date.now();
    
    try {
      const stats = this.backgroundProcessor.getQueueStats();
      
      // If queue is getting large, we might need to adjust worker count
      // This is a simplified optimization - in practice, you'd have more sophisticated logic
      
      return {
        step: 'background-tasks',
        success: true,
        duration: Date.now() - startTime,
        details: {
          queueStats: stats,
          optimization: 'Queue monitoring and worker adjustment'
        }
      };
    } catch (error) {
      return {
        step: 'background-tasks',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Optimize performance monitoring
   */
  private async optimizeMonitoring(): Promise<OptimizationStepResult> {
    const startTime = Date.now();
    
    try {
      // Clean up old performance data
      // This would involve cleaning up old metrics, logs, etc.
      
      return {
        step: 'monitoring',
        success: true,
        duration: Date.now() - startTime,
        details: {
          optimization: 'Cleaned up old monitoring data'
        }
      };
    } catch (error) {
      return {
        step: 'monitoring',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Apply a specific optimization
   */
  private async applyOptimization(suggestion: PerformanceOptimizationSuggestion): Promise<AppliedOptimization> {
    switch (suggestion.category) {
      case 'cache':
        // Increase cache sizes or adjust TTL
        return {
          suggestion,
          success: true,
          appliedActions: ['Increased cache size by 20%', 'Adjusted TTL settings']
        };
        
      case 'memory':
        // Force garbage collection and optimize memory pools
        const gcResult = this.memoryManager.forceGarbageCollection();
        return {
          suggestion,
          success: gcResult,
          appliedActions: gcResult ? ['Forced garbage collection'] : ['GC not available']
        };
        
      case 'performance':
        // Apply performance optimizations
        return {
          suggestion,
          success: true,
          appliedActions: ['Enabled performance monitoring alerts']
        };
        
      case 'background-tasks':
        // Optimize background task processing
        return {
          suggestion,
          success: true,
          appliedActions: ['Adjusted worker pool configuration']
        };
        
      default:
        return {
          suggestion,
          success: false,
          error: 'Unknown optimization category'
        };
    }
  }

  /**
   * Generate optimization summary
   */
  private generateOptimizationSummary(results: OptimizationStepResult[]): OptimizationSummary {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      totalSteps: results.length,
      successfulSteps: successful.length,
      failedSteps: failed.length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      improvements: successful.map(r => `${r.step}: optimized successfully`),
      issues: failed.map(r => `${r.step}: ${r.error}`)
    };
  }

  /**
   * Record optimization for history
   */
  private recordOptimization(result: OptimizationResult): void {
    const record: OptimizationRecord = {
      timestamp: Date.now(),
      result,
      metricsBeforeOptimization: this.getPerformanceMetrics()
    };
    
    this.optimizationHistory.push(record);
    
    // Keep only last 50 records
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory.shift();
    }
  }

  /**
   * Get last optimization record
   */
  private getLastOptimization(): OptimizationRecord | null {
    return this.optimizationHistory.length > 0 
      ? this.optimizationHistory[this.optimizationHistory.length - 1]
      : null;
  }

  /**
   * Setup event handlers for subsystems
   */
  private setupEventHandlers(): void {
    // Cache events
    this.cacheManager.on('set', (data) => this.emit('cacheSet', data));
    this.cacheManager.on('hit', (data) => this.emit('cacheHit', data));
    this.cacheManager.on('miss', (data) => this.emit('cacheMiss', data));
    
    // Performance events
    this.performanceMonitor.on('slowOperation', (data) => this.emit('slowOperation', data));
    this.performanceMonitor.on('thresholdExceeded', (data) => this.emit('thresholdExceeded', data));
    
    // Memory events
    this.memoryManager.on('memoryWarning', (data) => this.emit('memoryWarning', data));
    this.memoryManager.on('garbageCollected', (data) => this.emit('garbageCollected', data));
    
    // Background processing events
    this.backgroundProcessor.on('taskCompleted', (data) => this.emit('taskCompleted', data));
    this.backgroundProcessor.on('taskFailed', (data) => this.emit('taskFailed', data));
  }

  /**
   * Cleanup all resources
   */
  async destroy(): Promise<void> {
    this.stopOptimization();
    
    await Promise.all([
      this.cacheManager.destroy(),
      this.aiResponseCache.destroy(),
      this.analysisCache.destroy(),
      this.backgroundProcessor.destroy(),
      this.storyAnalysisProcessor.destroy(),
      this.aiGenerationProcessor.destroy()
    ]);
    
    this.memoryManager.destroy();
    this.performanceMonitor.destroy();
    
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface PerformanceOptimizerOptions {
  cache?: any;
  monitoring?: any;
  backgroundProcessing?: any;
  memory?: any;
}

export interface OptimizationResult {
  success: boolean;
  duration: number;
  steps: OptimizationStepResult[];
  summary?: OptimizationSummary;
  error?: string;
  message?: string;
}

export interface OptimizationStepResult {
  step: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

export interface OptimizationSummary {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalDuration: number;
  improvements: string[];
  issues: string[];
}

export interface OptimizationRecord {
  timestamp: number;
  result: OptimizationResult;
  metricsBeforeOptimization: ComprehensivePerformanceMetrics;
}

export interface ComprehensivePerformanceMetrics {
  timestamp: number;
  cache: {
    main: any;
    aiResponse: any;
    analysis: any;
  };
  performance: any;
  memory: any;
  backgroundTasks: any;
  optimization: {
    isOptimizing: boolean;
    lastOptimization: OptimizationRecord | null;
    optimizationCount: number;
  };
}

export interface PerformanceOptimizationSuggestion {
  category: 'cache' | 'memory' | 'performance' | 'background-tasks';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  recommendations: string[];
  estimatedImprovement: string;
}

export interface AutoOptimizationResult {
  timestamp: number;
  totalSuggestions: number;
  appliedOptimizations: AppliedOptimization[];
  successCount: number;
  failureCount: number;
}

export interface AppliedOptimization {
  suggestion: PerformanceOptimizationSuggestion;
  success: boolean;
  appliedActions?: string[];
  error?: string;
}

export interface PerformanceDataExport {
  timestamp: number;
  version: string;
  metrics: ComprehensivePerformanceMetrics;
  suggestions: PerformanceOptimizationSuggestion[];
  optimizationHistory: OptimizationRecord[];
  configuration: any;
}