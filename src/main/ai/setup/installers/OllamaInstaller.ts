import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface InstallationProgress {
  stage: string;
  progress: number; // 0-100
  message: string;
  details?: string;
}

export interface InstallationResult {
  success: boolean;
  version?: string;
  installPath?: string;
  error?: string;
  warnings: string[];
}

export class OllamaInstaller extends EventEmitter {
  private platform: string;
  private arch: string;
  private installDir: string;

  constructor() {
    super();
    this.platform = os.platform();
    this.arch = os.arch();
    this.installDir = this.getDefaultInstallDir();
  }

  async install(): Promise<InstallationResult> {
    const warnings: string[] = [];
    
    try {
      // Check if already installed
      if (await this.isOllamaInstalled()) {
        const version = await this.getOllamaVersion();
        return {
          success: true,
          version,
          installPath: await this.getOllamaPath(),
          warnings: ['Ollama is already installed']
        };
      }

      this.emit('progress', {
        stage: 'preparation',
        progress: 10,
        message: 'Preparing Ollama installation...',
        details: `Platform: ${this.platform}, Architecture: ${this.arch}`
      });

      // Platform-specific installation
      let result: InstallationResult;
      
      switch (this.platform) {
        case 'win32':
          result = await this.installWindows();
          break;
        case 'darwin':
          result = await this.installMacOS();
          break;
        case 'linux':
          result = await this.installLinux();
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      if (result.success) {
        // Verify installation
        this.emit('progress', {
          stage: 'verification',
          progress: 90,
          message: 'Verifying installation...'
        });

        const isInstalled = await this.isOllamaInstalled();
        if (!isInstalled) {
          throw new Error('Installation completed but Ollama is not accessible');
        }

        result.version = await this.getOllamaVersion();
        result.installPath = await this.getOllamaPath();

        this.emit('progress', {
          stage: 'complete',
          progress: 100,
          message: 'Ollama installation completed successfully!'
        });
      }

      return { ...result, warnings };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        warnings
      };
    }
  }

  private async installWindows(): Promise<InstallationResult> {
    this.emit('progress', {
      stage: 'download',
      progress: 20,
      message: 'Downloading Ollama for Windows...'
    });

    try {
      // Download the Windows installer
      const installerUrl = 'https://ollama.ai/download/OllamaSetup.exe';
      const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe');
      
      await this.downloadFile(installerUrl, installerPath);

      this.emit('progress', {
        stage: 'install',
        progress: 60,
        message: 'Running Ollama installer...',
        details: 'Please follow the installation wizard'
      });

      // Run the installer
      await this.runInstaller(installerPath, ['/S']); // Silent install

      // Clean up
      try {
        await fs.unlink(installerPath);
      } catch (error) {
        // Ignore cleanup errors
      }

      return { success: true, warnings: [] };
    } catch (error) {
      throw new Error(`Windows installation failed: ${(error as Error).message}`);
    }
  }

  private async installMacOS(): Promise<InstallationResult> {
    this.emit('progress', {
      stage: 'download',
      progress: 20,
      message: 'Downloading Ollama for macOS...'
    });

    try {
      // Check if we can use Homebrew
      const hasHomebrew = await this.hasHomebrew();
      
      if (hasHomebrew) {
        this.emit('progress', {
          stage: 'install',
          progress: 40,
          message: 'Installing Ollama via Homebrew...'
        });

        execSync('brew install ollama', { stdio: 'pipe' });
        return { success: true, warnings: [] };
      } else {
        // Manual installation
        const downloadUrl = 'https://ollama.ai/download/Ollama-darwin.zip';
        const downloadPath = path.join(os.tmpdir(), 'Ollama-darwin.zip');
        
        await this.downloadFile(downloadUrl, downloadPath);

        this.emit('progress', {
          stage: 'install',
          progress: 60,
          message: 'Installing Ollama...',
          details: 'Extracting and installing application'
        });

        // Extract and install
        await this.extractAndInstallMacOS(downloadPath);

        return { success: true, warnings: ['Installed manually - consider using Homebrew for easier updates'] };
      }
    } catch (error) {
      throw new Error(`macOS installation failed: ${(error as Error).message}`);
    }
  }

  private async installLinux(): Promise<InstallationResult> {
    this.emit('progress', {
      stage: 'download',
      progress: 20,
      message: 'Installing Ollama for Linux...'
    });

    try {
      // Use the official install script
      this.emit('progress', {
        stage: 'install',
        progress: 40,
        message: 'Running Ollama installation script...',
        details: 'This may take a few minutes'
      });

      // Download and run the install script
      const installScript = 'curl -fsSL https://ollama.ai/install.sh | sh';
      execSync(installScript, { stdio: 'pipe' });

      return { success: true, warnings: [] };
    } catch (error) {
      // Fallback to manual installation
      try {
        return await this.installLinuxManual();
      } catch (fallbackError) {
        throw new Error(`Linux installation failed: ${(error as Error).message}`);
      }
    }
  }

