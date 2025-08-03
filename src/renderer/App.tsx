import React, { useState, useEffect } from 'react';
import './App.css';

interface AppState {
  isLoading: boolean;
  error: string | null;
  aiProviders: string[];
  currentStory: any;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isLoading: true,
    error: null,
    aiProviders: [],
    currentStory: null
  });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Test the electron API connection
      const testResponse = await window.electronAPI.ai.generateText(
        'Hello, SoYume AI!', 
        { characters: [], genre: ['fantasy'], targetAudience: 'young-adult' }
      );
      
      console.log('AI Engine test response:', testResponse);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        aiProviders: ['SoYume Co-writer'] // Mock for now
      }));
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to initialize the application'
      }));
    }
  };

  const handleTestAI = async () => {
    try {
      const response = await window.electronAPI.ai.analyzeStory(
        'Once upon a time, there was a brave knight who set out on a quest to save the kingdom.'
      );
      
      console.log('Story analysis response:', response);
      alert('AI test successful! Check the console for details.');
    } catch (error) {
      console.error('AI test failed:', error);
      alert('AI test failed. Check the console for details.');
    }
  };

  const handleTestDatabase = async () => {
    try {
      const mockStory = {
        id: 'test-story-1',
        title: 'Test Story',
        genre: [{ name: 'Fantasy', subgenres: [], conventions: [], tropes: [] }],
        structure: { type: 'three-act' as const, beats: [], currentBeat: undefined },
        characters: [],
        chapters: [],
        metadata: {
          targetWordCount: 80000,
          currentWordCount: 0,
          targetAudience: 'young-adult',
          contentRating: 'PG-13',
          tags: ['fantasy', 'adventure'],
          notes: 'Test story for database functionality'
        },
        analysisCache: {
          lastAnalyzed: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await window.electronAPI.db.saveStory(mockStory);
      const loadedStory = await window.electronAPI.db.loadStory('test-story-1');
      
      console.log('Database test - saved and loaded story:', loadedStory);
      alert('Database test successful! Check the console for details.');
    } catch (error) {
      console.error('Database test failed:', error);
      alert('Database test failed. Check the console for details.');
    }
  };

  const handleTestAccessibility = async () => {
    try {
      await window.electronAPI.accessibility.enableScreenReader();
      await window.electronAPI.accessibility.configureTextToSpeech({
        enabled: true,
        voice: 'default',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8
      });
      
      console.log('Accessibility features configured');
      alert('Accessibility test successful! Screen reader and TTS configured.');
    } catch (error) {
      console.error('Accessibility test failed:', error);
      alert('Accessibility test failed. Check the console for details.');
    }
  };

  if (state.isLoading) {
    return (
      <div className="loading-container" role="status" aria-label="Loading application">
        <div className="loading-spinner"></div>
        <p>Initializing SoYume AI Creative Assistant...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-container" role="alert">
        <h1>Application Error</h1>
        <p>{state.error}</p>
        <button onClick={() => window.location.reload()}>
          Reload Application
        </button>
      </div>
    );
  }

  return (
    <div className="app" role="main">
      <header className="app-header">
        <h1>SoYume AI Creative Assistant</h1>
        <p>Your intelligent companion for creative writing</p>
      </header>

      <main className="app-main">
        <section className="welcome-section">
          <h2>Welcome to SoYume</h2>
          <p>
            This is the foundation of your AI-powered creative writing assistant. 
            The application is now running with the core architecture in place.
          </p>
        </section>

        <section className="status-section">
          <h3>System Status</h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">AI Providers:</span>
              <span className="status-value">{state.aiProviders.length} available</span>
            </div>
            <div className="status-item">
              <span className="status-label">Database:</span>
              <span className="status-value">Connected</span>
            </div>
            <div className="status-item">
              <span className="status-label">Accessibility:</span>
              <span className="status-value">Enabled</span>
            </div>
          </div>
        </section>

        <section className="test-section">
          <h3>Test Core Functionality</h3>
          <div className="test-buttons">
            <button 
              onClick={handleTestAI}
              className="test-button"
              aria-describedby="ai-test-description"
            >
              Test AI Engine
            </button>
            <p id="ai-test-description" className="test-description">
              Test the AI engine with story analysis
            </p>

            <button 
              onClick={handleTestDatabase}
              className="test-button"
              aria-describedby="db-test-description"
            >
              Test Database
            </button>
            <p id="db-test-description" className="test-description">
              Test database save and load functionality
            </p>

            <button 
              onClick={handleTestAccessibility}
              className="test-button"
              aria-describedby="a11y-test-description"
            >
              Test Accessibility
            </button>
            <p id="a11y-test-description" className="test-description">
              Test accessibility features configuration
            </p>
          </div>
        </section>

        <section className="next-steps">
          <h3>Next Steps</h3>
          <ul>
            <li>✅ Project foundation and core architecture</li>
            <li>✅ Data models and database with encryption</li>
            <li>✅ AI provider abstraction layer</li>
            <li>🔄 Implement external AI provider integrations (Task 5)</li>
            <li>🔄 Build local AI setup wizard (Task 6)</li>
            <li>🔄 Develop SoYume Co-writer AI (Task 4)</li>
          </ul>
        </section>
      </main>

      <footer className="app-footer">
        <p>SoYume AI Creative Assistant - Foundation Complete</p>
      </footer>
    </div>
  );
};

export default App;