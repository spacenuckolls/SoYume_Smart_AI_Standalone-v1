import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';

/**
 * Cross-platform installer builder with dependency management
 * Creates installers for Windows, macOS, and Linux with proper dependency handling
 */
export class InstallerBuilder extends EventEmitter {
  private builderConfig: InstallerBuilderConfig;
  private platformInstallers: Map<string, PlatformInstaller>;
  private dependencyManager: DependencyManager;

  constructor(options: InstallerBuilderOptions = {}) {
    super();
    
    this.builderConfig = {
      outputDir: options.outputDir || path.join(process.cwd(), 'installers'),
      tempDir: options.tempDir || path.join(process.cwd(), 'temp', 'installers'),
      appName: options.appName || 'AI Creative Assistant',
      appVersion: options.appVersion || '1.0.0',
      appDescription: options.appDescription || 'AI-powered creative writing assistant',
      publisher: options.publisher || 'SoYume',
      homepage: options.homepage || 'https://soyume.ai',
      supportUrl: options.supportUrl || 'https://support.soyume.ai',
      licenseFile: options.licenseFile,
      iconFile: options.iconFile,
      codeSigningEnabled: options.codeSigningEnabled !== false,
      createPortable: options.createPortable !== false,
      ...options.builderConfig
    };
    
    this.platformInstallers = new Map();
    this.dependencyManager = new DependencyManager(this.builderConfig);
    
    this.initialize();
  }

  /**
   * Initialize installer builder
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.builderConfig.outputDir, { recursive: true });
      await fs.mkdir(this.builderConfig.tempDir, { recursive: true });
      
      // Initialize platform installers
      this.platformInstallers.set('windows', new WindowsInstaller(this.builderConfig));
      this.platformInstallers.set('macos', new MacOSInstaller(this.builderConfig));
      this.platformInstallers.set('linux', new LinuxInstaller(this.builderConfig));
      
      // Initialize dependency manager
      await this.dependencyManager.initialize();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize installer builder: ${(error as Error).message}`);
    }
  }

  /**
   * Build installer for specific platform
   */
  async buildInstaller(platform: string, appPath: string, options: BuildInstallerOptions = {}): Promise<InstallerArtifact> {
    const installer = this.platformInstallers.get(platform);
    if (!installer) {
      throw new Error(`No installer available for platform: ${platform}`);
    }
    
    const buildId = crypto.randomUUID();
    
    try {
      this.emit('installer-build-started', { buildId, platform });
      
      // Prepare application bundle
      const bundlePath = await this.prepareAppBundle(appPath, platform, buildId);
      
      // Resolve dependencies
      const dependencies = await this.dependencyManager.resolveDependencies(bundlePath, platform);
      
      // Build installer
      const artifact = await installer.build(bundlePath, {
        ...options,
        buildId,
        dependencies
      });
      
      this.emit('installer-build-completed', { buildId, platform, artifact });
      return artifact;
      
    } catch (error) {
      this.emit('installer-build-failed', { buildId, platform, error: error.message });
      throw error;
    }
  }

  /**
   * Build installers for all platforms
   */
  async buildAllInstallers(appPaths: Record<string, string>, options: BuildInstallerOptions = {}): Promise<InstallerArtifact[]> {
    const artifacts: InstallerArtifact[] = [];
    
    for (const [platform, appPath] of Object.entries(appPaths)) {
      try {
        const artifact = await this.buildInstaller(platform, appPath, options);
        artifacts.push(artifact);
      } catch (error) {
        this.emit('warning', `Failed to build installer for ${platform}: ${(error as Error).message}`);
      }
    }
    
    return artifacts;
  }

  /**
   * Prepare application bundle
   */
  private async prepareAppBundle(appPath: string, platform: string, buildId: string): Promise<string> {
    const bundleDir = path.join(this.builderConfig.tempDir, buildId, platform);
    await fs.mkdir(bundleDir, { recursive: true });
    
    // Copy application files
    await this.copyDirectory(appPath, bundleDir);
    
    // Add platform-specific resources
    await this.addPlatformResources(bundleDir, platform);
    
    return bundleDir;
  }

