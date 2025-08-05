import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Model versioning and deployment system
 * Handles model lifecycle, versioning, and deployment management
 */
export class ModelVersioning extends EventEmitter {
  private versioningConfig: VersioningConfig;
  private modelRegistry: Map<string, ModelVersion>;
  private deploymentTargets: Map<string, DeploymentTarget>;
  private versionHistory: Map<string, ModelVersion[]>;

  constructor(options: ModelVersioningOptions = {}) {
    super();
    
    this.versioningConfig = {
      registryPath: options.registryPath || path.join(process.cwd(), 'models', 'registry'),
      maxVersionsPerModel: options.maxVersionsPerModel || 10,
      autoCleanup: options.autoCleanup !== false,
      compressionEnabled: options.compressionEnabled !== false,
      backupEnabled: options.backupEnabled !== false,
      ...options.versioningConfig
    };
    
    this.modelRegistry = new Map();
    this.deploymentTargets = new Map();
    this.versionHistory = new Map();
    
    this.initialize();
  }

  /**
   * Initialize model versioning system
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.versioningConfig.registryPath, { recursive: true });
      
      // Load existing registry
      await this.loadRegistry();
      
      // Initialize deployment targets
      await this.initializeDeploymentTargets();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize model versioning: ${(error as Error).message}`);
    }
  }

  /**
   * Register new model version
   */
  async registerModelVersion(config: ModelRegistrationConfig): Promise<string> {
    const versionId = crypto.randomUUID();
    
    // Validate model
    await this.validateModel(config.modelPath);
    
    // Calculate model hash
    const modelHash = await this.calculateModelHash(config.modelPath);
    
    // Check for duplicate
    const existingVersion = this.findVersionByHash(config.modelName, modelHash);
    if (existingVersion) {
      throw new Error(`Model version already exists: ${existingVersion.versionId}`);
    }
    
    // Create version metadata
    const version: ModelVersion = {
      versionId,
      modelName: config.modelName,
      version: config.version || this.generateVersionNumber(config.modelName),
      modelPath: config.modelPath,
      modelHash,
      baseModel: config.baseModel,
      taskType: config.taskType,
      trainingConfig: config.trainingConfig,
      evaluationResults: config.evaluationResults,
      metadata: {
        ...config.metadata,
        registeredAt: Date.now(),
        registeredBy: config.registeredBy || 'system',
        modelSize: await this.getModelSize(config.modelPath),
        parameters: config.parameters
      },
      status: 'registered',
      deployments: [],
      tags: config.tags || []
    };
    
    // Store version
    this.modelRegistry.set(versionId, version);
    
    // Update version history
    this.addToVersionHistory(config.modelName, version);
    
    // Save registry
    await this.saveRegistry();
    
    // Cleanup old versions if needed
    if (this.versioningConfig.autoCleanup) {
      await this.cleanupOldVersions(config.modelName);
    }
    
    this.emit('versionRegistered', { versionId, version });
    return versionId;
  }

  /**
   * Get model version
   */
  async getModelVersion(versionId: string): Promise<ModelVersion | null> {
    return this.modelRegistry.get(versionId) || null;
  }

  /**
   * List model versions
   */
  async listModelVersions(modelName?: string): Promise<ModelVersion[]> {
    const versions = Array.from(this.modelRegistry.values());
    
    if (modelName) {
      return versions.filter(v => v.modelName === modelName);
    }
    
    return versions;
  }

  /**
   * Get latest version of model
   */
  async getLatestVersion(modelName: string): Promise<ModelVersion | null> {
    const versions = await this.listModelVersions(modelName);
    
    if (versions.length === 0) {
      return null;
    }
    
    // Sort by registration time and return latest
    return versions.sort((a, b) => b.metadata.registeredAt - a.metadata.registeredAt)[0];
  }

