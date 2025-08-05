import { EventEmitter } from 'events';

/**
 * Memory management system for large story projects
 * Handles memory optimization, garbage collection, and resource cleanup
 */
export class MemoryManager extends EventEmitter {
  private memoryPools: Map<string, ObjectPool>;
  private weakReferences: WeakMap<object, MemoryMetadata>;
  private memoryThresholds: MemoryThresholds;
  private monitoringInterval: NodeJS.Timeout | null;
  private isMonitoring: boolean;
  private lastGCTime: number;

  constructor(options: MemoryManagerOptions = {}) {
    super();
    
    this.memoryPools = new Map();
    this.weakReferences = new WeakMap();
    this.memoryThresholds = {
      warningThreshold: options.warningThreshold || 0.8, // 80%
      criticalThreshold: options.criticalThreshold || 0.9, // 90%
      maxHeapSize: options.maxHeapSize || 1024 * 1024 * 1024, // 1GB
      gcInterval: options.gcInterval || 30000 // 30 seconds
    };
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.lastGCTime = Date.now();

    this.initializeObjectPools();
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000); // Check every 5 seconds

    this.emit('monitoringStarted');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Get an object from the pool or create a new one
   */
  getPooledObject<T>(poolName: string, factory: () => T): T {
    let pool = this.memoryPools.get(poolName);
    
    if (!pool) {
      pool = new ObjectPool(factory, { maxSize: 100 });
      this.memoryPools.set(poolName, pool);
    }

    const obj = pool.acquire();
    this.trackObject(obj, { poolName, acquiredAt: Date.now() });
    
    return obj;
  }

  /**
   * Return an object to the pool
   */
  returnPooledObject(poolName: string, obj: any): void {
    const pool = this.memoryPools.get(poolName);
    if (!pool) return;

    // Clean up the object before returning to pool
    this.cleanupObject(obj);
    pool.release(obj);
    
    this.emit('objectReturned', { poolName, poolSize: pool.size() });
  }

  /**
   * Track an object for memory management
   */
  trackObject(obj: any, metadata: MemoryMetadata): void {
    this.weakReferences.set(obj, {
      ...metadata,
      createdAt: metadata.createdAt || Date.now()
    });
  }

