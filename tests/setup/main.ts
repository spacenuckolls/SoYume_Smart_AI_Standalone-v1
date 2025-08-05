import { jest } from '@jest/globals';

// Main process specific test setup
console.log('Setting up main process tests...');

// Mock Electron main process APIs
const mockApp = {
  getPath: jest.fn((name: string) => {
    const paths: Record<string, string> = {
      userData: '/mock/user/data',
      appData: '/mock/app/data',
      temp: '/mock/temp',
      home: '/mock/home',
      documents: '/mock/documents',
      downloads: '/mock/downloads'
    };
    return paths[name] || '/mock/default';
  }),
  getVersion: jest.fn(() => '1.0.0'),
  getName: jest.fn(() => 'AI Creative Assistant'),
  quit: jest.fn(),
  exit: jest.fn(),
  focus: jest.fn(),
  hide: jest.fn(),
  show: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(undefined)
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn().mockResolvedValue(undefined),
  loadURL: jest.fn().mockResolvedValue(undefined),
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  focus: jest.fn(),
  minimize: jest.fn(),
  maximize: jest.fn(),
  unmaximize: jest.fn(),
  isMaximized: jest.fn(() => false),
  setFullScreen: jest.fn(),
  isFullScreen: jest.fn(() => false),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    openDevTools: jest.fn(),
    closeDevTools: jest.fn(),
    isDevToolsOpened: jest.fn(() => false),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    insertCSS: jest.fn().mockResolvedValue(''),
    setUserAgent: jest.fn(),
    getUserAgent: jest.fn(() => 'mock-user-agent'),
    session: {
      clearCache: jest.fn().mockResolvedValue(undefined),
      clearStorageData: jest.fn().mockResolvedValue(undefined)
    }
  },
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn()
}));

const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/file.txt'] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save.txt' }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  showErrorBox: jest.fn()
};

// Mock the entire electron module
jest.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog
}), { virtual: true });

// Test utilities specific to main process
global.mainTestUtils = {
  // Mock IPC communication
  mockIpcCall: async (channel: string, ...args: any[]) => {
    const handlers = (mockIpcMain.handle as jest.Mock).mock.calls
      .find(call => call[0] === channel);
    if (handlers && handlers[1]) {
      return await handlers[1]({}, ...args);
    }
    throw new Error(`No IPC handler registered for channel: ${channel}`);
  },
  
  // Create mock window
  createMockWindow: () => new mockBrowserWindow(),
  
  // AI provider test helpers
  createMockAIProvider: (responses: string[] = ['Mock AI response']) => ({
    name: 'MockProvider',
    isAvailable: jest.fn().mockResolvedValue(true),
    generateText: jest.fn().mockImplementation(async () => {
      return responses.shift() || 'Default mock response';
    }),
    streamText: jest.fn().mockImplementation(async function* () {
      for (const response of responses) {
        yield response;
      }
    }),
    getModels: jest.fn().mockResolvedValue(['mock-model-1', 'mock-model-2']),
    validateConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
  })
};

console.log('Main process test setup completed');