import { EventEmitter } from 'events';

export interface CognitiveAssistSettings {
  enabled: boolean;
  simplifiedInterface: boolean;
  progressIndicators: boolean;
  contextualHelp: boolean;
  errorPrevention: boolean;
  confirmationDialogs: boolean;
  breadcrumbs: boolean;
  taskBreakdown: boolean;
  memoryAids: boolean;
  focusReminders: boolean;
  timeoutWarnings: boolean;
  autoSave: boolean;
  undoRedoSupport: boolean;
  stepByStepGuidance: boolean;
}

export interface TaskStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  optional: boolean;
  estimatedTime?: number;
  helpText?: string;
  prerequisites?: string[];
}

export interface ContextualHint {
  id: string;
  element: HTMLElement;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  persistent: boolean;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export class CognitiveAssistManager extends EventEmitter {
  private settings: CognitiveAssistSettings;
  private activeHints: Map<string, ContextualHint> = new Map();
  private taskSteps: TaskStep[] = [];
  private currentTaskIndex = -1;
  private breadcrumbTrail: Array<{ title: string; url: string; timestamp: Date }> = [];
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private timeoutWarningTimer: NodeJS.Timeout | null = null;
  private undoStack: Array<{ action: string; data: any; timestamp: Date }> = [];
  private redoStack: Array<{ action: string; data: any; timestamp: Date }> = [];
  private maxUndoSteps = 50;

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
  }

  async initialize(): Promise<void> {
    this.setupProgressIndicators();
    this.setupContextualHelp();
    this.setupErrorPrevention();
    this.setupAutoSave();
    this.setupUndoRedo();
    this.setupTimeoutWarnings();
    this.setupBreadcrumbs();
    
    console.log('Cognitive Assist Manager initialized');
  }

  private getDefaultSettings(): CognitiveAssistSettings {
    return {
      enabled: true,
      simplifiedInterface: false,
      progressIndicators: true,
      contextualHelp: true,
      errorPrevention: true,
      confirmationDialogs: true,
      breadcrumbs: true,
      taskBreakdown: true,
      memoryAids: true,
      focusReminders: false,
      timeoutWarnings: true,
      autoSave: true,
      undoRedoSupport: true,
      stepByStepGuidance: true
    };
  }

  updateSettings(newSettings: Partial<CognitiveAssistSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
  }

  private applySettings(): void {
    if (this.settings.enabled) {
      this.enableCognitiveAssist();
    } else {
      this.disableCognitiveAssist();
    }
  }

  private setupProgressIndicators(): void {
    if (!this.settings.progressIndicators) return;

    const style = document.createElement('style');
    style.textContent = `
      .cognitive-progress-container {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 300px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        display: none;
      }
      
      .cognitive-progress-container.visible {
        display: block;
      }
      
      .progress-step {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        padding: 4px 0;
      }
      
      .progress-step-indicator {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        flex-shrink: 0;
      }
      
      .progress-step.completed .progress-step-indicator {
        background: #28a745;
        color: white;
      }
      
      .progress-step.current .progress-step-indicator {
        background: #007bff;
        color: white;
      }
      
      .progress-step.pending .progress-step-indicator {
        background: #e9ecef;
        color: #6c757d;
        border: 2px solid #dee2e6;
      }
    `;
    
    document.head.appendChild(style);
  }

  private setupContextualHelp(): void {
    if (!this.settings.contextualHelp) return;

    const helpStyle = document.createElement('style');
    helpStyle.textContent = `
      .cognitive-hint {
        background: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        max-width: 250px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        position: absolute;
        z-index: 10001;
      }
      
      .cognitive-hint.info { background: #17a2b8; }
      .cognitive-hint.warning { background: #ffc107; color: #212529; }
      .cognitive-hint.error { background: #dc3545; }
      .cognitive-hint.success { background: #28a745; }
    `;
    
    document.head.appendChild(helpStyle);
  }

