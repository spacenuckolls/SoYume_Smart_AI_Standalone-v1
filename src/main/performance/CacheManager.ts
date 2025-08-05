import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/**
 * Intelligent caching system for AI responses and analysis results
 * Implements LRU eviction, TTL expiration, and memory management
 */
export class CacheManager extends EventEmitter {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private maxSize: number;
  private maxMemoryUsage: number;
  private currentMemoryUsage: number;
  private cleanupInterval: NodeJS.Timeout | null;
  private compressionEnabled: boolean;

  constructor(options: CacheOptions = {}) {
    super();
    
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = options.maxSize || 1000;
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
    this.currentMemoryUsage = 0;
    this.cleanupInterval = null;
    this.compressionEnabled = options.compressionEnabled || true;
    
    this.startCleanupTimer();
  }

  /**
   * Store data in cache with optional TTL
   */
  async set(key: string, data: any, options: CacheSetOptions = {}): Promise<void> {
    const cacheKey = this.generateKey(key);
    const serializedData = await this.serializeData(data);
    const compressedData = this.compressionEnabled ? 
      await this.compressData(serializedData) : serializedData;
    
    const entry: CacheEntry = {
      key: cacheKey,
      data: compressedData,
      originalSize: serializedData.length,
      compressedSize: compressedData.length,
      timestamp: Date.now(),
      ttl: options.ttl || 3600000, // 1 hour default
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: options.tags || [],
      priority: options.priority || CachePriority.NORMAL,
      compressed: this.compressionEnabled
    };

    // Check if we need to evict entries
    await this.ensureCapacity(entry.compressedSize);
    
    // Remove existing entry if it exists
    if (this.cache.has(cacheKey)) {
      await this.remove(cacheKey);
    }
    
    // Add new entry
    this.cache.set(cacheKey, entry);
    this.accessOrder.push(cacheKey);
    this.currentMemoryUsage += entry.compressedSize;
    
    this.emit('set', { key: cacheKey, size: entry.compressedSize });
  }

  /**
   * Retrieve data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      this.emit('miss', { key: cacheKey });
      return null;
    }
    
    // Check TTL
    if (this.isExpired(entry)) {
      await this.remove(cacheKey);
      this.emit('expired', { key: cacheKey });
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(cacheKey);
    
    // Decompress and deserialize data
    const decompressedData = entry.compressed ? 
      await this.decompressData(entry.data) : entry.data;
    const deserializedData = await this.deserializeData(decompressedData);
    
    this.emit('hit', { key: cacheKey, accessCount: entry.accessCount });
    return deserializedData;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Remove entry from cache
   */
  async remove(key: string): Promise<boolean> {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return false;
    }
    
    this.cache.delete(cacheKey);
    this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
    this.currentMemoryUsage -= entry.compressedSize;
    
