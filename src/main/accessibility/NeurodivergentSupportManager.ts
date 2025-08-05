import { EventEmitter } from 'events';

export interface NeurodivergentSettings {
  adhdMode: boolean;
  autismMode: boolean;
  dyslexiaMode: boolean;
  anxietySupport: boolean;
  sensoryConsiderations: boolean;
  routineSupport: boolean;
  distractionReduction: boolean;
  executiveFunctionSupport: boolean;
}

export interface ADHDSettings {
  focusMode: boolean;
  breakReminders: boolean;
  taskChunking: boolean;
  hyperfocusProtection: boolean;
  distractionBlocking: boolean;
  motivationalCues: boolean;
  timeAwareness: boolean;
}

export interface AutismSettings {
  predictableInterface: boolean;
  changeNotifications: boolean;
  sensoryReduction: boolean;
  routineTemplates: boolean;
  socialCueAssistance: boolean;
  overloadPrevention: boolean;
  detailOrientation: boolean;
}

export interface DyslexiaSettings {
  dyslexicFont: boolean;
  increasedSpacing: boolean;
  colorOverlays: boolean;
  readingGuides: boolean;
  phonicSupport: boolean;
  wordPrediction: boolean;
  readAloud: boolean;
}

export class NeurodivergentSupportManager extends EventEmitter {
  private settings: NeurodivergentSettings;
  private adhdSettings: ADHDSettings;
  private autismSettings: AutismSettings;
  private dyslexiaSettings: DyslexiaSettings;
  
