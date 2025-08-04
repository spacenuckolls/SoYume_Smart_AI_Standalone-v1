import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { EventEmitter } from 'events';

export interface LMStudioInstallationResult {
  success: boolean;
  version?: string;
  installPath?: string;
  error?: string;
  warnings: string[];
  requiresManualSteps: boolean;
  manualInstructions?: string[];
}

export class LMStudioInstaller extends EventEmitter {
  private platform: string;
  private arch: string;

  constructor() {
    super();
    this.platform = os.platform();
    this.arch = os.arch();
  }

  async install(): Promise<LMStudioInstallationResult> {
    const warnings: string[] = [];

    try {
      // Check if already installed
      const existingInstall = await this.findExistingInstallation();
      if (existingInstall.found) {
        return {
          success: true,
          version: existingInstall.version,
          installPath: existingInstall.path,
          warnings: ['LM Studio is already installed'],
          requiresManualSteps: false
        };
      }

      this.emit('progress', {
        stage: 'preparation',
        progress: 10,
        message: 'Preparing LM Studio installation...',
        details: `Platform: ${this.platform}, Architecture: ${this.arch}`
      });

      // LM Studio requires manual installation on most platforms
      // We can guide the user through the process
      const downloadInfo = this.getDownloadInfo();
      
      this.emit('progress', {
        stage: 'guidance',
        progress: 50,
        message: 'LM Studio requires manual installation',
        details: 'Providing installation instructions'
      });

      return {
        success: true,
        requiresManualSteps: true,
        manualInstructions: this.getInstallationInstructions(),
        warnings: ['LM Studio must be installed manually - automated installation not available']
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        warnings,
        requiresManualSteps: true,
        manualInstructions: this.getInstallationInstructions()
      };
    }
  }

  private async findExistingInstallation(): Promise<{
    found: boolean;
    path?: string;
    version?: string;
  }> {
    const possiblePaths = this.getLMStudioPaths();

    for (const installPath of possiblePaths) {
      try {
        await fs.access(installPath);
        
        // Try to get version information
        let version: string | undefined;
        try {
          version = await this.getVersionFromPath(installPath);
        } catch (error) {
          version = 'Unknown';
        }

        return {
          found: true,
          path: installPath,
          version
        };
      } catch (error) {
        // Path doesn't exist, continue checking
      }
    }

    return { found: false };
  }

  private getLMStudioPaths(): string[] {
    switch (this.platform) {
      case 'win32':
        return [
          path.join(os.homedir(), 'AppData', 'Local', 'LM Studio', 'LM Studio.exe'),
          'C:\\Program Files\\LM Studio\\LM Studio.exe',
          'C:\\Program Files (x86)\\LM Studio\\LM Studio.exe'
        ];
      case 'darwin':
        return [
          '/Applications/LM Studio.app',
          path.join(os.homedir(), 'Applications', 'LM Studio.app')
        ];
      case 'linux':
        return [
          '/usr/local/bin/lm-studio',
          path.join(os.homedir(), '.local', 'bin', 'lm-studio'),
          '/opt/lm-studio/lm-studio',
          path.join(os.homedir(), 'LM Studio', 'lm-studio')
        ];
      default:
        return [];
    }
  }

  private async getVersionFromPath(installPath: string): Promise<string> {
    // This is platform-specific and would require different approaches
    // For now, return a placeholder
    return 'Detected';
  }

  private getDownloadInfo(): { url: string; filename: string; size: string } {
    const baseUrl = 'https://lmstudio.ai/download';
    
    switch (this.platform) {
      case 'win32':
        return {
          url: `${baseUrl}/windows`,
          filename: 'LM-Studio-Setup.exe',
          size: '~200MB'
        };
      case 'darwin':
        const macArch = this.arch === 'arm64' ? 'apple-silicon' : 'intel';
        return {
          url: `${baseUrl}/mac-${macArch}`,
          filename: 'LM-Studio.dmg',
          size: '~150MB'
        };
      case 'linux':
        return {
          url: `${baseUrl}/linux`,
          filename: 'LM-Studio.AppImage',
          size: '~180MB'
        };
      default:
        return {
          url: baseUrl,
          filename: 'LM-Studio',
          size: 'Unknown'
        };
    }
  }