  /**
   * Deploy model version
   */
  async deployModel(versionId: string, deploymentConfig: ModelDeploymentConfig): Promise<string> {
    const version = await this.getModelVersion(versionId);
    if (!version) {
      throw new Error(`Model version not found: ${versionId}`);
    }
    
    const deploymentTarget = this.deploymentTargets.get(deploymentConfig.targetId);
    if (!deploymentTarget) {
      throw new Error(`Deployment target not found: ${deploymentConfig.targetId}`);
    }
    
    const deploymentId = crypto.randomUUID();
    
    try {
      // Prepare model for deployment
      const preparedModelPath = await this.prepareModelForDeployment(
        version,
        deploymentTarget,
        deploymentConfig
      );
      
      // Execute deployment
      await this.executeDeployment(
        preparedModelPath,
        deploymentTarget,
        deploymentConfig,
        deploymentId
      );
      
      // Create deployment record
      const deployment: ModelDeployment = {
        deploymentId,
        versionId,
        targetId: deploymentConfig.targetId,
        environment: deploymentConfig.environment,
        config: deploymentConfig,
        status: 'deployed',
        deployedAt: Date.now(),
        deployedBy: deploymentConfig.deployedBy || 'system',
        endpoint: deploymentTarget.generateEndpoint(deploymentId),
        healthCheck: {
          status: 'healthy',
          lastCheck: Date.now(),
          responseTime: 0
        }
      };
      
      // Update version with deployment info
      version.deployments.push(deployment);
      version.status = 'deployed';
      
      await this.saveRegistry();
      
      this.emit('modelDeployed', { deploymentId, versionId, deployment });
      return deploymentId;
      
    } catch (error) {
      this.emit('deploymentFailed', { deploymentId, versionId, error: error.message });
      throw error;
    }
  }

