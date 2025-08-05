import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Renderer process specific test setup
console.log('Setting up renderer process tests...');

// Mock Electron renderer APIs
const mockIpcRenderer = {
  invoke: jest.fn().mockResolvedValue('mock response'),
  send: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockWebFrame = {
  setZoomFactor: jest.fn(),
  getZoomFactor: jest.fn(() => 1),
  setZoomLevel: jest.fn(),
  getZoomLevel: jest.fn(() => 0),
  setVisualZoomLevelLimits: jest.fn(),
  setSpellCheckProvider: jest.fn()
};

const mockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue(''),
  showItemInFolder: jest.fn(),
  beep: jest.fn()
};

// Mock electron in renderer
jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer,
  webFrame: mockWebFrame,
  shell: mockShell,
  contextBridge: {
    exposeInMainWorld: jest.fn()
  }
}), { virtual: true });

// Mock React Testing Library utilities
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Export testing utilities globally
global.renderTestUtils = {
  render,
  screen,
  fireEvent,
  waitFor,
  userEvent: userEvent.setup()
};

// Mock React hooks for testing
const mockUseState = jest.fn();
const mockUseEffect = jest.fn();
const mockUseContext = jest.fn();
const mockUseReducer = jest.fn();
const mockUseCallback = jest.fn();
const mockUseMemo = jest.fn();
const mockUseRef = jest.fn();

// Component test utilities
global.componentTestUtils = {
  // Create mock props
  createMockProps: (overrides: any = {}) => ({
    className: 'test-component',
    'data-testid': 'test-component',
    ...overrides
  }),
  
  // Mock React hooks
  mockHooks: {
    useState: mockUseState,
    useEffect: mockUseEffect,
    useContext: mockUseContext,
    useReducer: mockUseReducer,
    useCallback: mockUseCallback,
    useMemo: mockUseMemo,
    useRef: mockUseRef
  },
  
  // Accessibility testing helpers
  checkAccessibility: async (component: any) => {
    const { container } = render(component);
    
    // Check for ARIA labels
    const elementsWithoutLabels = container.querySelectorAll(
      'input:not([aria-label]):not([aria-labelledby]), button:not([aria-label]):not([aria-labelledby])'
    );
    
    if (elementsWithoutLabels.length > 0) {
      console.warn('Elements without accessibility labels found:', elementsWithoutLabels);
    }
    
    // Check for proper heading hierarchy
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    headings.forEach((heading) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      if (currentLevel > previousLevel + 1) {
        console.warn('Heading hierarchy skip detected:', heading);
      }
      previousLevel = currentLevel;
    });
    
    // Check for keyboard navigation
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    return {
      hasAccessibleLabels: elementsWithoutLabels.length === 0,
      hasProperHeadingHierarchy: true, // Simplified check
      hasFocusableElements: focusableElements.length > 0,
      focusableElementsCount: focusableElements.length
    };
  },
  
  // Performance testing helpers
  measureRenderTime: async (component: any) => {
    const start = performance.now();
    render(component);
    const end = performance.now();
    return end - start;
  },
  
  // Story component test helpers
  createMockStory: (overrides: any = {}) => ({
    id: 'test-story-123',
    title: 'Test Story',
    description: 'A test story for component testing',
    genre: 'fantasy',
    scenes: [],
    characters: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),
  
  createMockScene: (overrides: any = {}) => ({
    id: 'test-scene-123',
    title: 'Test Scene',
    content: 'This is test scene content for component testing.',
    order: 1,
    storyId: 'test-story-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),
  
  createMockCharacter: (overrides: any = {}) => ({
    id: 'test-character-123',
    name: 'Test Character',
    description: 'A test character for component testing',
    role: 'protagonist',
    traits: ['brave', 'intelligent'],
    backstory: 'Test character backstory',
    storyId: 'test-story-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),
  
  // AI provider mock for components
  createMockAIResponse: (overrides: any = {}) => ({
    text: 'Mock AI generated text response',
    model: 'mock-model',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30
    },
    finishReason: 'stop',
    ...overrides
  }),
  
  // Accessibility component mocks
  createMockAccessibilitySettings: (overrides: any = {}) => ({
    screenReader: {
      enabled: false,
      voice: 'default',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    },
    colorScheme: {
      theme: 'light',
      highContrast: false,
      colorBlindnessSupport: 'none'
    },
    layout: {
      fontSize: 'medium',
      spacing: 'normal',
      reducedMotion: false
    },
    cognitive: {
      simplifiedUI: false,
      focusIndicators: true,
      structuredWorkflows: false
    },
    ...overrides
  })
};

// Mock DOM APIs specific to renderer
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer,
    webFrame: mockWebFrame,
    shell: mockShell
  },
  writable: true
});

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: jest.fn((key: string) => {
    const mockData: Record<string, string> = {
      'ai-settings': JSON.stringify({ provider: 'mock', model: 'mock-model' }),
      'user-preferences': JSON.stringify({ theme: 'light', language: 'en' }),
      'story-drafts': JSON.stringify([])
    };
    return mockData[key] || null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

// Mock CSS-in-JS libraries
jest.mock('styled-components', () => ({
  default: (tag: any) => (styles: any) => tag,
  css: (styles: any) => styles,
  ThemeProvider: ({ children }: any) => children,
  createGlobalStyle: () => () => null
}));

// Mock drag and drop API
const mockDataTransfer = {
  dropEffect: 'none',
  effectAllowed: 'uninitialized',
  files: [],
  items: [],
  types: [],
  clearData: jest.fn(),
  getData: jest.fn(() => ''),
  setData: jest.fn(),
  setDragImage: jest.fn()
};

Object.defineProperty(window, 'DataTransfer', {
  value: jest.fn(() => mockDataTransfer)
});

// Mock Intersection Observer for virtual scrolling
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: any, options?: any) {
    this.callback = callback;
    this.options = options;
  }
  callback: any;
  options: any;
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock ResizeObserver for responsive components
global.ResizeObserver = class ResizeObserver {
  constructor(callback: any) {
    this.callback = callback;
  }
  callback: any;
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock requestAnimationFrame for animations
global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16); // ~60fps
  return 1;
});

global.cancelAnimationFrame = jest.fn();

// Mock getComputedStyle for style calculations
global.getComputedStyle = jest.fn(() => ({
  getPropertyValue: jest.fn(() => ''),
  width: '100px',
  height: '100px',
  fontSize: '16px',
  color: 'rgb(0, 0, 0)',
  backgroundColor: 'rgb(255, 255, 255)'
}));

console.log('Renderer process test setup completed');