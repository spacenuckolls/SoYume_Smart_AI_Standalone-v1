import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // AI Engine API
  ai: {
    generateText: (prompt: string, context: any) => 
      ipcRenderer.invoke('ai:generateText', prompt, context),
    analyzeStory: (content: string) => 
      ipcRenderer.invoke('ai:analyzeStory', content),
  },

  // Database API
  db: {
    saveStory: (story: any) => 
      ipcRenderer.invoke('db:saveStory', story),
    loadStory: (storyId: string) => 
      ipcRenderer.invoke('db:loadStory', storyId),
  },

  // Configuration API
  config: {
    get: (key: string) => 
      ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => 
      ipcRenderer.invoke('config:set', key, value),
  },

  // Accessibility API
  accessibility: {
    enableScreenReader: () => 
      ipcRenderer.invoke('accessibility:enableScreenReader'),
    configureTextToSpeech: (config: any) => 
      ipcRenderer.invoke('accessibility:configureTextToSpeech', config),
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      ai: {
        generateText: (prompt: string, context: any) => Promise<any>;
        analyzeStory: (content: string) => Promise<any>;
      };
      db: {
        saveStory: (story: any) => Promise<any>;
        loadStory: (storyId: string) => Promise<any>;
      };
      config: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
      accessibility: {
        enableScreenReader: () => Promise<void>;
        configureTextToSpeech: (config: any) => Promise<void>;
      };
    };
  }
}