import * as os from 'os';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { LocalAIOption } from './SetupWizard';

export interface SystemRequirement {
  name: string;
  required: boolean;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  message: string;
  details?: string;
  fixSuggestion?: string;
}

export interface SystemCheckResult {
  overall: 'pass' | 'fail' | 'warning';
  requirements: SystemRequirement[];
  canProceed: boolean;
  warnings: string[];
  recommendations: string[];
}

export class SystemChecker {
  async checkRequirements(option: LocalAIOption): Promise<SystemCheckResult> {
    const requirements: SystemRequirement[] = [];
    
    // Check operating system
    requirements.push(await this.checkOperatingSystem(option.requirements.os));
    
    // Check RAM
    requirements.push(await this.checkRAM(option.requirements.minRAM));
    
    // Check storage
    requirements.push(await this.checkStorage(option.requirements.minStorage));
    
    // Check GPU if required
    if (option.requirements.gpu) {
      requirements.push(await this.checkGPU());
    }
    
    // Check Docker if required
    if (option.requirements.docker) {
      requirements.push(await this.checkDocker());
    }
    
    // Check specific requirements based on option type
    switch (option.type) {
      case 'ollama':
        requirements.push(...await this.checkOllamaRequirements());
        break;
      case 'lm-studio':
        requirements.push(...await this.checkLMStudioRequirements());
        break;
      case 'docker':
        requirements.push(...await this.checkDockerAIRequirements());
        break;
    }
    
    // Analyze results
    const failed = requirements.filter(req => req.required && req.status === 'fail');
    const warnings = requirements.filter(req => req.status === 'warning');
    
    const overall = failed.length > 0 ? 'fail' : warnings.length > 0 ? 'warning' : 'pass';
    const canProceed = failed.length === 0;
    
    return {
      overall,
      requirements,
      canProceed,
      warnings: warnings.map(w => w.message),
      recommendations: this.generateRecommendations(requirements, option)
    };
  }

  private async checkOperatingSystem(supportedOS: string[]): Promise<SystemRequirement> {
    const platform = os.platform();
    const platformMap: Record<string, string> = {
      'win32': 'windows',
      'darwin': 'macos',
      'linux': 'linux'
    };
    
    const currentOS = platformMap[platform] || platform;
    const isSupported = supportedOS.includes(currentOS);
    
    return {
      name: 'Operating System',
      required: true,
      status: isSupported ? 'pass' : 'fail',
      message: isSupported 
        ? `${currentOS} is supported`
        : `${currentOS} is not supported. Supported: ${supportedOS.join(', ')}`,
      details: `Current OS: ${currentOS} (${platform})`
    };
  }

  private async checkRAM(minRAM: string): Promise<SystemRequirement> {
    const totalRAM = os.totalmem();
    const totalRAMGB = Math.round(totalRAM / (1024 * 1024 * 1024));
    const requiredGB = parseInt(minRAM.replace('GB', ''));
    
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = `${totalRAMGB}GB RAM available (${minRAM} required)`;
    
    if (totalRAMGB < requiredGB) {
      status = 'fail';
      message = `Insufficient RAM: ${totalRAMGB}GB available, ${requiredGB}GB required`;
    } else if (totalRAMGB < requiredGB * 1.5) {
      status = 'warning';
      message = `RAM is sufficient but limited: ${totalRAMGB}GB available, ${requiredGB}GB required`;
    }
    
    return {
      name: 'RAM Memory',
      required: true,
      status,
      message,
      details: `Total RAM: ${totalRAMGB}GB, Required: ${requiredGB}GB`,
      fixSuggestion: status === 'fail' ? 'Consider upgrading your RAM or closing other applications' : undefined
    };
  }

  private async checkStorage(minStorage: string): Promise<SystemRequirement> {
    try {
      const stats = await fs.statfs(process.cwd());
      const freeSpaceGB = Math.round((stats.free) / (1024 * 1024 * 1024));
      const requiredGB = parseInt(minStorage.replace('GB', ''));
      
      let status: 'pass' | 'fail' | 'warning' = 'pass';
      let message = `${freeSpaceGB}GB free space available (${minStorage} required)`;
      
      if (freeSpaceGB < requiredGB) {
        status = 'fail';
        message = `Insufficient storage: ${freeSpaceGB}GB free, ${requiredGB}GB required`;
      } else if (freeSpaceGB < requiredGB * 2) {
        status = 'warning';
        message = `Storage is sufficient but limited: ${freeSpaceGB}GB free, ${requiredGB}GB required`;
      }
      
      return {
        name: 'Storage Space',
        required: true,
        status,
        message,
        details: `Free space: ${freeSpaceGB}GB, Required: ${requiredGB}GB`,
        fixSuggestion: status === 'fail' ? 'Free up disk space or choose a different installation location' : undefined
      };
    } catch (error) {
      return {
        name: 'Storage Space',
        required: true,
        status: 'unknown',
        message: 'Could not check available storage space',
        details: (error as Error).message
      };
    }
  }

