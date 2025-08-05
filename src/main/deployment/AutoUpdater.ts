import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as https from 'https';

/**
 * Auto-update system with rollback capabilities
 * Handles checking for updates, downloading, and installing updates safely
 */
export class AutoUpdater extends EventEmitter {
  private updateConfig: UpdateConfig;
  private currentVersion: string;
  private updateChannel: UpdateChannel;
  private downloadManager: DownloadManager;
  private rollbackManager: RollbackManager;
  private updateCheckInterval: NodeJS.Timeout | null;

  constructor(options: AutoUpdaterOptions = {}) {
    super();
    
    this.updateConfig = {
      updateServerUrl: options.updateServerUrl || 'https://updates.soyume.ai',
      checkInterval: options.checkInterval || 4 * 60 * 60 * 1000, // 4 hours
      autoDownload: options.autoDownload !== false,
      autoInstall: options.autoInstall || false,
      allowPrerelease: options.allowPrerelease || false,
      updateCacheDir: options.updateCacheDir || path.join(process.cwd(), 'updates'),
      rollbackEnabled: options.rollbackEnabled !== false,
      maxRollbackVersions: options.maxRollbackVersions || 3,
      ...options.updateConfig
    };
    
    this.currentVersion = this.getCurrentVersion();
    this.updateChannel = options.updateChannel || 'stable';
    this.downloadManager = new DownloadManager(this.updateConfig);
    this.rollbackManager = new RollbackManager(this.updateConfig);
    this.updateCheckInterval = null;
    
    this.initialize();
  }

  /**
   * Initialize auto-updater
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.updateConfig.updateCacheDir, { recursive: true });
      
      await this.downloadManager.initialize();
      await this.rollbackManager.initialize();
      
      // Start automatic update checking if enabled
      if (this.updateConfig.checkInterval > 0) {
        this.startUpdateChecking();
      }
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize auto-updater: ${(error as Error).message}`);
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      this.emit('checking-for-update');
      
      const updateInfo = await this.fetchUpdateInfo();
      
      if (updateInfo && this.isNewerVersion(updateInfo.version, this.currentVersion)) {
        this.emit('update-available', updateInfo);
        
        // Auto-download if enabled
        if (this.updateConfig.autoDownload) {
          await this.downloadUpdate(updateInfo);
        }
        
        return updateInfo;
      } else {
        this.emit('update-not-available');
        return null;
      }
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Download update
   */
  async downloadUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      this.emit('update-download-started', updateInfo);
      
      const downloadPath = await this.downloadManager.download(updateInfo);
      
      // Verify download integrity
      await this.verifyDownload(downloadPath, updateInfo);
      
      this.emit('update-downloaded', { updateInfo, downloadPath });
      
