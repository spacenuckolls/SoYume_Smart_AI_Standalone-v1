import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync, spawn } from 'child_process';
import * as crypto from 'crypto';

/**
 * Automated build pipeline for Windows, macOS, and Linux
 * Handles cross-platform building, packaging, and distribution
 */
export class BuildPipeline extends EventEmitter {
  private buildConfig: BuildConfiguration;
  private currentBuild: BuildProcess | null;
  private buildHistory: BuildRecord[];

  constructor(config: BuildConfiguration) {
    super();
    
    this.buildConfig = config;
    this.currentBuild = null;
    this.buildHistory = [];
  }

  /**
   * Start a new build process
   */
  async startBuild(options: BuildOptions): Promise<BuildResult> {
    if (this.currentBuild) {
      throw new Error('Build already in progress');
    }

    const buildId = this.generateBuildId();
    const startTime = Date.now();

    this.currentBuild = {
      id: buildId,
      startTime,
      status: BuildStatus.RUNNING,
      platforms: options.platforms,
      version: options.version,
      buildType: options.buildType,
      steps: []
    };

    this.emit('buildStarted', { buildId, platforms: options.platforms });

    try {
      // Pre-build validation
      await this.validateBuildEnvironment(options.platforms);
      
      // Clean previous builds
      await this.cleanBuildArtifacts();
      
      // Build for each platform
      const platformResults: PlatformBuildResult[] = [];
      
      for (const platform of options.platforms) {
        this.emit('platformBuildStarted', { buildId, platform });
        
        try {
          const result = await this.buildForPlatform(platform, options);
          platformResults.push(result);
          
          this.emit('platformBuildCompleted', { buildId, platform, result });
        } catch (error) {
          const errorResult: PlatformBuildResult = {
            platform,
            success: false,
            error: error.message,
            duration: Date.now() - startTime
          };
          
          platformResults.push(errorResult);
          this.emit('platformBuildFailed', { buildId, platform, error: error.message });
        }
      }
      
      // Generate build artifacts
      const artifacts = await this.generateBuildArtifacts(platformResults, options);
      
      // Create distribution packages
      const distributionPackages = await this.createDistributionPackages(artifacts, options);
      
      const buildResult: BuildResult = {
        buildId,
        success: platformResults.every(r => r.success),
        duration: Date.now() - startTime,
        platforms: platformResults,
        artifacts,
        distributionPackages,
        version: options.version,
        buildType: options.buildType
      };

      // Record build history
      this.recordBuild(buildResult);
      
      this.currentBuild = null;
      this.emit('buildCompleted', buildResult);
      
      return buildResult;

    } catch (error) {
      const buildResult: BuildResult = {
        buildId,
        success: false,
        duration: Date.now() - startTime,
        platforms: [],
        artifacts: [],
        distributionPackages: [],
        version: options.version,
        buildType: options.buildType,
        error: error.message
      };

      this.currentBuild = null;
      this.emit('buildFailed', buildResult);
      
      return buildResult;
    }
  }

  /**
   * Get current build status
   */
  getCurrentBuild(): BuildProcess | null {
    return this.currentBuild;
  }

  /**
   * Get build history
   */
  getBuildHistory(): BuildRecord[] {
    return [...this.buildHistory];
  }

  /**
   * Cancel current build
   */
  async cancelBuild(): Promise<void> {
    if (!this.currentBuild) {
      throw new Error('No build in progress');
    }

    this.currentBuild.status = BuildStatus.CANCELLED;
    this.emit('buildCancelled', { buildId: this.currentBuild.id });
    
    // Kill any running processes
    // Implementation would depend on the specific build tools being used
    
    this.currentBuild = null;
  }