  getInstallationInstructions(): string[] {
    const downloadInfo = this.getDownloadInfo();
    const instructions: string[] = [];

    instructions.push(
      '🚀 LM Studio Installation Guide',
      '',
      'LM Studio provides a beautiful GUI for running local AI models.',
      'Follow these steps to install:'
    );

    switch (this.platform) {
      case 'win32':
        instructions.push(
          '',
          '📥 Windows Installation:',
          '1. Visit https://lmstudio.ai',
          '2. Click "Download for Windows"',
          `3. Run the downloaded ${downloadInfo.filename}`,
          '4. Follow the installation wizard',
          '5. Launch LM Studio from the Start Menu',
          '6. Complete the initial setup',
          '',
          '⚡ Quick Start:',
          '• Browse and download models from the built-in marketplace',
          '• Start the local server (Server tab)',
          '• Use the API at http://localhost:1234'
        );
        break;

      case 'darwin':
        instructions.push(
          '',
          '📥 macOS Installation:',
          '1. Visit https://lmstudio.ai',
          `2. Download for ${this.arch === 'arm64' ? 'Apple Silicon' : 'Intel'} Mac`,
          `3. Open the downloaded ${downloadInfo.filename}`,
          '4. Drag LM Studio to Applications folder',
          '5. Launch LM Studio from Applications',
          '6. Allow security permissions if prompted',
          '',
          '⚡ Quick Start:',
          '• Download models from the marketplace',
          '• Enable the local server',
          '• API will be available at http://localhost:1234'
        );
        break;

      case 'linux':
        instructions.push(
          '',
          '📥 Linux Installation:',
          '1. Visit https://lmstudio.ai',
          '2. Download the Linux AppImage',
          `3. Make ${downloadInfo.filename} executable:`,
          `   chmod +x ${downloadInfo.filename}`,
          `4. Run the AppImage: ./${downloadInfo.filename}`,
          '5. (Optional) Create desktop shortcut',
          '',
          '⚡ Quick Start:',
          '• Download models through the interface',
          '• Start the local server',
          '• Connect via http://localhost:1234'
        );
        break;
    }

    instructions.push(
      '',
      '🎯 Recommended Models for Creative Writing:',
      '• Llama 3.1 8B Instruct - Excellent for story writing',
      '• Mistral 7B Instruct - Fast and creative',
      '• Neural Chat 7B - Great for dialogue',
      '• Code Llama 13B - For technical writing',
      '',
      '⚙️ Configuration Tips:',
      '• Allocate sufficient GPU memory in settings',
      '• Enable GPU acceleration if available',
      '• Set context length to 4096+ for longer stories',
      '• Use temperature 0.7-0.9 for creative writing',
      '',
      '🔧 System Requirements:',
      '• RAM: 16GB+ recommended (8GB minimum)',
      '• Storage: 20GB+ free space for models',
      '• GPU: NVIDIA/AMD recommended for speed',
      '• CPU: Modern multi-core processor',
      '',
      '❓ After Installation:',
      '1. Launch LM Studio',
      '2. Go to the "Server" tab',
      '3. Click "Start Server"',
      '4. Return to this setup wizard',
      '5. Click "Test Connection" to verify'
    );

    return instructions;
  }

  async checkInstallation(): Promise<{
    installed: boolean;
    running: boolean;
    version?: string;
    path?: string;
    serverRunning?: boolean;
  }> {
    const existingInstall = await this.findExistingInstallation();
    
    if (!existingInstall.found) {
      return { installed: false, running: false };
    }

    // Check if LM Studio server is running
    const serverRunning = await this.isServerRunning();

    return {
      installed: true,
      running: true, // If we found the installation, assume it can run
      version: existingInstall.version,
      path: existingInstall.path,
      serverRunning
    };
  }

