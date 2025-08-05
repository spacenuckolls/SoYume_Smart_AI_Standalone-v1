import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import * as path from 'path';

/**
 * Background processing system for long-running analysis tasks
 * Manages worker threads and task queues to prevent UI blocking
 */
export class BackgroundProcessor extends EventEmitter {
  private workers: Map<string, WorkerInstance>;
  private taskQueue: TaskQueue;
  private maxWorkers: number;
  private activeWorkers: number;
  private taskCounter: number;

  constructor(options: BackgroundProcessorOptions = {}) {
    super();
    
    this.workers = new Map();
    this.taskQueue = new TaskQueue();
    this.maxWorkers = options.maxWorkers || Math.max(2, Math.floor(require('os').cpus().length / 2));
    this.activeWorkers = 0;
    this.taskCounter = 0;
  }

  /**
   * Submit a task for background processing
   */
  async submitTask<T>(task: BackgroundTask): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      const queuedTask: QueuedTask = {
        id: taskId,
        ...task,
        resolve,
        reject,
        submittedAt: Date.now(),
        status: TaskStatus.QUEUED
      };

      this.taskQueue.enqueue(queuedTask);
      this.emit('taskQueued', { taskId, type: task.type });
      
      // Try to process immediately if workers are available
      this.processQueue();
    });
  }

  /**
   * Submit multiple tasks for batch processing
   */
  async submitBatch<T>(tasks: BackgroundTask[]): Promise<T[]> {
    const promises = tasks.map(task => this.submitTask<T>(task));
    return Promise.all(promises);
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.taskQueue.findTask(taskId);
    return task ? task.status : null;
  }

  /**
   * Cancel a queued task
   */
  cancelTask(taskId: string): boolean {
    const task = this.taskQueue.findTask(taskId);
    if (!task || task.status !== TaskStatus.QUEUED) {
      return false;
    }

    this.taskQueue.removeTask(taskId);
    task.reject(new Error('Task cancelled'));
    this.emit('taskCancelled', { taskId });
    return true;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    return {
      queuedTasks: this.taskQueue.getQueuedCount(),
      runningTasks: this.taskQueue.getRunningCount(),
      completedTasks: this.taskQueue.getCompletedCount(),
      failedTasks: this.taskQueue.getFailedCount(),
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers,
      averageWaitTime: this.taskQueue.getAverageWaitTime(),
      averageProcessingTime: this.taskQueue.getAverageProcessingTime()
    };
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    while (this.activeWorkers < this.maxWorkers && this.taskQueue.hasQueuedTasks()) {
      const task = this.taskQueue.dequeue();
      if (!task) break;

      await this.executeTask(task);
    }
  }

  /**
   * Execute a task using a worker thread
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    const workerId = this.generateWorkerId();
    
    try {
      task.status = TaskStatus.RUNNING;
      task.startedAt = Date.now();
      this.activeWorkers++;
      
      this.emit('taskStarted', { taskId: task.id, workerId });

      const worker = await this.createWorker(workerId, task.type);
      const result = await this.runTaskInWorker(worker, task);
      
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();
      task.resolve(result);
      
      this.emit('taskCompleted', { 
        taskId: task.id, 
        workerId,
        duration: task.completedAt - (task.startedAt || 0)
      });

    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.completedAt = Date.now();
      task.error = error as Error;
      task.reject(error);
      
      this.emit('taskFailed', { 
        taskId: task.id, 
        workerId,
        error: error.message 
      });

    } finally {
      this.activeWorkers--;
      await this.terminateWorker(workerId);
      
      // Process next task in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Create a worker thread for a specific task type
   */
  private async createWorker(workerId: string, taskType: string): Promise<WorkerInstance> {
    const workerScript = this.getWorkerScript(taskType);
    
    const worker = new Worker(workerScript, {
      workerData: { workerId, taskType }
    });

    const workerInstance: WorkerInstance = {
      id: workerId,
      worker,
      taskType,
      createdAt: Date.now(),
      isTerminated: false
    };

    this.workers.set(workerId, workerInstance);
    
    // Handle worker errors
    worker.on('error', (error) => {
      this.emit('workerError', { workerId, error: error.message });
    });

    return workerInstance;
  }

  /**
   * Run a task in a worker thread
   */
  private async runTaskInWorker(workerInstance: WorkerInstance, task: QueuedTask): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${task.timeout || 300000}ms`));
      }, task.timeout || 300000); // 5 minutes default timeout

      workerInstance.worker.once('message', (result) => {
        clearTimeout(timeout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      });

      workerInstance.worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Send task data to worker
      workerInstance.worker.postMessage({
        taskId: task.id,
        type: task.type,
        data: task.data,
        options: task.options
      });
    });
  }

  /**
   * Terminate a worker thread
   */
  private async terminateWorker(workerId: string): Promise<void> {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance || workerInstance.isTerminated) {
      return;
    }

    try {
      await workerInstance.worker.terminate();
      workerInstance.isTerminated = true;
      this.workers.delete(workerId);
    } catch (error) {
      this.emit('workerTerminationError', { workerId, error: error.message });
    }
  }

  /**
   * Get worker script path for task type
   */
  private getWorkerScript(taskType: string): string {
    const workerScripts: Record<string, string> = {
      'story-analysis': path.join(__dirname, 'workers', 'story-analysis-worker.js'),
      'ai-generation': path.join(__dirname, 'workers', 'ai-generation-worker.js'),
      'text-processing': path.join(__dirname, 'workers', 'text-processing-worker.js'),
      'export-generation': path.join(__dirname, 'workers', 'export-generation-worker.js'),
      'model-quantization': path.join(__dirname, 'workers', 'model-quantization-worker.js')
    };

    return workerScripts[taskType] || path.join(__dirname, 'workers', 'generic-worker.js');
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${++this.taskCounter}`;
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup all workers and clear queue
   */
  async destroy(): Promise<void> {
    // Cancel all queued tasks
    const queuedTasks = this.taskQueue.getAllTasks().filter(t => t.status === TaskStatus.QUEUED);
    for (const task of queuedTasks) {
      task.reject(new Error('Background processor is shutting down'));
    }

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.keys()).map(workerId => 
      this.terminateWorker(workerId)
    );
    
    await Promise.all(terminationPromises);
    
    this.taskQueue.clear();
    this.removeAllListeners();
  }
}

