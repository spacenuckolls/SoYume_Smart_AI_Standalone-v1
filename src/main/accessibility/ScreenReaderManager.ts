import { EventEmitter } from 'events';

export interface ScreenReaderSettings {
  enabled: boolean;
  announceChanges: boolean;
  verboseDescriptions: boolean;
  announceHeadings: boolean;
  announceLinks: boolean;
  announceButtons: boolean;
  announceFormFields: boolean;
  announceRegions: boolean;
  politenessLevel: 'off' | 'polite' | 'assertive';
  speakPunctuation: boolean;
  speakEmptyElements: boolean;
}

export interface AnnouncementOptions {
  priority: 'off' | 'polite' | 'assertive';
  interrupt: boolean;
  delay?: number;
}

export class ScreenReaderManager extends EventEmitter {
  private settings: ScreenReaderSettings;
  private liveRegion: HTMLElement | null = null;
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;
  private announcementQueue: Array<{ message: string; options: AnnouncementOptions }> = [];
  private isProcessingQueue = false;
  private mutationObserver: MutationObserver | null = null;

  constructor() {
    super();
    this.settings = this.getDefaultSettings();
  }

  async initialize(): Promise<void> {
    this.createLiveRegions();
    this.setupMutationObserver();
    this.enhanceExistingContent();
    this.setupEventListeners();
    
    console.log('Screen Reader Manager initialized');
  }

  private getDefaultSettings(): ScreenReaderSettings {
    return {
      enabled: true,
      announceChanges: true,
      verboseDescriptions: false,
      announceHeadings: true,
      announceLinks: true,
      announceButtons: true,
      announceFormFields: true,
      announceRegions: true,
      politenessLevel: 'polite',
      speakPunctuation: false,
      speakEmptyElements: false
    };
  }

  updateSettings(newSettings: Partial<ScreenReaderSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
  }

  private applySettings(): void {
    if (this.settings.enabled) {
      this.enableScreenReaderSupport();
    } else {
      this.disableScreenReaderSupport();
    }
  }

