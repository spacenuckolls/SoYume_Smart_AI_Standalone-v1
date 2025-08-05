import { EventEmitter } from 'events';
import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Worker } from 'worker_threads';

/**
 * Secure plugin sandboxing and permission system
 * Provides isolated execution environment for plugins with controlled access
 */
export class PluginSandbox extends EventEmitter {
  private sandboxes: Map<string, SandboxInstance>;
  private permissionManager: PermissionManager;
  private resourceLimits: ResourceLimits;
  private securityPolicy: SecurityPolicy;
  private auditLogger: SandboxAuditLogger;

  constructor(options: PluginSandboxOptions = {}) {
    super();
    
    this.sandboxes = new Map();
    this.permissionManager = new PermissionManager(options.permissions);
    this.auditLogger = new SandboxAuditLogger(options.auditPath);
    
    this.resourceLimits = {
      maxMemory: options.maxMemory || 128 * 1024 * 1024, // 128MB
      maxCpuTime: options.maxCpuTime || 5000, // 5 seconds
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxNetworkRequests: options.maxNetworkRequests || 100,
      maxFileOperations: options.maxFileOperations || 50,
      ...options.resourceLimits
    };
    
    this.securityPolicy = {
      allowNetworkAccess: options.allowNetworkAccess || false,
      allowFileSystemAccess: options.allowFileSystemAccess || false,
      allowProcessSpawn: options.allowProcessSpawn || false,
      allowNativeModules: options.allowNativeModules || false,
      trustedDomains: options.trustedDomains || [],
      blockedModules: options.blockedModules || ['fs', 'child_process', 'cluster'],
      ...options.securityPolicy
    };
    
    this.initialize();
  }

