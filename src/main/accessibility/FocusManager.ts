import { EventEmitter } from 'events';

export interface FocusSettings {
  trapFocus: boolean;
  highlightFocus: boolean;
  skipToContent: boolean;
  focusIndicatorStyle: 'default' | 'high-contrast' | 'custom';
  focusIndicatorColor: string;
  focusIndicatorWidth: number;
  keyboardShortcuts: boolean;
  tabOrder: 'default' | 'logical' | 'custom';
}

export interface FocusableElement {
  element: HTMLElement;
  priority: number;
  group?: string;
  description?: string;
}

export class FocusManager extends EventEmitter {
  private settings: FocusSettings;
  private focusableElements: FocusableElement[] = [];
  private currentFocusIndex = -1;
  private focusTrap: HTMLElement | null = null;
  private skipLinks: HTMLElement[] = [];
  private keyboardShortcuts: Map<string, Function> = new Map();

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
  }

  async initialize(): Promise<void> {
    this.setupKeyboardNavigation();
    this.createSkipLinks();
    this.setupFocusIndicators();
    this.registerDefaultShortcuts();
    
    console.log('Focus Manager initialized');
  }

  private getDefaultSettings(): FocusSettings {
    return {
      trapFocus: false,
      highlightFocus: true,
      skipToContent: true,
      focusIndicatorStyle: 'default',
      focusIndicatorColor: '#0066cc',
      focusIndicatorWidth: 2,
      keyboardShortcuts: true,
      tabOrder: 'logical'
    };
  }

  updateSettings(newSettings: Partial<FocusSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
  }

  private applySettings(): void {
    this.updateFocusIndicators();
    this.updateSkipLinks();
    this.updateKeyboardShortcuts();
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.handleTabNavigation(event);
    }
    
    if (event.key === 'Escape' && this.focusTrap) {
      this.releaseFocusTrap();
    }
    
    if (this.settings.keyboardShortcuts) {
      this.handleKeyboardShortcut(event);
    }
  }

  private handleTabNavigation(event: KeyboardEvent): void {
    if (this.focusTrap) {
      this.handleTrapFocus(event);
      return;
    }

    if (this.settings.tabOrder === 'logical') {
      this.handleLogicalTabOrder(event);
    }
  }

  private handleTrapFocus(event: KeyboardEvent): void {
    if (!this.focusTrap) return;

    const focusableElements = this.getFocusableElementsInContainer(this.focusTrap);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (event.shiftKey) {
      if (activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private handleLogicalTabOrder(event: KeyboardEvent): void {
    if (this.focusableElements.length === 0) {
      this.updateFocusableElements();
    }

    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = this.focusableElements.findIndex(
      item => item.element === currentElement
    );

    if (currentIndex === -1) return;

    let nextIndex: number;
    if (event.shiftKey) {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : this.focusableElements.length - 1;
    } else {
      nextIndex = currentIndex < this.focusableElements.length - 1 ? currentIndex + 1 : 0;
    }

    event.preventDefault();
    this.focusableElements[nextIndex].element.focus();
    this.currentFocusIndex = nextIndex;
  }

  private handleFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    
    if (this.settings.highlightFocus) {
      this.highlightElement(target);
    }

    this.announceFocusChange(target);
    this.emit('focus-changed', { element: target, direction: 'in' });
  }

  private handleFocusOut(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    this.removeHighlight(target);
    
    this.emit('focus-changed', { element: target, direction: 'out' });
  }

  private highlightElement(element: HTMLElement): void {
    element.style.outline = `${this.settings.focusIndicatorWidth}px solid ${this.settings.focusIndicatorColor}`;
    element.style.outlineOffset = '2px';
    
    if (this.settings.focusIndicatorStyle === 'high-contrast') {
      element.style.backgroundColor = 'rgba(0, 102, 204, 0.1)';
    }
  }

  private removeHighlight(element: HTMLElement): void {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.backgroundColor = '';
  }

  private createSkipLinks(): void {
    if (!this.settings.skipToContent) return;

    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      z-index: 10000;
      border-radius: 4px;
      transition: top 0.3s;
    `;

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);
    this.skipLinks.push(skipLink);
  }

  private updateSkipLinks(): void {
    this.skipLinks.forEach(link => {
      link.style.display = this.settings.skipToContent ? 'block' : 'none';
    });
  }

  private updateFocusIndicators(): void {
    const style = document.getElementById('focus-indicators-style') || document.createElement('style');
    style.id = 'focus-indicators-style';
    
    let css = '';
    
    if (this.settings.highlightFocus) {
      css += `
        *:focus {
          outline: ${this.settings.focusIndicatorWidth}px solid ${this.settings.focusIndicatorColor} !important;
          outline-offset: 2px !important;
        }
      `;
      
      if (this.settings.focusIndicatorStyle === 'high-contrast') {
        css += `
          *:focus {
            background-color: rgba(0, 102, 204, 0.1) !important;
          }
        `;
      }
    }
    
    style.textContent = css;
    document.head.appendChild(style);
  }

  private registerDefaultShortcuts(): void {
    this.registerShortcut('Alt+1', () => {
      const mainContent = document.getElementById('main-content') || document.querySelector('main');
      if (mainContent) {
        (mainContent as HTMLElement).focus();
      }
    });

    this.registerShortcut('Alt+2', () => {
      const nav = document.querySelector('nav') || document.querySelector('[role=\"navigation\"]');
      if (nav) {
        (nav as HTMLElement).focus();
      }
    });

    this.registerShortcut('F6', () => {
      this.cycleMainRegions();
    });
  }

  private handleKeyboardShortcut(event: KeyboardEvent): void {
    const key = this.getKeyString(event);
    const handler = this.keyboardShortcuts.get(key);
    
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  private getKeyString(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    parts.push(event.key);
    
    return parts.join('+');
  }

  registerShortcut(keyString: string, handler: Function): void {
    this.keyboardShortcuts.set(keyString, handler);
  }

  unregisterShortcut(keyString: string): void {
    this.keyboardShortcuts.delete(keyString);
  }

  private updateKeyboardShortcuts(): void {
    if (!this.settings.keyboardShortcuts) {
      this.keyboardShortcuts.clear();
    } else {
      this.registerDefaultShortcuts();
    }
  }

  setFocusTrap(element: HTMLElement): void {
    this.focusTrap = element;
    this.settings.trapFocus = true;
    
    const focusableElements = this.getFocusableElementsInContainer(element);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  releaseFocusTrap(): void {
    this.focusTrap = null;
    this.settings.trapFocus = false;
    this.emit('focus-trap-released');
  }

  private getFocusableElementsInContainer(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex=\"-1\"])',
      '[contenteditable=\"true\"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }

  private updateFocusableElements(): void {
    const elements = this.getFocusableElementsInContainer(document.body);
    
    this.focusableElements = elements.map((element) => ({
      element,
      priority: this.calculateElementPriority(element),
      group: this.getElementGroup(element),
      description: this.getElementDescription(element)
    }));

    this.focusableElements.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      return this.getElementPosition(a.element) - this.getElementPosition(b.element);
    });
  }

  private calculateElementPriority(element: HTMLElement): number {
    if (element.matches('button, input[type=\"submit\"], input[type=\"button\"]')) {
      return 10;
    }
    if (element.matches('input, select, textarea')) {
      return 8;
    }
    if (element.matches('a[href]')) {
      return 6;
    }
    if (element.matches('[role=\"button\"], [role=\"link\"]')) {
      return 5;
    }
    
    return 1;
  }

  private getElementGroup(element: HTMLElement): string {
    const nav = element.closest('nav');
    if (nav) return 'navigation';
    
    const main = element.closest('main');
    if (main) return 'main';
    
    const aside = element.closest('aside');
    if (aside) return 'sidebar';
    
    const header = element.closest('header');
    if (header) return 'header';
    
    const footer = element.closest('footer');
    if (footer) return 'footer';
    
    return 'content';
  }

  private getElementDescription(element: HTMLElement): string {
    return element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           element.textContent?.trim() ||
           element.tagName.toLowerCase();
  }

  private getElementPosition(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    return rect.top * 10000 + rect.left;
  }

  private cycleMainRegions(): void {
    const regions = [
      document.querySelector('header'),
      document.querySelector('nav'),
      document.querySelector('main'),
      document.querySelector('aside'),
      document.querySelector('footer')
    ].filter(Boolean) as HTMLElement[];

    if (regions.length === 0) return;

    const currentElement = document.activeElement as HTMLElement;
    let currentRegionIndex = -1;

    for (let i = 0; i < regions.length; i++) {
      if (regions[i].contains(currentElement)) {
        currentRegionIndex = i;
        break;
      }
    }

    const nextIndex = (currentRegionIndex + 1) % regions.length;
    const nextRegion = regions[nextIndex];
    
    if (nextRegion.tabIndex >= 0) {
      nextRegion.focus();
    } else {
      const focusableInRegion = this.getFocusableElementsInContainer(nextRegion);
      if (focusableInRegion.length > 0) {
        focusableInRegion[0].focus();
      }
    }
  }

  private announceFocusChange(element: HTMLElement): void {
    const description = this.getElementDescription(element);
    const role = element.getAttribute('role') || element.tagName.toLowerCase();
    
    this.emit('announce', {
      message: `Focused ${role}: ${description}`,
      priority: 'polite'
    });
  }

  focusElement(selector: string): boolean {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      return true;
    }
    return false;
  }

  focusNext(): void {
    if (this.focusableElements.length === 0) {
      this.updateFocusableElements();
    }

    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
    this.focusableElements[this.currentFocusIndex].element.focus();
  }

  focusPrevious(): void {
    if (this.focusableElements.length === 0) {
      this.updateFocusableElements();
    }

    this.currentFocusIndex = this.currentFocusIndex > 0 
      ? this.currentFocusIndex - 1 
      : this.focusableElements.length - 1;
    this.focusableElements[this.currentFocusIndex].element.focus();
  }

  getFocusableElements(): FocusableElement[] {
    if (this.focusableElements.length === 0) {
      this.updateFocusableElements();
    }
    return [...this.focusableElements];
  }

  getSettings(): FocusSettings {
    return { ...this.settings };
  }
}