  private createLiveRegions(): void {
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.setAttribute('aria-relevant', 'additions text');
    this.politeRegion.className = 'sr-only';
    this.politeRegion.id = 'polite-announcements';
    
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.setAttribute('aria-relevant', 'additions text');
    this.assertiveRegion.className = 'sr-only';
    this.assertiveRegion.id = 'assertive-announcements';
    
    const style = document.createElement('style');
    style.textContent = `
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      
      .sr-only-focusable:focus {
        position: static !important;
        width: auto !important;
        height: auto !important;
        padding: inherit !important;
        margin: inherit !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: inherit !important;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(this.politeRegion);
    document.body.appendChild(this.assertiveRegion);
  }

  private setupMutationObserver(): void {
    if (!this.settings.announceChanges) return;

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        this.handleMutation(mutation);
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-selected', 'aria-checked', 'aria-pressed'],
      characterData: true
    });
  }

  private handleMutation(mutation: MutationRecord): void {
    switch (mutation.type) {
      case 'childList':
        this.handleChildListMutation(mutation);
        break;
      case 'attributes':
        this.handleAttributeMutation(mutation);
        break;
      case 'characterData':
        this.handleTextMutation(mutation);
        break;
    }
  }

  private handleChildListMutation(mutation: MutationRecord): void {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        this.announceNewElement(element);
      }
    });

    mutation.removedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        this.announceRemovedElement(element);
      }
    });
  }

  private handleAttributeMutation(mutation: MutationRecord): void {
    const element = mutation.target as HTMLElement;
    const attributeName = mutation.attributeName!;
    const newValue = element.getAttribute(attributeName);
    const oldValue = mutation.oldValue;

    if (newValue !== oldValue) {
      this.announceAttributeChange(element, attributeName, newValue, oldValue);
    }
  }

  private handleTextMutation(mutation: MutationRecord): void {
    const textNode = mutation.target;
    const parentElement = textNode.parentElement;
    
    if (parentElement && this.shouldAnnounceTextChange(parentElement)) {
      this.announce(`Text changed: ${textNode.textContent}`, { priority: 'polite', interrupt: false });
    }
  }

  private announceNewElement(element: HTMLElement): void {
    if (!this.shouldAnnounceElement(element)) return;

    const announcement = this.generateElementAnnouncement(element, 'added');
    if (announcement) {
      this.announce(announcement, { priority: 'polite', interrupt: false });
    }
  }

  private announceRemovedElement(element: HTMLElement): void {
    if (!this.shouldAnnounceElement(element)) return;

    const announcement = this.generateElementAnnouncement(element, 'removed');
    if (announcement) {
      this.announce(announcement, { priority: 'polite', interrupt: false });
    }
  }

  private announceAttributeChange(element: HTMLElement, attribute: string, newValue: string | null, oldValue: string | null): void {
    let announcement = '';

    switch (attribute) {
      case 'aria-expanded':
        announcement = newValue === 'true' ? 'Expanded' : 'Collapsed';
        break;
      case 'aria-selected':
        announcement = newValue === 'true' ? 'Selected' : 'Unselected';
        break;
      case 'aria-checked':
        if (newValue === 'true') announcement = 'Checked';
        else if (newValue === 'false') announcement = 'Unchecked';
        else if (newValue === 'mixed') announcement = 'Partially checked';
        break;
      case 'aria-pressed':
        announcement = newValue === 'true' ? 'Pressed' : 'Not pressed';
        break;
    }

    if (announcement) {
      const elementLabel = this.getElementLabel(element);
      this.announce(`${elementLabel} ${announcement}`, { priority: 'assertive', interrupt: true });
    }
  }

  private shouldAnnounceElement(element: HTMLElement): boolean {
    if (element.hidden || element.style.display === 'none') {
      return false;
    }

    if (element.classList.contains('sr-only')) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
      return this.settings.announceHeadings;
    }
    
    if (tagName === 'a') {
      return this.settings.announceLinks;
    }
    
    if (tagName === 'button') {
      return this.settings.announceButtons;
    }
    
    if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
      return this.settings.announceFormFields;
    }
    
    if (element.getAttribute('role') === 'region' || tagName === 'section' || tagName === 'main' || tagName === 'nav') {
      return this.settings.announceRegions;
    }

    return true;
  }

  private shouldAnnounceTextChange(element: HTMLElement): boolean {
    if (element.matches('input, textarea')) {
      return false;
    }

    if (element.getAttribute('aria-live')) {
      return false;
    }

    return true;
  }

  private generateElementAnnouncement(element: HTMLElement, action: 'added' | 'removed'): string | null {
    const tagName = element.tagName.toLowerCase();
    const label = this.getElementLabel(element);
    const role = element.getAttribute('role') || this.getImplicitRole(tagName);

    if (!label && !this.settings.speakEmptyElements) {
      return null;
    }

    const elementDescription = label || `${role} element`;
    return `${elementDescription} ${action}`;
  }

  private getElementLabel(element: HTMLElement): string {
    return element.getAttribute('aria-label') ||
           this.getLabelFromLabelledBy(element) ||
           element.getAttribute('title') ||
           this.getTextContent(element) ||
           element.getAttribute('alt') ||
           element.getAttribute('placeholder') ||
           '';
  }

  private getLabelFromLabelledBy(element: HTMLElement): string {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (!labelledBy) return '';

    const labelIds = labelledBy.split(' ');
    const labels = labelIds.map(id => {
      const labelElement = document.getElementById(id);
      return labelElement ? this.getTextContent(labelElement) : '';
    }).filter(Boolean);

    return labels.join(' ');
  }

  private getTextContent(element: HTMLElement): string {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          if (parent.hidden || parent.style.display === 'none' || parent.classList.contains('sr-only')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textParts: string[] = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join(' ').trim();
  }

  private getImplicitRole(tagName: string): string {
    const roleMap: Record<string, string> = {
      'button': 'button',
      'a': 'link',
      'input': 'textbox',
      'select': 'combobox',
      'textarea': 'textbox',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'section': 'region',
      'article': 'article',
      'aside': 'complementary',
      'header': 'banner',
      'footer': 'contentinfo'
    };

    return roleMap[tagName] || 'element';
  }

  private setupEventListeners(): void {
    document.addEventListener('focusin', (event) => {
      const element = event.target as HTMLElement;
      this.announceFocusContext(element);
    });

    document.addEventListener('change', (event) => {
      const element = event.target as HTMLElement;
      this.announceFormChange(element);
    });

    document.addEventListener('invalid', (event) => {
      const element = event.target as HTMLElement;
      this.announceFormError(element);
    });
  }

  private announceFocusContext(element: HTMLElement): void {
    if (!this.settings.verboseDescriptions) return;

    const context = this.buildElementContext(element);
    if (context) {
      this.announce(context, { priority: 'polite', interrupt: false, delay: 500 });
    }
  }

  private buildElementContext(element: HTMLElement): string {
    const parts: string[] = [];

    const position = this.getElementPosition(element);
    if (position) {
      parts.push(position);
    }

    const parentContext = this.getParentContext(element);
    if (parentContext) {
      parts.push(parentContext);
    }

    const state = this.getElementState(element);
    if (state) {
      parts.push(state);
    }

    return parts.join(', ');
  }

  private getElementPosition(element: HTMLElement): string {
    const listItem = element.closest('li');
    if (listItem) {
      const list = listItem.parentElement;
      if (list) {
        const items = Array.from(list.children);
        const position = items.indexOf(listItem) + 1;
        return `Item ${position} of ${items.length}`;
      }
    }

    const tableCell = element.closest('td, th');
    if (tableCell) {
      const row = tableCell.parentElement;
      if (row) {
        const cells = Array.from(row.children);
        const colIndex = cells.indexOf(tableCell) + 1;
        const rows = Array.from(row.parentElement?.children || []);
        const rowIndex = rows.indexOf(row) + 1;
        return `Row ${rowIndex}, Column ${colIndex}`;
      }
    }

    return '';
  }

  private getParentContext(element: HTMLElement): string {
    const contexts: string[] = [];

    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        contexts.push(`In ${legend.textContent?.trim()} group`);
      }
    }

    const dialog = element.closest('[role=\"dialog\"], dialog');
    if (dialog) {
      const title = dialog.getAttribute('aria-label') || 
                   dialog.querySelector('h1, h2, h3, h4, h5, h6')?.textContent;
      if (title) {
        contexts.push(`In ${title} dialog`);
      }
    }

    return contexts.join(', ');
  }

  private getElementState(element: HTMLElement): string {
    const states: string[] = [];

    if (element.getAttribute('aria-expanded') === 'true') {
      states.push('expanded');
    } else if (element.getAttribute('aria-expanded') === 'false') {
      states.push('collapsed');
    }

    if (element.getAttribute('aria-selected') === 'true') {
      states.push('selected');
    }

    if (element.getAttribute('aria-checked') === 'true') {
      states.push('checked');
    } else if (element.getAttribute('aria-checked') === 'mixed') {
      states.push('partially checked');
    }

    if (element.hasAttribute('required')) {
      states.push('required');
    }

    if (element.hasAttribute('disabled')) {
      states.push('disabled');
    }

    return states.join(', ');
  }

  private announceFormChange(element: HTMLElement): void {
    const label = this.getElementLabel(element);
    const value = this.getElementValue(element);
    
    if (label && value) {
      this.announce(`${label} changed to ${value}`, { priority: 'polite', interrupt: false });
    }
  }

  private announceFormError(element: HTMLElement): void {
    const label = this.getElementLabel(element);
    const errorMessage = this.getErrorMessage(element);
    
    const message = errorMessage 
      ? `Error in ${label}: ${errorMessage}`
      : `Error in ${label}`;
    
    this.announce(message, { priority: 'assertive', interrupt: true });
  }

  private getElementValue(element: HTMLElement): string {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? 'checked' : 'unchecked';
      }
      return element.value;
    }
    
    if (element instanceof HTMLSelectElement) {
      return element.selectedOptions[0]?.textContent || '';
    }
    
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    
    return '';
  }

  private getErrorMessage(element: HTMLElement): string {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const errorElement = document.getElementById(describedBy);
      if (errorElement) {
        return errorElement.textContent?.trim() || '';
      }
    }
    
    return (element as HTMLInputElement).validationMessage || '';
  }

  private enhanceExistingContent(): void {
    this.enhanceButtons();
    this.enhanceLinks();
    this.enhanceFormFields();
    this.enhanceHeadings();
    this.enhanceRegions();
  }

  private enhanceButtons(): void {
    const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    buttons.forEach((button) => {
      const text = this.getTextContent(button as HTMLElement);
      if (!text) {
        (button as HTMLElement).setAttribute('aria-label', 'Button');
      }
    });
  }

  private enhanceLinks(): void {
    const links = document.querySelectorAll('a:not([aria-label]):not([aria-labelledby])');
    links.forEach((link) => {
      const text = this.getTextContent(link as HTMLElement);
      if (!text && (link as HTMLAnchorElement).href) {
        (link as HTMLElement).setAttribute('aria-label', `Link to ${(link as HTMLAnchorElement).href}`);
      }
    });
  }

  private enhanceFormFields(): void {
    const fields = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby]), select:not([aria-label]):not([aria-labelledby]), textarea:not([aria-label]):not([aria-labelledby])');
    fields.forEach((field) => {
      const label = document.querySelector(`label[for=\"${field.id}\"]`);
      if (!label && field.id) {
        const placeholder = (field as HTMLInputElement).placeholder;
        if (placeholder) {
          (field as HTMLElement).setAttribute('aria-label', placeholder);
        }
      }
    });
  }

  private enhanceHeadings(): void {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = `heading-${index + 1}`;
      }
    });
  }

  private enhanceRegions(): void {
    const regions = document.querySelectorAll('main, nav, aside, section');
    regions.forEach((region) => {
      if (!region.getAttribute('aria-label') && !region.getAttribute('aria-labelledby')) {
        const heading = region.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading && heading.id) {
          region.setAttribute('aria-labelledby', heading.id);
        }
      }
    });
  }

  private enableScreenReaderSupport(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.setupMutationObserver();
  }

  private disableScreenReaderSupport(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  announce(message: string, options: Partial<AnnouncementOptions> = {}): void {
    if (!this.settings.enabled) return;

    const fullOptions: AnnouncementOptions = {
      priority: this.settings.politenessLevel,
      interrupt: false,
      ...options
    };

    if (fullOptions.priority === 'off') return;

    this.announcementQueue.push({ message, options: fullOptions });
    this.processAnnouncementQueue();
  }

  private async processAnnouncementQueue(): Promise<void> {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.announcementQueue.length > 0) {
      const { message, options } = this.announcementQueue.shift()!;
      
      if (options.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }

      const region = options.priority === 'assertive' ? this.assertiveRegion : this.politeRegion;
      if (region) {
        if (options.interrupt) {
          region.textContent = '';
          region.offsetHeight;
        }
        
        region.textContent = message;
        
        setTimeout(() => {
          if (region.textContent === message) {
            region.textContent = '';
          }
        }, 1000);
      }

      this.emit('announced', { message, options });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  announcePageChange(title: string, description?: string): void {
    const message = description 
      ? `Page changed to ${title}. ${description}`
      : `Page changed to ${title}`;
    
    this.announce(message, { priority: 'assertive', interrupt: true });
  }

  announceError(message: string): void {
    this.announce(`Error: ${message}`, { priority: 'assertive', interrupt: true });
  }

  announceSuccess(message: string): void {
    this.announce(`Success: ${message}`, { priority: 'polite', interrupt: false });
  }

  announceProgress(current: number, total: number, description?: string): void {
    const percentage = Math.round((current / total) * 100);
    const message = description 
      ? `${description}: ${percentage}% complete, ${current} of ${total}`
      : `Progress: ${percentage}% complete, ${current} of ${total}`;
    
    this.announce(message, { priority: 'polite', interrupt: false });
  }

  getSettings(): ScreenReaderSettings {
    return { ...this.settings };
  }
}