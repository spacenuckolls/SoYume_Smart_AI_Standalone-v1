import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

/**
 * Crash reporting and diagnostic collection system
 * Handles crash detection, report generation, and diagnostic data collection
 */
export class CrashReporter extends EventEmitter {
  private reporterConfig: CrashReporterConfig;
  private diagnosticCollector: DiagnosticCollector;
  private reportUploader: ReportUploader;
  private crashHandlers: Map<string, CrashHandler>;
  private isInitialized: boolean;

  constructor(options: CrashReporterOptions = {}) {
    super();
    
    this.reporterConfig = {
      crashReportsDir: options.crashReportsDir || path.join(os.tmpdir(), 'ai-creative-assistant', 'crashes'),
      maxReports: options.maxReports || 50,
      autoUpload: options.autoUpload !== false,
      uploadUrl: options.uploadUrl || 'https://crash-reports.soyume.ai/api/reports',
      collectDiagnostics: options.collectDiagnostics !== false,
      anonymizeData: options.anonymizeData !== false,
      retentionDays: options.retentionDays || 30,
      ...options.reporterConfig
    };
    
    this.diagnosticCollector = new DiagnosticCollector(this.reporterConfig);
    this.reportUploader = new ReportUploader(this.reporterConfig);
    this.crashHandlers = new Map();
    this.isInitialized = false;
    
    this.initialize();
  }