  private async isServerRunning(): Promise<boolean> {
    try {
      // LM Studio typically runs on port 1234
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async waitForInstallation(timeoutMs: number = 300000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkInstallation();
      if (status.installed) {
        return true;
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.emit('progress', {
        stage: 'waiting',
        progress: Math.min(90, ((Date.now() - startTime) / timeoutMs) * 100),
        message: 'Waiting for LM Studio installation...',
        details: 'Please complete the installation process'
      });
    }
    
    return false;
  }

  getServerInstructions(): string[] {
    return [
      '🖥️ Starting LM Studio Server:',
      '',
      '1. Launch LM Studio application',
      '2. Click on the "Server" tab (usually at the top)',
      '3. Select a model from the dropdown (download one first if needed)',
      '4. Click "Start Server" button',
      '5. Server will start on http://localhost:1234',
      '',
      '📋 Server Configuration:',
      '• Port: 1234 (default)',
      '• API Format: OpenAI Compatible',
      '• Context Length: 4096+ recommended',
      '• GPU Acceleration: Enable if available',
      '',
      '🔍 Troubleshooting:',
      '• If port 1234 is busy, try a different port',
      '• Ensure your firewall allows local connections',
      '• Check that you have sufficient RAM for the model',
      '• GPU drivers should be up to date for acceleration',
      '',
      '✅ Verification:',
      '• Server status should show "Running"',
      '• You should see model loaded in the interface',
      '• Test with a simple prompt in the chat tab'
    ];
  }

  getTroubleshootingGuide(): string[] {
    return [
      '🔧 LM Studio Troubleshooting:',
      '',
      '❌ Installation Issues:',
      '• Windows: Run installer as administrator',
      '• macOS: Allow app in Security & Privacy settings',
      '• Linux: Ensure AppImage has execute permissions',
      '',
      '❌ Server Won\'t Start:',
      '• Check if port 1234 is already in use',
      '• Ensure you have a model downloaded',
      '• Verify sufficient RAM is available',
      '• Try restarting LM Studio',
      '',
      '❌ Model Loading Issues:',
      '• Check available disk space',
      '• Verify model file integrity',
      '• Try a smaller model first',
      '• Clear model cache if corrupted',
      '',
      '❌ Performance Issues:',
      '• Enable GPU acceleration in settings',
      '• Reduce context length if memory limited',
      '• Close other resource-intensive applications',
      '• Consider using a smaller model',
      '',
      '❌ Connection Issues:',
      '• Verify server is running (green status)',
      '• Check firewall settings',
      '• Try accessing http://localhost:1234 in browser',
      '• Restart both LM Studio and this application',
      '',
      '📞 Getting Help:',
      '• LM Studio Discord: https://discord.gg/aPQfnNkxGC',
      '• Documentation: https://lmstudio.ai/docs',
      '• GitHub Issues: https://github.com/lmstudio-ai'
    ];
  }

  async openLMStudio(): Promise<boolean> {
    try {
      const existingInstall = await this.findExistingInstallation();
      if (!existingInstall.found || !existingInstall.path) {
        return false;
      }

      switch (this.platform) {
        case 'win32':
          execSync(`start "" "${existingInstall.path}"`, { stdio: 'ignore' });
          break;
        case 'darwin':
          execSync(`open "${existingInstall.path}"`, { stdio: 'ignore' });
          break;
        case 'linux':
          execSync(`"${existingInstall.path}" &`, { stdio: 'ignore' });
          break;
      }

      return true;
    } catch (error) {
      console.error('Failed to open LM Studio:', error);
      return false;
    }
  }

  getSystemRequirements(): {
    minimum: Record<string, string>;
    recommended: Record<string, string>;
  } {
    return {
      minimum: {
        'RAM': '8GB',
        'Storage': '10GB free space',
        'CPU': 'Modern multi-core processor',
        'OS': 'Windows 10+, macOS 10.15+, or Linux'
      },
      recommended: {
        'RAM': '16GB or more',
        'Storage': '50GB+ for multiple models',
        'GPU': 'NVIDIA RTX series or AMD equivalent',
        'CPU': '8+ core processor',
        'OS': 'Latest version with GPU drivers'
      }
    };
  }
}