      // Auto-install if enabled
      if (this.updateConfig.autoInstall) {
        await this.installUpdate(updateInfo, downloadPath);
      }
      
    } catch (error) {
      this.emit('download-error', error);
      throw error;
    }
  }

  /**
   * Install update
   */
  async installUpdate(updateInfo: UpdateInfo, downloadPath: string): Promise<void> {
    try {
      this.emit('update-install-started', updateInfo);
      
      // Create rollback point before installing
      if (this.updateConfig.rollbackEnabled) {
        await this.rollbackManager.createRollbackPoint(this.currentVersion);
      }
      
      // Install update based on platform
      await this.performInstallation(downloadPath, updateInfo);
      
      this.emit('update-installed', updateInfo);
      
      // Schedule restart if needed
      if (updateInfo.requiresRestart) {
        this.emit('restart-required', updateInfo);
      }
      
    } catch (error) {
      this.emit('install-error', error);
      
      // Attempt rollback on installation failure
      if (this.updateConfig.rollbackEnabled) {
        await this.rollbackUpdate();
      }
      
      throw error;
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackUpdate(): Promise<void> {
    try {
      this.emit('rollback-started');
      
      const rollbackInfo = await this.rollbackManager.rollback();
      
      if (rollbackInfo) {
        this.currentVersion = rollbackInfo.version;
        this.emit('rollback-completed', rollbackInfo);
        
        if (rollbackInfo.requiresRestart) {
          this.emit('restart-required', rollbackInfo);
        }
      } else {
        throw new Error('No rollback point available');
      }
      
    } catch (error) {
      this.emit('rollback-error', error);
      throw error;
    }
  }

  /**
   * Get available rollback versions
   */
  async getAvailableRollbacks(): Promise<RollbackInfo[]> {
    return await this.rollbackManager.getAvailableRollbacks();
  }

  /**
   * Rollback to specific version
   */
  async rollbackToVersion(version: string): Promise<void> {
    try {
      this.emit('rollback-started');
      
      const rollbackInfo = await this.rollbackManager.rollbackToVersion(version);
      
      this.currentVersion = rollbackInfo.version;
      this.emit('rollback-completed', rollbackInfo);
      
      if (rollbackInfo.requiresRestart) {
        this.emit('restart-required', rollbackInfo);
      }
      
    } catch (error) {
      this.emit('rollback-error', error);
      throw error;
    }
  }

  /**
   * Set update channel
   */
  setUpdateChannel(channel: UpdateChannel): void {
    this.updateChannel = channel;
    this.emit('update-channel-changed', channel);
  }

  /**
   * Get current update channel
   */
  getUpdateChannel(): UpdateChannel {
    return this.updateChannel;
  }

  /**
   * Enable/disable automatic updates
   */
  setAutoUpdateEnabled(enabled: boolean): void {
    if (enabled && !this.updateCheckInterval) {
      this.startUpdateChecking();
    } else if (!enabled && this.updateCheckInterval) {
      this.stopUpdateChecking();
    }
  }

  /**
   * Get update status
   */
  getUpdateStatus(): UpdateStatus {
    return {
      currentVersion: this.currentVersion,
      updateChannel: this.updateChannel,
      autoUpdateEnabled: this.updateCheckInterval !== null,
      lastCheckTime: this.downloadManager.getLastCheckTime(),
      availableUpdate: null, // Would be populated if update is available
      downloadProgress: this.downloadManager.getDownloadProgress()
    };
  }

  /**
   * Private methods
   */
  private getCurrentVersion(): string {
    try {
      const packageJson = require(path.join(process.cwd(), 'package.json'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  private async fetchUpdateInfo(): Promise<UpdateInfo | null> {
    const updateUrl = `${this.updateConfig.updateServerUrl}/api/updates/${this.updateChannel}`;
    
    return new Promise((resolve, reject) => {
      const request = https.get(updateUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const updateInfo: UpdateInfo = JSON.parse(data);
              resolve(updateInfo);
            } else if (response.statusCode === 204) {
              resolve(null); // No updates available
            } else {
              reject(new Error(`Update check failed: ${response.statusCode}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse update info: ${(error as Error).message}`));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(new Error(`Update check request failed: ${error.message}`));
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Update check timeout'));
      });
    });
  }

  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string) => {
      return version.split('.').map(Number);
    };
    
    const newParts = parseVersion(newVersion);
    const currentParts = parseVersion(currentVersion);
    
    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false;
  }

  private async verifyDownload(downloadPath: string, updateInfo: UpdateInfo): Promise<void> {
    const fileContent = await fs.readFile(downloadPath);
    const actualChecksum = crypto.createHash('sha256').update(fileContent).digest('hex');
    
    if (actualChecksum !== updateInfo.checksum) {
      throw new Error('Download verification failed: checksum mismatch');
    }
  }

  private async performInstallation(downloadPath: string, updateInfo: UpdateInfo): Promise<void> {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        await this.installWindows(downloadPath, updateInfo);
        break;
      case 'darwin':
        await this.installMacOS(downloadPath, updateInfo);
        break;
      case 'linux':
        await this.installLinux(downloadPath, updateInfo);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async installWindows(downloadPath: string, updateInfo: UpdateInfo): Promise<void> {
    // Windows installation using the downloaded installer
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const installer = spawn(downloadPath, ['/S'], { // Silent install
        detached: true,
        stdio: 'ignore'
      });
      
      installer.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Windows installation failed with code ${code}`));
        }
      });
      
      installer.on('error', (error) => {
        reject(new Error(`Windows installation error: ${error.message}`));
      });
    });
  }

  private async installMacOS(downloadPath: string, updateInfo: UpdateInfo): Promise<void> {
    // macOS installation using the downloaded DMG or app bundle
    const { spawn } = require('child_process');
    
    if (downloadPath.endsWith('.dmg')) {
      // Mount DMG and copy app
      return new Promise((resolve, reject) => {
        const hdiutil = spawn('hdiutil', ['attach', downloadPath, '-nobrowse'], {
          stdio: 'pipe'
        });
        
        hdiutil.on('close', (code) => {
          if (code === 0) {
            // Copy app from mounted volume to Applications
            // This is simplified - real implementation would be more complex
            resolve();
          } else {
            reject(new Error(`macOS installation failed with code ${code}`));
          }
        });
      });
    } else {
      throw new Error('Unsupported macOS installer format');
    }
  }

  private async installLinux(downloadPath: string, updateInfo: UpdateInfo): Promise<void> {
    // Linux installation using AppImage or package
    if (downloadPath.endsWith('.AppImage')) {
      // Make AppImage executable and replace current version
      await fs.chmod(downloadPath, '755');
      
      const currentAppPath = process.execPath;
      const backupPath = `${currentAppPath}.backup`;
      
      // Backup current version
      await fs.copyFile(currentAppPath, backupPath);
      
      // Replace with new version
      await fs.copyFile(downloadPath, currentAppPath);
      await fs.chmod(currentAppPath, '755');
      
    } else {
      throw new Error('Unsupported Linux installer format');
    }
  }

  private startUpdateChecking(): void {
    this.updateCheckInterval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.updateConfig.checkInterval);
  }

  private stopUpdateChecking(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    this.stopUpdateChecking();
    
    await this.downloadManager.destroy();
    await this.rollbackManager.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * Download manager for handling update downloads
 */
class DownloadManager {
  private config: UpdateConfig;
  private activeDownloads: Map<string, DownloadProgress>;
  private lastCheckTime: number;

  constructor(config: UpdateConfig) {
    this.config = config;
    this.activeDownloads = new Map();
    this.lastCheckTime = 0;
  }

  async initialize(): Promise<void> {
    // Initialize download manager
  }

  async download(updateInfo: UpdateInfo): Promise<string> {
    const downloadId = crypto.randomUUID();
    const filename = this.getDownloadFilename(updateInfo);
    const downloadPath = path.join(this.config.updateCacheDir, filename);
    
    const progress: DownloadProgress = {
      downloadId,
      filename,
      totalBytes: 0,
      downloadedBytes: 0,
      percentage: 0,
      speed: 0,
      startTime: Date.now()
    };
    
    this.activeDownloads.set(downloadId, progress);
    
    try {
      await this.performDownload(updateInfo.downloadUrl, downloadPath, progress);
      this.activeDownloads.delete(downloadId);
      return downloadPath;
      
    } catch (error) {
      this.activeDownloads.delete(downloadId);
      throw error;
    }
  }

  private async performDownload(url: string, outputPath: string, progress: DownloadProgress): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(outputPath);
      
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }
        
        progress.totalBytes = parseInt(response.headers['content-length'] || '0');
        
        response.on('data', (chunk) => {
          progress.downloadedBytes += chunk.length;
          progress.percentage = (progress.downloadedBytes / progress.totalBytes) * 100;
          
          const elapsed = Date.now() - progress.startTime;
          progress.speed = progress.downloadedBytes / (elapsed / 1000);
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(300000, () => { // 5 minutes timeout
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  private getDownloadFilename(updateInfo: UpdateInfo): string {
    const platform = process.platform;
    const arch = process.arch;
    
    switch (platform) {
      case 'win32':
        return `ai-creative-assistant-${updateInfo.version}-win32-${arch}.exe`;
      case 'darwin':
        return `ai-creative-assistant-${updateInfo.version}-darwin-${arch}.dmg`;
      case 'linux':
        return `ai-creative-assistant-${updateInfo.version}-linux-${arch}.AppImage`;
      default:
        return `ai-creative-assistant-${updateInfo.version}-${platform}-${arch}`;
    }
  }

  getLastCheckTime(): number {
    return this.lastCheckTime;
  }

  getDownloadProgress(): DownloadProgress | null {
    const activeDownloads = Array.from(this.activeDownloads.values());
    return activeDownloads.length > 0 ? activeDownloads[0] : null;
  }

  async destroy(): Promise<void> {
    // Cancel active downloads
    this.activeDownloads.clear();
  }
}

/**
 * Rollback manager for handling version rollbacks
 */
class RollbackManager {
  private config: UpdateConfig;
  private rollbackDir: string;

  constructor(config: UpdateConfig) {
    this.config = config;
    this.rollbackDir = path.join(config.updateCacheDir, 'rollback');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.rollbackDir, { recursive: true });
  }

  async createRollbackPoint(version: string): Promise<void> {
    const rollbackPath = path.join(this.rollbackDir, version);
    await fs.mkdir(rollbackPath, { recursive: true });
    
    // Backup current application files
    const currentAppPath = process.execPath;
    const backupAppPath = path.join(rollbackPath, path.basename(currentAppPath));
    
    await fs.copyFile(currentAppPath, backupAppPath);
    
    // Create rollback metadata
    const metadata: RollbackInfo = {
      version,
      createdAt: Date.now(),
      appPath: backupAppPath,
      requiresRestart: true
    };
    
    const metadataPath = path.join(rollbackPath, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Cleanup old rollback points
    await this.cleanupOldRollbacks();
  }

  async rollback(): Promise<RollbackInfo | null> {
    const rollbacks = await this.getAvailableRollbacks();
    
    if (rollbacks.length === 0) {
      return null;
    }
    
    // Get the most recent rollback point
    const latestRollback = rollbacks[0];
    
    return await this.performRollback(latestRollback);
  }

  async rollbackToVersion(version: string): Promise<RollbackInfo> {
    const rollbacks = await this.getAvailableRollbacks();
    const targetRollback = rollbacks.find(r => r.version === version);
    
    if (!targetRollback) {
      throw new Error(`Rollback point not found for version: ${version}`);
    }
    
    return await this.performRollback(targetRollback);
  }

  async getAvailableRollbacks(): Promise<RollbackInfo[]> {
    try {
      const rollbackDirs = await fs.readdir(this.rollbackDir);
      const rollbacks: RollbackInfo[] = [];
      
      for (const dir of rollbackDirs) {
        try {
          const metadataPath = path.join(this.rollbackDir, dir, 'metadata.json');
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata: RollbackInfo = JSON.parse(metadataContent);
          rollbacks.push(metadata);
        } catch (error) {
          // Skip invalid rollback points
        }
      }
      
      // Sort by creation time (newest first)
      return rollbacks.sort((a, b) => b.createdAt - a.createdAt);
      
    } catch (error) {
      return [];
    }
  }

  private async performRollback(rollbackInfo: RollbackInfo): Promise<RollbackInfo> {
    const currentAppPath = process.execPath;
    
    // Backup current version before rollback
    const tempBackupPath = `${currentAppPath}.temp-backup`;
    await fs.copyFile(currentAppPath, tempBackupPath);
    
    try {
      // Restore from rollback point
      await fs.copyFile(rollbackInfo.appPath, currentAppPath);
      await fs.chmod(currentAppPath, '755');
      
      // Remove temporary backup
      await fs.unlink(tempBackupPath);
      
      return rollbackInfo;
      
    } catch (error) {
      // Restore from temporary backup on failure
      try {
        await fs.copyFile(tempBackupPath, currentAppPath);
        await fs.unlink(tempBackupPath);
      } catch (restoreError) {
        // Log restore error but throw original error
      }
      
      throw error;
    }
  }

  private async cleanupOldRollbacks(): Promise<void> {
    const rollbacks = await this.getAvailableRollbacks();
    
    if (rollbacks.length > this.config.maxRollbackVersions) {
      const rollbacksToDelete = rollbacks.slice(this.config.maxRollbackVersions);
      
      for (const rollback of rollbacksToDelete) {
        try {
          const rollbackPath = path.join(this.rollbackDir, rollback.version);
          await fs.rm(rollbackPath, { recursive: true, force: true });
        } catch (error) {
          // Log but don't fail cleanup
        }
      }
    }
  }

  async destroy(): Promise<void> {
    // Cleanup rollback manager
  }
}

// Types and interfaces
export interface AutoUpdaterOptions {
  updateServerUrl?: string;
  checkInterval?: number;
  autoDownload?: boolean;
  autoInstall?: boolean;
  allowPrerelease?: boolean;
  updateCacheDir?: string;
  rollbackEnabled?: boolean;
  maxRollbackVersions?: number;
  updateChannel?: UpdateChannel;
  updateConfig?: Partial<UpdateConfig>;
}

export interface UpdateConfig {
  updateServerUrl: string;
  checkInterval: number;
  autoDownload: boolean;
  autoInstall: boolean;
  allowPrerelease: boolean;
  updateCacheDir: string;
  rollbackEnabled: boolean;
  maxRollbackVersions: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  releaseNotes: string;
  requiresRestart: boolean;
  minimumVersion?: string;
  platform: string;
  architecture: string;
}

export interface UpdateStatus {
  currentVersion: string;
  updateChannel: UpdateChannel;
  autoUpdateEnabled: boolean;
  lastCheckTime: number;
  availableUpdate: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
}

export interface DownloadProgress {
  downloadId: string;
  filename: string;
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
  speed: number;
  startTime: number;
}

export interface RollbackInfo {
  version: string;
  createdAt: number;
  appPath: string;
  requiresRestart: boolean;
}

export type UpdateChannel = 'stable' | 'beta' | 'alpha';