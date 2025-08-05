import { EventEmitter } from 'events';
import * as os from 'os';

/**
 * Performance monitoring and optimization system
 * Tracks application performance metrics and provides optimization suggestions
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private monitoringInterval: NodeJS.Timeout | null;
  private thresholds: PerformanceThresholds;
  private isMonitoring: boolean;
  private startTime: number;

  constructor(options: PerformanceMonitorOptions = {}) {
    super();
    
    this.metrics = this.initializeMetrics();
    this.monitoringInterval = null;
    this.thresholds = {
      cpuUsage: options.cpuThreshold || 80,
      memoryUsage: options.memoryThreshold || 85,
      responseTime: options.responseTimeThreshold || 3000,
      renderTime: options.renderTimeThreshold || 100,
      ...options.thresholds
    };
    this.isMonitoring = false;
    this.startTime = Date.now();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    this.emit('monitoringStarted', { interval });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<void> {
    const now = Date.now();
    
    // System metrics
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    
    // Application metrics
    const uptime = now - this.startTime;
    const eventLoopLag = await this.getEventLoopLag();
    
    // Update metrics
    this.metrics.system.cpu.current = cpuUsage;
    this.metrics.system.cpu.history.push({ timestamp: now, value: cpuUsage });
    
    this.metrics.system.memory.current = memoryUsage;
    this.metrics.system.memory.history.push({ timestamp: now, value: memoryUsage.used });
    
    this.metrics.system.disk = diskUsage;
    this.metrics.application.uptime = uptime;
    this.metrics.application.eventLoopLag = eventLoopLag;
    
    // Trim history to last 100 entries
    this.trimHistory();
    
    // Check thresholds and emit warnings
    this.checkThresholds();
    
    this.emit('metricsUpdated', this.metrics);
  }

  /**
   * Record operation timing
   */
  recordOperation(operation: string, duration: number, metadata?: any): void {
    const record: OperationRecord = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    };

    if (!this.metrics.operations[operation]) {
      this.metrics.operations[operation] = {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        recentDurations: []
      };
    }

    const opMetrics = this.metrics.operations[operation];
    opMetrics.count++;
    opMetrics.totalDuration += duration;
    opMetrics.averageDuration = opMetrics.totalDuration / opMetrics.count;
    opMetrics.minDuration = Math.min(opMetrics.minDuration, duration);
    opMetrics.maxDuration = Math.max(opMetrics.maxDuration, duration);
    opMetrics.recentDurations.push(record);

    // Keep only last 50 records
    if (opMetrics.recentDurations.length > 50) {
      opMetrics.recentDurations.shift();
    }

    // Check if operation is slow
    if (duration > this.thresholds.responseTime) {
      this.emit('slowOperation', { operation, duration, metadata });
    }

    this.emit('operationRecorded', record);
  }

  /**
   * Record render timing
   */
  recordRender(component: string, duration: number, metadata?: any): void {
    const record: RenderRecord = {
      component,
      duration,
      timestamp: Date.now(),
      metadata
    };

    if (!this.metrics.rendering[component]) {
      this.metrics.rendering[component] = {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        recentRenders: []
      };
    }

    const renderMetrics = this.metrics.rendering[component];
    renderMetrics.count++;
    renderMetrics.totalDuration += duration;
    renderMetrics.averageDuration = renderMetrics.totalDuration / renderMetrics.count;
    renderMetrics.minDuration = Math.min(renderMetrics.minDuration, duration);
    renderMetrics.maxDuration = Math.max(renderMetrics.maxDuration, duration);
    renderMetrics.recentRenders.push(record);

    // Keep only last 30 records
    if (renderMetrics.recentRenders.length > 30) {
      renderMetrics.recentRenders.shift();
    }

    // Check if render is slow
    if (duration > this.thresholds.renderTime) {
      this.emit('slowRender', { component, duration, metadata });
    }

    this.emit('renderRecorded', record);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get performance summary
   */
  getSummary(): PerformanceSummary {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    
    // Calculate recent averages
    const recentCPU = this.metrics.system.cpu.history
      .filter(h => now - h.timestamp < recentWindow)
      .reduce((sum, h) => sum + h.value, 0) / 
      Math.max(1, this.metrics.system.cpu.history.filter(h => now - h.timestamp < recentWindow).length);

    const recentMemory = this.metrics.system.memory.history
      .filter(h => now - h.timestamp < recentWindow)
      .reduce((sum, h) => sum + h.value, 0) / 
      Math.max(1, this.metrics.system.memory.history.filter(h => now - h.timestamp < recentWindow).length);

    // Get slowest operations
    const slowestOperations = Object.entries(this.metrics.operations)
      .map(([name, metrics]) => ({ name, averageDuration: metrics.averageDuration }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    // Get slowest renders
    const slowestRenders = Object.entries(this.metrics.rendering)
      .map(([name, metrics]) => ({ name, averageDuration: metrics.averageDuration }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return {
      uptime: this.metrics.application.uptime,
      averageCPU: recentCPU,
      averageMemory: recentMemory,
      eventLoopLag: this.metrics.application.eventLoopLag,
      totalOperations: Object.values(this.metrics.operations).reduce((sum, op) => sum + op.count, 0),
      totalRenders: Object.values(this.metrics.rendering).reduce((sum, render) => sum + render.count, 0),
      slowestOperations,
      slowestRenders,
      healthScore: this.calculateHealthScore()
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const summary = this.getSummary();

    // CPU usage suggestions
    if (summary.averageCPU > this.thresholds.cpuUsage) {
      suggestions.push({
        type: 'cpu',
        severity: 'high',
        title: 'High CPU Usage Detected',
        description: `Average CPU usage is ${summary.averageCPU.toFixed(1)}%, which exceeds the threshold of ${this.thresholds.cpuUsage}%`,
        recommendations: [
          'Consider implementing background processing for heavy operations',
          'Use Web Workers for CPU-intensive tasks',
          'Optimize algorithms in frequently called functions',
          'Implement request debouncing and throttling'
        ]
      });
    }

    // Memory usage suggestions
    if (summary.averageMemory > this.thresholds.memoryUsage * 1024 * 1024) {
      suggestions.push({
        type: 'memory',
        severity: 'high',
        title: 'High Memory Usage Detected',
        description: `Memory usage is ${(summary.averageMemory / 1024 / 1024).toFixed(1)}MB, which may cause performance issues`,
        recommendations: [
          'Implement proper cleanup of event listeners and timers',
          'Use object pooling for frequently created objects',
          'Optimize data structures and reduce memory leaks',
          'Consider lazy loading for large datasets'
        ]
      });
    }

    // Event loop lag suggestions
    if (summary.eventLoopLag > 100) {
      suggestions.push({
        type: 'eventloop',
        severity: 'medium',
        title: 'Event Loop Lag Detected',
        description: `Event loop lag is ${summary.eventLoopLag.toFixed(1)}ms, which may cause UI freezing`,
        recommendations: [
          'Break up long-running synchronous operations',
          'Use setTimeout or setImmediate to yield control',
          'Implement progressive processing for large datasets',
          'Consider using Web Workers for heavy computations'
        ]
      });
    }

    // Slow operations suggestions
    summary.slowestOperations.forEach(op => {
      if (op.averageDuration > this.thresholds.responseTime) {
        suggestions.push({
          type: 'operation',
          severity: 'medium',
          title: `Slow Operation: ${op.name}`,
          description: `Operation "${op.name}" takes an average of ${op.averageDuration.toFixed(1)}ms`,
          recommendations: [
            'Implement caching for this operation',
            'Optimize database queries or API calls',
            'Consider background processing',
            'Add progress indicators for long operations'
          ]
        });
      }
    });

    // Slow renders suggestions
    summary.slowestRenders.forEach(render => {
      if (render.averageDuration > this.thresholds.renderTime) {
        suggestions.push({
          type: 'render',
          severity: 'medium',
          title: `Slow Render: ${render.name}`,
          description: `Component "${render.name}" takes an average of ${render.averageDuration.toFixed(1)}ms to render`,
          recommendations: [
            'Implement React.memo or useMemo for expensive calculations',
            'Use virtualization for large lists',
            'Optimize component re-renders',
            'Consider code splitting and lazy loading'
          ]
        });
      }
    });

    return suggestions;
  }

  /**
   * Export performance data
   */
  exportData(): PerformanceExport {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      summary: this.getSummary(),
      suggestions: this.getOptimizationSuggestions(),
      thresholds: this.thresholds
    };
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      system: {
        cpu: {
          current: 0,
          history: []
        },
        memory: {
          current: { used: 0, total: 0, free: 0 },
          history: []
        },
        disk: {
          used: 0,
          total: 0,
          free: 0
        }
      },
      application: {
        uptime: 0,
        eventLoopLag: 0
      },
      operations: {},
      rendering: {}
    };
  }

  /**
   * Get CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalUsage = (endUsage.user + endUsage.system) / 1000; // Convert to ms
        const totalTime = endTime - startTime;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): MemoryUsage {
    const processMemory = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };
    
    return {
      used: processMemory.heapUsed,
      total: systemMemory.total,
      free: systemMemory.free
    };
  }

  /**
   * Get disk usage information
   */
  private async getDiskUsage(): Promise<DiskUsage> {
    // Simplified disk usage - in production, use proper disk usage library
    return {
      used: 50 * 1024 * 1024 * 1024, // 50GB
      total: 500 * 1024 * 1024 * 1024, // 500GB
      free: 450 * 1024 * 1024 * 1024 // 450GB
    };
  }

  /**
   * Get event loop lag
   */
  private async getEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Trim history arrays to prevent memory growth
   */
  private trimHistory(): void {
    const maxHistoryLength = 100;
    
    if (this.metrics.system.cpu.history.length > maxHistoryLength) {
      this.metrics.system.cpu.history = this.metrics.system.cpu.history.slice(-maxHistoryLength);
    }
    
    if (this.metrics.system.memory.history.length > maxHistoryLength) {
      this.metrics.system.memory.history = this.metrics.system.memory.history.slice(-maxHistoryLength);
    }
  }

  /**
   * Check performance thresholds and emit warnings
   */
  private checkThresholds(): void {
    const { cpu, memory } = this.metrics.system;
    
    if (cpu.current > this.thresholds.cpuUsage) {
      this.emit('thresholdExceeded', {
        type: 'cpu',
        current: cpu.current,
        threshold: this.thresholds.cpuUsage
      });
    }
    
    if (memory.current.used > this.thresholds.memoryUsage * 1024 * 1024) {
      this.emit('thresholdExceeded', {
        type: 'memory',
        current: memory.current.used,
        threshold: this.thresholds.memoryUsage * 1024 * 1024
      });
    }
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(): number {
    let score = 100;
    
    // CPU penalty
    if (this.metrics.system.cpu.current > this.thresholds.cpuUsage) {
      score -= (this.metrics.system.cpu.current - this.thresholds.cpuUsage) * 0.5;
    }
    
    // Memory penalty
    const memoryUsagePercent = (this.metrics.system.memory.current.used / this.metrics.system.memory.current.total) * 100;
    if (memoryUsagePercent > this.thresholds.memoryUsage) {
      score -= (memoryUsagePercent - this.thresholds.memoryUsage) * 0.3;
    }
    
    // Event loop lag penalty
    if (this.metrics.application.eventLoopLag > 50) {
      score -= this.metrics.application.eventLoopLag * 0.1;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface PerformanceMonitorOptions {
  cpuThreshold?: number;
  memoryThreshold?: number;
  responseTimeThreshold?: number;
  renderTimeThreshold?: number;
  thresholds?: Partial<PerformanceThresholds>;
}

export interface PerformanceThresholds {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  renderTime: number;
}

export interface PerformanceMetrics {
  system: {
    cpu: {
      current: number;
      history: HistoryPoint[];
    };
    memory: {
      current: MemoryUsage;
      history: HistoryPoint[];
    };
    disk: DiskUsage;
  };
  application: {
    uptime: number;
    eventLoopLag: number;
  };
  operations: Record<string, OperationMetrics>;
  rendering: Record<string, RenderMetrics>;
}

export interface HistoryPoint {
  timestamp: number;
  value: number;
}

export interface MemoryUsage {
  used: number;
  total: number;
  free: number;
}

export interface DiskUsage {
  used: number;
  total: number;
  free: number;
}

export interface OperationMetrics {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  recentDurations: OperationRecord[];
}

export interface RenderMetrics {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  recentRenders: RenderRecord[];
}

export interface OperationRecord {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: any;
}

export interface RenderRecord {
  component: string;
  duration: number;
  timestamp: number;
  metadata?: any;
}

export interface PerformanceSummary {
  uptime: number;
  averageCPU: number;
  averageMemory: number;
  eventLoopLag: number;
  totalOperations: number;
  totalRenders: number;
  slowestOperations: Array<{ name: string; averageDuration: number }>;
  slowestRenders: Array<{ name: string; averageDuration: number }>;
  healthScore: number;
}

export interface OptimizationSuggestion {
  type: 'cpu' | 'memory' | 'eventloop' | 'operation' | 'render';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendations: string[];
}

export interface PerformanceExport {
  timestamp: number;
  metrics: PerformanceMetrics;
  summary: PerformanceSummary;
  suggestions: OptimizationSuggestion[];
  thresholds: PerformanceThresholds;
}