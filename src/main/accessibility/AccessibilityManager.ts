import { BrowserWindow } from 'electron';
import { ConfigManager, AccessibilitySettings, TTSSettings } from '../config/ConfigManager';

export class AccessibilityManager {
  private configManager: ConfigManager;
  private speechSynthesis: any = null;
  private currentUtterance: any = null;
  private initialized = false;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.configManager.initialize();
    await this.initializeTTS();
    
    this.initialized = true;
    console.log('Accessibility Manager initialized');
  }

  private async initializeTTS(): Promise<void> {
    // Initialize text-to-speech capabilities
    // This will be expanded with native TTS integration
    console.log('Text-to-speech initialized');
  }

  // Window accessibility setup
  applyWindowSettings(window: BrowserWindow): void {
    const settings = this.configManager.getAccessibilitySettings();
    
    // Apply high contrast if enabled
    if (settings.highContrast) {
      window.webContents.insertCSS(`
        * {
          filter: contrast(150%) !important;
        }
      `);
    }

    // Apply custom font size
    if (settings.fontSize !== 14) {
      window.webContents.setZoomFactor(settings.fontSize / 14);
    }

    // Enable screen reader support
    if (settings.screenReader) {
      this.enableScreenReaderSupport(window);
    }

    // Apply focus mode if enabled
    if (settings.focusMode.enabled) {
      this.enableFocusMode(window, settings.focusMode);
    }
  }

  private enableScreenReaderSupport(window: BrowserWindow): void {
    // Inject screen reader compatibility scripts
    window.webContents.executeJavaScript(`
      // Ensure all interactive elements have proper ARIA labels
      document.addEventListener('DOMContentLoaded', () => {
        const interactiveElements = document.querySelectorAll('button, input, textarea, select, [role="button"]');
        interactiveElements.forEach(element => {
          if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
            const text = element.textContent || element.value || element.placeholder;
            if (text) {
              element.setAttribute('aria-label', text.trim());
            }
          }
        });
      });
    `);
  }

  private enableFocusMode(window: BrowserWindow, focusSettings: any): void {
    let css = '';
    
    if (focusSettings.hideDistractions) {
      css += `
        .sidebar, .toolbar, .status-bar {
          display: none !important;
        }
      `;
    }

    if (focusSettings.dimBackground) {
      css += `
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.3);
          pointer-events: none;
          z-index: 1000;
        }
      `;
    }

    if (focusSettings.highlightCurrentSection) {
      css += `
        .current-section {
          background: rgba(255, 255, 0, 0.1) !important;
          border: 2px solid #ffeb3b !important;
          border-radius: 4px !important;
        }
      `;
    }

    if (css) {
      window.webContents.insertCSS(css);
    }
  }

  // Text-to-Speech functionality
  async enableScreenReader(): Promise<void> {
    const settings = this.configManager.getAccessibilitySettings();
    settings.screenReader = true;
    this.configManager.updateAccessibilitySettings(settings);
    
    console.log('Screen reader enabled');
  }

  async configureTextToSpeech(config: TTSSettings): Promise<void> {
    const settings = this.configManager.getAccessibilitySettings();
    settings.textToSpeech = { ...settings.textToSpeech, ...config };
    this.configManager.updateAccessibilitySettings(settings);
    
    console.log('Text-to-speech configured:', config);
  }

  async speakText(text: string): Promise<void> {
    const ttsSettings = this.configManager.getAccessibilitySettings().textToSpeech;
    
    if (!ttsSettings.enabled) {
      return;
    }

    // Stop current speech if any
    this.stopSpeaking();

    // This is a basic implementation - will be enhanced with native TTS
    console.log(`Speaking: "${text}" with voice: ${ttsSettings.voice}, rate: ${ttsSettings.rate}`);
    
    // In a real implementation, this would use native TTS APIs
    // For now, we'll use a mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Finished speaking');
        resolve();
      }, text.length * 50); // Mock duration based on text length
    });
  }

  stopSpeaking(): void {
    if (this.currentUtterance) {
      console.log('Stopping current speech');
      this.currentUtterance = null;
    }
  }

  // Keyboard navigation
  setupKeyboardNavigation(window: BrowserWindow): void {
    window.webContents.executeJavaScript(`
      document.addEventListener('keydown', (event) => {
        // Tab navigation enhancement
        if (event.key === 'Tab') {
          const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          // Ensure visible focus indicators
          focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
              element.style.outline = '2px solid #007acc';
              element.style.outlineOffset = '2px';
            });
            
            element.addEventListener('blur', () => {
              element.style.outline = '';
              element.style.outlineOffset = '';
            });
          });
        }
        
        // Escape key to exit focus mode
        if (event.key === 'Escape') {
          window.electronAPI.accessibility.exitFocusMode?.();
        }
        
        // Ctrl+Shift+S to toggle speech
        if (event.ctrlKey && event.shiftKey && event.key === 'S') {
          event.preventDefault();
          const selectedText = window.getSelection()?.toString();
          if (selectedText) {
            window.electronAPI.accessibility.speakText?.(selectedText);
          }
        }
      });
    `);
  }

  // Dyslexia support
  enableDyslexiaSupport(window: BrowserWindow): void {
    window.webContents.insertCSS(`
      @import url('https://fonts.googleapis.com/css2?family=OpenDyslexic:wght@400;700&display=swap');
      
      .dyslexia-friendly {
        font-family: 'OpenDyslexic', sans-serif !important;
        line-height: 1.8 !important;
        letter-spacing: 0.1em !important;
        word-spacing: 0.2em !important;
      }
      
      .dyslexia-friendly p {
        margin-bottom: 1.5em !important;
      }
      
      .dyslexia-friendly h1, .dyslexia-friendly h2, .dyslexia-friendly h3 {
        margin-top: 2em !important;
        margin-bottom: 1em !important;
      }
    `);

    // Apply dyslexia-friendly class to text content
    window.webContents.executeJavaScript(`
      document.addEventListener('DOMContentLoaded', () => {
        const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, textarea');
        textElements.forEach(element => {
          element.classList.add('dyslexia-friendly');
        });
      });
    `);
  }

  // Color and contrast adjustments
  applyColorScheme(window: BrowserWindow, scheme: string): void {
    let css = '';
    
    switch (scheme) {
      case 'high-contrast':
        css = `
          * {
            background: #000000 !important;
            color: #ffffff !important;
            border-color: #ffffff !important;
          }
          
          a, button {
            color: #ffff00 !important;
          }
          
          input, textarea, select {
            background: #333333 !important;
            color: #ffffff !important;
            border: 2px solid #ffffff !important;
          }
        `;
        break;
        
      case 'dark-mode':
        css = `
          * {
            background: #1e1e1e !important;
            color: #d4d4d4 !important;
          }
          
          input, textarea, select {
            background: #2d2d30 !important;
            color: #cccccc !important;
            border: 1px solid #3e3e42 !important;
          }
        `;
        break;
        
      case 'sepia':
        css = `
          * {
            background: #f4f3e8 !important;
            color: #5c4b37 !important;
          }
        `;
        break;
    }
    
    if (css) {
      window.webContents.insertCSS(css);
    }
  }

  // ADHD support - focus modes
  enableFocusMode(window: BrowserWindow): void {
    const settings = this.configManager.getAccessibilitySettings().focusMode;
    settings.enabled = true;
    
    this.configManager.updateAccessibilitySettings({
      focusMode: settings
    });
    
    this.enableFocusMode(window, settings);
  }

  disableFocusMode(window: BrowserWindow): void {
    const settings = this.configManager.getAccessibilitySettings().focusMode;
    settings.enabled = false;
    
    this.configManager.updateAccessibilitySettings({
      focusMode: settings
    });
    
    // Remove focus mode CSS
    window.webContents.executeJavaScript(`
      const focusStyles = document.querySelectorAll('style[data-focus-mode]');
      focusStyles.forEach(style => style.remove());
    `);
  }

  // Accessibility testing and validation
  async validateAccessibility(window: BrowserWindow): Promise<any> {
    return window.webContents.executeJavaScript(`
      // Basic accessibility audit
      const issues = [];
      
      // Check for missing alt text
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt) {
          issues.push({
            type: 'missing-alt-text',
            element: 'img',
            index: index,
            message: 'Image missing alt text'
          });
        }
      });
      
      // Check for missing form labels
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, index) => {
        if (!input.labels?.length && !input.getAttribute('aria-label')) {
          issues.push({
            type: 'missing-label',
            element: input.tagName.toLowerCase(),
            index: index,
            message: 'Form element missing label'
          });
        }
      });
      
      // Check for proper heading hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let lastLevel = 0;
      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1));
        if (level > lastLevel + 1) {
          issues.push({
            type: 'heading-hierarchy',
            element: heading.tagName.toLowerCase(),
            index: index,
            message: 'Heading level skipped'
          });
        }
        lastLevel = level;
      });
      
      return {
        totalIssues: issues.length,
        issues: issues,
        score: Math.max(0, 100 - (issues.length * 10))
      };
    `);
  }

  // Get current accessibility status
  getAccessibilityStatus(): any {
    const settings = this.configManager.getAccessibilitySettings();
    
    return {
      screenReader: settings.screenReader,
      textToSpeech: settings.textToSpeech.enabled,
      dyslexiaSupport: settings.dyslexiaSupport,
      focusMode: settings.focusMode.enabled,
      highContrast: settings.highContrast,
      keyboardNavigation: settings.keyboardNavigation,
      fontSize: settings.fontSize,
      lineSpacing: settings.lineSpacing
    };
  }

  // Update accessibility settings
  async updateSettings(updates: Partial<AccessibilitySettings>): Promise<void> {
    this.configManager.updateAccessibilitySettings(updates);
    console.log('Accessibility settings updated:', updates);
  }
}