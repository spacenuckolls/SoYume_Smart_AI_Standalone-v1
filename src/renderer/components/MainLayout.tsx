import React, { useState, useEffect, useCallback } from 'react';
import { Story, Scene, Character, WritingSession, UserPresence, EditOperation, Comment, Suggestion } from '../../shared/types/Story';
import { StoryProjectManager } from './StoryProjectManager';
import { SceneEditor } from './SceneEditor';
import { CharacterManager } from './CharacterManager';
import { IntelligentWritingInterface } from './IntelligentWritingInterface';
import { StoryVisualizationDashboard } from './StoryVisualizationDashboard';
import { CollaborativeEditor } from './CollaborativeEditor';
import { AdvancedSettingsPanel } from './AdvancedSettingsPanel';
import '../styles/AdvancedComponents.css';

interface MainLayoutProps {
  initialStory?: Story;
}

type ViewMode = 'project' | 'editor' | 'intelligent-editor' | 'collaborative' | 'characters' | 'analysis' | 'dashboard';
type EditorMode = 'standard' | 'intelligent' | 'collaborative';

export const MainLayout: React.FC<MainLayoutProps> = ({ initialStory }) => {
  const [currentStory, setCurrentStory] = useState<Story | null>(initialStory || null);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('project');
  const [editorMode, setEditorMode] = useState<EditorMode>('intelligent');
  const [showSettings, setShowSettings] = useState(false);
  const [writingSession, setWritingSession] = useState<WritingSession>({
    id: 'session-1',
    startTime: new Date(),
    targetWordCount: 1000,
    currentWordCount: 0,
    isActive: true
  });
  const [collaborationSession, setCollaborationSession] = useState<string | null>(null);
  const [userPresence, setUserPresence] = useState<UserPresence>({
    userId: 'user-1',
    userName: 'Writer',
    userColor: '#3B82F6',
    sceneId: '',
    cursorPosition: 0,
    lastSeen: new Date(),
    isActive: true
  });

  // Initialize with first scene if story has scenes
  useEffect(() => {
    if (currentStory && currentStory.scenes && currentStory.scenes.length > 0 && !currentScene) {
      setCurrentScene(currentStory.scenes[0]);
    }
  }, [currentStory, currentScene]);

  const handleStorySelect = (story: Story) => {
    setCurrentStory(story);
    if (story.scenes && story.scenes.length > 0) {
      setCurrentScene(story.scenes[0]);
      setActiveView('intelligent-editor');
    }
  };

  const handleSceneSelect = (scene: Scene) => {
    setCurrentScene(scene);
    setActiveView(editorMode === 'collaborative' ? 'collaborative' : 'intelligent-editor');
  };

  const handleSceneUpdate = useCallback((updatedScene: Scene, operation?: EditOperation) => {
    if (currentStory) {
      const updatedStory = {
        ...currentStory,
        scenes: currentStory.scenes?.map(scene => 
          scene.id === updatedScene.id ? updatedScene : scene
        ) || []
      };
      setCurrentStory(updatedStory);
      setCurrentScene(updatedScene);
      
      // Update writing session
      if (updatedScene.content) {
        const wordCount = updatedScene.content.split(/\s+/).filter(word => word.length > 0).length;
        setWritingSession(prev => ({
          ...prev,
          currentWordCount: wordCount
        }));
      }
    }
  }, [currentStory]);

  const handleStoryUpdate = useCallback((updatedStory: Story) => {
    setCurrentStory(updatedStory);
  }, []);

  const handlePresenceUpdate = useCallback((presence: UserPresence) => {
    setUserPresence(presence);
  }, []);

  const handleCommentAdd = useCallback((comment: Comment) => {
    console.log('Comment added:', comment);
    // Handle comment addition
  }, []);

  const handleSuggestionAdd = useCallback((suggestion: Suggestion) => {
    console.log('Suggestion added:', suggestion);
    // Handle suggestion addition
  }, []);

  const handleSettingsChange = useCallback((settings: any) => {
    console.log('Settings updated:', settings);
    // Apply settings changes
  }, []);

  const handleEditorModeChange = (mode: EditorMode) => {
    setEditorMode(mode);
    if (currentStory && currentScene) {
      switch (mode) {
        case 'intelligent':
          setActiveView('intelligent-editor');
          break;
        case 'collaborative':
          setActiveView('collaborative');
          setCollaborationSession('session-' + Date.now());
          break;
        default:
          setActiveView('editor');
      }
    }
  };

  const handleInsightClick = useCallback((insight: any) => {
    console.log('Insight clicked:', insight);
    // Handle insight interaction
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + , : Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      
      // Ctrl/Cmd + Shift + D : Toggle dashboard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setActiveView(activeView === 'dashboard' ? 'intelligent-editor' : 'dashboard');
      }
      
      // Ctrl/Cmd + Shift + C : Toggle collaborative mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleEditorModeChange(editorMode === 'collaborative' ? 'intelligent' : 'collaborative');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, editorMode]);

  return (
    <div className="main-layout">
      <div className="layout-header">
        <div className="app-title">
          <h1>AI Creative Assistant</h1>
          <div className="app-subtitle">
            Professional Creative Writing Suite
          </div>
        </div>
        
        <nav className="main-navigation">
          <button 
            className={activeView === 'project' ? 'active' : ''}
            onClick={() => setActiveView('project')}
            title="Manage Projects"
          >
            📁 Projects
          </button>
          
          <div className="editor-mode-group">
            <button 
              className={activeView === 'intelligent-editor' ? 'active' : ''}
              onClick={() => setActiveView('intelligent-editor')}
              disabled={!currentStory}
              title="Intelligent Writing Interface"
            >
              ✍️ Write
            </button>
            
            <div className="mode-selector">
              <button
                className={`mode-btn ${editorMode === 'intelligent' ? 'active' : ''}`}
                onClick={() => handleEditorModeChange('intelligent')}
                disabled={!currentStory}
                title="AI-Assisted Writing"
              >
                🤖
              </button>
              <button
                className={`mode-btn ${editorMode === 'collaborative' ? 'active' : ''}`}
                onClick={() => handleEditorModeChange('collaborative')}
                disabled={!currentStory}
                title="Collaborative Writing"
              >
                👥
              </button>
            </div>
          </div>
          
          <button 
            className={activeView === 'characters' ? 'active' : ''}
            onClick={() => setActiveView('characters')}
            disabled={!currentStory}
            title="Character Management"
          >
            👤 Characters
          </button>
          
          <button 
            className={activeView === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveView('dashboard')}
            disabled={!currentStory}
            title="Story Analytics Dashboard"
          >
            📊 Analytics
          </button>
          
          <button 
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings (Ctrl+,)"
          >
            ⚙️
          </button>
        </nav>
      </div>
      
      <div className="layout-content">
        {activeView === 'project' && (
          <StoryProjectManager 
            onStorySelect={handleStorySelect}
            currentStory={currentStory}
          />
        )}
        
        {activeView === 'editor' && currentStory && currentScene && (
          <SceneEditor
            story={currentStory}
            scene={currentScene}
            onSceneUpdate={handleSceneUpdate}
            onSceneSelect={handleSceneSelect}
          />
        )}
        
        {activeView === 'intelligent-editor' && currentStory && currentScene && (
          <IntelligentWritingInterface
            story={currentStory}
            currentScene={currentScene}
            onSceneUpdate={handleSceneUpdate}
            onStoryUpdate={setCurrentStory}
            writingSession={writingSession}
            aiAssistanceMode="moderate"
          />
        )}
        
        {activeView === 'collaborative' && currentStory && currentScene && collaborationSession && (
          <CollaborativeEditor
            story={currentStory}
            scene={currentScene}
            sessionId={collaborationSession}
            userId={userPresence.userId}
            userName={userPresence.userName}
            userColor={userPresence.userColor}
            onSceneUpdate={handleSceneUpdate}
            onPresenceUpdate={handlePresenceUpdate}
            onCommentAdd={handleCommentAdd}
            onSuggestionAdd={handleSuggestionAdd}
          />
        )}
        
        {activeView === 'characters' && currentStory && (
          <CharacterManager
            story={currentStory}
            onStoryUpdate={handleStoryUpdate}
          />
        )}
        
        {activeView === 'dashboard' && currentStory && (
          <StoryVisualizationDashboard
            story={currentStory}
            onSceneSelect={(sceneIndex) => {
              if (currentStory.scenes && currentStory.scenes[sceneIndex]) {
                handleSceneSelect(currentStory.scenes[sceneIndex]);
              }
            }}
            onCharacterSelect={(characterId) => {
              setActiveView('characters');
            }}
            onInsightClick={handleInsightClick}
          />
        )}
        
        {activeView === 'analysis' && currentStory && (
          <div className="analysis-placeholder">
            <h2>Story Analysis</h2>
            <p>Advanced story analysis features are now integrated into the Analytics Dashboard.</p>
            <button 
              className="btn-primary"
              onClick={() => setActiveView('dashboard')}
            >
              Open Analytics Dashboard
            </button>
          </div>
        )}
      </div>
      
      {showSettings && (
        <AdvancedSettingsPanel
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      )}
      
      {/* Status Bar */}
      <div className="layout-footer">
        <div className="status-info">
          {currentStory && (
            <>
              <span className="story-title">{currentStory.title}</span>
              {currentScene && (
                <span className="scene-info">
                  Scene: {currentScene.title || 'Untitled'}
                </span>
              )}
              <span className="word-count">
                Words: {writingSession.currentWordCount} / {writingSession.targetWordCount}
              </span>
            </>
          )}
        </div>
        
        <div className="status-actions">
          {editorMode === 'collaborative' && (
            <div className="collaboration-status">
              <div className="status-indicator connected" />
              <span>Connected</span>
            </div>
          )}
          
          <div className="ai-status">
            <div className="status-indicator connected" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};