  /**
   * Validate build environment for target platforms
   */
  private async validateBuildEnvironment(platforms: BuildPlatform[]): Promise<void> {
    const validationResults: EnvironmentValidation[] = [];

    for (const platform of platforms) {
      const validation = await this.validatePlatformEnvironment(platform);
      validationResults.push(validation);
    }

    const failures = validationResults.filter(v => !v.valid);
    if (failures.length > 0) {
      const errorMessage = failures.map(f => `${f.platform}: ${f.error}`).join(', ');
      throw new Error(`Build environment validation failed: ${errorMessage}`);
    }
  }

  /**
   * Validate environment for a specific platform
   */
  private async validatePlatformEnvironment(platform: BuildPlatform): Promise<EnvironmentValidation> {
    try {
      switch (platform) {
        case BuildPlatform.WINDOWS:
          return await this.validateWindowsEnvironment();
        case BuildPlatform.MACOS:
          return await this.validateMacOSEnvironment();
        case BuildPlatform.LINUX:
          return await this.validateLinuxEnvironment();
        default:
          return {
            platform,
            valid: false,
            error: `Unsupported platform: ${platform}`
          };
      }
    } catch (error) {
      return {
        platform,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Windows build environment
   */
  private async validateWindowsEnvironment(): Promise<EnvironmentValidation> {
    const requirements = [
      { command: 'node --version', description: 'Node.js' },
      { command: 'npm --version', description: 'npm' },
      { command: 'electron-builder --version', description: 'electron-builder' }
    ];

    for (const req of requirements) {
      try {
        execSync(req.command, { stdio: 'pipe' });
      } catch (error) {
        return {
          platform: BuildPlatform.WINDOWS,
          valid: false,
          error: `Missing requirement: ${req.description}`
        };
      }
    }

    return {
      platform: BuildPlatform.WINDOWS,
      valid: true
    };
  }

  /**
   * Validate macOS build environment
   */
  private async validateMacOSEnvironment(): Promise<EnvironmentValidation> {
    const requirements = [
      { command: 'node --version', description: 'Node.js' },
      { command: 'npm --version', description: 'npm' },
      { command: 'electron-builder --version', description: 'electron-builder' },
      { command: 'xcodebuild -version', description: 'Xcode' }
    ];

    for (const req of requirements) {
      try {
        execSync(req.command, { stdio: 'pipe' });
      } catch (error) {
        return {
          platform: BuildPlatform.MACOS,
          valid: false,
          error: `Missing requirement: ${req.description}`
        };
      }
    }

    return {
      platform: BuildPlatform.MACOS,
      valid: true
    };
  }

  /**
   * Validate Linux build environment
   */
  private async validateLinuxEnvironment(): Promise<EnvironmentValidation> {
    const requirements = [
      { command: 'node --version', description: 'Node.js' },
      { command: 'npm --version', description: 'npm' },
      { command: 'electron-builder --version', description: 'electron-builder' }
    ];

    for (const req of requirements) {
      try {
        execSync(req.command, { stdio: 'pipe' });
      } catch (error) {
        return {
          platform: BuildPlatform.LINUX,
          valid: false,
          error: `Missing requirement: ${req.description}`
        };
      }
    }

    return {
      platform: BuildPlatform.LINUX,
      valid: true
    };
  }

  /**
   * Clean previous build artifacts
   */
  private async cleanBuildArtifacts(): Promise<void> {
    const cleanupPaths = [
      'dist',
      'build',
      'release',
      'packages'
    ];

    for (const cleanupPath of cleanupPaths) {
      try {
        await fs.rm(cleanupPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors if directories don't exist
      }
    }
  }

  /**
   * Build for a specific platform
   */
  private async buildForPlatform(platform: BuildPlatform, options: BuildOptions): Promise<PlatformBuildResult> {
    const startTime = Date.now();
    
    try {
      // Install dependencies
      await this.installDependencies();
      
      // Build application
      await this.buildApplication(options);
      
      // Package for platform
      const packageResult = await this.packageForPlatform(platform, options);
      
      // Sign if required
      if (options.sign && this.shouldSignForPlatform(platform)) {
        await this.signPackage(platform, packageResult.packagePath);
      }
      
      // Verify package
      await this.verifyPackage(platform, packageResult.packagePath);
      
      return {
        platform,
        success: true,
        duration: Date.now() - startTime,
        packagePath: packageResult.packagePath,
        packageSize: packageResult.packageSize,
        checksum: packageResult.checksum
      };

    } catch (error) {
      return {
        platform,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Install dependencies
   */
  private async installDependencies(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['ci'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm ci failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Build the application
   */
  private async buildApplication(options: BuildOptions): Promise<void> {
    const buildCommand = options.buildType === BuildType.PRODUCTION ? 'build' : 'build:dev';
    
    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['run', buildCommand], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('buildOutput', { data: data.toString() });
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
        this.emit('buildError', { data: data.toString() });
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Package for specific platform
   */
  private async packageForPlatform(platform: BuildPlatform, options: BuildOptions): Promise<PackageResult> {
    const platformFlag = this.getPlatformFlag(platform);
    const outputDir = path.join('packages', platform);
    
    return new Promise((resolve, reject) => {
      const args = ['run', 'package', '--', platformFlag, '--publish=never'];
      
      if (options.buildType === BuildType.PRODUCTION) {
        args.push('--config.compression=maximum');
      }

      const process = spawn('npm', args, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('packageOutput', { platform, data: data.toString() });
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', async (code) => {
        if (code === 0) {
          try {
            const packagePath = await this.findPackageFile(outputDir, platform);
            const packageSize = await this.getFileSize(packagePath);
            const checksum = await this.calculateChecksum(packagePath);
            
            resolve({
              packagePath,
              packageSize,
              checksum
            });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Packaging failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Sign package for platform
   */
  private async signPackage(platform: BuildPlatform, packagePath: string): Promise<void> {
    switch (platform) {
      case BuildPlatform.WINDOWS:
        await this.signWindowsPackage(packagePath);
        break;
      case BuildPlatform.MACOS:
        await this.signMacOSPackage(packagePath);
        break;
      case BuildPlatform.LINUX:
        // Linux packages typically don't require signing
        break;
    }
  }

  /**
   * Sign Windows package
   */
  private async signWindowsPackage(packagePath: string): Promise<void> {
    const certificatePath = this.buildConfig.signing?.windows?.certificatePath;
    const certificatePassword = this.buildConfig.signing?.windows?.certificatePassword;
    
    if (!certificatePath || !certificatePassword) {
      throw new Error('Windows signing certificate not configured');
    }

    return new Promise((resolve, reject) => {
      const args = [
        'sign',
        '/f', certificatePath,
        '/p', certificatePassword,
        '/t', 'http://timestamp.digicert.com',
        '/fd', 'SHA256',
        packagePath
      ];

      const process = spawn('signtool', args, {
        stdio: 'pipe',
        shell: true
      });

      let errorOutput = '';

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Windows signing failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Sign macOS package
   */
  private async signMacOSPackage(packagePath: string): Promise<void> {
    const identity = this.buildConfig.signing?.macos?.identity;
    
    if (!identity) {
      throw new Error('macOS signing identity not configured');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--sign', identity,
        '--force',
        '--verbose',
        packagePath
      ];

      const process = spawn('codesign', args, {
        stdio: 'pipe',
        shell: true
      });

      let errorOutput = '';

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`macOS signing failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Verify package integrity
   */
  private async verifyPackage(platform: BuildPlatform, packagePath: string): Promise<void> {
    // Check if file exists and is readable
    try {
      await fs.access(packagePath);
    } catch (error) {
      throw new Error(`Package verification failed: ${packagePath} not found`);
    }

    // Check file size
    const stats = await fs.stat(packagePath);
    if (stats.size === 0) {
      throw new Error(`Package verification failed: ${packagePath} is empty`);
    }

    // Platform-specific verification
    switch (platform) {
      case BuildPlatform.WINDOWS:
        await this.verifyWindowsPackage(packagePath);
        break;
      case BuildPlatform.MACOS:
        await this.verifyMacOSPackage(packagePath);
        break;
      case BuildPlatform.LINUX:
        await this.verifyLinuxPackage(packagePath);
        break;
    }
  }

  /**
   * Verify Windows package
   */
  private async verifyWindowsPackage(packagePath: string): Promise<void> {
    // Verify signature if signed
    if (this.buildConfig.signing?.windows) {
      return new Promise((resolve, reject) => {
        const process = spawn('signtool', ['verify', '/pa', packagePath], {
          stdio: 'pipe',
          shell: true
        });

        let errorOutput = '';

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Windows package verification failed: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });
    }
  }

  /**
   * Verify macOS package
   */
  private async verifyMacOSPackage(packagePath: string): Promise<void> {
    // Verify signature if signed
    if (this.buildConfig.signing?.macos) {
      return new Promise((resolve, reject) => {
        const process = spawn('codesign', ['--verify', '--verbose', packagePath], {
          stdio: 'pipe',
          shell: true
        });

        let errorOutput = '';

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`macOS package verification failed: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });
    }
  }

  /**
   * Verify Linux package
   */
  private async verifyLinuxPackage(packagePath: string): Promise<void> {
    // Basic verification - check if it's a valid archive
    const extension = path.extname(packagePath).toLowerCase();
    
    if (extension === '.appimage') {
      // Verify AppImage
      return new Promise((resolve, reject) => {
        const process = spawn('file', [packagePath], {
          stdio: 'pipe',
          shell: true
        });

        let output = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0 && output.includes('ELF')) {
            resolve();
          } else {
            reject(new Error('Linux package verification failed: Invalid AppImage'));
          }
        });

        process.on('error', (error) => {
          reject(error);
        });
      });
    }
  }

  /**
   * Generate build artifacts
   */
  private async generateBuildArtifacts(
    platformResults: PlatformBuildResult[],
    options: BuildOptions
  ): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];

    for (const result of platformResults.filter(r => r.success)) {
      if (result.packagePath) {
        artifacts.push({
          platform: result.platform,
          type: 'package',
          path: result.packagePath,
          size: result.packageSize || 0,
          checksum: result.checksum || '',
          version: options.version
        });
      }
    }

    // Generate checksums file
    const checksumsPath = await this.generateChecksumsFile(artifacts);
    artifacts.push({
      platform: 'all' as BuildPlatform,
      type: 'checksums',
      path: checksumsPath,
      size: await this.getFileSize(checksumsPath),
      checksum: await this.calculateChecksum(checksumsPath),
      version: options.version
    });

    return artifacts;
  }

  /**
   * Create distribution packages
   */
  private async createDistributionPackages(
    artifacts: BuildArtifact[],
    options: BuildOptions
  ): Promise<DistributionPackage[]> {
    const packages: DistributionPackage[] = [];

    // Create release archive
    const releaseArchivePath = await this.createReleaseArchive(artifacts, options);
    packages.push({
      type: 'release-archive',
      path: releaseArchivePath,
      size: await this.getFileSize(releaseArchivePath),
      checksum: await this.calculateChecksum(releaseArchivePath),
      platforms: artifacts.map(a => a.platform).filter(p => p !== 'all'),
      version: options.version
    });

    return packages;
  }

  /**
   * Helper methods
   */
  private generateBuildId(): string {
    return `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPlatformFlag(platform: BuildPlatform): string {
    switch (platform) {
      case BuildPlatform.WINDOWS:
        return '--win';
      case BuildPlatform.MACOS:
        return '--mac';
      case BuildPlatform.LINUX:
        return '--linux';
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private shouldSignForPlatform(platform: BuildPlatform): boolean {
    switch (platform) {
      case BuildPlatform.WINDOWS:
        return !!this.buildConfig.signing?.windows;
      case BuildPlatform.MACOS:
        return !!this.buildConfig.signing?.macos;
      case BuildPlatform.LINUX:
        return false; // Linux packages typically don't require signing
      default:
        return false;
    }
  }

  private async findPackageFile(outputDir: string, platform: BuildPlatform): Promise<string> {
    const files = await fs.readdir(outputDir, { recursive: true });
    
    const extensions = this.getPackageExtensions(platform);
    const packageFile = files.find(file => 
      extensions.some(ext => file.toString().endsWith(ext))
    );

    if (!packageFile) {
      throw new Error(`Package file not found in ${outputDir}`);
    }

    return path.join(outputDir, packageFile.toString());
  }

  private getPackageExtensions(platform: BuildPlatform): string[] {
    switch (platform) {
      case BuildPlatform.WINDOWS:
        return ['.exe', '.msi'];
      case BuildPlatform.MACOS:
        return ['.dmg', '.pkg'];
      case BuildPlatform.LINUX:
        return ['.AppImage', '.deb', '.rpm'];
      default:
        return [];
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  private async generateChecksumsFile(artifacts: BuildArtifact[]): Promise<string> {
    const checksumsPath = path.join('packages', 'checksums.txt');
    
    let content = '# SHA256 Checksums\n\n';
    
    for (const artifact of artifacts) {
      if (artifact.type === 'package') {
        const filename = path.basename(artifact.path);
        content += `${artifact.checksum}  ${filename}\n`;
      }
    }

    await fs.writeFile(checksumsPath, content);
    return checksumsPath;
  }

  private async createReleaseArchive(artifacts: BuildArtifact[], options: BuildOptions): Promise<string> {
    const archivePath = path.join('packages', `ai-creative-assistant-${options.version}.zip`);
    
    // This would use a proper archiving library in production
    // For now, we'll just create a placeholder
    await fs.writeFile(archivePath, 'Release archive placeholder');
    
    return archivePath;
  }

  private recordBuild(result: BuildResult): void {
    const record: BuildRecord = {
      ...result,
      timestamp: Date.now()
    };

    this.buildHistory.push(record);

    // Keep only last 50 builds
    if (this.buildHistory.length > 50) {
      this.buildHistory.shift();
    }
  }
}

// Types and interfaces
export interface BuildConfiguration {
  signing?: {
    windows?: {
      certificatePath: string;
      certificatePassword: string;
    };
    macos?: {
      identity: string;
    };
  };
  distribution?: {
    channels: string[];
    updateServer?: string;
  };
}

export interface BuildOptions {
  platforms: BuildPlatform[];
  version: string;
  buildType: BuildType;
  sign?: boolean;
  publish?: boolean;
}

export interface BuildResult {
  buildId: string;
  success: boolean;
  duration: number;
  platforms: PlatformBuildResult[];
  artifacts: BuildArtifact[];
  distributionPackages: DistributionPackage[];
  version: string;
  buildType: BuildType;
  error?: string;
}

export interface PlatformBuildResult {
  platform: BuildPlatform;
  success: boolean;
  duration: number;
  packagePath?: string;
  packageSize?: number;
  checksum?: string;
  error?: string;
}

export interface BuildArtifact {
  platform: BuildPlatform;
  type: 'package' | 'checksums';
  path: string;
  size: number;
  checksum: string;
  version: string;
}

export interface DistributionPackage {
  type: 'release-archive';
  path: string;
  size: number;
  checksum: string;
  platforms: BuildPlatform[];
  version: string;
}

export interface BuildProcess {
  id: string;
  startTime: number;
  status: BuildStatus;
  platforms: BuildPlatform[];
  version: string;
  buildType: BuildType;
  steps: BuildStep[];
}

export interface BuildStep {
  name: string;
  status: BuildStatus;
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface BuildRecord extends BuildResult {
  timestamp: number;
}

export interface EnvironmentValidation {
  platform: BuildPlatform;
  valid: boolean;
  error?: string;
}

export interface PackageResult {
  packagePath: string;
  packageSize: number;
  checksum: string;
}

export enum BuildPlatform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux'
}

export enum BuildType {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production'
}

export enum BuildStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}