import React, { useState, useEffect, useCallback } from 'react';
import { ConfigManager } from '../../main/config/ConfigManager';
import { AccessibilityManager } from '../../main/accessibility/AccessibilityManager';
import { AIProviderRegistry } from '../../main/ai/providers/AIProviderRegistry';
import { AIProvider, AIProviderConfig, AIProviderType } from '../../shared/types/AI';

interface AdvancedSettingsPanelProps {
  onClose: () => void;
  onSettingsChange: (settings: any) => void;
}

interface SettingsSection {
  id: string;
  title: string;
  icon: string;
  component: React.ComponentType<any>;
}

interface AIProviderSettings {
  enabled: boolean;
  config: AIProviderConfig;
  priority: number;
  fallbackEnabled: boolean;
}

interface AccessibilitySettings {
  screenReaderEnabled: boolean;
  highContrastMode: boolean;
  dyslexiaSupport: boolean;
  keyboardNavigationEnabled: boolean;
  voiceControlEnabled: boolean;
  focusManagement: 'standard' | 'enhanced' | 'adhd-friendly';
  textToSpeechEnabled: boolean;
  speechToTextEnabled: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  colorScheme: 'auto' | 'light' | 'dark' | 'high-contrast';
  animationsEnabled: boolean;
  soundEnabled: boolean;
}

interface WritingSettings {
  autoSaveInterval: number;
  wordCountTarget: number;
  distractionFreeMode: boolean;
  typewriterMode: boolean;
  focusMode: boolean;
  spellCheckEnabled: boolean;
  grammarCheckEnabled: boolean;
  aiAssistanceLevel: 'minimal' | 'moderate' | 'aggressive';
  suggestionFrequency: 'low' | 'medium' | 'high';
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
}

interface PerformanceSettings {
  cacheEnabled: boolean;
  cacheSize: number;
  backgroundProcessing: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
  modelQuantization: boolean;
  gpuAcceleration: boolean;
  memoryLimit: number;
}

interface PrivacySettings {
  dataCollection: boolean;
  analyticsEnabled: boolean;
  crashReporting: boolean;
  cloudSyncEnabled: boolean;
  localStorageOnly: boolean;
  encryptionEnabled: boolean;
  anonymousUsage: boolean;
  telemetryLevel: 'none' | 'basic' | 'detailed';
}

