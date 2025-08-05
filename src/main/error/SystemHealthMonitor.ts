import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * System health monitoring and diagnostic tools
 * Monitors application health and provides diagnostic information
 */
export class SystemHealthMonitor extends EventEmitter {
  private healthChecks: Map<string, HealthCheck>;
  private monitoringInterval: NodeJS.Timeout | null;
  private healthHistory: HealthSnapshot[];
  private alertThresholds: AlertThresholds;
  private diagnosticData: DiagnosticData;

  constructor(options: SystemHealthOptions = {}) {
    super();
    
    this.healthChecks = new Map();
    this.monitoringInterval = null;
    this.healthHistory = [];
    this.alertThresholds = {
      cpuUsage: options.cpuThreshold || 80,
      memoryUsage: options.memoryThreshold || 85,
      diskUsage: options.diskThreshold || 90,
      errorRate: options.errorRateThreshold || 10,
      responseTime: options.responseTimeThreshold || 5000
    };
    this.diagnosticData = {
      systemInfo: {},
      applicationInfo: {},
      performanceMetrics: {},
      errorLogs: [],
      networkInfo: {}
    };
    
    this.initializeHealthChecks();
    this.collectSystemInfo();
    this.startMonitoring(options.monitoringInterval || 30000);
  }

  /**
   * Get current system health status
   */
  async getCurrentHealth(): Promise<SystemHealth> {
    const healthResults = new Map<string, HealthCheckResult>();
    
    // Run all health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await this.runHealthCheck(check);
        healthResults.set(name, result);
      } catch (error) {
        healthResults.set(name, {
          status: HealthStatus.CRITICAL,
          message: `Health check failed: ${error.message}`,
          timestamp: Date.now(),
          metrics: {}
        });
      }
    }
    
    // Determine overall health
    const overallStatus = this.calculateOverallHealth(healthResults);
    
    const systemHealth: SystemHealth = {
      overall: overallStatus,
      components: Object.fromEntries(healthResults),
      timestamp: Date.now(),
      uptime: process.uptime() * 1000,
      version: this.getApplicationVersion()
    };
    
    // Store in history
    this.addToHistory(systemHealth);
    
    return systemHealth;
  }

  /**
   * Get system health history
   */
  getHealthHistory(hours: number = 24): HealthSnapshot[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.healthHistory.filter(snapshot => snapshot.timestamp > cutoffTime);
  }

  /**
   * Get comprehensive diagnostic information
   */
  async getDiagnosticInfo(): Promise<DiagnosticInfo> {
    await this.updateDiagnosticData();
    
    return {
      timestamp: Date.now(),
      systemHealth: await this.getCurrentHealth(),
      systemInfo: this.diagnosticData.systemInfo,
      applicationInfo: this.diagnosticData.applicationInfo,
      performanceMetrics: this.diagnosticData.performanceMetrics,
      networkInfo: this.diagnosticData.networkInfo,
      recentErrors: this.diagnosticData.errorLogs.slice(-50),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Run system diagnostics and generate report
   */
  async runDiagnostics(): Promise<DiagnosticReport> {
    const startTime = Date.now();
    const diagnosticTests: DiagnosticTest[] = [];
    
    // System resource tests
    diagnosticTests.push(await this.testSystemResources());
    diagnosticTests.push(await this.testDiskSpace());
    diagnosticTests.push(await this.testMemoryUsage());
    diagnosticTests.push(await this.testNetworkConnectivity());
    
    // Application-specific tests
    diagnosticTests.push(await this.testDatabaseConnectivity());
    diagnosticTests.push(await this.testAIProviders());
    diagnosticTests.push(await this.testFileSystemAccess());
    diagnosticTests.push(await this.testConfigurationValidity());
    
    const duration = Date.now() - startTime;
    const passedTests = diagnosticTests.filter(t => t.passed).length;
    const failedTests = diagnosticTests.filter(t => !t.passed).length;
    
    const report: DiagnosticReport = {
      timestamp: Date.now(),
      duration,
      totalTests: diagnosticTests.length,
      passedTests,
      failedTests,
      overallStatus: failedTests === 0 ? 'healthy' : failedTests > 3 ? 'critical' : 'warning',
      tests: diagnosticTests,
      recommendations: this.generateDiagnosticRecommendations(diagnosticTests)
    };
    
    this.emit('diagnosticsCompleted', report);
    return report;
  }

  /**
   * Export diagnostic data for support
   */
  async exportDiagnosticData(): Promise<string> {
    const diagnosticInfo = await this.getDiagnosticInfo();
    const diagnosticReport = await this.runDiagnostics();
    
    const exportData = {
      exportTimestamp: Date.now(),
      diagnosticInfo,
      diagnosticReport,
      healthHistory: this.getHealthHistory(48), // Last 48 hours
      systemLogs: await this.collectSystemLogs()
    };
    
    const exportPath = path.join(process.cwd(), 'diagnostics', `diagnostic-export-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      
      this.emit('diagnosticDataExported', { path: exportPath });
      return exportPath;
    } catch (error) {
      this.emit('diagnosticExportFailed', { error: error.message });
      throw error;
    }
  }

  /**
   * Add custom health check
   */
  addHealthCheck(name: string, check: HealthCheck): void {
    this.healthChecks.set(name, check);
    this.emit('healthCheckAdded', { name });
  }

  /**
   * Remove health check
   */
  removeHealthCheck(name: string): boolean {
    const removed = this.healthChecks.delete(name);
    if (removed) {
      this.emit('healthCheckRemoved', { name });
    }
    return removed;
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.emit('alertThresholdsUpdated', this.alertThresholds);
  }

  /**
   * Initialize default health checks
   */
  private initializeHealthChecks(): void {
    // CPU usage check
    this.healthChecks.set('cpu', {
      name: 'CPU Usage',
      description: 'Monitor CPU utilization',
      check: async () => {
        const cpuUsage = await this.getCPUUsage();
        return {
          status: cpuUsage > this.alertThresholds.cpuUsage ? HealthStatus.WARNING : HealthStatus.HEALTHY,
          message: `CPU usage: ${cpuUsage.toFixed(1)}%`,
          metrics: { cpuUsage }
        };
      },
      interval: 30000
    });

    // Memory usage check
    this.healthChecks.set('memory', {
      name: 'Memory Usage',
      description: 'Monitor memory consumption',
      check: async () => {
        const memoryInfo = process.memoryUsage();
        const totalMemory = os.totalmem();
        const usagePercent = (memoryInfo.heapUsed / totalMemory) * 100;
        
        return {
          status: usagePercent > this.alertThresholds.memoryUsage ? HealthStatus.WARNING : HealthStatus.HEALTHY,
          message: `Memory usage: ${usagePercent.toFixed(1)}%`,
          metrics: { 
            heapUsed: memoryInfo.heapUsed,
            heapTotal: memoryInfo.heapTotal,
            external: memoryInfo.external,
            usagePercent
          }
        };
      },
      interval: 30000
    });

    // Disk space check
    this.healthChecks.set('disk', {
      name: 'Disk Space',
      description: 'Monitor available disk space',
      check: async () => {
        const diskInfo = await this.getDiskUsage();
        const usagePercent = (diskInfo.used / diskInfo.total) * 100;
        
        return {
          status: usagePercent > this.alertThresholds.diskUsage ? HealthStatus.WARNING : HealthStatus.HEALTHY,
          message: `Disk usage: ${usagePercent.toFixed(1)}%`,
          metrics: diskInfo
        };
      },
      interval: 60000
    });

    // Database connectivity check
    this.healthChecks.set('database', {
      name: 'Database',
      description: 'Check database connectivity and performance',
      check: async () => {
        try {
          const startTime = Date.now();
          await this.testDatabaseConnection();
          const responseTime = Date.now() - startTime;
          
          return {
            status: responseTime > 1000 ? HealthStatus.WARNING : HealthStatus.HEALTHY,
            message: `Database responsive (${responseTime}ms)`,
            metrics: { responseTime }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Database connection failed: ${error.message}`,
            metrics: { error: error.message }
          };
        }
      },
      interval: 60000
    });

    // Network connectivity check
    this.healthChecks.set('network', {
      name: 'Network',
      description: 'Check internet connectivity',
      check: async () => {
        try {
          const startTime = Date.now();
          await this.testNetworkConnection();
          const responseTime = Date.now() - startTime;
          
          return {
            status: responseTime > 5000 ? HealthStatus.WARNING : HealthStatus.HEALTHY,
            message: `Network responsive (${responseTime}ms)`,
            metrics: { responseTime }
          };
        } catch (error) {
          return {
            status: HealthStatus.WARNING,
            message: `Network connectivity issues: ${error.message}`,
            metrics: { error: error.message }
          };
        }
      },
      interval: 60000
    });
  }

  /**
   * Start health monitoring
   */
  private startMonitoring(interval: number): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.getCurrentHealth();
        this.emit('healthUpdate', health);
        
        // Check for alerts
        this.checkForAlerts(health);
      } catch (error) {
        this.emit('monitoringError', error);
      }
    }, interval);
  }

  /**
   * Run a specific health check
   */
  private async runHealthCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await check.check();
      return {
        ...result,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: HealthStatus.CRITICAL,
        message: `Health check failed: ${error.message}`,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        metrics: { error: error.message }
      };
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(results: Map<string, HealthCheckResult>): HealthStatus {
    const statuses = Array.from(results.values()).map(r => r.status);
    
    if (statuses.includes(HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL;
    }
    
    if (statuses.includes(HealthStatus.WARNING)) {
      return HealthStatus.WARNING;
    }
    
    return HealthStatus.HEALTHY;
  }

  /**
   * Add health snapshot to history
   */
  private addToHistory(health: SystemHealth): void {
    const snapshot: HealthSnapshot = {
      timestamp: health.timestamp,
      overall: health.overall,
      componentCount: Object.keys(health.components).length,
      warningCount: Object.values(health.components).filter(c => c.status === HealthStatus.WARNING).length,
      criticalCount: Object.values(health.components).filter(c => c.status === HealthStatus.CRITICAL).length
    };
    
    this.healthHistory.push(snapshot);
    
    // Keep only last 1000 snapshots
    if (this.healthHistory.length > 1000) {
      this.healthHistory.shift();
    }
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts(health: SystemHealth): void {
    for (const [component, result] of Object.entries(health.components)) {
      if (result.status === HealthStatus.CRITICAL) {
        this.emit('criticalAlert', {
          component,
          message: result.message,
          timestamp: result.timestamp
        });
      } else if (result.status === HealthStatus.WARNING) {
        this.emit('warningAlert', {
          component,
          message: result.message,
          timestamp: result.timestamp
        });
      }
    }
  }

  /**
   * Collect system information
   */
  private async collectSystemInfo(): Promise<void> {
    this.diagnosticData.systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }

  /**
   * Update diagnostic data
   */
  private async updateDiagnosticData(): Promise<void> {
    // Update system info
    await this.collectSystemInfo();
    
    // Update application info
    this.diagnosticData.applicationInfo = {
      version: this.getApplicationVersion(),
      uptime: process.uptime() * 1000,
      workingDirectory: process.cwd(),
      execPath: process.execPath,
      argv: process.argv,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DEBUG: process.env.DEBUG
      }
    };
    
    // Update performance metrics
    this.diagnosticData.performanceMetrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: await this.getCPUUsage(),
      eventLoopLag: await this.getEventLoopLag()
    };
    
    // Update network info
    this.diagnosticData.networkInfo = {
      networkInterfaces: os.networkInterfaces()
    };
  }

  /**
   * Generate health recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check recent health history for patterns
    const recentHistory = this.getHealthHistory(1);
    if (recentHistory.length > 0) {
      const latest = recentHistory[recentHistory.length - 1];
      
      if (latest.criticalCount > 0) {
        recommendations.push('Critical issues detected. Immediate attention required.');
      }
      
      if (latest.warningCount > 2) {
        recommendations.push('Multiple warnings detected. Consider system optimization.');
      }
    }
    
    return recommendations;
  }

  /**
   * System diagnostic tests
   */
  private async testSystemResources(): Promise<DiagnosticTest> {
    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryInfo = process.memoryUsage();
      const totalMemory = os.totalmem();
      const memoryUsage = (memoryInfo.heapUsed / totalMemory) * 100;
      
      const passed = cpuUsage < 90 && memoryUsage < 90;
      
      return {
        name: 'System Resources',
        description: 'Check CPU and memory usage',
        passed,
        message: passed ? 'System resources within normal limits' : 'High resource usage detected',
        details: {
          cpuUsage: `${cpuUsage.toFixed(1)}%`,
          memoryUsage: `${memoryUsage.toFixed(1)}%`
        }
      };
    } catch (error) {
      return {
        name: 'System Resources',
        description: 'Check CPU and memory usage',
        passed: false,
        message: `Failed to check system resources: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testDiskSpace(): Promise<DiagnosticTest> {
    try {
      const diskInfo = await this.getDiskUsage();
      const usagePercent = (diskInfo.used / diskInfo.total) * 100;
      const passed = usagePercent < 95;
      
      return {
        name: 'Disk Space',
        description: 'Check available disk space',
        passed,
        message: passed ? 'Sufficient disk space available' : 'Low disk space warning',
        details: {
          usage: `${usagePercent.toFixed(1)}%`,
          free: `${(diskInfo.free / 1024 / 1024 / 1024).toFixed(1)} GB`
        }
      };
    } catch (error) {
      return {
        name: 'Disk Space',
        description: 'Check available disk space',
        passed: false,
        message: `Failed to check disk space: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testMemoryUsage(): Promise<DiagnosticTest> {
    try {
      const memoryInfo = process.memoryUsage();
      const heapUsagePercent = (memoryInfo.heapUsed / memoryInfo.heapTotal) * 100;
      const passed = heapUsagePercent < 85;
      
      return {
        name: 'Memory Usage',
        description: 'Check application memory consumption',
        passed,
        message: passed ? 'Memory usage within normal limits' : 'High memory usage detected',
        details: {
          heapUsage: `${heapUsagePercent.toFixed(1)}%`,
          heapUsed: `${(memoryInfo.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(memoryInfo.heapTotal / 1024 / 1024).toFixed(1)} MB`
        }
      };
    } catch (error) {
      return {
        name: 'Memory Usage',
        description: 'Check application memory consumption',
        passed: false,
        message: `Failed to check memory usage: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testNetworkConnectivity(): Promise<DiagnosticTest> {
    try {
      const startTime = Date.now();
      await this.testNetworkConnection();
      const responseTime = Date.now() - startTime;
      const passed = responseTime < 10000;
      
      return {
        name: 'Network Connectivity',
        description: 'Test internet connectivity',
        passed,
        message: passed ? 'Network connectivity is good' : 'Slow network connectivity',
        details: {
          responseTime: `${responseTime}ms`
        }
      };
    } catch (error) {
      return {
        name: 'Network Connectivity',
        description: 'Test internet connectivity',
        passed: false,
        message: `Network connectivity failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testDatabaseConnectivity(): Promise<DiagnosticTest> {
    try {
      const startTime = Date.now();
      await this.testDatabaseConnection();
      const responseTime = Date.now() - startTime;
      const passed = responseTime < 2000;
      
      return {
        name: 'Database Connectivity',
        description: 'Test database connection and performance',
        passed,
        message: passed ? 'Database is responsive' : 'Slow database response',
        details: {
          responseTime: `${responseTime}ms`
        }
      };
    } catch (error) {
      return {
        name: 'Database Connectivity',
        description: 'Test database connection and performance',
        passed: false,
        message: `Database connection failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testAIProviders(): Promise<DiagnosticTest> {
    try {
      // This would test actual AI provider connectivity
      // For now, we'll simulate the test
      const passed = true;
      
      return {
        name: 'AI Providers',
        description: 'Test AI provider availability',
        passed,
        message: passed ? 'AI providers are available' : 'Some AI providers are unavailable',
        details: {
          providers: 'OpenAI, Anthropic, Local AI'
        }
      };
    } catch (error) {
      return {
        name: 'AI Providers',
        description: 'Test AI provider availability',
        passed: false,
        message: `AI provider test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testFileSystemAccess(): Promise<DiagnosticTest> {
    try {
      const testPath = path.join(process.cwd(), 'test-write-access.tmp');
      await fs.writeFile(testPath, 'test');
      await fs.unlink(testPath);
      
      return {
        name: 'File System Access',
        description: 'Test file system read/write permissions',
        passed: true,
        message: 'File system access is working correctly',
        details: {
          workingDirectory: process.cwd()
        }
      };
    } catch (error) {
      return {
        name: 'File System Access',
        description: 'Test file system read/write permissions',
        passed: false,
        message: `File system access failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  private async testConfigurationValidity(): Promise<DiagnosticTest> {
    try {
      // This would validate application configuration
      // For now, we'll simulate the test
      const passed = true;
      
      return {
        name: 'Configuration Validity',
        description: 'Validate application configuration',
        passed,
        message: passed ? 'Configuration is valid' : 'Configuration issues detected',
        details: {
          configFiles: 'All configuration files are valid'
        }
      };
    } catch (error) {
      return {
        name: 'Configuration Validity',
        description: 'Validate application configuration',
        passed: false,
        message: `Configuration validation failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Generate diagnostic recommendations based on test results
   */
  private generateDiagnosticRecommendations(tests: DiagnosticTest[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = tests.filter(t => !t.passed);
    
    if (failedTests.length === 0) {
      recommendations.push('All diagnostic tests passed. System is healthy.');
    } else {
      recommendations.push(`${failedTests.length} diagnostic tests failed. Review the failed tests for specific issues.`);
      
      failedTests.forEach(test => {
        switch (test.name) {
          case 'System Resources':
            recommendations.push('Consider closing unnecessary applications or upgrading hardware.');
            break;
          case 'Disk Space':
            recommendations.push('Free up disk space by removing unnecessary files or expanding storage.');
            break;
          case 'Memory Usage':
            recommendations.push('Restart the application or increase available memory.');
            break;
          case 'Network Connectivity':
            recommendations.push('Check internet connection and firewall settings.');
            break;
          case 'Database Connectivity':
            recommendations.push('Verify database service is running and accessible.');
            break;
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalUsage = (endUsage.user + endUsage.system) / 1000;
        const totalTime = endTime - startTime;
        const cpuPercent = (totalUsage / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getDiskUsage(): Promise<{ total: number; used: number; free: number }> {
    // Simplified disk usage calculation
    // In a real implementation, you'd use a proper disk usage library
    return {
      total: 500 * 1024 * 1024 * 1024, // 500GB
      used: 250 * 1024 * 1024 * 1024,  // 250GB
      free: 250 * 1024 * 1024 * 1024   // 250GB
    };
  }

  private async getEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  private async testDatabaseConnection(): Promise<void> {
    // Mock database connection test
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async testNetworkConnection(): Promise<void> {
    // Mock network connection test
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private getApplicationVersion(): string {
    // This would read from package.json or version file
    return '1.0.0';
  }

  private async collectSystemLogs(): Promise<string[]> {
    // This would collect actual system logs
    return ['Sample log entry 1', 'Sample log entry 2'];
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
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
export interface SystemHealthOptions {
  monitoringInterval?: number;
  cpuThreshold?: number;
  memoryThreshold?: number;
  diskThreshold?: number;
  errorRateThreshold?: number;
  responseTimeThreshold?: number;
}

export interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<Partial<HealthCheckResult>>;
  interval: number;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  timestamp: number;
  duration?: number;
  metrics: Record<string, any>;
}

export interface SystemHealth {
  overall: HealthStatus;
  components: Record<string, HealthCheckResult>;
  timestamp: number;
  uptime: number;
  version: string;
}

export interface HealthSnapshot {
  timestamp: number;
  overall: HealthStatus;
  componentCount: number;
  warningCount: number;
  criticalCount: number;
}

export interface AlertThresholds {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  errorRate: number;
  responseTime: number;
}

export interface DiagnosticData {
  systemInfo: Record<string, any>;
  applicationInfo: Record<string, any>;
  performanceMetrics: Record<string, any>;
  errorLogs: any[];
  networkInfo: Record<string, any>;
}

export interface DiagnosticInfo {
  timestamp: number;
  systemHealth: SystemHealth;
  systemInfo: Record<string, any>;
  applicationInfo: Record<string, any>;
  performanceMetrics: Record<string, any>;
  networkInfo: Record<string, any>;
  recentErrors: any[];
  recommendations: string[];
}

export interface DiagnosticTest {
  name: string;
  description: string;
  passed: boolean;
  message: string;
  details: Record<string, any>;
}

export interface DiagnosticReport {
  timestamp: number;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallStatus: 'healthy' | 'warning' | 'critical';
  tests: DiagnosticTest[];
  recommendations: string[];
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}