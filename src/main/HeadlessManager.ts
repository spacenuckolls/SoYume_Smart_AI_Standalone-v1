import { EventEmitter } from 'events';
import { AIEngine } from './ai/AIEngine';
import { DatabaseManager } from './database/DatabaseManager';
import { PluginManager } from './plugin/PluginManager';
import { ConfigManager } from './config/ConfigManager';
import { APIServer } from './api/APIServer';
import { GRPCServer } from './api/GRPCServer';
import { Story, Scene, Character } from '../shared/types/Story';

export interface HeadlessConfig {
  enableAPI: boolean;
  enableGRPC: boolean;
  apiPort: number;
  grpcPort: number;
  autoStartPlugins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentOperations: number;
  operationTimeout: number;
  enableMetrics: boolean;
  metricsPort?: number;
}

export interface HeadlessOperation {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: Error;
  metadata: any;
}

export interface HeadlessMetrics {
  operationsTotal: number;
  operationsCompleted: number;
  operationsFailed: number;
  averageOperationTime: number;
  activeOperations: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  pluginsActive: number;
  apiRequestsTotal: number;
  grpcRequestsTotal: number;
}

/**
 * HeadlessManager provides a way to run the AI Creative Assistant
 * without a UI, suitable for server deployments, CI/CD, and plugin hosting
 */
export class HeadlessManager extends EventEmitter {
  private config: HeadlessConfig;
  private aiEngine: AIEngine;
  private dbManager: DatabaseManager;
  private pluginManager: PluginManager;
  private configManager: ConfigManager;
  private apiServer?: APIServer;
  private grpcServer?: GRPCServer;
  private operations: Map<string, HeadlessOperation> = new Map();
  private metrics: HeadlessMetrics;
  private isRunning = false;
  private startTime: Date;
  private operationQueue: HeadlessOperation[] = [];
  private activeOperations = 0;

  constructor(config: Partial<HeadlessConfig> = {}) {
    super();
    
    this.config = {
      enableAPI: true,
      enableGRPC: true,
      apiPort: 3001,
      grpcPort: 50051,
      autoStartPlugins: [],
      logLevel: 'info',
      maxConcurrentOperations: 10,
      operationTimeout: 300000, // 5 minutes
      enableMetrics: true,
      metricsPort: 9090,
      ...config
    };

    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
    
    this.setupComponents();
  }