  private async installLinuxManual(): Promise<InstallationResult> {
    this.emit('progress', {
      stage: 'download',
      progress: 30,
      message: 'Downloading Ollama binary...'
    });

    const arch = this.arch === 'x64' ? 'amd64' : this.arch;
    const downloadUrl = `https://ollama.ai/download/ollama-linux-${arch}`;
    const binaryPath = '/usr/local/bin/ollama';

    // Download binary
    const tempPath = path.join(os.tmpdir(), 'ollama');
    await this.downloadFile(downloadUrl, tempPath);

    this.emit('progress', {
      stage: 'install',
      progress: 70,
      message: 'Installing Ollama binary...'
    });

    // Install binary (requires sudo)
    execSync(`sudo mv ${tempPath} ${binaryPath}`, { stdio: 'pipe' });
    execSync(`sudo chmod +x ${binaryPath}`, { stdio: 'pipe' });

    return { success: true, warnings: ['Installed manually - you may need to set up systemd service'] };
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
  }

  private async runInstaller(installerPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(installerPath, args, { stdio: 'pipe' });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Installer exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async hasHomebrew(): Promise<boolean> {
    try {
      execSync('which brew', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async extractAndInstallMacOS(zipPath: string): Promise<void> {
    const extractDir = path.join(os.tmpdir(), 'ollama-extract');
    
    // Create extraction directory
    await fs.mkdir(extractDir, { recursive: true });
    
    // Extract zip
    execSync(`unzip -q "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    
    // Move to Applications
    const appPath = path.join(extractDir, 'Ollama.app');
    const targetPath = '/Applications/Ollama.app';
    
    execSync(`mv "${appPath}" "${targetPath}"`, { stdio: 'pipe' });
    
    // Clean up
    await fs.rm(extractDir, { recursive: true, force: true });
    await fs.unlink(zipPath);
  }

  private async isOllamaInstalled(): Promise<boolean> {
    try {
      execSync('ollama --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getOllamaVersion(): Promise<string> {
    try {
      const output = execSync('ollama --version', { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      return 'Unknown';
    }
  }

  private async getOllamaPath(): Promise<string> {
    try {
      const output = execSync('which ollama', { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      return 'Unknown';
    }
  }

  private getDefaultInstallDir(): string {
    switch (this.platform) {
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama');
      case 'darwin':
        return '/Applications/Ollama.app';
      case 'linux':
        return '/usr/local/bin';
      default:
        return '/usr/local/bin';
    }
  }

  // Public methods for external use
  async checkInstallation(): Promise<{ installed: boolean; version?: string; path?: string }> {
    const installed = await this.isOllamaInstalled();
    
    if (installed) {
      return {
        installed: true,
        version: await this.getOllamaVersion(),
        path: await this.getOllamaPath()
      };
    }
    
    return { installed: false };
  }

  async uninstall(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          // Windows uninstall would require registry access or uninstaller
          throw new Error('Windows uninstall not implemented - use Control Panel');
        case 'darwin':
          if (await this.hasHomebrew()) {
            execSync('brew uninstall ollama', { stdio: 'pipe' });
          } else {
            await fs.rm('/Applications/Ollama.app', { recursive: true, force: true });
          }
          break;
        case 'linux':
          execSync('sudo rm -f /usr/local/bin/ollama', { stdio: 'pipe' });
          break;
      }
      return true;
    } catch (error) {
      console.error('Uninstall failed:', error);
      return false;
    }
  }

  getInstallationInstructions(): string[] {
    const instructions: string[] = [];
    
    switch (this.platform) {
      case 'win32':
        instructions.push(
          '1. Download Ollama installer from https://ollama.ai',
          '2. Run the installer as administrator',
          '3. Follow the installation wizard',
          '4. Restart your terminal or command prompt',
          '5. Verify installation with: ollama --version'
        );
        break;
      case 'darwin':
        instructions.push(
          'Option 1 - Homebrew (Recommended):',
          '1. Install Homebrew if not already installed',
          '2. Run: brew install ollama',
          '',
          'Option 2 - Manual:',
          '1. Download Ollama from https://ollama.ai',
          '2. Drag Ollama.app to Applications folder',
          '3. Open Terminal and verify: ollama --version'
        );
        break;
      case 'linux':
        instructions.push(
          'Option 1 - Install Script (Recommended):',
          '1. Run: curl -fsSL https://ollama.ai/install.sh | sh',
          '',
          'Option 2 - Manual:',
          '1. Download binary from https://ollama.ai',
          '2. Move to /usr/local/bin/ollama',
          '3. Make executable: sudo chmod +x /usr/local/bin/ollama',
          '4. Verify installation: ollama --version'
        );
        break;
    }
    
    return instructions;
  }
}