/**
 * Task queue implementation with priority support
 */
class TaskQueue {
  private tasks: Map<string, QueuedTask>;
  private queuedTasks: QueuedTask[];
  private completedTasks: QueuedTask[];
  private failedTasks: QueuedTask[];

  constructor() {
    this.tasks = new Map();
    this.queuedTasks = [];
    this.completedTasks = [];
    this.failedTasks = [];
  }

  enqueue(task: QueuedTask): void {
    this.tasks.set(task.id, task);
    
    // Insert task based on priority
    const insertIndex = this.queuedTasks.findIndex(t => 
      (t.priority || TaskPriority.NORMAL) < (task.priority || TaskPriority.NORMAL)
    );
    
    if (insertIndex === -1) {
      this.queuedTasks.push(task);
    } else {
      this.queuedTasks.splice(insertIndex, 0, task);
    }
  }

  dequeue(): QueuedTask | null {
    const task = this.queuedTasks.shift();
    return task || null;
  }

  findTask(taskId: string): QueuedTask | null {
    return this.tasks.get(taskId) || null;
  }

  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.tasks.delete(taskId);
    
    const queueIndex = this.queuedTasks.findIndex(t => t.id === taskId);
    if (queueIndex > -1) {
      this.queuedTasks.splice(queueIndex, 1);
    }