  /**
   * Initialize crash reporter
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.reporterConfig.crashReportsDir, { recursive: true });
      
      await this.diagnosticCollector.initialize();
      await this.reportUploader.initialize();
      
      // Setup crash handlers
      this.setupCrashHandlers();
      
      // Cleanup old reports
      await this.cleanupOldReports();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize crash reporter: ${(error as Error).message}`);
    }
  }

  /**
   * Report a crash manually
   */
  async reportCrash(crashInfo: CrashInfo): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Crash reporter not initialized');
    }
    
    const reportId = crypto.randomUUID();
    
    try {
      // Collect diagnostic data
      const diagnostics = this.reporterConfig.collectDiagnostics 
        ? await this.diagnosticCollector.collect()
        : null;
      
      // Create crash report
      const crashReport: CrashReport = {
        reportId,
        timestamp: Date.now(),
        version: this.getApplicationVersion(),
        platform: process.platform,
        architecture: process.arch,
        crashInfo,
        diagnostics,
        systemInfo: await this.collectSystemInfo(),
        userAgent: this.getUserAgent()
      };
      
      // Anonymize data if enabled
      if (this.reporterConfig.anonymizeData) {
        this.anonymizeReport(crashReport);
      }
      
      // Save report locally
      await this.saveCrashReport(crashReport);
      
      // Upload report if auto-upload is enabled
      if (this.reporterConfig.autoUpload) {
        await this.uploadReport(crashReport);
      }
      
      this.emit('crash-reported', { reportId, crashReport });
      return reportId;
      
    } catch (error) {
      this.emit('report-error', { reportId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all crash reports
   */
  async getCrashReports(): Promise<CrashReportSummary[]> {
    try {
      const reportFiles = await fs.readdir(this.reporterConfig.crashReportsDir);
      const reports: CrashReportSummary[] = [];
      
      for (const file of reportFiles) {
        if (file.endsWith('.json')) {
          try {
            const reportPath = path.join(this.reporterConfig.crashReportsDir, file);
            const reportContent = await fs.readFile(reportPath, 'utf8');
            const report: CrashReport = JSON.parse(reportContent);
            
            reports.push({
              reportId: report.reportId,
              timestamp: report.timestamp,
              version: report.version,
              platform: report.platform,
              crashType: report.crashInfo.type,
              uploaded: report.uploaded || false
            });
          } catch (error) {
            // Skip invalid report files
          }
        }
      }
      
      return reports.sort((a, b) => b.timestamp - a.timestamp);
      
    } catch (error) {
      throw new Error(`Failed to get crash reports: ${(error as Error).message}`);
    }
  }

  /**
   * Get detailed crash report
   */
  async getCrashReport(reportId: string): Promise<CrashReport | null> {
    try {
      const reportPath = path.join(this.reporterConfig.crashReportsDir, `${reportId}.json`);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(reportContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * Upload crash report
   */
  async uploadReport(report: CrashReport): Promise<void> {
    try {
      await this.reportUploader.upload(report);
      
      // Mark report as uploaded
      report.uploaded = true;
      report.uploadedAt = Date.now();
      
      await this.saveCrashReport(report);
      
      this.emit('report-uploaded', { reportId: report.reportId });
      
    } catch (error) {
      this.emit('upload-error', { reportId: report.reportId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete crash report
   */
  async deleteCrashReport(reportId: string): Promise<void> {
    try {
      const reportPath = path.join(this.reporterConfig.crashReportsDir, `${reportId}.json`);
      await fs.unlink(reportPath);
      
      this.emit('report-deleted', { reportId });
      
    } catch (error) {
      throw new Error(`Failed to delete crash report: ${(error as Error).message}`);
    }
  }

  /**
   * Collect diagnostic information
   */
  async collectDiagnostics(): Promise<DiagnosticData> {
    return await this.diagnosticCollector.collect();
  }

  /**
   * Setup crash handlers for different types of crashes
   */
  private setupCrashHandlers(): void {
    // Uncaught exception handler
    const uncaughtExceptionHandler = (error: Error) => {
      this.handleCrash({
        type: 'uncaught-exception',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack || ''
        },
        fatal: true
      });
    };
    
    // Unhandled promise rejection handler
    const unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
      this.handleCrash({
        type: 'unhandled-rejection',
        error: {
          name: 'UnhandledPromiseRejection',
          message: String(reason),
          stack: reason?.stack || ''
        },
        fatal: false,
        metadata: {
          promise: promise.toString()
        }
      });
    };
    
    // Warning handler
    const warningHandler = (warning: Error) => {
      this.handleCrash({
        type: 'warning',
        error: {
          name: warning.name,
          message: warning.message,
          stack: warning.stack || ''
        },
        fatal: false
      });
    };
    
    // Register handlers
    process.on('uncaughtException', uncaughtExceptionHandler);
    process.on('unhandledRejection', unhandledRejectionHandler);
    process.on('warning', warningHandler);
    
    // Store handlers for cleanup
    this.crashHandlers.set('uncaughtException', uncaughtExceptionHandler);
    this.crashHandlers.set('unhandledRejection', unhandledRejectionHandler);
    this.crashHandlers.set('warning', warningHandler);
    
    // Electron-specific crash handlers
    if (process.type === 'renderer' || process.type === 'browser') {
      this.setupElectronCrashHandlers();
    }
  }

  /**
   * Setup Electron-specific crash handlers
   */
  private setupElectronCrashHandlers(): void {
    try {
      const { crashReporter } = require('electron');
      
      crashReporter.start({
        productName: 'AI Creative Assistant',
        companyName: 'SoYume',
        submitURL: this.reporterConfig.uploadUrl,
        uploadToServer: this.reporterConfig.autoUpload,
        ignoreSystemCrashHandler: false,
        rateLimit: true,
        compress: true
      });
      
    } catch (error) {
      // Electron not available or crash reporter failed to start
    }
  }

  /**
   * Handle crash occurrence
   */
  private async handleCrash(crashInfo: CrashInfo): Promise<void> {
    try {
      await this.reportCrash(crashInfo);
      
      if (crashInfo.fatal) {
        // Give some time for the report to be saved/uploaded
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      }
      
    } catch (error) {
      // Don't let crash reporting crash the app
      console.error('Failed to report crash:', error);
    }
  }

  /**
   * Save crash report to disk
   */
  private async saveCrashReport(report: CrashReport): Promise<void> {
    const reportPath = path.join(this.reporterConfig.crashReportsDir, `${report.reportId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Collect system information
   */
  private async collectSystemInfo(): Promise<SystemInfo> {
    return {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron || 'N/A',
      chromeVersion: process.versions.chrome || 'N/A',
      osVersion: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Get application version
   */
  private getApplicationVersion(): string {
    try {
      const packageJson = require(path.join(process.cwd(), 'package.json'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    const version = this.getApplicationVersion();
    const platform = process.platform;
    const arch = process.arch;
    
    return `AI-Creative-Assistant/${version} (${platform}; ${arch})`;
  }

  /**
   * Anonymize sensitive data in crash report
   */
  private anonymizeReport(report: CrashReport): void {
    // Remove or hash sensitive information
    if (report.crashInfo.error.stack) {
      report.crashInfo.error.stack = this.anonymizeStackTrace(report.crashInfo.error.stack);
    }
    
    if (report.diagnostics) {
      report.diagnostics = this.anonymizeDiagnostics(report.diagnostics);
    }
    
    // Remove user-specific paths
    if (report.crashInfo.metadata) {
      report.crashInfo.metadata = this.anonymizeMetadata(report.crashInfo.metadata);
    }
  }

  /**
   * Anonymize stack trace
   */
  private anonymizeStackTrace(stackTrace: string): string {
    // Replace user-specific paths with generic placeholders
    const userHome = os.homedir();
    const anonymized = stackTrace
      .replace(new RegExp(userHome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<USER_HOME>')
      .replace(/\/Users\/[^\/]+/g, '/Users/<USER>')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<USER>');
    
    return anonymized;
  }

  /**
   * Anonymize diagnostic data
   */
  private anonymizeDiagnostics(diagnostics: DiagnosticData): DiagnosticData {
    const anonymized = { ...diagnostics };
    
    // Remove or hash sensitive file paths
    if (anonymized.recentFiles) {
      anonymized.recentFiles = anonymized.recentFiles.map(file => ({
        ...file,
        path: this.anonymizePath(file.path)
      }));
    }
    
    // Remove sensitive environment variables
    if (anonymized.environment) {
      const sensitiveVars = ['HOME', 'USER', 'USERNAME', 'PATH'];
      for (const varName of sensitiveVars) {
        if (anonymized.environment[varName]) {
          anonymized.environment[varName] = '<REDACTED>';
        }
      }
    }
    
    return anonymized;
  }

  /**
   * Anonymize metadata
   */
  private anonymizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const anonymized = { ...metadata };
    
    // Remove or anonymize sensitive keys
    const sensitiveKeys = ['userId', 'email', 'username', 'token', 'key'];
    
    for (const key of sensitiveKeys) {
      if (anonymized[key]) {
        anonymized[key] = '<REDACTED>';
      }
    }
    
    return anonymized;
  }

  /**
   * Anonymize file path
   */
  private anonymizePath(filePath: string): string {
    const userHome = os.homedir();
    return filePath.replace(userHome, '<USER_HOME>');
  }

  /**
   * Cleanup old crash reports
   */
  private async cleanupOldReports(): Promise<void> {
    try {
      const reports = await this.getCrashReports();
      const cutoffTime = Date.now() - (this.reporterConfig.retentionDays * 24 * 60 * 60 * 1000);
      
      // Remove old reports
      const oldReports = reports.filter(report => report.timestamp < cutoffTime);
      
      for (const report of oldReports) {
        await this.deleteCrashReport(report.reportId);
      }
      
      // Remove excess reports if over limit
      if (reports.length > this.reporterConfig.maxReports) {
        const excessReports = reports
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, reports.length - this.reporterConfig.maxReports);
        
        for (const report of excessReports) {
          await this.deleteCrashReport(report.reportId);
        }
      }
      
    } catch (error) {
      // Don't fail initialization due to cleanup errors
    }
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Remove crash handlers
    for (const [event, handler] of this.crashHandlers) {
      process.removeListener(event as any, handler);
    }
    
    await this.diagnosticCollector.destroy();
    await this.reportUploader.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * Diagnostic data collector
 */
class DiagnosticCollector {
  private config: CrashReporterConfig;

  constructor(config: CrashReporterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize diagnostic collector
  }

  async collect(): Promise<DiagnosticData> {
    const diagnostics: DiagnosticData = {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      environment: this.collectEnvironmentInfo(),
      recentFiles: await this.collectRecentFiles(),
      logs: await this.collectRecentLogs(),
      performance: await this.collectPerformanceMetrics(),
      features: await this.collectFeatureUsage()
    };
    
    return diagnostics;
  }

  private collectEnvironmentInfo(): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Collect relevant environment variables
    const relevantVars = [
      'NODE_ENV',
      'ELECTRON_IS_DEV',
      'LANG',
      'LC_ALL',
      'TZ'
    ];
    
    for (const varName of relevantVars) {
      if (process.env[varName]) {
        env[varName] = process.env[varName]!;
      }
    }
    
    return env;
  }

  private async collectRecentFiles(): Promise<FileInfo[]> {
    // Collect information about recently accessed files
    // This would integrate with the application's file management system
    return [];
  }

  private async collectRecentLogs(): Promise<LogEntry[]> {
    // Collect recent log entries
    // This would integrate with the application's logging system
    return [];
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      startupTime: Date.now() - (process.uptime() * 1000),
      memoryPeak: process.memoryUsage().heapUsed,
      cpuTime: process.cpuUsage().user + process.cpuUsage().system,
      eventLoopLag: 0 // Would measure actual event loop lag
    };
  }

  private async collectFeatureUsage(): Promise<FeatureUsage[]> {
    // Collect feature usage statistics
    // This would integrate with the application's analytics system
    return [];
  }

  async destroy(): Promise<void> {
    // Cleanup diagnostic collector
  }
}

/**
 * Report uploader
 */
class ReportUploader {
  private config: CrashReporterConfig;

  constructor(config: CrashReporterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize report uploader
  }

  async upload(report: CrashReport): Promise<void> {
    const https = require('https');
    const data = JSON.stringify(report);
    
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': report.userAgent
        }
      };
      
      const req = https.request(this.config.uploadUrl, options, (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });
      
      req.on('error', (error: Error) => {
        reject(new Error(`Upload request failed: ${error.message}`));
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Upload timeout'));
      });
      
      req.write(data);
      req.end();
    });
  }

  async destroy(): Promise<void> {
    // Cleanup report uploader
  }
}

// Types and interfaces
export interface CrashReporterOptions {
  crashReportsDir?: string;
  maxReports?: number;
  autoUpload?: boolean;
  uploadUrl?: string;
  collectDiagnostics?: boolean;
  anonymizeData?: boolean;
  retentionDays?: number;
  reporterConfig?: Partial<CrashReporterConfig>;
}

export interface CrashReporterConfig {
  crashReportsDir: string;
  maxReports: number;
  autoUpload: boolean;
  uploadUrl: string;
  collectDiagnostics: boolean;
  anonymizeData: boolean;
  retentionDays: number;
}

export interface CrashInfo {
  type: 'uncaught-exception' | 'unhandled-rejection' | 'warning' | 'manual' | 'renderer-crash';
  error: {
    name: string;
    message: string;
    stack: string;
  };
  fatal: boolean;
  metadata?: Record<string, any>;
}

export interface CrashReport {
  reportId: string;
  timestamp: number;
  version: string;
  platform: string;
  architecture: string;
  crashInfo: CrashInfo;
  diagnostics: DiagnosticData | null;
  systemInfo: SystemInfo;
  userAgent: string;
  uploaded?: boolean;
  uploadedAt?: number;
}

export interface CrashReportSummary {
  reportId: string;
  timestamp: number;
  version: string;
  platform: string;
  crashType: string;
  uploaded: boolean;
}

export interface DiagnosticData {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  environment: Record<string, string>;
  recentFiles: FileInfo[];
  logs: LogEntry[];
  performance: PerformanceMetrics;
  features: FeatureUsage[];
}

export interface SystemInfo {
  platform: string;
  architecture: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  osVersion: string;
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  uptime: number;
  loadAverage: number[];
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: number;
  type: string;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  source: string;
}

export interface PerformanceMetrics {
  startupTime: number;
  memoryPeak: number;
  cpuTime: number;
  eventLoopLag: number;
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  lastUsed: number;
}

export type CrashHandler = (...args: any[]) => void;