  private async checkGPU(): Promise<SystemRequirement> {
    try {
      // Try to detect GPU on different platforms
      let gpuInfo = '';
      let hasGPU = false;
      
      if (os.platform() === 'win32') {
        try {
          gpuInfo = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' });
          hasGPU = gpuInfo.includes('NVIDIA') || gpuInfo.includes('AMD') || gpuInfo.includes('Intel');
        } catch (error) {
          // Fallback method for Windows
          gpuInfo = 'GPU detection failed on Windows';
        }
      } else if (os.platform() === 'darwin') {
        try {
          gpuInfo = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf8' });
          hasGPU = gpuInfo.includes('Chipset Model') || gpuInfo.includes('NVIDIA') || gpuInfo.includes('AMD');
        } catch (error) {
          gpuInfo = 'GPU detection failed on macOS';
        }
      } else {
        try {
          gpuInfo = execSync('lspci | grep -i vga', { encoding: 'utf8' });
          hasGPU = gpuInfo.length > 0;
        } catch (error) {
          try {
            gpuInfo = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', { encoding: 'utf8' });
            hasGPU = gpuInfo.trim().length > 0;
          } catch (nvidiaError) {
            gpuInfo = 'GPU detection failed on Linux';
          }
        }
      }
      
      return {
        name: 'GPU Support',
        required: false,
        status: hasGPU ? 'pass' : 'warning',
        message: hasGPU ? 'GPU detected for acceleration' : 'No GPU detected - will use CPU only',
        details: gpuInfo.substring(0, 200),
        fixSuggestion: !hasGPU ? 'Consider using a system with GPU for better performance' : undefined
      };
    } catch (error) {
      return {
        name: 'GPU Support',
        required: false,
        status: 'unknown',
        message: 'Could not detect GPU information',
        details: (error as Error).message
      };
    }
  }

