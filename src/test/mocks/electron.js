// Mock Electron APIs for testing
const mockElectron = {
  app: {
    getPath: jest.fn(() => '/mock/path'),
    on: jest.fn(),
    quit: jest.fn(),
    isReady: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve())
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn()
    },
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false),
    focus: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn()
  }
};

// Mock window.electronAPI for renderer tests
global.window = global.window || {};
global.window.electronAPI = {
  isOnboardingRequired: jest.fn(() => Promise.resolve(false)),
  getOnboardingProgress: jest.fn(() => Promise.resolve({})),
  startOnboarding: jest.fn(() => Promise.resolve(true)),
  completeOnboarding: jest.fn(() => Promise.resolve(true)),
  skipOnboardingStep: jest.fn(() => Promise.resolve(true)),
  saveUserSettings: jest.fn(() => Promise.resolve(true)),
  onboardingComplete: jest.fn(),
  getCompletedTutorials: jest.fn(() => Promise.resolve([])),
  markTutorialCompleted: jest.fn(() => Promise.resolve(true)),
  getTutorialPreferences: jest.fn(() => Promise.resolve({})),
  updateTutorialPreferences: jest.fn(() => Promise.resolve(true)),
  configureAIProvider: jest.fn(() => Promise.resolve()),
  getUserSettings: jest.fn(() => Promise.resolve({})),
  updateUserSettings: jest.fn(() => Promise.resolve(true))
};

// Mock process for Node.js APIs
global.process = global.process || {
  platform: 'test',
  arch: 'x64',
  version: 'v18.0.0',
  uptime: () => 100,
  memoryUsage: () => ({
    rss: 1000000,
    heapTotal: 1000000,
    heapUsed: 500000,
    external: 100000,
    arrayBuffers: 50000
  }),
  env: {
    NODE_ENV: 'test'
  }
};

module.exports = mockElectron;