  /**
   * Add platform-specific resources
   */
  private async addPlatformResources(bundleDir: string, platform: string): Promise<void> {
    // Add license file if specified
    if (this.builderConfig.licenseFile) {
      const licenseDest = path.join(bundleDir, 'LICENSE');
      await fs.copyFile(this.builderConfig.licenseFile, licenseDest);
    }
    
    // Add icon file if specified
    if (this.builderConfig.iconFile) {
      const iconExt = platform === 'windows' ? '.ico' : platform === 'macos' ? '.icns' : '.png';
      const iconDest = path.join(bundleDir, `icon${iconExt}`);
      await fs.copyFile(this.builderConfig.iconFile, iconDest);
    }
    
    // Add platform-specific configuration
    await this.addPlatformConfig(bundleDir, platform);
  }

  /**
   * Add platform-specific configuration
   */
  private async addPlatformConfig(bundleDir: string, platform: string): Promise<void> {
    const config = {
      name: this.builderConfig.appName,
      version: this.builderConfig.appVersion,
      description: this.builderConfig.appDescription,
      publisher: this.builderConfig.publisher,
      homepage: this.builderConfig.homepage,
      supportUrl: this.builderConfig.supportUrl,
      platform
    };
    
    const configPath = path.join(bundleDir, 'app-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Cleanup platform installers
    for (const [platform, installer] of this.platformInstallers) {
      await installer.destroy();
    }
    
    await this.dependencyManager.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * Base platform installer class
 */
abstract class PlatformInstaller {
  protected config: InstallerBuilderConfig;

  constructor(config: InstallerBuilderConfig) {
    this.config = config;
  }

  abstract build(appPath: string, options: PlatformInstallerOptions): Promise<InstallerArtifact>;
  abstract destroy(): Promise<void>;
}

/**
 * Windows installer (NSIS/WiX)
 */
class WindowsInstaller extends PlatformInstaller {
  async build(appPath: string, options: PlatformInstallerOptions): Promise<InstallerArtifact> {
    const installerPath = path.join(
      this.config.outputDir,
      `${this.config.appName}-${this.config.appVersion}-setup.exe`
    );
    
    // Create NSIS script
    const nsisScript = await this.createNSISScript(appPath, options);
    const nsisScriptPath = path.join(this.config.tempDir, options.buildId, 'installer.nsi');
    await fs.writeFile(nsisScriptPath, nsisScript);
    
    // Build installer using NSIS
    await this.buildWithNSIS(nsisScriptPath, installerPath);
    
    // Code sign if enabled
    if (this.config.codeSigningEnabled) {
      await this.codeSignWindows(installerPath);
    }
    
    const stats = await fs.stat(installerPath);
    
    return {
      platform: 'windows',
      type: 'installer',
      path: installerPath,
      filename: path.basename(installerPath),
      size: stats.size,
      checksum: await this.calculateChecksum(installerPath)
    };
  }

  private async createNSISScript(appPath: string, options: PlatformInstallerOptions): Promise<string> {
    return `
!define APPNAME "${this.config.appName}"
!define APPVERSION "${this.config.appVersion}"
!define PUBLISHER "${this.config.publisher}"
!define DESCRIPTION "${this.config.appDescription}"
!define HOMEPAGE "${this.config.homepage}"

Name "\${APPNAME}"
OutFile "${path.join(this.config.outputDir, `${this.config.appName}-${this.config.appVersion}-setup.exe`)}"
InstallDir "$PROGRAMFILES64\\${this.config.appName}"
RequestExecutionLevel admin

Page directory
Page instfiles

Section "Install"
  SetOutPath $INSTDIR
  File /r "${appPath}\\*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\\uninstall.exe"
  
  ; Registry entries
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${this.config.appName}" "DisplayName" "\${APPNAME}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${this.config.appName}" "DisplayVersion" "\${APPVERSION}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${this.config.appName}" "Publisher" "\${PUBLISHER}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${this.config.appName}" "UninstallString" "$INSTDIR\\uninstall.exe"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\\${this.config.appName}"
  CreateShortCut "$SMPROGRAMS\\${this.config.appName}\\${this.config.appName}.lnk" "$INSTDIR\\${this.config.appName}.exe"
  CreateShortCut "$DESKTOP\\${this.config.appName}.lnk" "$INSTDIR\\${this.config.appName}.exe"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\\*"
  RMDir /r "$INSTDIR"
  Delete "$SMPROGRAMS\\${this.config.appName}\\${this.config.appName}.lnk"
  RMDir "$SMPROGRAMS\\${this.config.appName}"
  Delete "$DESKTOP\\${this.config.appName}.lnk"
  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${this.config.appName}"
SectionEnd
`;
  }

  private async buildWithNSIS(scriptPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const makensis = spawn('makensis', [scriptPath], { stdio: 'pipe' });
      
      makensis.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`NSIS build failed with code ${code}`));
        }
      });
      
      makensis.on('error', (error) => {
        reject(new Error(`NSIS build error: ${error.message}`));
      });
    });
  }

  private async codeSignWindows(filePath: string): Promise<void> {
    // Code signing implementation for Windows
    // This would use signtool.exe with appropriate certificates
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async destroy(): Promise<void> {
    // Cleanup Windows installer
  }
}