export const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
  onClose,
  onSettingsChange
}) => {
  const [activeSection, setActiveSection] = useState('ai-providers');
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const configManager = new ConfigManager();
        const currentSettings = await configManager.getConfig();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle settings changes
  const handleSettingChange = useCallback((section: string, key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
    setHasChanges(true);
  }, []);

  // Save settings
  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const configManager = new ConfigManager();
      await configManager.updateConfig(settings);
      onSettingsChange(settings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [settings, onSettingsChange]);

  // Reset settings
  const resetSettings = useCallback(async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setIsLoading(true);
      try {
        const configManager = new ConfigManager();
        await configManager.resetConfig();
        const defaultSettings = await configManager.getConfig();
        setSettings(defaultSettings);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to reset settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // Settings sections
  const sections: SettingsSection[] = [
    {
      id: 'ai-providers',
      title: 'AI Providers',
      icon: '🤖',
      component: AIProvidersSection
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      icon: '♿',
      component: AccessibilitySection
    },
    {
      id: 'writing',
      title: 'Writing',
      icon: '✍️',
      component: WritingSection
    },
    {
      id: 'performance',
      title: 'Performance',
      icon: '⚡',
      component: PerformanceSection
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      icon: '🔒',
      component: PrivacySection
    },
    {
      id: 'advanced',
      title: 'Advanced',
      icon: '⚙️',
      component: AdvancedSection
    }
  ];

  const ActiveSectionComponent = sections.find(s => s.id === activeSection)?.component || AIProvidersSection;

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner" />
        <div className="loading-text">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="advanced-settings-panel">
      <div className="settings-overlay" onClick={onClose} />
      
      <div className="settings-modal">
        <div className="settings-header">
          <div className="settings-title">
            <h1>Advanced Settings</h1>
            <p>Customize your AI Creative Assistant experience</p>
          </div>
          
          <div className="settings-actions">
            {hasChanges && (
              <div className="unsaved-changes">
                <span>Unsaved changes</span>
              </div>
            )}
            
            <button 
              className="btn-secondary"
              onClick={resetSettings}
              disabled={isSaving}
            >
              Reset to Defaults
            </button>
            
            <button 
              className="btn-primary"
              onClick={saveSettings}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            
            <button 
              className="btn-close"
              onClick={onClose}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="settings-content">
          <div className="settings-sidebar">
            <nav className="settings-nav">
              {sections.map(section => (
                <button
                  key={section.id}
                  className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="nav-icon">{section.icon}</span>
                  <span className="nav-title">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
          
          <div className="settings-main">
            <ActiveSectionComponent
              settings={settings}
              onSettingChange={handleSettingChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// AI Providers Section
const AIProvidersSection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    const loadProviders = async () => {
      const registry = new AIProviderRegistry();
      const availableProviders = await registry.getAvailableProviders();
      setProviders(availableProviders);
    };
    loadProviders();
  }, []);

  const testProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const registry = new AIProviderRegistry();
      const provider = await registry.getProvider(providerId);
      const result = await provider.testConnection();
      alert(result.success ? 'Connection successful!' : `Connection failed: ${result.error}`);
    } catch (error) {
      alert(`Test failed: ${error}`);
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>AI Providers Configuration</h2>
        <p>Configure and manage your AI providers for different writing tasks</p>
      </div>
      
      <div className="providers-list">
        {providers.map(provider => (
          <div key={provider.id} className="provider-card">
            <div className="provider-header">
              <div className="provider-info">
                <h3>{provider.name}</h3>
                <p>{provider.description}</p>
                <div className="provider-type">{provider.type}</div>
              </div>
              
              <div className="provider-controls">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.aiProviders?.[provider.id]?.enabled || false}
                    onChange={(e) => onSettingChange('aiProviders', `${provider.id}.enabled`, e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
            
            {settings.aiProviders?.[provider.id]?.enabled && (
              <div className="provider-config">
                <div className="config-row">
                  <label>Priority</label>
                  <select
                    value={settings.aiProviders?.[provider.id]?.priority || 1}
                    onChange={(e) => onSettingChange('aiProviders', `${provider.id}.priority`, parseInt(e.target.value))}
                  >
                    <option value={1}>High</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Low</option>
                  </select>
                </div>
                
                <div className="config-row">
                  <label>Enable as Fallback</label>
                  <input
                    type="checkbox"
                    checked={settings.aiProviders?.[provider.id]?.fallbackEnabled || false}
                    onChange={(e) => onSettingChange('aiProviders', `${provider.id}.fallbackEnabled`, e.target.checked)}
                  />
                </div>
                
                {provider.type === 'cloud' && (
                  <>
                    <div className="config-row">
                      <label>API Key</label>
                      <input
                        type="password"
                        value={settings.aiProviders?.[provider.id]?.config?.apiKey || ''}
                        onChange={(e) => onSettingChange('aiProviders', `${provider.id}.config.apiKey`, e.target.value)}
                        placeholder="Enter API key"
                      />
                    </div>
                    
                    <div className="config-row">
                      <label>Model</label>
                      <input
                        type="text"
                        value={settings.aiProviders?.[provider.id]?.config?.model || ''}
                        onChange={(e) => onSettingChange('aiProviders', `${provider.id}.config.model`, e.target.value)}
                        placeholder="Model name"
                      />
                    </div>
                  </>
                )}
                
                {provider.type === 'local' && (
                  <>
                    <div className="config-row">
                      <label>Endpoint URL</label>
                      <input
                        type="url"
                        value={settings.aiProviders?.[provider.id]?.config?.endpoint || ''}
                        onChange={(e) => onSettingChange('aiProviders', `${provider.id}.config.endpoint`, e.target.value)}
                        placeholder="http://localhost:11434"
                      />
                    </div>
                    
                    <div className="config-row">
                      <label>Model Path</label>
                      <input
                        type="text"
                        value={settings.aiProviders?.[provider.id]?.config?.modelPath || ''}
                        onChange={(e) => onSettingChange('aiProviders', `${provider.id}.config.modelPath`, e.target.value)}
                        placeholder="Path to model file"
                      />
                    </div>
                  </>
                )}
                
                <div className="provider-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => testProvider(provider.id)}
                    disabled={testingProvider === provider.id}
                  >
                    {testingProvider === provider.id ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Accessibility Section
const AccessibilitySection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Accessibility Settings</h2>
        <p>Configure accessibility features for an inclusive writing experience</p>
      </div>
      
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Visual Accessibility</h3>
          
          <div className="setting-item">
            <label>High Contrast Mode</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.highContrastMode || false}
              onChange={(e) => onSettingChange('accessibility', 'highContrastMode', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Font Size</label>
            <select
              value={settings.accessibility?.fontSize || 'medium'}
              onChange={(e) => onSettingChange('accessibility', 'fontSize', e.target.value)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="extra-large">Extra Large</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Color Scheme</label>
            <select
              value={settings.accessibility?.colorScheme || 'auto'}
              onChange={(e) => onSettingChange('accessibility', 'colorScheme', e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="high-contrast">High Contrast</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Reduce Animations</label>
            <input
              type="checkbox"
              checked={!settings.accessibility?.animationsEnabled}
              onChange={(e) => onSettingChange('accessibility', 'animationsEnabled', !e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Motor & Cognitive Support</h3>
          
          <div className="setting-item">
            <label>Enhanced Keyboard Navigation</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.keyboardNavigationEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'keyboardNavigationEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Focus Management</label>
            <select
              value={settings.accessibility?.focusManagement || 'standard'}
              onChange={(e) => onSettingChange('accessibility', 'focusManagement', e.target.value)}
            >
              <option value="standard">Standard</option>
              <option value="enhanced">Enhanced</option>
              <option value="adhd-friendly">ADHD-Friendly</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Dyslexia Support</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.dyslexiaSupport || false}
              onChange={(e) => onSettingChange('accessibility', 'dyslexiaSupport', e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Audio & Speech</h3>
          
          <div className="setting-item">
            <label>Screen Reader Support</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.screenReaderEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'screenReaderEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Text-to-Speech</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.textToSpeechEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'textToSpeechEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Speech-to-Text</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.speechToTextEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'speechToTextEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Voice Control</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.voiceControlEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'voiceControlEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Sound Effects</label>
            <input
              type="checkbox"
              checked={settings.accessibility?.soundEnabled || false}
              onChange={(e) => onSettingChange('accessibility', 'soundEnabled', e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Writing Section
const WritingSection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Writing Settings</h2>
        <p>Customize your writing environment and AI assistance</p>
      </div>
      
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Writing Environment</h3>
          
          <div className="setting-item">
            <label>Auto-save Interval (minutes)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.writing?.autoSaveInterval || 5}
              onChange={(e) => onSettingChange('writing', 'autoSaveInterval', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting-item">
            <label>Daily Word Count Target</label>
            <input
              type="number"
              min="100"
              max="10000"
              step="100"
              value={settings.writing?.wordCountTarget || 1000}
              onChange={(e) => onSettingChange('writing', 'wordCountTarget', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting-item">
            <label>Distraction-Free Mode</label>
            <input
              type="checkbox"
              checked={settings.writing?.distractionFreeMode || false}
              onChange={(e) => onSettingChange('writing', 'distractionFreeMode', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Typewriter Mode</label>
            <input
              type="checkbox"
              checked={settings.writing?.typewriterMode || false}
              onChange={(e) => onSettingChange('writing', 'typewriterMode', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Focus Mode</label>
            <input
              type="checkbox"
              checked={settings.writing?.focusMode || false}
              onChange={(e) => onSettingChange('writing', 'focusMode', e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Language & Grammar</h3>
          
          <div className="setting-item">
            <label>Spell Check</label>
            <input
              type="checkbox"
              checked={settings.writing?.spellCheckEnabled !== false}
              onChange={(e) => onSettingChange('writing', 'spellCheckEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Grammar Check</label>
            <input
              type="checkbox"
              checked={settings.writing?.grammarCheckEnabled || false}
              onChange={(e) => onSettingChange('writing', 'grammarCheckEnabled', e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>AI Assistance</h3>
          
          <div className="setting-item">
            <label>AI Assistance Level</label>
            <select
              value={settings.writing?.aiAssistanceLevel || 'moderate'}
              onChange={(e) => onSettingChange('writing', 'aiAssistanceLevel', e.target.value)}
            >
              <option value="minimal">Minimal</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Suggestion Frequency</label>
            <select
              value={settings.writing?.suggestionFrequency || 'medium'}
              onChange={(e) => onSettingChange('writing', 'suggestionFrequency', e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Analysis Depth</label>
            <select
              value={settings.writing?.analysisDepth || 'detailed'}
              onChange={(e) => onSettingChange('writing', 'analysisDepth', e.target.value)}
            >
              <option value="basic">Basic</option>
              <option value="detailed">Detailed</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// Performance Section
const PerformanceSection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Performance Settings</h2>
        <p>Optimize performance for your system and usage patterns</p>
      </div>
      
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Caching & Storage</h3>
          
          <div className="setting-item">
            <label>Enable Caching</label>
            <input
              type="checkbox"
              checked={settings.performance?.cacheEnabled !== false}
              onChange={(e) => onSettingChange('performance', 'cacheEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Cache Size (MB)</label>
            <input
              type="number"
              min="50"
              max="2000"
              step="50"
              value={settings.performance?.cacheSize || 500}
              onChange={(e) => onSettingChange('performance', 'cacheSize', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting-item">
            <label>Memory Limit (MB)</label>
            <input
              type="number"
              min="512"
              max="8192"
              step="256"
              value={settings.performance?.memoryLimit || 2048}
              onChange={(e) => onSettingChange('performance', 'memoryLimit', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Processing</h3>
          
          <div className="setting-item">
            <label>Background Processing</label>
            <input
              type="checkbox"
              checked={settings.performance?.backgroundProcessing !== false}
              onChange={(e) => onSettingChange('performance', 'backgroundProcessing', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Max Concurrent Requests</label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.performance?.maxConcurrentRequests || 3}
              onChange={(e) => onSettingChange('performance', 'maxConcurrentRequests', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting-item">
            <label>Request Timeout (seconds)</label>
            <input
              type="number"
              min="10"
              max="300"
              step="10"
              value={settings.performance?.requestTimeout || 60}
              onChange={(e) => onSettingChange('performance', 'requestTimeout', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>AI Optimization</h3>
          
          <div className="setting-item">
            <label>Model Quantization</label>
            <input
              type="checkbox"
              checked={settings.performance?.modelQuantization || false}
              onChange={(e) => onSettingChange('performance', 'modelQuantization', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>GPU Acceleration</label>
            <input
              type="checkbox"
              checked={settings.performance?.gpuAcceleration || false}
              onChange={(e) => onSettingChange('performance', 'gpuAcceleration', e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Privacy Section
const PrivacySection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Privacy & Security Settings</h2>
        <p>Control how your data is handled and protected</p>
      </div>
      
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Data Collection</h3>
          
          <div className="setting-item">
            <label>Anonymous Usage Analytics</label>
            <input
              type="checkbox"
              checked={settings.privacy?.analyticsEnabled || false}
              onChange={(e) => onSettingChange('privacy', 'analyticsEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Crash Reporting</label>
            <input
              type="checkbox"
              checked={settings.privacy?.crashReporting || false}
              onChange={(e) => onSettingChange('privacy', 'crashReporting', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Telemetry Level</label>
            <select
              value={settings.privacy?.telemetryLevel || 'basic'}
              onChange={(e) => onSettingChange('privacy', 'telemetryLevel', e.target.value)}
            >
              <option value="none">None</option>
              <option value="basic">Basic</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Data Storage</h3>
          
          <div className="setting-item">
            <label>Local Storage Only</label>
            <input
              type="checkbox"
              checked={settings.privacy?.localStorageOnly || false}
              onChange={(e) => onSettingChange('privacy', 'localStorageOnly', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Cloud Sync</label>
            <input
              type="checkbox"
              checked={settings.privacy?.cloudSyncEnabled || false}
              onChange={(e) => onSettingChange('privacy', 'cloudSyncEnabled', e.target.checked)}
              disabled={settings.privacy?.localStorageOnly}
            />
          </div>
          
          <div className="setting-item">
            <label>Data Encryption</label>
            <input
              type="checkbox"
              checked={settings.privacy?.encryptionEnabled !== false}
              onChange={(e) => onSettingChange('privacy', 'encryptionEnabled', e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Advanced Section
const AdvancedSection: React.FC<{
  settings: any;
  onSettingChange: (section: string, key: string, value: any) => void;
}> = ({ settings, onSettingChange }) => {
  const [debugMode, setDebugMode] = useState(false);
  const [experimentalFeatures, setExperimentalFeatures] = useState(false);

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Advanced Settings</h2>
        <p>Advanced configuration options for power users</p>
      </div>
      
      <div className="settings-groups">
        <div className="settings-group">
          <h3>Developer Options</h3>
          
          <div className="setting-item">
            <label>Debug Mode</label>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>Experimental Features</label>
            <input
              type="checkbox"
              checked={experimentalFeatures}
              onChange={(e) => setExperimentalFeatures(e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>System Integration</h3>
          
          <div className="setting-item">
            <label>Plugin API Enabled</label>
            <input
              type="checkbox"
              checked={settings.advanced?.pluginApiEnabled || false}
              onChange={(e) => onSettingChange('advanced', 'pluginApiEnabled', e.target.checked)}
            />
          </div>
          
          <div className="setting-item">
            <label>External Tool Integration</label>
            <input
              type="checkbox"
              checked={settings.advanced?.externalToolIntegration || false}
              onChange={(e) => onSettingChange('advanced', 'externalToolIntegration', e.target.checked)}
            />
          </div>
        </div>
        
        <div className="settings-group">
          <h3>Data Management</h3>
          
          <div className="setting-item">
            <button className="btn-secondary">
              Export Settings
            </button>
          </div>
          
          <div className="setting-item">
            <button className="btn-secondary">
              Import Settings
            </button>
          </div>
          
          <div className="setting-item">
            <button className="btn-danger">
              Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};