import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { DatabaseManager } from './database/DatabaseManager';
import { ConfigManager } from './config/ConfigManager';
import { AIEngine } from './ai/AIEngine';
import { AccessibilityManager } from './accessibility/AccessibilityManager';

class SoYumeApp {
  private mainWindow: BrowserWindow | null = null;
  private databaseManager: DatabaseManager;
  private configManager: ConfigManager;
  private aiEngine: AIEngine;
  private accessibilityManager: AccessibilityManager;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.configManager = new ConfigManager();
    this.aiEngine = new AIEngine();
    this.accessibilityManager = new AccessibilityManager();
  }

  async initialize(): Promise<void> {
    await this.databaseManager.initialize();
    await this.configManager.initialize();
    await this.aiEngine.initialize();
    await this.accessibilityManager.initialize();
    
    this.setupIpcHandlers();
  }

  createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'default',
      show: false, // Don't show until ready
    });

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // Apply accessibility settings
      this.accessibilityManager.applyWindowSettings(this.mainWindow!);
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIpcHandlers(): void {
    // AI Engine handlers
    ipcMain.handle('ai:generateText', async (event, prompt: string, context: any) => {
      return this.aiEngine.generateText(prompt, context);
    });

    ipcMain.handle('ai:analyzeStory', async (event, content: string) => {
      return this.aiEngine.analyzeStory(content);
    });

    // Database handlers
    ipcMain.handle('db:saveStory', async (event, story: any) => {
      return this.databaseManager.saveStory(story);
    });

    ipcMain.handle('db:loadStory', async (event, storyId: string) => {
      return this.databaseManager.loadStory(storyId);
    });

    // Configuration handlers
    ipcMain.handle('config:get', async (event, key: string) => {
      return this.configManager.get(key);
    });

    ipcMain.handle('config:set', async (event, key: string, value: any) => {
      return this.configManager.set(key, value);
    });

    // Accessibility handlers
    ipcMain.handle('accessibility:enableScreenReader', async () => {
      return this.accessibilityManager.enableScreenReader();
    });

    ipcMain.handle('accessibility:configureTextToSpeech', async (event, config: any) => {
      return this.accessibilityManager.configureTextToSpeech(config);
    });
  }
}

// Application lifecycle
const soYumeApp = new SoYumeApp();

app.whenReady().then(async () => {
  await soYumeApp.initialize();
  soYumeApp.createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      soYumeApp.createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app termination
app.on('before-quit', async () => {
  // Cleanup resources
  await soYumeApp['databaseManager'].close();
});