  private async checkDocker(): Promise<SystemRequirement> {
    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' });
      const dockerComposeVersion = execSync('docker-compose --version', { encoding: 'utf8' });
      
      return {
        name: 'Docker',
        required: true,
        status: 'pass',
        message: 'Docker is installed and available',
        details: `${dockerVersion.trim()}, ${dockerComposeVersion.trim()}`
      };
    } catch (error) {
      return {
        name: 'Docker',
        required: true,
        status: 'fail',
        message: 'Docker is not installed or not available',
        details: (error as Error).message,
        fixSuggestion: 'Install Docker Desktop from https://docker.com/products/docker-desktop'
      };
    }
  }

  private async checkOllamaRequirements(): Promise<SystemRequirement[]> {
    const requirements: SystemRequirement[] = [];
    
    // Check if Ollama is already installed
    try {
      const ollamaVersion = execSync('ollama --version', { encoding: 'utf8' });
      requirements.push({
        name: 'Ollama Installation',
        required: false,
        status: 'pass',
        message: 'Ollama is already installed',
        details: ollamaVersion.trim()
      });
    } catch (error) {
      requirements.push({
        name: 'Ollama Installation',
        required: false,
        status: 'warning',
        message: 'Ollama is not installed (will be installed during setup)',
        details: 'Ollama will be downloaded and installed automatically'
      });
    }
    
    // Check network connectivity
    requirements.push(await this.checkNetworkConnectivity('https://ollama.ai'));
    
    return requirements;
  }

  private async checkLMStudioRequirements(): Promise<SystemRequirement[]> {
    const requirements: SystemRequirement[] = [];
    
    // Check for LM Studio installation
    const lmStudioPaths = this.getLMStudioPaths();
    let lmStudioFound = false;
    
    for (const path of lmStudioPaths) {
      try {
        await fs.access(path);
        lmStudioFound = true;
        break;
      } catch (error) {
        // Path doesn't exist, continue checking
      }
    }
    
    requirements.push({
      name: 'LM Studio Installation',
      required: false,
      status: lmStudioFound ? 'pass' : 'warning',
      message: lmStudioFound 
        ? 'LM Studio is already installed'
        : 'LM Studio is not installed (will be installed during setup)',
      details: lmStudioFound ? 'Found existing installation' : 'Will guide through installation process'
    });
    
    // Check network connectivity
    requirements.push(await this.checkNetworkConnectivity('https://lmstudio.ai'));
    
    return requirements;
  }

  private async checkDockerAIRequirements(): Promise<SystemRequirement[]> {
    const requirements: SystemRequirement[] = [];
    
    // Check Docker Compose
    try {
      const composeVersion = execSync('docker-compose --version', { encoding: 'utf8' });
      requirements.push({
        name: 'Docker Compose',
        required: true,
        status: 'pass',
        message: 'Docker Compose is available',
        details: composeVersion.trim()
      });
    } catch (error) {
      requirements.push({
        name: 'Docker Compose',
        required: true,
        status: 'fail',
        message: 'Docker Compose is not available',
        details: (error as Error).message,
        fixSuggestion: 'Install Docker Compose or use Docker Desktop which includes it'
      });
    }
    
    // Check Docker daemon
    try {
      execSync('docker info', { encoding: 'utf8' });
      requirements.push({
        name: 'Docker Daemon',
        required: true,
        status: 'pass',
        message: 'Docker daemon is running',
        details: 'Docker service is active and accessible'
      });
    } catch (error) {
      requirements.push({
        name: 'Docker Daemon',
        required: true,
        status: 'fail',
        message: 'Docker daemon is not running',
        details: (error as Error).message,
        fixSuggestion: 'Start Docker Desktop or the Docker service'
      });
    }
    
    return requirements;
  }

  private async checkNetworkConnectivity(url: string): Promise<SystemRequirement> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      return {
        name: 'Network Connectivity',
        required: true,
        status: response.ok ? 'pass' : 'warning',
        message: response.ok 
          ? 'Network connectivity is good'
          : `Network connectivity issue (${response.status})`,
        details: `Tested connection to ${url}`
      };
    } catch (error) {
      return {
        name: 'Network Connectivity',
        required: true,
        status: 'warning',
        message: 'Network connectivity could not be verified',
        details: (error as Error).message,
        fixSuggestion: 'Check your internet connection and firewall settings'
      };
    }
  }

  private getLMStudioPaths(): string[] {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return [
        'C:\\Users\\%USERNAME%\\AppData\\Local\\LM Studio\\LM Studio.exe',
        'C:\\Program Files\\LM Studio\\LM Studio.exe'
      ];
    } else if (platform === 'darwin') {
      return [
        '/Applications/LM Studio.app',
        '~/Applications/LM Studio.app'
      ];
    } else {
      return [
        '/usr/local/bin/lm-studio',
        '~/.local/bin/lm-studio',
        '/opt/lm-studio/lm-studio'
      ];
    }
  }

  private generateRecommendations(requirements: SystemRequirement[], option: LocalAIOption): string[] {
    const recommendations: string[] = [];
    
    const failedRequired = requirements.filter(req => req.required && req.status === 'fail');
    const warnings = requirements.filter(req => req.status === 'warning');
    
    if (failedRequired.length > 0) {
      recommendations.push('Address the failed requirements before proceeding with installation');
      failedRequired.forEach(req => {
        if (req.fixSuggestion) {
          recommendations.push(`${req.name}: ${req.fixSuggestion}`);
        }
      });
    }
    
    if (warnings.length > 0) {
      recommendations.push('Consider addressing the warnings for optimal performance');
    }
    
    // Option-specific recommendations
    if (option.type === 'ollama' && !requirements.find(r => r.name === 'GPU Support')?.status === 'pass') {
      recommendations.push('Ollama works well on CPU, but GPU acceleration will improve performance');
    }
    
    if (option.type === 'lm-studio' && !requirements.find(r => r.name === 'GPU Support')?.status === 'pass') {
      recommendations.push('LM Studio strongly benefits from GPU acceleration for good performance');
    }
    
    if (option.type === 'docker') {
      recommendations.push('Ensure Docker has sufficient resources allocated (RAM and CPU)');
      recommendations.push('Consider using Docker Desktop for easier management');
    }
    
    return recommendations;
  }

  // Utility method to get system information summary
  async getSystemInfo(): Promise<any> {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)) + 'GB',
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      nodeVersion: process.version,
      uptime: Math.round(os.uptime() / 3600) + ' hours'
    };
  }
}