  /**
   * Initialize sandbox system
   */
  private async initialize(): Promise<void> {
    try {
      await this.auditLogger.initialize();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize plugin sandbox: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new sandbox for a plugin
   */
  async createSandbox(pluginId: string, config: SandboxConfig): Promise<string> {
    if (this.sandboxes.has(pluginId)) {
      throw new Error(`Sandbox already exists for plugin: ${pluginId}`);
    }
    
    // Validate plugin permissions
    await this.validatePluginPermissions(pluginId, config.permissions);
    
    // Create sandbox instance
    const sandboxId = crypto.randomUUID();
    const sandbox = new SandboxInstance(sandboxId, pluginId, config, {
      resourceLimits: this.resourceLimits,
      securityPolicy: this.securityPolicy,
      permissionManager: this.permissionManager,
      auditLogger: this.auditLogger
    });
    
    await sandbox.initialize();
    this.sandboxes.set(pluginId, sandbox);
    
    this.emit('sandboxCreated', { sandboxId, pluginId });
    await this.auditLogger.logEvent({
      type: 'sandbox_created',
      pluginId,
      sandboxId,
      permissions: config.permissions,
      timestamp: Date.now()
    });
    
    return sandboxId;
  }

  /**
   * Execute code in sandbox
   */
  async executeInSandbox(pluginId: string, code: string, context?: Record<string, any>): Promise<any> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    try {
      const result = await sandbox.execute(code, context);
      
      await this.auditLogger.logEvent({
        type: 'code_executed',
        pluginId,
        sandboxId: sandbox.id,
        codeHash: crypto.createHash('sha256').update(code).digest('hex'),
        success: true,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      await this.auditLogger.logEvent({
        type: 'execution_error',
        pluginId,
        sandboxId: sandbox.id,
        error: (error as Error).message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Load and execute plugin file
   */
  async loadPlugin(pluginId: string, pluginPath: string): Promise<any> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    // Validate plugin file
    await this.validatePluginFile(pluginPath);
    
    try {
      const pluginCode = await fs.readFile(pluginPath, 'utf8');
      const result = await sandbox.loadPlugin(pluginCode, pluginPath);
      
      await this.auditLogger.logEvent({
        type: 'plugin_loaded',
        pluginId,
        sandboxId: sandbox.id,
        pluginPath,
        success: true,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      await this.auditLogger.logEvent({
        type: 'plugin_load_error',
        pluginId,
        sandboxId: sandbox.id,
        pluginPath,
        error: (error as Error).message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Call plugin method
   */
  async callPluginMethod(pluginId: string, methodName: string, args: any[] = []): Promise<any> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    try {
      const result = await sandbox.callMethod(methodName, args);
      
      await this.auditLogger.logEvent({
        type: 'method_called',
        pluginId,
        sandboxId: sandbox.id,
        methodName,
        argsCount: args.length,
        success: true,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      await this.auditLogger.logEvent({
        type: 'method_call_error',
        pluginId,
        sandboxId: sandbox.id,
        methodName,
        error: (error as Error).message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Grant permission to plugin
   */
  async grantPermission(pluginId: string, permission: Permission): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    await this.permissionManager.grantPermission(pluginId, permission);
    await sandbox.updatePermissions();
    
    await this.auditLogger.logEvent({
      type: 'permission_granted',
      pluginId,
      sandboxId: sandbox.id,
      permission: permission.name,
      scope: permission.scope,
      timestamp: Date.now()
    });
    
    this.emit('permissionGranted', { pluginId, permission });
  }

  /**
   * Revoke permission from plugin
   */
  async revokePermission(pluginId: string, permissionName: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    await this.permissionManager.revokePermission(pluginId, permissionName);
    await sandbox.updatePermissions();
    
    await this.auditLogger.logEvent({
      type: 'permission_revoked',
      pluginId,
      sandboxId: sandbox.id,
      permissionName,
      timestamp: Date.now()
    });
    
    this.emit('permissionRevoked', { pluginId, permissionName });
  }

  /**
   * Get plugin permissions
   */
  async getPluginPermissions(pluginId: string): Promise<Permission[]> {
    return await this.permissionManager.getPluginPermissions(pluginId);
  }

  /**
   * Get sandbox status
   */
  getSandboxStatus(pluginId: string): SandboxStatus | null {
    const sandbox = this.sandboxes.get(pluginId);
    return sandbox ? sandbox.getStatus() : null;
  }

  /**
   * Get all sandbox statuses
   */
  getAllSandboxStatuses(): Record<string, SandboxStatus> {
    const statuses: Record<string, SandboxStatus> = {};
    
    for (const [pluginId, sandbox] of this.sandboxes) {
      statuses[pluginId] = sandbox.getStatus();
    }
    
    return statuses;
  }

  /**
   * Pause sandbox execution
   */
  async pauseSandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    await sandbox.pause();
    
    await this.auditLogger.logEvent({
      type: 'sandbox_paused',
      pluginId,
      sandboxId: sandbox.id,
      timestamp: Date.now()
    });
    
    this.emit('sandboxPaused', { pluginId });
  }

  /**
   * Resume sandbox execution
   */
  async resumeSandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    await sandbox.resume();
    
    await this.auditLogger.logEvent({
      type: 'sandbox_resumed',
      pluginId,
      sandboxId: sandbox.id,
      timestamp: Date.now()
    });
    
    this.emit('sandboxResumed', { pluginId });
  }

  /**
   * Terminate sandbox
   */
  async terminateSandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (!sandbox) {
      throw new Error(`No sandbox found for plugin: ${pluginId}`);
    }
    
    await sandbox.terminate();
    this.sandboxes.delete(pluginId);
    
    await this.auditLogger.logEvent({
      type: 'sandbox_terminated',
      pluginId,
      sandboxId: sandbox.id,
      timestamp: Date.now()
    });
    
    this.emit('sandboxTerminated', { pluginId });
  }

  /**
   * Validate plugin permissions
   */
  private async validatePluginPermissions(pluginId: string, permissions: Permission[]): Promise<void> {
    for (const permission of permissions) {
      if (!this.isPermissionAllowed(permission)) {
        throw new Error(`Permission not allowed: ${permission.name}`);
      }
      
      if (permission.requiresApproval && !await this.isPermissionApproved(pluginId, permission)) {
        throw new Error(`Permission requires approval: ${permission.name}`);
      }
    }
  }

  /**
   * Check if permission is allowed by security policy
   */
  private isPermissionAllowed(permission: Permission): boolean {
    switch (permission.name) {
      case 'network':
        return this.securityPolicy.allowNetworkAccess;
      case 'filesystem':
        return this.securityPolicy.allowFileSystemAccess;
      case 'process':
        return this.securityPolicy.allowProcessSpawn;
      case 'native':
        return this.securityPolicy.allowNativeModules;
      default:
        return true;
    }
  }

  /**
   * Check if permission is approved
   */
  private async isPermissionApproved(pluginId: string, permission: Permission): Promise<boolean> {
    // This would integrate with a user approval system
    // For now, return false for high-risk permissions
    const highRiskPermissions = ['filesystem', 'process', 'native'];
    return !highRiskPermissions.includes(permission.name);
  }

  /**
   * Validate plugin file
   */
  private async validatePluginFile(pluginPath: string): Promise<void> {
    try {
      const stats = await fs.stat(pluginPath);
      
      if (stats.size > this.resourceLimits.maxFileSize) {
        throw new Error(`Plugin file too large: ${stats.size} bytes`);
      }
      
      // Check file extension
      const ext = path.extname(pluginPath).toLowerCase();
      const allowedExtensions = ['.js', '.mjs', '.ts'];
      
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`Invalid plugin file extension: ${ext}`);
      }
      
      // Basic content validation
      const content = await fs.readFile(pluginPath, 'utf8');
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /require\s*\(\s*['"]fs['"]\s*\)/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\.exit/,
        /process\.kill/
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          throw new Error(`Suspicious code pattern detected in plugin`);
        }
      }
      
    } catch (error) {
      throw new Error(`Plugin validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(): Promise<SecurityReport> {
    const sandboxStatuses = this.getAllSandboxStatuses();
    const auditEvents = await this.auditLogger.getRecentEvents(1000);
    
    const report: SecurityReport = {
      reportId: crypto.randomUUID(),
      generatedAt: Date.now(),
      summary: {
        totalSandboxes: this.sandboxes.size,
        activeSandboxes: Object.values(sandboxStatuses).filter(s => s.state === 'running').length,
        pausedSandboxes: Object.values(sandboxStatuses).filter(s => s.state === 'paused').length,
        totalEvents: auditEvents.length,
        securityViolations: auditEvents.filter(e => e.type.includes('violation')).length
      },
      sandboxStatuses,
      recentEvents: auditEvents.slice(0, 50),
      riskAssessment: this.assessSecurityRisks(sandboxStatuses, auditEvents),
      recommendations: this.generateSecurityRecommendations(sandboxStatuses, auditEvents)
    };
    
    return report;
  }

  /**
   * Assess security risks
   */
  private assessSecurityRisks(statuses: Record<string, SandboxStatus>, events: AuditEvent[]): RiskAssessment {
    let riskScore = 0;
    const riskFactors: string[] = [];
    
    // Check for high resource usage
    const highMemoryUsage = Object.values(statuses).filter(s => 
      s.resourceUsage.memoryUsage > this.resourceLimits.maxMemory * 0.8
    ).length;
    
    if (highMemoryUsage > 0) {
      riskScore += 20;
      riskFactors.push(`${highMemoryUsage} sandboxes with high memory usage`);
    }
    
    // Check for permission violations
    const permissionViolations = events.filter(e => 
      e.type === 'permission_violation'
    ).length;
    
    if (permissionViolations > 0) {
      riskScore += permissionViolations * 10;
      riskFactors.push(`${permissionViolations} permission violations`);
    }
    
    // Check for execution errors
    const executionErrors = events.filter(e => 
      e.type === 'execution_error'
    ).length;
    
    if (executionErrors > 10) {
      riskScore += 15;
      riskFactors.push(`High number of execution errors: ${executionErrors}`);
    }
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 60) riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';
    else riskLevel = 'low';
    
    return {
      riskScore,
      riskLevel,
      riskFactors
    };
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(statuses: Record<string, SandboxStatus>, events: AuditEvent[]): string[] {
    const recommendations: string[] = [];
    
    const highMemoryPlugins = Object.entries(statuses).filter(([, status]) => 
      status.resourceUsage.memoryUsage > this.resourceLimits.maxMemory * 0.8
    );
    
    if (highMemoryPlugins.length > 0) {
      recommendations.push(`Review memory usage for plugins: ${highMemoryPlugins.map(([id]) => id).join(', ')}`);
    }
    
    const errorPronePlugins = events
      .filter(e => e.type === 'execution_error')
      .reduce((acc, e) => {
        acc[e.pluginId] = (acc[e.pluginId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const highErrorPlugins = Object.entries(errorPronePlugins)
      .filter(([, count]) => count > 5)
      .map(([pluginId]) => pluginId);
    
    if (highErrorPlugins.length > 0) {
      recommendations.push(`Review error-prone plugins: ${highErrorPlugins.join(', ')}`);
    }
    
    const networkAccessPlugins = Object.entries(statuses).filter(([, status]) => 
      status.permissions.some(p => p.name === 'network')
    );
    
    if (networkAccessPlugins.length > 0) {
      recommendations.push('Monitor network access for plugins with network permissions');
    }
    
    return recommendations;
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Terminate all sandboxes
    const terminationPromises = Array.from(this.sandboxes.keys()).map(pluginId => 
      this.terminateSandbox(pluginId).catch(() => {
        // Ignore errors during cleanup
      })
    );
    
    await Promise.all(terminationPromises);
    
    // Cleanup audit logger
    await this.auditLogger.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * Individual sandbox instance
 */
class SandboxInstance extends EventEmitter {
  public readonly id: string;
  public readonly pluginId: string;
  private config: SandboxConfig;
  private context: vm.Context | null;
  private worker: Worker | null;
  private state: SandboxState;
  private resourceUsage: ResourceUsage;
  private permissions: Permission[];
  private options: SandboxInstanceOptions;
  private startTime: number;

  constructor(id: string, pluginId: string, config: SandboxConfig, options: SandboxInstanceOptions) {
    super();
    
    this.id = id;
    this.pluginId = pluginId;
    this.config = config;
    this.options = options;
    this.context = null;
    this.worker = null;
    this.state = 'initializing';
    this.permissions = config.permissions || [];
    this.startTime = Date.now();
    
    this.resourceUsage = {
      memoryUsage: 0,
      cpuTime: 0,
      networkRequests: 0,
      fileOperations: 0
    };
  }

  /**
   * Initialize sandbox
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.isolationLevel === 'process') {
        await this.initializeWorkerSandbox();
      } else {
        await this.initializeVMSandbox();
      }
      
      this.state = 'ready';
      this.emit('initialized');
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize VM-based sandbox
   */
  private async initializeVMSandbox(): Promise<void> {
    const sandbox = {
      console: this.createSecureConsole(),
      setTimeout: this.createSecureTimeout(),
      setInterval: this.createSecureInterval(),
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      Buffer: Buffer,
      process: this.createSecureProcess(),
      require: this.createSecureRequire(),
      __filename: this.config.filename || 'plugin.js',
      __dirname: path.dirname(this.config.filename || 'plugin.js'),
      global: {},
      exports: {},
      module: { exports: {} }
    };
    
    // Add permitted APIs
    for (const permission of this.permissions) {
      this.addPermittedAPI(sandbox, permission);
    }
    
    this.context = vm.createContext(sandbox, {
      name: `plugin-${this.pluginId}`,
      codeGeneration: {
        strings: false,
        wasm: false
      }
    });
  }

  /**
   * Initialize worker-based sandbox
   */
  private async initializeWorkerSandbox(): Promise<void> {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      const vm = require('vm');
      
      let pluginContext = null;
      
      parentPort.on('message', async (message) => {
        try {
          switch (message.type) {
            case 'execute':
              const result = vm.runInContext(message.code, pluginContext, {
                timeout: ${this.options.resourceLimits.maxCpuTime}
              });
              parentPort.postMessage({ type: 'result', data: result });
              break;
              
            case 'initialize':
              pluginContext = vm.createContext(message.sandbox);
              parentPort.postMessage({ type: 'initialized' });
              break;
              
            default:
              throw new Error('Unknown message type');
          }
        } catch (error) {
          parentPort.postMessage({ type: 'error', error: error.message });
        }
      });
    `;
    
    this.worker = new Worker(workerCode, {
      eval: true,
      resourceLimits: {
        maxOldGenerationSizeMb: Math.floor(this.options.resourceLimits.maxMemory / (1024 * 1024)),
        maxYoungGenerationSizeMb: Math.floor(this.options.resourceLimits.maxMemory / (1024 * 1024) / 4)
      }
    });
    
    // Initialize worker context
    const sandbox = this.createWorkerSandbox();
    
    return new Promise((resolve, reject) => {
      this.worker!.once('message', (message) => {
        if (message.type === 'initialized') {
          resolve();
        } else {
          reject(new Error(message.error));
        }
      });
      
      this.worker!.postMessage({ type: 'initialize', sandbox });
    });
  }

  /**
   * Execute code in sandbox
   */
  async execute(code: string, context?: Record<string, any>): Promise<any> {
    if (this.state !== 'ready' && this.state !== 'running') {
      throw new Error(`Sandbox not ready for execution. State: ${this.state}`);
    }
    
    this.state = 'running';
    
    try {
      let result: any;
      
      if (this.worker) {
        result = await this.executeInWorker(code, context);
      } else if (this.context) {
        result = await this.executeInVM(code, context);
      } else {
        throw new Error('No execution context available');
      }
      
      this.state = 'ready';
      this.updateResourceUsage();
      
      return result;
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Execute in VM context
   */
  private async executeInVM(code: string, context?: Record<string, any>): Promise<any> {
    if (!this.context) {
      throw new Error('VM context not initialized');
    }
    
    // Add context variables
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        this.context[key] = value;
      }
    }
    
    return vm.runInContext(code, this.context, {
      timeout: this.options.resourceLimits.maxCpuTime,
      filename: this.config.filename || 'plugin.js'
    });
  }

  /**
   * Execute in worker
   */
  private async executeInWorker(code: string, context?: Record<string, any>): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, this.options.resourceLimits.maxCpuTime);
      
      this.worker!.once('message', (message) => {
        clearTimeout(timeout);
        
        if (message.type === 'result') {
          resolve(message.data);
        } else {
          reject(new Error(message.error));
        }
      });
      
      this.worker!.postMessage({ type: 'execute', code, context });
    });
  }

  /**
   * Load plugin code
   */
  async loadPlugin(code: string, filename: string): Promise<any> {
    const wrappedCode = `
      (function(exports, require, module, __filename, __dirname) {
        ${code}
      })(exports, require, module, __filename, __dirname);
    `;
    
    return await this.execute(wrappedCode);
  }

  /**
   * Call plugin method
   */
  async callMethod(methodName: string, args: any[] = []): Promise<any> {
    const code = `
      if (typeof ${methodName} === 'function') {
        ${methodName}.apply(this, ${JSON.stringify(args)});
      } else if (exports.${methodName} && typeof exports.${methodName} === 'function') {
        exports.${methodName}.apply(exports, ${JSON.stringify(args)});
      } else {
        throw new Error('Method not found: ${methodName}');
      }
    `;
    
    return await this.execute(code);
  }

  /**
   * Update permissions
   */
  async updatePermissions(): Promise<void> {
    this.permissions = await this.options.permissionManager.getPluginPermissions(this.pluginId);
    
    // Reinitialize context with new permissions
    if (this.context) {
      await this.initializeVMSandbox();
    } else if (this.worker) {
      await this.initializeWorkerSandbox();
    }
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    this.state = 'paused';
    this.emit('paused');
  }

  /**
   * Resume execution
   */
  async resume(): Promise<void> {
    this.state = 'ready';
    this.emit('resumed');
  }

  /**
   * Terminate sandbox
   */
  async terminate(): Promise<void> {
    this.state = 'terminated';
    
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    
    this.context = null;
    this.emit('terminated');
  }

  /**
   * Get sandbox status
   */
  getStatus(): SandboxStatus {
    return {
      id: this.id,
      pluginId: this.pluginId,
      state: this.state,
      uptime: Date.now() - this.startTime,
      resourceUsage: { ...this.resourceUsage },
      permissions: [...this.permissions],
      isolationLevel: this.config.isolationLevel || 'vm'
    };
  }

  /**
   * Create secure console
   */
  private createSecureConsole(): Console {
    return {
      log: (...args) => this.emit('console', { level: 'log', args }),
      error: (...args) => this.emit('console', { level: 'error', args }),
      warn: (...args) => this.emit('console', { level: 'warn', args }),
      info: (...args) => this.emit('console', { level: 'info', args }),
      debug: (...args) => this.emit('console', { level: 'debug', args })
    } as Console;
  }

  /**
   * Create secure setTimeout
   */
  private createSecureTimeout(): typeof setTimeout {
    return (callback: Function, delay: number, ...args: any[]) => {
      if (delay > 30000) { // Max 30 seconds
        throw new Error('Timeout delay too long');
      }
      return setTimeout(callback, delay, ...args);
    };
  }

  /**
   * Create secure setInterval
   */
  private createSecureInterval(): typeof setInterval {
    return (callback: Function, delay: number, ...args: any[]) => {
      if (delay < 100) { // Min 100ms
        throw new Error('Interval delay too short');
      }
      return setInterval(callback, delay, ...args);
    };
  }

  /**
   * Create secure process object
   */
  private createSecureProcess(): Partial<NodeJS.Process> {
    return {
      env: { NODE_ENV: 'sandbox' },
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: () => (Date.now() - this.startTime) / 1000
    };
  }

  /**
   * Create secure require function
   */
  private createSecureRequire(): NodeRequire {
    return ((id: string) => {
      // Check if module is blocked
      if (this.options.securityPolicy.blockedModules.includes(id)) {
        throw new Error(`Module blocked: ${id}`);
      }
      
      // Check if native modules are allowed
      if (!this.options.securityPolicy.allowNativeModules && this.isNativeModule(id)) {
        throw new Error(`Native module not allowed: ${id}`);
      }
      
      // Allow only specific modules
      const allowedModules = ['crypto', 'util', 'path', 'url', 'querystring'];
      if (!allowedModules.includes(id)) {
        throw new Error(`Module not allowed: ${id}`);
      }
      
      return require(id);
    }) as NodeRequire;
  }

  /**
   * Check if module is native
   */
  private isNativeModule(id: string): boolean {
    const nativeModules = [
      'fs', 'path', 'os', 'crypto', 'http', 'https', 'net', 'dgram',
      'child_process', 'cluster', 'worker_threads', 'vm'
    ];
    return nativeModules.includes(id);
  }

  /**
   * Add permitted API to sandbox
   */
  private addPermittedAPI(sandbox: any, permission: Permission): void {
    switch (permission.name) {
      case 'network':
        if (this.options.securityPolicy.allowNetworkAccess) {
          sandbox.fetch = this.createSecureFetch();
        }
        break;
      case 'filesystem':
        if (this.options.securityPolicy.allowFileSystemAccess) {
          sandbox.fs = this.createSecureFS();
        }
        break;
      // Add more APIs as needed
    }
  }

  /**
   * Create secure fetch function
   */
  private createSecureFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      this.resourceUsage.networkRequests++;
      
      if (this.resourceUsage.networkRequests > this.options.resourceLimits.maxNetworkRequests) {
        throw new Error('Network request limit exceeded');
      }
      
      // Validate URL against trusted domains
      const url = typeof input === 'string' ? input : input.toString();
      const urlObj = new URL(url);
      
      if (!this.options.securityPolicy.trustedDomains.some(domain => 
        urlObj.hostname.endsWith(domain)
      )) {
        throw new Error(`Domain not trusted: ${urlObj.hostname}`);
      }
      
      return fetch(input, init);
    };
  }

  /**
   * Create secure filesystem API
   */
  private createSecureFS(): any {
    return {
      readFile: async (path: string) => {
        this.resourceUsage.fileOperations++;
        
        if (this.resourceUsage.fileOperations > this.options.resourceLimits.maxFileOperations) {
          throw new Error('File operation limit exceeded');
        }
        
        // Validate path
        if (!this.isPathAllowed(path)) {
          throw new Error(`Path not allowed: ${path}`);
        }
        
        return fs.readFile(path, 'utf8');
      }
    };
  }

  /**
   * Check if file path is allowed
   */
  private isPathAllowed(filePath: string): boolean {
    const allowedPaths = ['/tmp', '/var/tmp'];
    const resolvedPath = path.resolve(filePath);
    
    return allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
  }

  /**
   * Create worker sandbox context
   */
  private createWorkerSandbox(): any {
    const sandbox = {
      console: this.createSecureConsole(),
      setTimeout: this.createSecureTimeout(),
      setInterval: this.createSecureInterval(),
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      Buffer: Buffer,
      process: this.createSecureProcess(),
      require: this.createSecureRequire(),
      global: {},
      exports: {},
      module: { exports: {} }
    };
    
    // Add permitted APIs
    for (const permission of this.permissions) {
      this.addPermittedAPI(sandbox, permission);
    }
    
    return sandbox;
  }

  /**
   * Update resource usage metrics
   */
  private updateResourceUsage(): void {
    if (this.worker) {
      // Get worker resource usage
      const usage = this.worker.resourceLimits;
      this.resourceUsage.memoryUsage = usage?.maxOldGenerationSizeMb || 0;
    } else {
      // Estimate VM resource usage
      this.resourceUsage.memoryUsage = process.memoryUsage().heapUsed;
    }
    
    this.resourceUsage.cpuTime = Date.now() - this.startTime;
  }
}

/**
 * Permission manager
 */
class PermissionManager {
  private permissions: Map<string, Permission[]>;

  constructor(defaultPermissions?: Permission[]) {
    this.permissions = new Map();
  }

  async grantPermission(pluginId: string, permission: Permission): Promise<void> {
    const pluginPermissions = this.permissions.get(pluginId) || [];
    
    // Check if permission already exists
    const existingIndex = pluginPermissions.findIndex(p => p.name === permission.name);
    
    if (existingIndex >= 0) {
      pluginPermissions[existingIndex] = permission;
    } else {
      pluginPermissions.push(permission);
    }
    
    this.permissions.set(pluginId, pluginPermissions);
  }

  async revokePermission(pluginId: string, permissionName: string): Promise<void> {
    const pluginPermissions = this.permissions.get(pluginId) || [];
    const filteredPermissions = pluginPermissions.filter(p => p.name !== permissionName);
    
    this.permissions.set(pluginId, filteredPermissions);
  }

  async getPluginPermissions(pluginId: string): Promise<Permission[]> {
    return this.permissions.get(pluginId) || [];
  }
}

/**
 * Sandbox audit logger
 */
class SandboxAuditLogger {
  private auditPath: string;
  private events: AuditEvent[];

  constructor(auditPath?: string) {
    this.auditPath = auditPath || path.join(process.cwd(), 'logs', 'sandbox-audit');
    this.events = [];
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.auditPath, { recursive: true });
  }

  async logEvent(event: AuditEvent): Promise<void> {
    this.events.push(event);
    
    // Write to file periodically
    if (this.events.length >= 100) {
      await this.flushEvents();
    }
  }

  async getRecentEvents(limit: number): Promise<AuditEvent[]> {
    return this.events.slice(-limit);
  }

  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;
    
    const logFile = path.join(this.auditPath, `audit-${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(this.events, null, 2));
    
    this.events = [];
  }

  async destroy(): Promise<void> {
    await this.flushEvents();
  }
}

// Types and interfaces
export interface PluginSandboxOptions {
  maxMemory?: number;
  maxCpuTime?: number;
  maxFileSize?: number;
  maxNetworkRequests?: number;
  maxFileOperations?: number;
  allowNetworkAccess?: boolean;
  allowFileSystemAccess?: boolean;
  allowProcessSpawn?: boolean;
  allowNativeModules?: boolean;
  trustedDomains?: string[];
  blockedModules?: string[];
  permissions?: Permission[];
  resourceLimits?: Partial<ResourceLimits>;
  securityPolicy?: Partial<SecurityPolicy>;
  auditPath?: string;
}

export interface SandboxConfig {
  permissions?: Permission[];
  isolationLevel?: 'vm' | 'process';
  filename?: string;
  timeout?: number;
}

export interface Permission {
  name: string;
  scope?: string[];
  requiresApproval?: boolean;
  metadata?: Record<string, any>;
}

export interface ResourceLimits {
  maxMemory: number;
  maxCpuTime: number;
  maxFileSize: number;
  maxNetworkRequests: number;
  maxFileOperations: number;
}

export interface SecurityPolicy {
  allowNetworkAccess: boolean;
  allowFileSystemAccess: boolean;
  allowProcessSpawn: boolean;
  allowNativeModules: boolean;
  trustedDomains: string[];
  blockedModules: string[];
}

export interface ResourceUsage {
  memoryUsage: number;
  cpuTime: number;
  networkRequests: number;
  fileOperations: number;
}

export interface SandboxStatus {
  id: string;
  pluginId: string;
  state: SandboxState;
  uptime: number;
  resourceUsage: ResourceUsage;
  permissions: Permission[];
  isolationLevel: 'vm' | 'process';
}

export interface AuditEvent {
  type: string;
  pluginId: string;
  sandboxId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface SecurityReport {
  reportId: string;
  generatedAt: number;
  summary: {
    totalSandboxes: number;
    activeSandboxes: number;
    pausedSandboxes: number;
    totalEvents: number;
    securityViolations: number;
  };
  sandboxStatuses: Record<string, SandboxStatus>;
  recentEvents: AuditEvent[];
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
}

interface SandboxInstanceOptions {
  resourceLimits: ResourceLimits;
  securityPolicy: SecurityPolicy;
  permissionManager: PermissionManager;
  auditLogger: SandboxAuditLogger;
}

export type SandboxState = 'initializing' | 'ready' | 'running' | 'paused' | 'error' | 'terminated';