  /**
   * Create a managed large object with automatic cleanup
   */
  createManagedObject<T>(
    factory: () => T,
    cleanup: (obj: T) => void,
    options: ManagedObjectOptions = {}
  ): ManagedObject<T> {
    const obj = factory();
    const managedObj: ManagedObject<T> = {
      data: obj,
      cleanup: () => {
        cleanup(obj);
        this.emit('objectCleaned', { type: options.type || 'unknown' });
      },
      isDisposed: false,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      type: options.type || 'unknown',
      size: options.estimatedSize || 0
    };

    this.trackObject(obj, {
      createdAt: managedObj.createdAt,
      type: managedObj.type,
      size: managedObj.size,
      managed: true
    });

    // Auto-cleanup after TTL if specified
    if (options.ttl) {
      setTimeout(() => {
        if (!managedObj.isDisposed) {
          managedObj.cleanup();
          managedObj.isDisposed = true;
        }
      }, options.ttl);
    }

    return managedObj;
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (typeof global.gc === 'function') {
      const beforeMemory = process.memoryUsage();
      global.gc();
      const afterMemory = process.memoryUsage();
      
      this.lastGCTime = Date.now();
      
      const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
      this.emit('garbageCollected', {
        memoryFreed,
        beforeMemory,
        afterMemory
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    const beforeMemory = process.memoryUsage();
    
    let optimizations = 0;
    
    // Clean up object pools
    for (const [poolName, pool] of this.memoryPools) {
      const cleaned = pool.cleanup();
      optimizations += cleaned;
      this.emit('poolCleaned', { poolName, objectsCleaned: cleaned });
    }
    
    // Force garbage collection
    const gcPerformed = this.forceGarbageCollection();
    if (gcPerformed) optimizations++;
    
    // Clean up expired managed objects
    // Note: WeakMap doesn't allow iteration, so this is conceptual
    // In practice, you'd maintain a separate registry for cleanup
    
    const afterMemory = process.memoryUsage();
    const result: MemoryOptimizationResult = {
      duration: Date.now() - startTime,
      memoryFreed: beforeMemory.heapUsed - afterMemory.heapUsed,
      optimizationsPerformed: optimizations,
      beforeMemory,
      afterMemory,
      gcPerformed
    };
    
    this.emit('memoryOptimized', result);
    return result;
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memoryUsage = process.memoryUsage();
    const poolStats = this.getPoolStats();
    
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      heapUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      isNearLimit: memoryUsage.heapUsed > this.memoryThresholds.maxHeapSize * this.memoryThresholds.warningThreshold,
      isCritical: memoryUsage.heapUsed > this.memoryThresholds.maxHeapSize * this.memoryThresholds.criticalThreshold,
      poolStats,
      lastGCTime: this.lastGCTime,
      timeSinceLastGC: Date.now() - this.lastGCTime
    };
  }

  /**
   * Create a memory-efficient data structure for large datasets
   */
  createEfficientDataStructure<T>(
    type: 'array' | 'map' | 'set',
    options: EfficientDataStructureOptions = {}
  ): EfficientDataStructure<T> {
    switch (type) {
      case 'array':
        return new EfficientArray<T>(options);
      case 'map':
        return new EfficientMap<T>(options);
      case 'set':
        return new EfficientSet<T>(options);
      default:
        throw new Error(`Unsupported data structure type: ${type}`);
    }
  }

  /**
   * Monitor memory usage and emit warnings
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    
    if (stats.isCritical) {
      this.emit('memoryWarning', {
        level: 'critical',
        heapUsagePercent: stats.heapUsagePercent,
        heapUsed: stats.heapUsed,
        recommendation: 'Immediate memory cleanup required'
      });
      
      // Auto-optimize if critical
      this.optimizeMemory();
      
    } else if (stats.isNearLimit) {
      this.emit('memoryWarning', {
        level: 'warning',
        heapUsagePercent: stats.heapUsagePercent,
        heapUsed: stats.heapUsed,
        recommendation: 'Consider optimizing memory usage'
      });
    }
    
    // Auto-GC if it's been too long
    if (stats.timeSinceLastGC > this.memoryThresholds.gcInterval) {
      this.forceGarbageCollection();
    }
  }

  /**
   * Initialize object pools for common objects
   */
  private initializeObjectPools(): void {
    // Story objects pool
    this.memoryPools.set('story', new ObjectPool(
      () => ({ id: '', title: '', content: '', scenes: [], characters: [] }),
      { maxSize: 50 }
    ));
    
    // Scene objects pool
    this.memoryPools.set('scene', new ObjectPool(
      () => ({ id: '', title: '', content: '', order: 0 }),
      { maxSize: 200 }
    ));
    
    // Character objects pool
    this.memoryPools.set('character', new ObjectPool(
      () => ({ id: '', name: '', description: '', traits: [] }),
      { maxSize: 100 }
    ));
    
    // Analysis result pool
    this.memoryPools.set('analysis', new ObjectPool(
      () => ({ type: '', result: null, timestamp: 0 }),
      { maxSize: 100 }
    ));
  }

  /**
   * Clean up an object before returning to pool
   */
  private cleanupObject(obj: any): void {
    if (typeof obj === 'object' && obj !== null) {
      // Clear arrays
      Object.keys(obj).forEach(key => {
        if (Array.isArray(obj[key])) {
          obj[key].length = 0;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Reset nested objects to default values
          Object.keys(obj[key]).forEach(nestedKey => {
            const value = obj[key][nestedKey];
            if (typeof value === 'string') obj[key][nestedKey] = '';
            else if (typeof value === 'number') obj[key][nestedKey] = 0;
            else if (typeof value === 'boolean') obj[key][nestedKey] = false;
            else if (Array.isArray(value)) value.length = 0;
          });
        }
      });
    }
  }

  /**
   * Get statistics for all object pools
   */
  private getPoolStats(): PoolStats[] {
    return Array.from(this.memoryPools.entries()).map(([name, pool]) => ({
      name,
      size: pool.size(),
      maxSize: pool.maxSize,
      available: pool.available(),
      utilizationPercent: (pool.size() / pool.maxSize) * 100
    }));
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stopMonitoring();
    
    // Clear all pools
    for (const pool of this.memoryPools.values()) {
      pool.destroy();
    }
    this.memoryPools.clear();
    
    this.removeAllListeners();
  }
}

/**
 * Object pool implementation for memory efficiency
 */
class ObjectPool<T> {
  private objects: T[];
  private factory: () => T;
  private reset?: (obj: T) => void;
  public readonly maxSize: number;

  constructor(factory: () => T, options: ObjectPoolOptions<T> = {}) {
    this.objects = [];
    this.factory = factory;
    this.reset = options.reset;
    this.maxSize = options.maxSize || 50;
    
    // Pre-populate pool
    const initialSize = Math.min(options.initialSize || 5, this.maxSize);
    for (let i = 0; i < initialSize; i++) {
      this.objects.push(this.factory());
    }
  }

  acquire(): T {
    if (this.objects.length > 0) {
      return this.objects.pop()!;
    }
    
    return this.factory();
  }

  release(obj: T): void {
    if (this.objects.length < this.maxSize) {
      if (this.reset) {
        this.reset(obj);
      }
      this.objects.push(obj);
    }
    // If pool is full, let object be garbage collected
  }

  size(): number {
    return this.objects.length;
  }

  available(): number {
    return this.maxSize - this.objects.length;
  }

  cleanup(): number {
    const cleaned = this.objects.length;
    this.objects.length = 0;
    return cleaned;
  }

  destroy(): void {
    this.objects.length = 0;
  }
}

/**
 * Memory-efficient array implementation
 */
class EfficientArray<T> implements EfficientDataStructure<T> {
  private data: T[];
  private maxSize: number;
  private compressionEnabled: boolean;

  constructor(options: EfficientDataStructureOptions = {}) {
    this.data = [];
    this.maxSize = options.maxSize || 10000;
    this.compressionEnabled = options.compressionEnabled || false;
  }

  add(item: T): void {
    if (this.data.length >= this.maxSize) {
      // Remove oldest items (FIFO)
      this.data.shift();
    }
    this.data.push(item);
  }

  get(index: number): T | undefined {
    return this.data[index];
  }

  size(): number {
    return this.data.length;
  }

  clear(): void {
    this.data.length = 0;
  }

  optimize(): void {
    // Remove undefined/null values
    this.data = this.data.filter(item => item !== undefined && item !== null);
  }

  getMemoryUsage(): number {
    // Rough estimation
    return this.data.length * 64; // Assume 64 bytes per item average
  }
}

/**
 * Memory-efficient map implementation
 */
class EfficientMap<T> implements EfficientDataStructure<T> {
  private data: Map<string, T>;
  private maxSize: number;
  private accessOrder: string[];

  constructor(options: EfficientDataStructureOptions = {}) {
    this.data = new Map();
    this.maxSize = options.maxSize || 5000;
    this.accessOrder = [];
  }

  set(key: string, value: T): void {
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      // Remove least recently used item
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.data.delete(oldestKey);
      }
    }
    
    this.data.set(key, value);
    
    // Update access order
    const existingIndex = this.accessOrder.indexOf(key);
    if (existingIndex > -1) {
      this.accessOrder.splice(existingIndex, 1);
    }
    this.accessOrder.push(key);
  }