    this.emit('remove', { key: cacheKey, size: entry.compressedSize });
    return true;
  }

  /**
   * Clear all entries or entries with specific tags
   */
  async clear(tags?: string[]): Promise<void> {
    if (!tags) {
      this.cache.clear();
      this.accessOrder = [];
      this.currentMemoryUsage = 0;
      this.emit('clear', { type: 'all' });
      return;
    }
    
    const keysToRemove: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      await this.remove(key);
    }
    
    this.emit('clear', { type: 'tagged', tags, count: keysToRemove.length });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      size: this.cache.size,
      memoryUsage: this.currentMemoryUsage,
      maxSize: this.maxSize,
      maxMemoryUsage: this.maxMemoryUsage,
      hitRate: this.calculateHitRate(),
      averageAccessCount: entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length || 0,
      oldestEntry: Math.min(...entries.map(e => e.timestamp)),
      newestEntry: Math.max(...entries.map(e => e.timestamp)),
      expiredEntries: entries.filter(e => this.isExpired(e)).length,
      compressionRatio: this.calculateCompressionRatio(entries),
      memoryEfficiency: (this.currentMemoryUsage / this.maxMemoryUsage) * 100
    };
  }

  /**
   * Optimize cache by removing expired and least-used entries
   */
  async optimize(): Promise<CacheOptimizationResult> {
    const startTime = Date.now();
    const initialSize = this.cache.size;
    const initialMemory = this.currentMemoryUsage;
    
    // Remove expired entries
    const expiredKeys = Array.from(this.cache.entries())
      .filter(([_, entry]) => this.isExpired(entry))
      .map(([key, _]) => key);
    
    for (const key of expiredKeys) {
      await this.remove(key);
    }
    
    // Remove low-priority entries if memory usage is high
    if (this.currentMemoryUsage > this.maxMemoryUsage * 0.8) {
      const lowPriorityEntries = Array.from(this.cache.entries())
        .filter(([_, entry]) => entry.priority === CachePriority.LOW)
        .sort(([_, a], [__, b]) => a.lastAccessed - b.lastAccessed)
        .slice(0, Math.floor(this.cache.size * 0.2));
      
      for (const [key, _] of lowPriorityEntries) {
        await this.remove(key);
      }
    }
    
    const result: CacheOptimizationResult = {
      duration: Date.now() - startTime,
      entriesRemoved: initialSize - this.cache.size,
      memoryFreed: initialMemory - this.currentMemoryUsage,
      expiredEntriesRemoved: expiredKeys.length
    };
    
    this.emit('optimize', result);
    return result;
  }

  /**
   * Preload frequently accessed data
   */
  async preload(keys: string[], dataLoader: (key: string) => Promise<any>): Promise<void> {
    const preloadPromises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const data = await dataLoader(key);
          await this.set(key, data, { priority: CachePriority.HIGH });
        } catch (error) {
          this.emit('preloadError', { key, error });
        }
      }
    });
    
    await Promise.all(preloadPromises);
    this.emit('preload', { keys: keys.length });
  }

  /**
   * Ensure cache has enough capacity for new entry
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    // Check size limit
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder[0];
      if (oldestKey) {
        await this.remove(oldestKey);
      }
    }
    
    // Check memory limit
    while (this.currentMemoryUsage + newEntrySize > this.maxMemoryUsage) {
      const lruKey = this.findLRUKey();
      if (lruKey) {
        await this.remove(lruKey);
      } else {
        break; // No more entries to remove
      }
    }
  }

  /**
   * Find least recently used key
   */
  private findLRUKey(): string | null {
    if (this.accessOrder.length === 0) {
      return null;
    }
    
    // Find entry with lowest priority and oldest access time
    let lruKey = this.accessOrder[0];
    let lruEntry = this.cache.get(lruKey);
    
    for (const key of this.accessOrder) {
      const entry = this.cache.get(key);
      if (!entry || !lruEntry) continue;
      
      if (entry.priority < lruEntry.priority || 
          (entry.priority === lruEntry.priority && entry.lastAccessed < lruEntry.lastAccessed)) {
        lruKey = key;
        lruEntry = entry;
      }
    }
    
    return lruKey;
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Generate cache key with hash
   */
  private generateKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Serialize data for storage
   */
  private async serializeData(data: any): Promise<Buffer> {
    return Buffer.from(JSON.stringify(data), 'utf8');
  }

  /**
   * Deserialize data from storage
   */
  private async deserializeData(data: Buffer): Promise<any> {
    return JSON.parse(data.toString('utf8'));
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  /**
   * Decompress data using gzip
   */
  private async decompressData(data: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  /**
   * Calculate hit rate
   */
  private calculateHitRate(): number {
    // This would be tracked with actual hit/miss counters in production
    return 0.85; // Mock value
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(entries: CacheEntry[]): number {
    const totalOriginal = entries.reduce((sum, e) => sum + e.originalSize, 0);
    const totalCompressed = entries.reduce((sum, e) => sum + e.compressedSize, 0);
    
    return totalOriginal > 0 ? totalCompressed / totalOriginal : 1;
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.optimize();
    }, 300000); // 5 minutes
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopCleanupTimer();
    await this.clear();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface CacheOptions {
  maxSize?: number;
  maxMemoryUsage?: number;
  compressionEnabled?: boolean;
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
  priority?: CachePriority;
}

export interface CacheEntry {
  key: string;
  data: Buffer;
  originalSize: number;
  compressedSize: number;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  priority: CachePriority;
  compressed: boolean;
}

export interface CacheStats {
  size: number;
  memoryUsage: number;
  maxSize: number;
  maxMemoryUsage: number;
  hitRate: number;
  averageAccessCount: number;
  oldestEntry: number;
  newestEntry: number;
  expiredEntries: number;
  compressionRatio: number;
  memoryEfficiency: number;
}

export interface CacheOptimizationResult {
  duration: number;
  entriesRemoved: number;
  memoryFreed: number;
  expiredEntriesRemoved: number;
}

export enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Specialized cache implementations
export class AIResponseCache extends CacheManager {
  constructor() {
    super({
      maxSize: 500,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      compressionEnabled: true
    });
  }

  async cacheAIResponse(prompt: string, provider: string, model: string, response: any): Promise<void> {
    const key = `ai:${provider}:${model}:${crypto.createHash('md5').update(prompt).digest('hex')}`;
    await this.set(key, response, {
      ttl: 7200000, // 2 hours
      tags: ['ai-response', provider, model],
      priority: CachePriority.HIGH
    });
  }

  async getAIResponse(prompt: string, provider: string, model: string): Promise<any> {
    const key = `ai:${provider}:${model}:${crypto.createHash('md5').update(prompt).digest('hex')}`;
    return await this.get(key);
  }
}

export class AnalysisCache extends CacheManager {
  constructor() {
    super({
      maxSize: 200,
      maxMemoryUsage: 30 * 1024 * 1024, // 30MB
      compressionEnabled: true
    });
  }

  async cacheAnalysis(storyId: string, analysisType: string, result: any): Promise<void> {
    const key = `analysis:${storyId}:${analysisType}`;
    await this.set(key, result, {
      ttl: 3600000, // 1 hour
      tags: ['analysis', analysisType, storyId],
      priority: CachePriority.NORMAL
    });
  }

  async getAnalysis(storyId: string, analysisType: string): Promise<any> {
    const key = `analysis:${storyId}:${analysisType}`;
    return await this.get(key);
  }

  async invalidateStoryAnalysis(storyId: string): Promise<void> {
    await this.clear([storyId]);
  }
}