  async initialize(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.log('info', 'Initializing headless mode...');

      // Initialize core components
      await this.configManager.initialize();
      await this.dbManager.initialize();
      await this.aiEngine.initialize();
      await this.pluginManager.initialize();

      // Start API servers
      if (this.config.enableAPI) {
        await this.apiServer!.start();
        this.log('info', `API server started on port ${this.config.apiPort}`);
      }

      if (this.config.enableGRPC) {
        await this.grpcServer!.start();
        this.log('info', `gRPC server started on port ${this.config.grpcPort}`);
      }

      // Auto-start plugins
      await this.autoStartPlugins();

      // Start metrics collection
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Start operation processing
      this.startOperationProcessing();

      this.isRunning = true;
      this.emit('initialized');
      this.log('info', 'Headless mode initialized successfully');

    } catch (error) {
      this.log('error', 'Failed to initialize headless mode:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.log('info', 'Shutting down headless mode...');

      // Stop processing new operations
      this.isRunning = false;

      // Wait for active operations to complete (with timeout)
      await this.waitForOperationsToComplete(30000);

      // Stop API servers
      if (this.apiServer) {
        await this.apiServer.stop();
      }

      if (this.grpcServer) {
        await this.grpcServer.stop();
      }

      // Shutdown components
      await this.pluginManager.shutdown?.();
      await this.aiEngine.shutdown?.();
      await this.dbManager.shutdown?.();

      this.emit('shutdown');
      this.log('info', 'Headless mode shutdown complete');

    } catch (error) {
      this.log('error', 'Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Execute an operation in headless mode
   */
  async executeOperation(type: string, params: any, metadata: any = {}): Promise<any> {
    const operation: HeadlessOperation = {
      id: this.generateOperationId(),
      type,
      status: 'pending',
      startTime: new Date(),
      metadata: { ...metadata, params }
    };

    this.operations.set(operation.id, operation);
    this.operationQueue.push(operation);
    this.metrics.operationsTotal++;

    this.emit('operationQueued', operation);

    // Wait for operation to complete
    return new Promise((resolve, reject) => {
      const checkOperation = () => {
        const currentOp = this.operations.get(operation.id);
        if (!currentOp) {
          reject(new Error('Operation not found'));
          return;
        }

        if (currentOp.status === 'completed') {
          resolve(currentOp.result);
        } else if (currentOp.status === 'failed') {
          reject(currentOp.error);
        } else {
          // Check timeout
          const elapsed = Date.now() - currentOp.startTime.getTime();
          if (elapsed > this.config.operationTimeout) {
            currentOp.status = 'failed';
            currentOp.error = new Error('Operation timeout');
            currentOp.endTime = new Date();
            this.metrics.operationsFailed++;
            reject(currentOp.error);
          } else {
            setTimeout(checkOperation, 100);
          }
        }
      };

      checkOperation();
    });
  }

  /**
   * Get operation status
   */
  getOperation(operationId: string): HeadlessOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * List all operations
   */
  listOperations(filter?: { status?: string; type?: string }): HeadlessOperation[] {
    let operations = Array.from(this.operations.values());

    if (filter) {
      if (filter.status) {
        operations = operations.filter(op => op.status === filter.status);
      }
      if (filter.type) {
        operations = operations.filter(op => op.type === filter.type);
      }
    }

    return operations.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'pending') {
      return false;
    }

    operation.status = 'failed';
    operation.error = new Error('Operation cancelled');
    operation.endTime = new Date();
    this.metrics.operationsFailed++;

    this.emit('operationCancelled', operation);
    return true;
  }

  /**
   * Get current metrics
   */
  getMetrics(): HeadlessMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    uptime: number;
    version: string;
  } {
    const checks = {
      database: this.dbManager.isHealthy?.() ?? true,
      aiEngine: this.aiEngine.isHealthy?.() ?? true,
      pluginManager: this.pluginManager.getAllPlugins().length > 0,
      apiServer: this.apiServer?.getStats().isRunning ?? false,
      grpcServer: this.grpcServer?.getStats().isRunning ?? false
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      version: '1.0.0'
    };
  }

  private setupComponents(): void {
    // Initialize core components
    this.configManager = new ConfigManager();
    this.dbManager = new DatabaseManager(this.configManager);
    this.aiEngine = new AIEngine(this.configManager);
    this.pluginManager = new PluginManager(this.aiEngine, this.dbManager, this.configManager);

    // Initialize API servers if enabled
    if (this.config.enableAPI) {
      this.apiServer = new APIServer(
        this.aiEngine,
        this.dbManager,
        this.pluginManager,
        this.configManager,
        { port: this.config.apiPort }
      );
    }

    if (this.config.enableGRPC) {
      this.grpcServer = new GRPCServer(
        this.aiEngine,
        this.dbManager,
        this.pluginManager,
        { port: this.config.grpcPort }
      );
    }

    // Set up event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Plugin events
    this.pluginManager.on('pluginActivated', (plugin) => {
      this.log('info', `Plugin activated: ${plugin.manifest.name}`);
      this.metrics.pluginsActive++;
    });

    this.pluginManager.on('pluginDeactivated', (plugin) => {
      this.log('info', `Plugin deactivated: ${plugin.manifest.name}`);
      this.metrics.pluginsActive--;
    });

    this.pluginManager.on('pluginError', (plugin, error) => {
      this.log('error', `Plugin error in ${plugin.manifest.name}:`, error);
    });

    // AI Engine events
    this.aiEngine.on?.('textGenerated', (result) => {
      this.log('debug', 'Text generated:', result.length, 'characters');
    });

    this.aiEngine.on?.('analysisCompleted', (analysis) => {
      this.log('debug', 'Analysis completed:', analysis.type);
    });
  }

  private async autoStartPlugins(): Promise<void> {
    for (const pluginId of this.config.autoStartPlugins) {
      try {
        await this.pluginManager.activatePlugin(pluginId);
        this.log('info', `Auto-started plugin: ${pluginId}`);
      } catch (error) {
        this.log('warn', `Failed to auto-start plugin ${pluginId}:`, error);
      }
    }
  }

  private startOperationProcessing(): void {
    const processOperations = async () => {
      while (this.isRunning) {
        if (this.operationQueue.length > 0 && this.activeOperations < this.config.maxConcurrentOperations) {
          const operation = this.operationQueue.shift()!;
          this.processOperation(operation);
        }
        
        // Small delay to prevent busy waiting
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };

    processOperations().catch(error => {
      this.log('error', 'Operation processing error:', error);
    });
  }

  private async processOperation(operation: HeadlessOperation): Promise<void> {
    this.activeOperations++;
    operation.status = 'running';
    this.emit('operationStarted', operation);

    try {
      const result = await this.executeOperationType(operation);
      
      operation.status = 'completed';
      operation.result = result;
      operation.endTime = new Date();
      this.metrics.operationsCompleted++;
      
      this.emit('operationCompleted', operation);
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = error as Error;
      operation.endTime = new Date();
      this.metrics.operationsFailed++;
      
      this.emit('operationFailed', operation);
      this.log('error', `Operation ${operation.id} failed:`, error);
      
    } finally {
      this.activeOperations--;
    }
  }

  private async executeOperationType(operation: HeadlessOperation): Promise<any> {
    const { type, metadata } = operation;
    const { params } = metadata;

    switch (type) {
      case 'generateText':
        return this.aiEngine.generateText(params.prompt, params.options);

      case 'analyzeStory':
        return this.aiEngine.analyzeStory(params.story);

      case 'analyzeScene':
        return this.aiEngine.analyzeScene(params.scene);

      case 'analyzeCharacter':
        return this.aiEngine.analyzeCharacter(params.character);

      case 'saveStory':
        return this.dbManager.saveStory(params.story);

      case 'getStory':
        return this.dbManager.getStory(params.id);

      case 'searchStories':
        return this.dbManager.searchStories(params.query);

      case 'activatePlugin':
        return this.pluginManager.activatePlugin(params.pluginId);

      case 'deactivatePlugin':
        return this.pluginManager.deactivatePlugin(params.pluginId);

      case 'executePluginCommand':
        const plugin = this.pluginManager.getPlugin(params.pluginId);
        if (!plugin || !plugin.isActive) {
          throw new Error(`Plugin ${params.pluginId} not found or not active`);
        }
        // Execute plugin command (would need plugin command system)
        return { success: true };

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private async waitForOperationsToComplete(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeOperations > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeOperations > 0) {
      this.log('warn', `${this.activeOperations} operations still active after timeout`);
    }
  }

  private startMetricsCollection(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.updateMetrics();
      this.emit('metricsUpdated', this.metrics);
    }, 30000);
  }

  private updateMetrics(): void {
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.activeOperations = this.activeOperations;
    this.metrics.pluginsActive = this.pluginManager.getActivePlugins().length;
    
    // Calculate average operation time
    const completedOps = this.listOperations({ status: 'completed' });
    if (completedOps.length > 0) {
      const totalTime = completedOps.reduce((sum, op) => {
        return sum + (op.endTime!.getTime() - op.startTime.getTime());
      }, 0);
      this.metrics.averageOperationTime = totalTime / completedOps.length;
    }
  }

  private initializeMetrics(): HeadlessMetrics {
    return {
      operationsTotal: 0,
      operationsCompleted: 0,
      operationsFailed: 0,
      averageOperationTime: 0,
      activeOperations: 0,
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      pluginsActive: 0,
      apiRequestsTotal: 0,
      grpcRequestsTotal: 0
    };
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [HEADLESS] ${message}`, ...args);
    }
  }

  // Public API for external integrations
  public async generateText(prompt: string, options?: any): Promise<string> {
    return this.executeOperation('generateText', { prompt, options });
  }

  public async analyzeStory(story: Story): Promise<any> {
    return this.executeOperation('analyzeStory', { story });
  }

  public async analyzeScene(scene: Scene): Promise<any> {
    return this.executeOperation('analyzeScene', { scene });
  }

  public async analyzeCharacter(character: Character): Promise<any> {
    return this.executeOperation('analyzeCharacter', { character });
  }

  public async saveStory(story: Story): Promise<Story> {
    return this.executeOperation('saveStory', { story });
  }

  public async getStory(id: string): Promise<Story | null> {
    return this.executeOperation('getStory', { id });
  }

  public async searchStories(query: string): Promise<Story[]> {
    return this.executeOperation('searchStories', { query });
  }

  public async activatePlugin(pluginId: string): Promise<void> {
    return this.executeOperation('activatePlugin', { pluginId });
  }

  public async deactivatePlugin(pluginId: string): Promise<void> {
    return this.executeOperation('deactivatePlugin', { pluginId });
  }
}