  get(key: string): T | undefined {
    const value = this.data.get(key);
    if (value !== undefined) {
      // Update access order
      const existingIndex = this.accessOrder.indexOf(key);
      if (existingIndex > -1) {
        this.accessOrder.splice(existingIndex, 1);
        this.accessOrder.push(key);
      }
    }
    return value;
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
    this.accessOrder.length = 0;
  }

  optimize(): void {
    // Already optimized with LRU eviction
  }

  getMemoryUsage(): number {
    return this.data.size * 128; // Rough estimation
  }
}

/**
 * Memory-efficient set implementation
 */
class EfficientSet<T> implements EfficientDataStructure<T> {
  private data: Set<T>;
  private maxSize: number;

  constructor(options: EfficientDataStructureOptions = {}) {
    this.data = new Set();
    this.maxSize = options.maxSize || 5000;
  }

  add(item: T): void {
    if (this.data.size >= this.maxSize) {
      // Remove first item (FIFO)
      const firstItem = this.data.values().next().value;
      this.data.delete(firstItem);
    }
    this.data.add(item);
  }

  has(item: T): boolean {
    return this.data.has(item);
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  optimize(): void {
    // Set is already optimized
  }

  getMemoryUsage(): number {
    return this.data.size * 64; // Rough estimation
  }
}

// Types and interfaces
export interface MemoryManagerOptions {
  warningThreshold?: number;
  criticalThreshold?: number;
  maxHeapSize?: number;
  gcInterval?: number;
}

export interface MemoryThresholds {
  warningThreshold: number;
  criticalThreshold: number;
  maxHeapSize: number;
  gcInterval: number;
}

export interface MemoryMetadata {
  createdAt?: number;
  type?: string;
  size?: number;
  poolName?: string;
  acquiredAt?: number;
  managed?: boolean;
}

export interface ManagedObject<T> {
  data: T;
  cleanup: () => void;
  isDisposed: boolean;
  createdAt: number;
  lastAccessed: number;
  type: string;
  size: number;
}

export interface ManagedObjectOptions {
  type?: string;
  estimatedSize?: number;
  ttl?: number;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsagePercent: number;
  isNearLimit: boolean;
  isCritical: boolean;
  poolStats: PoolStats[];
  lastGCTime: number;
  timeSinceLastGC: number;
}

export interface PoolStats {
  name: string;
  size: number;
  maxSize: number;
  available: number;
  utilizationPercent: number;
}

export interface MemoryOptimizationResult {
  duration: number;
  memoryFreed: number;
  optimizationsPerformed: number;
  beforeMemory: NodeJS.MemoryUsage;
  afterMemory: NodeJS.MemoryUsage;
  gcPerformed: boolean;
}

export interface ObjectPoolOptions<T> {
  maxSize?: number;
  initialSize?: number;
  reset?: (obj: T) => void;
}

export interface EfficientDataStructureOptions {
  maxSize?: number;
  compressionEnabled?: boolean;
}

export interface EfficientDataStructure<T> {
  size(): number;
  clear(): void;
  optimize(): void;
  getMemoryUsage(): number;
}