    return true;
  }

  hasQueuedTasks(): boolean {
    return this.queuedTasks.length > 0;
  }

  getQueuedCount(): number {
    return this.queuedTasks.length;
  }

  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.RUNNING).length;
  }

  getCompletedCount(): number {
    return this.completedTasks.length;
  }

  getFailedCount(): number {
    return this.failedTasks.length;
  }

  getAllTasks(): QueuedTask[] {
    return Array.from(this.tasks.values());
  }

  getAverageWaitTime(): number {
    const completedWithWaitTime = this.completedTasks.filter(t => t.startedAt && t.submittedAt);
    if (completedWithWaitTime.length === 0) return 0;

    const totalWaitTime = completedWithWaitTime.reduce((sum, task) => 
      sum + ((task.startedAt || 0) - task.submittedAt), 0
    );

    return totalWaitTime / completedWithWaitTime.length;
  }

  getAverageProcessingTime(): number {
    const completedWithProcessingTime = this.completedTasks.filter(t => 
      t.completedAt && t.startedAt
    );
    
    if (completedWithProcessingTime.length === 0) return 0;

    const totalProcessingTime = completedWithProcessingTime.reduce((sum, task) => 
      sum + ((task.completedAt || 0) - (task.startedAt || 0)), 0
    );

    return totalProcessingTime / completedWithProcessingTime.length;
  }

  clear(): void {
    this.tasks.clear();
    this.queuedTasks = [];
    this.completedTasks = [];
    this.failedTasks = [];
  }
}

// Specialized background processors
export class StoryAnalysisProcessor extends BackgroundProcessor {
  constructor() {
    super({ maxWorkers: 2 });
  }

  async analyzeStoryStructure(storyId: string, content: string): Promise<any> {
    return this.submitTask({
      type: 'story-analysis',
      data: { storyId, content, analysisType: 'structure' },
      priority: TaskPriority.HIGH,
      timeout: 120000 // 2 minutes
    });
  }

  async detectPlotHoles(storyId: string, scenes: any[]): Promise<any> {
    return this.submitTask({
      type: 'story-analysis',
      data: { storyId, scenes, analysisType: 'plot-holes' },
      priority: TaskPriority.NORMAL,
      timeout: 180000 // 3 minutes
    });
  }

  async analyzePacing(storyId: string, content: string): Promise<any> {
    return this.submitTask({
      type: 'story-analysis',
      data: { storyId, content, analysisType: 'pacing' },
      priority: TaskPriority.NORMAL,
      timeout: 90000 // 1.5 minutes
    });
  }
}

export class AIGenerationProcessor extends BackgroundProcessor {
  constructor() {
    super({ maxWorkers: 3 });
  }

  async generateText(prompt: string, provider: string, options: any): Promise<any> {
    return this.submitTask({
      type: 'ai-generation',
      data: { prompt, provider, options, generationType: 'text' },
      priority: TaskPriority.HIGH,
      timeout: 300000 // 5 minutes
    });
  }

  async generateCharacterProfile(characterData: any): Promise<any> {
    return this.submitTask({
      type: 'ai-generation',
      data: { characterData, generationType: 'character-profile' },
      priority: TaskPriority.NORMAL,
      timeout: 180000 // 3 minutes
    });
  }

  async generateSceneDescription(sceneData: any): Promise<any> {
    return this.submitTask({
      type: 'ai-generation',
      data: { sceneData, generationType: 'scene-description' },
      priority: TaskPriority.NORMAL,
      timeout: 120000 // 2 minutes
    });
  }
}

export class ModelQuantizationProcessor extends BackgroundProcessor {
  constructor() {
    super({ maxWorkers: 1 }); // CPU intensive, limit to 1 worker
  }

  async quantizeModel(modelPath: string, quantizationLevel: number): Promise<any> {
    return this.submitTask({
      type: 'model-quantization',
      data: { modelPath, quantizationLevel },
      priority: TaskPriority.LOW,
      timeout: 1800000 // 30 minutes
    });
  }
}

// Types and interfaces
export interface BackgroundProcessorOptions {
  maxWorkers?: number;
}

export interface BackgroundTask {
  type: string;
  data: any;
  options?: any;
  priority?: TaskPriority;
  timeout?: number;
}

export interface QueuedTask extends BackgroundTask {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  status: TaskStatus;
  error?: Error;
}

export interface WorkerInstance {
  id: string;
  worker: Worker;
  taskType: string;
  createdAt: number;
  isTerminated: boolean;
}

export interface QueueStats {
  queuedTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkers: number;
  maxWorkers: number;
  averageWaitTime: number;
  averageProcessingTime: number;
}

export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}