  /**
   * Undeploy model
   */
  async undeployModel(deploymentId: string): Promise<void> {
    // Find deployment
    let targetVersion: ModelVersion | null = null;
    let targetDeployment: ModelDeployment | null = null;
    
    for (const version of this.modelRegistry.values()) {
      const deployment = version.deployments.find(d => d.deploymentId === deploymentId);
      if (deployment) {
        targetVersion = version;
        targetDeployment = deployment;
        break;
      }
    }
    
    if (!targetVersion || !targetDeployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const deploymentTarget = this.deploymentTargets.get(targetDeployment.targetId);
    if (!deploymentTarget) {
      throw new Error(`Deployment target not found: ${targetDeployment.targetId}`);
    }
    
    try {
      // Execute undeployment
      await deploymentTarget.undeploy(deploymentId);
      
      // Update deployment status
      targetDeployment.status = 'undeployed';
      targetDeployment.undeployedAt = Date.now();
      
      // Update version status if no active deployments
      const activeDeployments = targetVersion.deployments.filter(d => d.status === 'deployed');
      if (activeDeployments.length === 0) {
        targetVersion.status = 'registered';
      }
      
      await this.saveRegistry();
      
      this.emit('modelUndeployed', { deploymentId, versionId: targetVersion.versionId });
      
    } catch (error) {
      this.emit('undeploymentFailed', { deploymentId, error: error.message });
      throw error;
    }
  }

  /**
   * Promote model version
   */
  async promoteVersion(versionId: string, environment: string): Promise<void> {
    const version = await this.getModelVersion(versionId);
    if (!version) {
      throw new Error(`Model version not found: ${versionId}`);
    }
    
    // Find current production deployment
    const currentProduction = this.findProductionDeployment(version.modelName, environment);
    
    // Deploy new version
    const deploymentConfig: ModelDeploymentConfig = {
      targetId: 'production',
      environment,
      replicas: currentProduction?.config.replicas || 1,
      resources: currentProduction?.config.resources || { cpu: '1', memory: '2Gi' },
      deployedBy: 'promotion-system'
    };
    
    const newDeploymentId = await this.deployModel(versionId, deploymentConfig);
    
    // Undeploy old version if exists
    if (currentProduction) {
      await this.undeployModel(currentProduction.deploymentId);
    }
    
    // Update version tags
    version.tags = version.tags.filter(tag => tag !== `production-${environment}`);
    version.tags.push(`production-${environment}`);
    
    await this.saveRegistry();
    
    this.emit('versionPromoted', { 
      versionId, 
      environment, 
      newDeploymentId,
      previousDeploymentId: currentProduction?.deploymentId 
    });
  }

  /**
   * Rollback to previous version
   */
  async rollbackVersion(modelName: string, environment: string): Promise<void> {
    const versions = await this.listModelVersions(modelName);
    const productionVersions = versions
      .filter(v => v.tags.includes(`production-${environment}`))
      .sort((a, b) => b.metadata.registeredAt - a.metadata.registeredAt);
    
    if (productionVersions.length < 2) {
      throw new Error('No previous version available for rollback');
    }
    
    const previousVersion = productionVersions[1];
    
    // Promote previous version
    await this.promoteVersion(previousVersion.versionId, environment);
    
    this.emit('versionRolledBack', { 
      modelName, 
      environment, 
      rolledBackTo: previousVersion.versionId 
    });
  }

  /**
   * Archive old model version
   */
  async archiveVersion(versionId: string): Promise<void> {
    const version = await this.getModelVersion(versionId);
    if (!version) {
      throw new Error(`Model version not found: ${versionId}`);
    }
    
    // Check if version has active deployments
    const activeDeployments = version.deployments.filter(d => d.status === 'deployed');
    if (activeDeployments.length > 0) {
      throw new Error('Cannot archive version with active deployments');
    }
    
    // Archive model files if backup is enabled
    if (this.versioningConfig.backupEnabled) {
      await this.backupModelFiles(version);
    }
    
    // Update version status
    version.status = 'archived';
    version.metadata.archivedAt = Date.now();
    
    await this.saveRegistry();
    
    this.emit('versionArchived', { versionId });
  }

  /**
   * Delete model version
   */
  async deleteVersion(versionId: string, force: boolean = false): Promise<void> {
    const version = await this.getModelVersion(versionId);
    if (!version) {
      throw new Error(`Model version not found: ${versionId}`);
    }
    
    // Check if version has active deployments
    const activeDeployments = version.deployments.filter(d => d.status === 'deployed');
    if (activeDeployments.length > 0 && !force) {
      throw new Error('Cannot delete version with active deployments. Use force=true to override.');
    }
    
    // Undeploy all active deployments if force is true
    if (force) {
      for (const deployment of activeDeployments) {
        await this.undeployModel(deployment.deploymentId);
      }
    }
    
    // Remove from registry
    this.modelRegistry.delete(versionId);
    
    // Remove from version history
    this.removeFromVersionHistory(version.modelName, versionId);
    
    // Delete model files
    try {
      await fs.rm(version.modelPath, { recursive: true, force: true });
    } catch (error) {
      // Log but don't fail if file deletion fails
      this.emit('warning', `Failed to delete model files: ${(error as Error).message}`);
    }
    
    await this.saveRegistry();
    
    this.emit('versionDeleted', { versionId });
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(versionId: string): Promise<ModelMetrics> {
    const version = await this.getModelVersion(versionId);
    if (!version) {
      throw new Error(`Model version not found: ${versionId}`);
    }
    
    const metrics: ModelMetrics = {
      versionId,
      modelName: version.modelName,
      version: version.version,
      evaluationResults: version.evaluationResults,
      deploymentMetrics: {},
      usage: {
        totalRequests: 0,
        averageLatency: 0,
        errorRate: 0,
        throughput: 0
      },
      lastUpdated: Date.now()
    };
    
    // Collect metrics from active deployments
    for (const deployment of version.deployments) {
      if (deployment.status === 'deployed') {
        const deploymentTarget = this.deploymentTargets.get(deployment.targetId);
        if (deploymentTarget) {
          const deploymentMetrics = await deploymentTarget.getMetrics(deployment.deploymentId);
          metrics.deploymentMetrics[deployment.deploymentId] = deploymentMetrics;
          
          // Aggregate usage metrics
          metrics.usage.totalRequests += deploymentMetrics.requests || 0;
          metrics.usage.averageLatency = Math.max(metrics.usage.averageLatency, deploymentMetrics.latency || 0);
          metrics.usage.errorRate = Math.max(metrics.usage.errorRate, deploymentMetrics.errorRate || 0);
          metrics.usage.throughput += deploymentMetrics.throughput || 0;
        }
      }
    }
    
    return metrics;
  }

  /**
   * Compare model versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison> {
    const version1 = await this.getModelVersion(versionId1);
    const version2 = await this.getModelVersion(versionId2);
    
    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }
    
    const comparison: VersionComparison = {
      version1: {
        versionId: version1.versionId,
        version: version1.version,
        registeredAt: version1.metadata.registeredAt
      },
      version2: {
        versionId: version2.versionId,
        version: version2.version,
        registeredAt: version2.metadata.registeredAt
      },
      differences: {
        baseModel: version1.baseModel !== version2.baseModel,
        taskType: version1.taskType !== version2.taskType,
        modelSize: version1.metadata.modelSize !== version2.metadata.modelSize,
        parameters: version1.metadata.parameters !== version2.metadata.parameters
      },
      performanceComparison: this.comparePerformance(version1, version2),
      recommendation: this.generateComparisonRecommendation(version1, version2)
    };
    
    return comparison;
  }

  /**
   * Private helper methods
   */
  private async validateModel(modelPath: string): Promise<void> {
    try {
      const stats = await fs.stat(modelPath);
      if (!stats.isDirectory() && !stats.isFile()) {
        throw new Error('Model path must be a file or directory');
      }
    } catch (error) {
      throw new Error(`Invalid model path: ${modelPath}`);
    }
  }

  private async calculateModelHash(modelPath: string): Promise<string> {
    // Simplified hash calculation - would use proper model file hashing
    const stats = await fs.stat(modelPath);
    return crypto.createHash('sha256')
      .update(`${modelPath}-${stats.size}-${stats.mtime.getTime()}`)
      .digest('hex');
  }

  private findVersionByHash(modelName: string, hash: string): ModelVersion | null {
    for (const version of this.modelRegistry.values()) {
      if (version.modelName === modelName && version.modelHash === hash) {
        return version;
      }
    }
    return null;
  }

  private generateVersionNumber(modelName: string): string {
    const versions = Array.from(this.modelRegistry.values())
      .filter(v => v.modelName === modelName)
      .map(v => v.version)
      .sort();
    
    if (versions.length === 0) {
      return '1.0.0';
    }
    
    // Simple version increment
    const lastVersion = versions[versions.length - 1];
    const parts = lastVersion.split('.').map(Number);
    parts[2]++; // Increment patch version
    
    return parts.join('.');
  }

  private async getModelSize(modelPath: string): Promise<number> {
    const stats = await fs.stat(modelPath);
    return stats.size;
  }

  private addToVersionHistory(modelName: string, version: ModelVersion): void {
    if (!this.versionHistory.has(modelName)) {
      this.versionHistory.set(modelName, []);
    }
    
    const history = this.versionHistory.get(modelName)!;
    history.push(version);
    
    // Sort by registration time
    history.sort((a, b) => b.metadata.registeredAt - a.metadata.registeredAt);
  }

  private removeFromVersionHistory(modelName: string, versionId: string): void {
    const history = this.versionHistory.get(modelName);
    if (history) {
      const index = history.findIndex(v => v.versionId === versionId);
      if (index >= 0) {
        history.splice(index, 1);
      }
    }
  }

  private async cleanupOldVersions(modelName: string): Promise<void> {
    const versions = await this.listModelVersions(modelName);
    const sortedVersions = versions.sort((a, b) => b.metadata.registeredAt - a.metadata.registeredAt);
    
    if (sortedVersions.length > this.versioningConfig.maxVersionsPerModel) {
      const versionsToCleanup = sortedVersions.slice(this.versioningConfig.maxVersionsPerModel);
      
      for (const version of versionsToCleanup) {
        // Only cleanup versions without active deployments
        const activeDeployments = version.deployments.filter(d => d.status === 'deployed');
        if (activeDeployments.length === 0) {
          await this.archiveVersion(version.versionId);
        }
      }
    }
  }

  private async loadRegistry(): Promise<void> {
    try {
      const registryFile = path.join(this.versioningConfig.registryPath, 'registry.json');
      const content = await fs.readFile(registryFile, 'utf8');
      const data = JSON.parse(content);
      
      // Load model versions
      for (const versionData of data.versions || []) {
        this.modelRegistry.set(versionData.versionId, versionData);
        this.addToVersionHistory(versionData.modelName, versionData);
      }
      
    } catch (error) {
      // Registry doesn't exist yet, start fresh
    }
  }

  private async saveRegistry(): Promise<void> {
    const registryData = {
      versions: Array.from(this.modelRegistry.values()),
      lastUpdated: Date.now()
    };
    
    const registryFile = path.join(this.versioningConfig.registryPath, 'registry.json');
    await fs.writeFile(registryFile, JSON.stringify(registryData, null, 2));
  }

  private async initializeDeploymentTargets(): Promise<void> {
    // Initialize local deployment target
    this.deploymentTargets.set('local', new LocalDeploymentTarget());
    
    // Initialize cloud deployment targets
    this.deploymentTargets.set('production', new CloudDeploymentTarget('production'));
    this.deploymentTargets.set('staging', new CloudDeploymentTarget('staging'));
    
    // Initialize all targets
    for (const [id, target] of this.deploymentTargets) {
      await target.initialize();
    }
  }

  private async prepareModelForDeployment(
    version: ModelVersion,
    target: DeploymentTarget,
    config: ModelDeploymentConfig
  ): Promise<string> {
    // Prepare model based on target requirements
    return await target.prepareModel(version.modelPath, config);
  }

  private async executeDeployment(
    modelPath: string,
    target: DeploymentTarget,
    config: ModelDeploymentConfig,
    deploymentId: string
  ): Promise<void> {
    await target.deploy(modelPath, config, deploymentId);
  }

  private findProductionDeployment(modelName: string, environment: string): ModelDeployment | null {
    for (const version of this.modelRegistry.values()) {
      if (version.modelName === modelName) {
        const deployment = version.deployments.find(d => 
          d.status === 'deployed' && 
          d.environment === environment &&
          version.tags.includes(`production-${environment}`)
        );
        if (deployment) {
          return deployment;
        }
      }
    }
    return null;
  }

  private async backupModelFiles(version: ModelVersion): Promise<void> {
    const backupDir = path.join(this.versioningConfig.registryPath, 'backups', version.versionId);
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copy model files to backup location
    // This would use proper file copying in production
    this.emit('modelBackedUp', { versionId: version.versionId, backupPath: backupDir });
  }

  private comparePerformance(version1: ModelVersion, version2: ModelVersion): any {
    // Compare evaluation results
    const eval1 = version1.evaluationResults;
    const eval2 = version2.evaluationResults;
    
    if (!eval1 || !eval2) {
      return { comparison: 'insufficient_data' };
    }
    
    return {
      overallScore: {
        version1: eval1.overallScore,
        version2: eval2.overallScore,
        winner: eval1.overallScore > eval2.overallScore ? 'version1' : 'version2'
      },
      metrics: {
        // Compare specific metrics
      }
    };
  }

  private generateComparisonRecommendation(version1: ModelVersion, version2: ModelVersion): string {
    const perf = this.comparePerformance(version1, version2);
    
    if (perf.comparison === 'insufficient_data') {
      return 'Insufficient evaluation data to make recommendation';
    }
    
    if (perf.overallScore.winner === 'version1') {
      return `Version ${version1.version} performs better overall`;
    } else {
      return `Version ${version2.version} performs better overall`;
    }
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Cleanup deployment targets
    for (const [id, target] of this.deploymentTargets) {
      await target.destroy();
    }
    
    this.removeAllListeners();
  }
}

/**
 * Base deployment target class
 */
abstract class DeploymentTarget {
  abstract initialize(): Promise<void>;
  abstract deploy(modelPath: string, config: ModelDeploymentConfig, deploymentId: string): Promise<void>;
  abstract undeploy(deploymentId: string): Promise<void>;
  abstract prepareModel(modelPath: string, config: ModelDeploymentConfig): Promise<string>;
  abstract generateEndpoint(deploymentId: string): string;
  abstract getMetrics(deploymentId: string): Promise<any>;
  abstract destroy(): Promise<void>;
}

/**
 * Local deployment target
 */
class LocalDeploymentTarget extends DeploymentTarget {
  private deployments: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    // Initialize local deployment environment
  }

  async deploy(modelPath: string, config: ModelDeploymentConfig, deploymentId: string): Promise<void> {
    // Mock local deployment
    this.deployments.set(deploymentId, {
      modelPath,
      config,
      startedAt: Date.now()
    });
  }

  async undeploy(deploymentId: string): Promise<void> {
    this.deployments.delete(deploymentId);
  }

  async prepareModel(modelPath: string, config: ModelDeploymentConfig): Promise<string> {
    // No preparation needed for local deployment
    return modelPath;
  }

  generateEndpoint(deploymentId: string): string {
    return `http://localhost:8080/models/${deploymentId}`;
  }

  async getMetrics(deploymentId: string): Promise<any> {
    return {
      requests: Math.floor(Math.random() * 1000),
      latency: Math.random() * 100 + 50,
      errorRate: Math.random() * 0.05,
      throughput: Math.random() * 100 + 10
    };
  }

  async destroy(): Promise<void> {
    this.deployments.clear();
  }
}

/**
 * Cloud deployment target
 */
class CloudDeploymentTarget extends DeploymentTarget {
  private environment: string;
  private deployments: Map<string, any> = new Map();