/**
 * macOS installer (PKG)
 */
class MacOSInstaller extends PlatformInstaller {
  async build(appPath: string, options: PlatformInstallerOptions): Promise<InstallerArtifact> {
    const installerPath = path.join(
      this.config.outputDir,
      `${this.config.appName}-${this.config.appVersion}.pkg`
    );
    
    // Build PKG installer
    await this.buildPKG(appPath, installerPath, options);
    
    // Code sign if enabled
    if (this.config.codeSigningEnabled) {
      await this.codeSignMacOS(installerPath);
    }
    
    const stats = await fs.stat(installerPath);
    
    return {
      platform: 'macos',
      type: 'installer',
      path: installerPath,
      filename: path.basename(installerPath),
      size: stats.size,
      checksum: await this.calculateChecksum(installerPath)
    };
  }

  private async buildPKG(appPath: string, outputPath: string, options: PlatformInstallerOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const pkgbuild = spawn('pkgbuild', [
        '--root', appPath,
        '--identifier', `ai.soyume.${this.config.appName.toLowerCase()}`,
        '--version', this.config.appVersion,
        '--install-location', '/Applications',
        outputPath
      ], { stdio: 'pipe' });
      
      pkgbuild.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PKG build failed with code ${code}`));
        }
      });
      
      pkgbuild.on('error', (error) => {
        reject(new Error(`PKG build error: ${error.message}`));
      });
    });
  }

  private async codeSignMacOS(filePath: string): Promise<void> {
    // Code signing implementation for macOS using codesign
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async destroy(): Promise<void> {
    // Cleanup macOS installer
  }
}

/**
 * Linux installer (DEB/RPM/AppImage)
 */
class LinuxInstaller extends PlatformInstaller {
  async build(appPath: string, options: PlatformInstallerOptions): Promise<InstallerArtifact> {
    const installerPath = path.join(
      this.config.outputDir,
      `${this.config.appName}-${this.config.appVersion}.deb`
    );
    
    // Build DEB package
    await this.buildDEB(appPath, installerPath, options);
    
    const stats = await fs.stat(installerPath);
    
    return {
      platform: 'linux',
      type: 'installer',
      path: installerPath,
      filename: path.basename(installerPath),
      size: stats.size,
      checksum: await this.calculateChecksum(installerPath)
    };
  }

  private async buildDEB(appPath: string, outputPath: string, options: PlatformInstallerOptions): Promise<void> {
    const debDir = path.join(this.config.tempDir, options.buildId, 'deb');
    
    // Create DEB structure
    await fs.mkdir(path.join(debDir, 'DEBIAN'), { recursive: true });
    await fs.mkdir(path.join(debDir, 'usr', 'bin'), { recursive: true });
    await fs.mkdir(path.join(debDir, 'usr', 'share', 'applications'), { recursive: true });
    
    // Copy application files
    await this.copyDirectory(appPath, path.join(debDir, 'opt', this.config.appName));
    
    // Create control file
    const controlContent = `Package: ${this.config.appName.toLowerCase()}
Version: ${this.config.appVersion}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: ${this.config.publisher}
Description: ${this.config.appDescription}
Homepage: ${this.config.homepage}
`;
    
    await fs.writeFile(path.join(debDir, 'DEBIAN', 'control'), controlContent);
    
    // Create desktop entry
    const desktopEntry = `[Desktop Entry]
Name=${this.config.appName}
Comment=${this.config.appDescription}
Exec=/opt/${this.config.appName}/${this.config.appName}
Icon=/opt/${this.config.appName}/icon.png
Terminal=false
Type=Application
Categories=Office;
`;
    
    await fs.writeFile(
      path.join(debDir, 'usr', 'share', 'applications', `${this.config.appName.toLowerCase()}.desktop`),
      desktopEntry
    );
    
    // Build DEB package
    return new Promise((resolve, reject) => {
      const dpkg = spawn('dpkg-deb', ['--build', debDir, outputPath], { stdio: 'pipe' });
      
      dpkg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`DEB build failed with code ${code}`));
        }
      });
      
      dpkg.on('error', (error) => {
        reject(new Error(`DEB build error: ${error.message}`));
      });
    });
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async destroy(): Promise<void> {
    // Cleanup Linux installer
  }
}

/**
 * Dependency manager for resolving and bundling dependencies
 */
class DependencyManager {
  private config: InstallerBuilderConfig;

  constructor(config: InstallerBuilderConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize dependency manager
  }

  async resolveDependencies(appPath: string, platform: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    
    // Analyze application dependencies
    const packageJsonPath = path.join(appPath, 'package.json');
    
    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      // Process production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'npm',
            required: true,
            platform: 'all'
          });
        }
      }
      
      // Add platform-specific dependencies
      const platformDeps = await this.getPlatformDependencies(platform);
      dependencies.push(...platformDeps);
      
    } catch (error) {
      // No package.json or parsing error
    }
    
    return dependencies;
  }

  private async getPlatformDependencies(platform: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    
    switch (platform) {
      case 'windows':
        dependencies.push({
          name: 'Microsoft Visual C++ Redistributable',
          version: 'latest',
          type: 'system',
          required: true,
          platform: 'windows'
        });
        break;
        
      case 'macos':
        // macOS typically has fewer external dependencies
        break;
        
      case 'linux':
        dependencies.push({
          name: 'libnss3',
          version: 'latest',
          type: 'system',
          required: true,
          platform: 'linux'
        });
        break;
    }
    
    return dependencies;
  }

  async destroy(): Promise<void> {
    // Cleanup dependency manager
  }
}

// Types and interfaces
export interface InstallerBuilderOptions {
  outputDir?: string;
  tempDir?: string;
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  publisher?: string;
  homepage?: string;
  supportUrl?: string;
  licenseFile?: string;
  iconFile?: string;
  codeSigningEnabled?: boolean;
  createPortable?: boolean;
  builderConfig?: Partial<InstallerBuilderConfig>;
}

export interface InstallerBuilderConfig {
  outputDir: string;
  tempDir: string;
  appName: string;
  appVersion: string;
  appDescription: string;
  publisher: string;
  homepage: string;
  supportUrl: string;
  licenseFile?: string;
  iconFile?: string;
  codeSigningEnabled: boolean;
  createPortable: boolean;
}

export interface BuildInstallerOptions {
  buildId?: string;
  dependencies?: Dependency[];
  customScript?: string;
  includeRuntime?: boolean;
}

export interface PlatformInstallerOptions extends BuildInstallerOptions {
  buildId: string;
  dependencies: Dependency[];
}

export interface InstallerArtifact {
  platform: string;
  type: 'installer' | 'portable';
  path: string;
  filename: string;
  size: number;
  checksum: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'system' | 'runtime';
  required: boolean;
  platform: 'all' | 'windows' | 'macos' | 'linux';
}