  private focusTimer: NodeJS.Timeout | null = null;
  private breakTimer: NodeJS.Timeout | null = null;
  private currentFocusSession: number = 0;
  private distractionElements: HTMLElement[] = [];

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
    this.adhdSettings = this.getDefaultADHDSettings();
    this.autismSettings = this.getDefaultAutismSettings();
    this.dyslexiaSettings = this.getDefaultDyslexiaSettings();
  }

  async initialize(): Promise<void> {
    this.setupNeurodivergentSupport();
    this.loadUserPreferences();
    
    console.log('Neurodivergent Support Manager initialized');
  }

  private getDefaultSettings(): NeurodivergentSettings {
    return {
      adhdMode: false,
      autismMode: false,
      dyslexiaMode: false,
      anxietySupport: false,
      sensoryConsiderations: false,
      routineSupport: false,
      distractionReduction: false,
      executiveFunctionSupport: false
    };
  }

  private getDefaultADHDSettings(): ADHDSettings {
    return {
      focusMode: false,
      breakReminders: true,
      taskChunking: true,
      hyperfocusProtection: true,
      distractionBlocking: false,
      motivationalCues: true,
      timeAwareness: true
    };
  }

  private getDefaultAutismSettings(): AutismSettings {
    return {
      predictableInterface: true,
      changeNotifications: true,
      sensoryReduction: false,
      routineTemplates: true,
      socialCueAssistance: false,
      overloadPrevention: true,
      detailOrientation: true
    };
  }

  private getDefaultDyslexiaSettings(): DyslexiaSettings {
    return {
      dyslexicFont: false,
      increasedSpacing: false,
      colorOverlays: false,
      readingGuides: false,
      phonicSupport: false,
      wordPrediction: false,
      readAloud: false
    };
  }

  updateSettings(newSettings: Partial<NeurodivergentSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
  }

  updateADHDSettings(newSettings: Partial<ADHDSettings>): void {
    this.adhdSettings = { ...this.adhdSettings, ...newSettings };
    if (this.settings.adhdMode) {
      this.applyADHDSupport();
    }
  }

  updateAutismSettings(newSettings: Partial<AutismSettings>): void {
    this.autismSettings = { ...this.autismSettings, ...newSettings };
    if (this.settings.autismMode) {
      this.applyAutismSupport();
    }
  }

  updateDyslexiaSettings(newSettings: Partial<DyslexiaSettings>): void {
    this.dyslexiaSettings = { ...this.dyslexiaSettings, ...newSettings };
    if (this.settings.dyslexiaMode) {
      this.applyDyslexiaSupport();
    }
  }

  private applySettings(): void {
    if (this.settings.adhdMode) {
      this.applyADHDSupport();
    } else {
      this.removeADHDSupport();
    }

    if (this.settings.autismMode) {
      this.applyAutismSupport();
    } else {
      this.removeAutismSupport();
    }

    if (this.settings.dyslexiaMode) {
      this.applyDyslexiaSupport();
    } else {
      this.removeDyslexiaSupport();
    }
  }

  private setupNeurodivergentSupport(): void {
    this.createSupportStyles();
    this.setupEventListeners();
  }

  private createSupportStyles(): void {
    const style = document.createElement('style');
    style.id = 'neurodivergent-support-styles';
    style.textContent = `
      /* ADHD Support Styles */
      .adhd-focus-mode {
        filter: blur(0px) !important;
        opacity: 1 !important;
      }
      
      .adhd-focus-mode * {
        animation: none !important;
        transition: none !important;
      }
      
      .adhd-distraction-blur {
        filter: blur(2px);
        opacity: 0.3;
        pointer-events: none;
      }
      
      .adhd-focus-indicator {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #28a745;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .adhd-break-reminder {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffc107;
        color: #212529;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        z-index: 10001;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      }
      
      /* Autism Support Styles */
      .autism-predictable-layout {
        transition: none !important;
      }
      
      .autism-change-notification {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #17a2b8;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      
      .autism-sensory-reduced {
        filter: contrast(0.8) brightness(0.9);
      }
      
      .autism-sensory-reduced * {
        animation: none !important;
        transition: opacity 0.1s ease !important;
      }
      
      /* Dyslexia Support Styles */
      .dyslexia-font {
        font-family: 'OpenDyslexic', 'Comic Sans MS', cursive !important;
      }
      
      .dyslexia-spacing {
        line-height: 1.8 !important;
        letter-spacing: 0.1em !important;
        word-spacing: 0.2em !important;
      }
      
      .dyslexia-overlay {
        position: relative;
      }
      
      .dyslexia-overlay::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 0, 0.1);
        pointer-events: none;
        z-index: 1;
      }
      
      .dyslexia-reading-guide {
        position: absolute;
        height: 2px;
        background: #007bff;
        width: 100%;
        z-index: 10;
        pointer-events: none;
        transition: top 0.1s ease;
      }
      
      /* General Accessibility Enhancements */
      .reduced-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      
      .high-contrast {
        filter: contrast(150%) brightness(110%);
      }
      
      .calm-colors {
        filter: sepia(20%) saturate(70%);
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // Listen for focus changes to provide ADHD support
    document.addEventListener('focusin', (event) => {
      if (this.settings.adhdMode && this.adhdSettings.focusMode) {
        this.handleFocusForADHD(event.target as HTMLElement);
      }
    });

    // Listen for page changes to notify autism users
    window.addEventListener('popstate', () => {
      if (this.settings.autismMode && this.autismSettings.changeNotifications) {
        this.notifyPageChange();
      }
    });

    // Listen for mouse movement for dyslexia reading guide
    document.addEventListener('mousemove', (event) => {
      if (this.settings.dyslexiaMode && this.dyslexiaSettings.readingGuides) {
        this.updateReadingGuide(event);
      }
    });
  }

  private applyADHDSupport(): void {
    document.body.classList.add('adhd-support-enabled');
    
    if (this.adhdSettings.focusMode) {
      this.enableFocusMode();
    }
    
    if (this.adhdSettings.breakReminders) {
      this.startBreakReminders();
    }
    
    if (this.adhdSettings.distractionBlocking) {
      this.enableDistractionBlocking();
    }
    
    if (this.adhdSettings.timeAwareness) {
      this.enableTimeAwareness();
    }
  }

  private removeADHDSupport(): void {
    document.body.classList.remove('adhd-support-enabled');
    this.disableFocusMode();
    this.stopBreakReminders();
    this.disableDistractionBlocking();
    this.disableTimeAwareness();
  }

  private enableFocusMode(): void {
    const focusIndicator = document.createElement('div');
    focusIndicator.id = 'adhd-focus-indicator';
    focusIndicator.className = 'adhd-focus-indicator';
    focusIndicator.textContent = 'Focus Mode Active';
    document.body.appendChild(focusIndicator);
    
    // Start focus session timer
    this.startFocusSession();
  }

  private disableFocusMode(): void {
    const indicator = document.getElementById('adhd-focus-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
  }

  private startFocusSession(): void {
    this.currentFocusSession++;
    const sessionDuration = 25 * 60 * 1000; // 25 minutes (Pomodoro technique)
    
    this.focusTimer = setTimeout(() => {
      this.endFocusSession();
    }, sessionDuration);
    
    this.emit('focus-session-started', { session: this.currentFocusSession });
  }

  private endFocusSession(): void {
    this.emit('focus-session-ended', { session: this.currentFocusSession });
    
    if (this.adhdSettings.breakReminders) {
      this.showBreakReminder();
    }
  }

  private startBreakReminders(): void {
    // Set up periodic break reminders
    this.breakTimer = setInterval(() => {
      this.showBreakReminder();
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  private stopBreakReminders(): void {
    if (this.breakTimer) {
      clearInterval(this.breakTimer);
      this.breakTimer = null;
    }
  }

  private showBreakReminder(): void {
    const reminder = document.createElement('div');
    reminder.className = 'adhd-break-reminder';
    reminder.innerHTML = `
      <h3>Time for a Break!</h3>
      <p>You've been working for a while. Take a 5-minute break to recharge.</p>
      <button onclick="this.parentElement.remove()">Take Break</button>
      <button onclick="this.parentElement.remove()">Continue Working</button>
    `;
    
    document.body.appendChild(reminder);
    
    // Auto-remove after 30 seconds if no action taken
    setTimeout(() => {
      if (reminder.parentElement) {
        reminder.remove();
      }
    }, 30000);
  }

  private enableDistractionBlocking(): void {
    // Identify and blur potentially distracting elements
    const distractingSelectors = [
      '.advertisement',
      '.social-media-widget',
      '.notification-popup',
      '[class*="distract"]',
      '[class*="popup"]'
    ];
    
    distractingSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        (element as HTMLElement).classList.add('adhd-distraction-blur');
        this.distractionElements.push(element as HTMLElement);
      });
    });
  }

  private disableDistractionBlocking(): void {
    this.distractionElements.forEach(element => {
      element.classList.remove('adhd-distraction-blur');
    });
    this.distractionElements = [];
  }

  private enableTimeAwareness(): void {
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'adhd-time-awareness';
    timeDisplay.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
    `;
    
    const updateTime = () => {
      const now = new Date();
      timeDisplay.textContent = now.toLocaleTimeString();
    };
    
    updateTime();
    setInterval(updateTime, 1000);
    
    document.body.appendChild(timeDisplay);
  }

  private disableTimeAwareness(): void {
    const timeDisplay = document.getElementById('adhd-time-awareness');
    if (timeDisplay) {
      timeDisplay.remove();
    }
  }

  private handleFocusForADHD(element: HTMLElement): void {
    // Remove focus from all other elements
    document.querySelectorAll('.adhd-focus-mode').forEach(el => {
      el.classList.remove('adhd-focus-mode');
    });
    
    // Add focus to current element and its container
    element.classList.add('adhd-focus-mode');
    const container = element.closest('section, article, div[role], main');
    if (container) {
      container.classList.add('adhd-focus-mode');
    }
  }

  private applyAutismSupport(): void {
    document.body.classList.add('autism-support-enabled');
    
    if (this.autismSettings.predictableInterface) {
      document.body.classList.add('autism-predictable-layout');
    }
    
    if (this.autismSettings.sensoryReduction) {
      document.body.classList.add('autism-sensory-reduced');
    }
    
    if (this.autismSettings.routineTemplates) {
      this.enableRoutineTemplates();
    }
  }

  private removeAutismSupport(): void {
    document.body.classList.remove('autism-support-enabled', 'autism-predictable-layout', 'autism-sensory-reduced');
  }

  private notifyPageChange(): void {
    const notification = document.createElement('div');
    notification.className = 'autism-change-notification';
    notification.textContent = `Page changed to: ${document.title}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  private enableRoutineTemplates(): void {
    // Create routine template selector
    const templateSelector = document.createElement('div');
    templateSelector.id = 'autism-routine-templates';
    templateSelector.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
    `;
    
    templateSelector.innerHTML = `
      <h4>Routine Templates</h4>
      <button onclick="this.parentElement.style.display='none'">Writing Session</button>
      <button onclick="this.parentElement.style.display='none'">Character Development</button>
      <button onclick="this.parentElement.style.display='none'">Story Planning</button>
    `;
    
    document.body.appendChild(templateSelector);
  }

  private applyDyslexiaSupport(): void {
    document.body.classList.add('dyslexia-support-enabled');
    
    if (this.dyslexiaSettings.dyslexicFont) {
      this.loadDyslexicFont();
      document.body.classList.add('dyslexia-font');
    }
    
    if (this.dyslexiaSettings.increasedSpacing) {
      document.body.classList.add('dyslexia-spacing');
    }
    
    if (this.dyslexiaSettings.colorOverlays) {
      document.body.classList.add('dyslexia-overlay');
    }
    
    if (this.dyslexiaSettings.readingGuides) {
      this.enableReadingGuide();
    }
  }

  private removeDyslexiaSupport(): void {
    document.body.classList.remove('dyslexia-support-enabled', 'dyslexia-font', 'dyslexia-spacing', 'dyslexia-overlay');
    this.disableReadingGuide();
  }

  private loadDyslexicFont(): void {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=OpenDyslexic';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  private enableReadingGuide(): void {
    const guide = document.createElement('div');
    guide.id = 'dyslexia-reading-guide';
    guide.className = 'dyslexia-reading-guide';
    document.body.appendChild(guide);
  }

  private disableReadingGuide(): void {
    const guide = document.getElementById('dyslexia-reading-guide');
    if (guide) {
      guide.remove();
    }
  }

  private updateReadingGuide(event: MouseEvent): void {
    const guide = document.getElementById('dyslexia-reading-guide');
    if (guide) {
      guide.style.top = `${event.clientY}px`;
    }
  }

  private loadUserPreferences(): void {
    const saved = localStorage.getItem('neurodivergent-preferences');
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        this.updateSettings(preferences.general || {});
        this.updateADHDSettings(preferences.adhd || {});
        this.updateAutismSettings(preferences.autism || {});
        this.updateDyslexiaSettings(preferences.dyslexia || {});
      } catch (error) {
        console.warn('Failed to load neurodivergent preferences:', error);
      }
    }
  }

  saveUserPreferences(): void {
    const preferences = {
      general: this.settings,
      adhd: this.adhdSettings,
      autism: this.autismSettings,
      dyslexia: this.dyslexiaSettings
    };
    
    localStorage.setItem('neurodivergent-preferences', JSON.stringify(preferences));
  }

  // Public API methods
  enableADHDMode(): void {
    this.updateSettings({ adhdMode: true });
  }

  enableAutismMode(): void {
    this.updateSettings({ autismMode: true });
  }

  enableDyslexiaMode(): void {
    this.updateSettings({ dyslexiaMode: true });
  }

  startFocusSession(): void {
    if (this.settings.adhdMode) {
      this.enableFocusMode();
    }
  }

  endFocusSession(): void {
    this.disableFocusMode();
  }

  getSettings(): {
    general: NeurodivergentSettings;
    adhd: ADHDSettings;
    autism: AutismSettings;
    dyslexia: DyslexiaSettings;
  } {
    return {
      general: { ...this.settings },
      adhd: { ...this.adhdSettings },
      autism: { ...this.autismSettings },
      dyslexia: { ...this.dyslexiaSettings }
    };
  }
}