  constructor(environment: string) {
    super();
    this.environment = environment;
  }

  async initialize(): Promise<void> {
    // Initialize cloud deployment environment
  }

  async deploy(modelPath: string, config: ModelDeploymentConfig, deploymentId: string): Promise<void> {
    // Mock cloud deployment
    this.deployments.set(deploymentId, {
      modelPath,
      config,
      environment: this.environment,
      startedAt: Date.now()
    });
  }

  async undeploy(deploymentId: string): Promise<void> {
    this.deployments.delete(deploymentId);
  }

  async prepareModel(modelPath: string, config: ModelDeploymentConfig): Promise<string> {
    // Prepare model for cloud deployment (containerization, etc.)
    return modelPath;
  }

  generateEndpoint(deploymentId: string): string {
    return `https://api.soyume.ai/${this.environment}/models/${deploymentId}`;
  }

  async getMetrics(deploymentId: string): Promise<any> {
    return {
      requests: Math.floor(Math.random() * 10000),
      latency: Math.random() * 200 + 100,
      errorRate: Math.random() * 0.02,
      throughput: Math.random() * 500 + 50
    };
  }

  async destroy(): Promise<void> {
    this.deployments.clear();
  }
}

// Types and interfaces
export interface ModelVersioningOptions {
  registryPath?: string;
  maxVersionsPerModel?: number;
  autoCleanup?: boolean;
  compressionEnabled?: boolean;
  backupEnabled?: boolean;
  versioningConfig?: Partial<VersioningConfig>;
}

export interface VersioningConfig {
  registryPath: string;
  maxVersionsPerModel: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  backupEnabled: boolean;
}

export interface ModelRegistrationConfig {
  modelName: string;
  version?: string;
  modelPath: string;
  baseModel: string;
  taskType: string;
  trainingConfig?: any;
  evaluationResults?: any;
  parameters?: number;
  metadata?: Record<string, any>;
  tags?: string[];
  registeredBy?: string;
}

export interface ModelVersion {
  versionId: string;
  modelName: string;
  version: string;
  modelPath: string;
  modelHash: string;
  baseModel: string;
  taskType: string;
  trainingConfig?: any;
  evaluationResults?: any;
  metadata: {
    registeredAt: number;
    registeredBy: string;
    modelSize: number;
    parameters?: number;
    archivedAt?: number;
    [key: string]: any;
  };
  status: 'registered' | 'deployed' | 'archived';
  deployments: ModelDeployment[];
  tags: string[];
}

export interface ModelDeploymentConfig {
  targetId: string;
  environment: string;
  replicas?: number;
  resources?: {
    cpu: string;
    memory: string;
    gpu?: string;
  };
  scaling?: {
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
  };
  deployedBy?: string;
}

export interface ModelDeployment {
  deploymentId: string;
  versionId: string;
  targetId: string;
  environment: string;
  config: ModelDeploymentConfig;
  status: 'deployed' | 'undeployed' | 'failed';
  deployedAt: number;
  deployedBy: string;
  undeployedAt?: number;
  endpoint: string;
  healthCheck: {
    status: 'healthy' | 'unhealthy';
    lastCheck: number;
    responseTime: number;
  };
}

export interface ModelMetrics {
  versionId: string;
  modelName: string;
  version: string;
  evaluationResults?: any;
  deploymentMetrics: Record<string, any>;
  usage: {
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
    throughput: number;
  };
  lastUpdated: number;
}

export interface VersionComparison {
  version1: {
    versionId: string;
    version: string;
    registeredAt: number;
  };
  version2: {
    versionId: string;
    version: string;
    registeredAt: number;
  };
  differences: {
    baseModel: boolean;
    taskType: boolean;
    modelSize: boolean;
    parameters: boolean;
  };
  performanceComparison: any;
  recommendation: string;
}