  private setupErrorPrevention(): void {
    if (!this.settings.errorPrevention) return;

    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      if (!this.validateForm(form)) {
        event.preventDefault();
        this.showFormErrors(form);
      }
    });
  }

  private setupAutoSave(): void {
    if (!this.settings.autoSave) return;

    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, 30000); // Auto-save every 30 seconds
  }

  private setupUndoRedo(): void {
    if (!this.settings.undoRedoSupport) return;

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        this.redo();
      }
    });
  }

  private setupTimeoutWarnings(): void {
    if (!this.settings.timeoutWarnings) return;

    let lastActivity = Date.now();
    
    document.addEventListener('mousemove', () => lastActivity = Date.now());
    document.addEventListener('keydown', () => lastActivity = Date.now());
    
    setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      if (timeSinceActivity > 25 * 60 * 1000) { // 25 minutes
        this.showTimeoutWarning();
      }
    }, 60000); // Check every minute
  }

  private setupBreadcrumbs(): void {
    if (!this.settings.breadcrumbs) return;

    this.addBreadcrumb(document.title, window.location.href);
  }

  // Public API methods
  showHint(elementSelector: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    const element = document.querySelector(elementSelector) as HTMLElement;
    if (!element) return;

    const hint: ContextualHint = {
      id: `hint-${Date.now()}`,
      element,
      message,
      type,
      persistent: false,
      position: 'auto'
    };

    this.displayHint(hint);
  }

  private displayHint(hint: ContextualHint): void {
    const hintElement = document.createElement('div');
    hintElement.className = `cognitive-hint ${hint.type}`;
    hintElement.textContent = hint.message;
    hintElement.id = hint.id;

    const rect = hint.element.getBoundingClientRect();
    hintElement.style.left = `${rect.left}px`;
    hintElement.style.top = `${rect.bottom + 5}px`;

    document.body.appendChild(hintElement);
    this.activeHints.set(hint.id, hint);

    if (!hint.persistent) {
      setTimeout(() => {
        this.removeHint(hint.id);
      }, 5000);
    }
  }

  removeHint(hintId: string): void {
    const hintElement = document.getElementById(hintId);
    if (hintElement) {
      hintElement.remove();
    }
    this.activeHints.delete(hintId);
  }

  startTask(steps: TaskStep[]): void {
    this.taskSteps = steps;
    this.currentTaskIndex = 0;
    this.showProgressIndicator();
  }

  completeCurrentStep(): void {
    if (this.currentTaskIndex >= 0 && this.currentTaskIndex < this.taskSteps.length) {
      this.taskSteps[this.currentTaskIndex].completed = true;
      this.currentTaskIndex++;
      this.updateProgressIndicator();
    }
  }

  private showProgressIndicator(): void {
    let container = document.getElementById('cognitive-progress-indicators');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cognitive-progress-indicators';
      container.className = 'cognitive-progress-container';
      document.body.appendChild(container);
    }

    container.classList.add('visible');
    this.updateProgressIndicator();
  }

  private updateProgressIndicator(): void {
    const container = document.getElementById('cognitive-progress-indicators');
    if (!container) return;

    const completedSteps = this.taskSteps.filter(step => step.completed).length;
    const totalSteps = this.taskSteps.length;
    const progress = (completedSteps / totalSteps) * 100;

    container.innerHTML = `
      <div class="progress-overall">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text">${completedSteps} of ${totalSteps} steps completed</div>
      </div>
    `;
  }

  addBreadcrumb(title: string, url: string): void {
    this.breadcrumbTrail.push({ title, url, timestamp: new Date() });
    if (this.breadcrumbTrail.length > 10) {
      this.breadcrumbTrail.shift();
    }
    this.updateBreadcrumbs();
  }

  private updateBreadcrumbs(): void {
    let breadcrumbContainer = document.getElementById('cognitive-breadcrumbs');
    if (!breadcrumbContainer) {
      breadcrumbContainer = document.createElement('nav');
      breadcrumbContainer.id = 'cognitive-breadcrumbs';
      breadcrumbContainer.setAttribute('aria-label', 'Breadcrumb navigation');
      document.body.insertBefore(breadcrumbContainer, document.body.firstChild);
    }

    const breadcrumbHTML = this.breadcrumbTrail.map((crumb, index) => {
      const isLast = index === this.breadcrumbTrail.length - 1;
      return `<span${isLast ? ' aria-current="page"' : ''}>${crumb.title}</span>`;
    }).join(' > ');

    breadcrumbContainer.innerHTML = breadcrumbHTML;
  }

  private validateForm(form: HTMLFormElement): boolean {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      const input = field as HTMLInputElement;
      if (!input.value.trim()) {
        isValid = false;
        input.classList.add('error');
      } else {
        input.classList.remove('error');
      }
    });

    return isValid;
  }

  private showFormErrors(form: HTMLFormElement): void {
    const errorFields = form.querySelectorAll('.error');
    if (errorFields.length > 0) {
      this.showHint(`#${errorFields[0].id}`, 'This field is required', 'error');
    }
  }

  private performAutoSave(): void {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      localStorage.setItem(`autosave-${form.id || 'form'}`, JSON.stringify(data));
    });
    
    this.emit('auto-saved');
  }

  private showTimeoutWarning(): void {
    if (this.timeoutWarningTimer) return;

    const warning = document.createElement('div');
    warning.className = 'timeout-warning';
    warning.innerHTML = `
      <div>Your session will expire in 5 minutes due to inactivity.</div>
      <button onclick="this.parentElement.remove()">Continue Working</button>
    `;
    warning.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border: 2px solid #ffc107;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10002;
    `;

    document.body.appendChild(warning);

    this.timeoutWarningTimer = setTimeout(() => {
      warning.remove();
      this.timeoutWarningTimer = null;
    }, 5 * 60 * 1000);
  }

  recordAction(action: string, data: any): void {
    this.undoStack.push({ action, data, timestamp: new Date() });
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack when new action is recorded
  }

  private undo(): void {
    const lastAction = this.undoStack.pop();
    if (lastAction) {
      this.redoStack.push(lastAction);
      this.emit('undo', lastAction);
    }
  }

  private redo(): void {
    const lastUndone = this.redoStack.pop();
    if (lastUndone) {
      this.undoStack.push(lastUndone);
      this.emit('redo', lastUndone);
    }
  }

  private enableCognitiveAssist(): void {
    // Enable all cognitive assistance features
    this.setupProgressIndicators();
    this.setupContextualHelp();
    this.setupErrorPrevention();
    this.setupAutoSave();
    this.setupUndoRedo();
    this.setupTimeoutWarnings();
    this.setupBreadcrumbs();
  }

  private disableCognitiveAssist(): void {
    // Clean up intervals and event listeners
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    if (this.timeoutWarningTimer) {
      clearTimeout(this.timeoutWarningTimer);
      this.timeoutWarningTimer = null;
    }
  }

  getSettings(): CognitiveAssistSettings {
    return { ...this.settings };
  }
}