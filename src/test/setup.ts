// Jest setup file for SoYume AI Creative Assistant

// Mock Electron APIs
const mockElectron = {
  app: {
    getPath: jest.fn(() => '/mock/path'),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      insertCSS: jest.fn(),
      executeJavaScript: jest.fn(() => Promise.resolve()),
      setZoomFactor: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn()
  }
};

// Mock database (no longer using better-sqlite3)
const mockDatabase = {
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(() => [])
  })),
  exec: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn()
};

// Mock electron-store
const mockStore = jest.fn(() => ({
  get: jest.fn(),
  set: jest.fn(),
  store: {},
  clear: jest.fn()
}));

// Mock crypto
const mockCrypto = {
  randomBytes: jest.fn(() => Buffer.from('mock-random-bytes')),
  createCipher: jest.fn(() => ({
    update: jest.fn(() => 'encrypted'),
    final: jest.fn(() => 'final')
  })),
  createDecipher: jest.fn(() => ({
    update: jest.fn(() => 'decrypted'),
    final: jest.fn(() => 'final')
  }))
};

// Mock fs
const mockFs = {
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => Buffer.from('mock-file-content')),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
};

// Apply mocks
jest.mock('electron', () => mockElectron);
jest.mock('electron-store', () => mockStore);
jest.mock('crypto', () => mockCrypto);
jest.mock('fs', () => mockFs);

// Global test utilities
(global as any).mockElectron = mockElectron;
(global as any).mockDatabase = mockDatabase;
(global as any).mockStore = mockStore;
(global as any).mockCrypto = mockCrypto;
(global as any).mockFs = mockFs;

// Console suppression for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Helper function to suppress console output in tests
(global as any).suppressConsole = () => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
};