import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layout,
  Card,
  Button,
  Input,
  Select,
  Space,
  Tooltip,
  Dropdown,
  Progress,
  Tag,
  Divider,
  Typography,
  Row,
  Col,
  Slider,
  Switch,
  Badge,
  Popover,
  Modal,
  message,
  Spin
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  MoreOutlined,
  BulbOutlined,
  EyeOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  BookOutlined,
  UserOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
  FormatPainterOutlined,
  FontSizeOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  SoundOutlined,
  CommentOutlined
} from '@ant-design/icons';
import { Story, Scene, Character, SceneAnalysis } from '../../shared/types/Story';
import { SceneOutline } from './SceneOutline';
import { WritingAssistant } from './WritingAssistant';
import { SceneAnalysisPanel } from './SceneAnalysisPanel';
import { CharacterPanel } from './CharacterPanel';
import { RichTextEditor } from './RichTextEditor';
import { WritingGoals } from './WritingGoals';
import { DistractionFreeMode } from './DistractionFreeMode';
import './SceneEditor.css';

const { Sider, Content } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SceneEditorProps {
  story: Story;
  currentScene: Scene | null;
  onSceneSelect: (scene: Scene) => void;
  onSceneUpdate: (scene: Scene) => void;
  onStoryUpdate: (story: Story) => void;
}

interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  showWordCount: boolean;
  showReadingTime: boolean;
  autoSave: boolean;
  distractionFree: boolean;
  typewriterMode: boolean;
  focusMode: boolean;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({
  story,
  currentScene,
  onSceneSelect,
  onSceneUpdate,
  onStoryUpdate
}) => {
  const [leftSiderCollapsed, setLeftSiderCollapsed] = useState(false);
  const [rightSiderCollapsed, setRightSiderCollapsed] = useState(false);
  const [activeRightPanel, setActiveRightPanel] = useState<'assistant' | 'analysis' | 'characters' | 'goals'>('assistant');
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 16,
    fontFamily: 'Georgia',
    lineHeight: 1.6,
    theme: 'light',
    showWordCount: true,
    showReadingTime: true,
    autoSave: true,
    distractionFree: false,
    typewriterMode: false,
    focusMode: false
  });
  
  const [sceneAnalysis, setSceneAnalysis] = useState<SceneAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [writingSession, setWritingSession] = useState({
    startTime: null as Date | null,
    wordCount: 0,
    targetWords: 500,
    isActive: false
  });
  
  const [editorContent, setEditorContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const editorRef = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentScene) {
      setEditorContent(currentScene.content || '');
      updateWordCount(currentScene.content || '');
    }
  }, [currentScene]);

  useEffect(() => {
    if (editorSettings.autoSave && currentScene) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleAutoSave();
      }, 2000);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editorContent]);

  const updateWordCount = useCallback((content: string) => {
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    setWordCount(count);
    setReadingTime(Math.ceil(count / 250)); // Average reading speed
  }, []);

  const handleContentChange = (content: string) => {
    setEditorContent(content);
    updateWordCount(content);
    
    if (writingSession.isActive) {
      setWritingSession(prev => ({
        ...prev,
        wordCount: prev.wordCount + (content.length > editorContent.length ? 1 : 0)
      }));
    }
  };

  const handleAutoSave = async () => {
    if (currentScene && editorContent !== currentScene.content) {
      try {
        const updatedScene = { ...currentScene, content: editorContent };
        await window.electronAPI.scene.autoSaveScene(updatedScene);
        onSceneUpdate(updatedScene);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  };

  const handleSaveScene = async () => {
    if (currentScene) {
      try {
        const updatedScene = {
          ...currentScene,
          content: editorContent,
          wordCount,
          lastModified: new Date().toISOString()
        };
        
        await window.electronAPI.scene.saveScene(updatedScene);
        onSceneUpdate(updatedScene);
        
        // Update story word count
        const totalWordCount = story.scenes?.reduce((total, scene) => 
          total + (scene.id === currentScene.id ? wordCount : scene.wordCount || 0), 0
        ) || 0;
        
        const updatedStory = { ...story, wordCount: totalWordCount };
        onStoryUpdate(updatedStory);
        
        message.success('Scene saved successfully');
      } catch (error) {
        message.error('Failed to save scene');
      }
    }
  };

  const handleCreateScene = () => {
    const newScene: Scene = {
      id: `scene_${Date.now()}`,
      title: `Scene ${(story.scenes?.length || 0) + 1}`,
      content: '',
      summary: '',
      characters: [],
      setting: '',
      mood: 'neutral',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    const updatedStory = {
      ...story,
      scenes: [...(story.scenes || []), newScene]
    };

    onStoryUpdate(updatedStory);
    onSceneSelect(newScene);
    message.success('New scene created');
  };

  const handleDeleteScene = (scene: Scene) => {
    Modal.confirm({
      title: 'Delete Scene',
      content: `Are you sure you want to delete "${scene.title}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const updatedScenes = story.scenes?.filter(s => s.id !== scene.id) || [];
        const updatedStory = { ...story, scenes: updatedScenes };
        onStoryUpdate(updatedStory);
        
        if (currentScene?.id === scene.id) {
          onSceneSelect(updatedScenes[0] || null);
        }
        
        message.success('Scene deleted');
      }
    });
  };

  const handleAnalyzeScene = async () => {
    if (!currentScene) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await window.electronAPI.scene.analyzeScene(currentScene);
      setSceneAnalysis(analysis);
      setActiveRightPanel('analysis');
      setRightSiderCollapsed(false);
    } catch (error) {
      message.error('Failed to analyze scene');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startWritingSession = () => {
    setWritingSession({
      startTime: new Date(),
      wordCount: 0,
      targetWords: 500,
      isActive: true
    });
    message.success('Writing session started!');
  };

  const endWritingSession = () => {
    if (writingSession.startTime) {
      const duration = Date.now() - writingSession.startTime.getTime();
      const minutes = Math.round(duration / 60000);
      
      setWritingSession(prev => ({ ...prev, isActive: false }));
      
      message.success(
        `Writing session completed! ${writingSession.wordCount} words in ${minutes} minutes.`
      );
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setLeftSiderCollapsed(true);
      setRightSiderCollapsed(true);
    }
  };

  const sceneMenuItems = (scene: Scene) => [
    {
      key: 'edit',
      label: 'Edit Title',
      icon: <EditOutlined />,
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: <CopyOutlined />,
    },
    {
      key: 'analyze',
      label: 'Analyze',
      icon: <BarChartOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const editorToolbarItems = [
    {
      key: 'save',
      icon: <SaveOutlined />,
      tooltip: 'Save (Ctrl+S)',
      onClick: handleSaveScene,
    },
    {
      key: 'undo',
      icon: <UndoOutlined />,
      tooltip: 'Undo (Ctrl+Z)',
      onClick: () => editorRef.current?.undo(),
    },
    {
      key: 'redo',
      icon: <RedoOutlined />,
      tooltip: 'Redo (Ctrl+Y)',
      onClick: () => editorRef.current?.redo(),
    },
    { type: 'divider' },
    {
      key: 'bold',
      icon: <BoldOutlined />,
      tooltip: 'Bold (Ctrl+B)',
      onClick: () => editorRef.current?.toggleBold(),
    },
    {
      key: 'italic',
      icon: <ItalicOutlined />,
      tooltip: 'Italic (Ctrl+I)',
      onClick: () => editorRef.current?.toggleItalic(),
    },
    {
      key: 'underline',
      icon: <UnderlineOutlined />,
      tooltip: 'Underline (Ctrl+U)',
      onClick: () => editorRef.current?.toggleUnderline(),
    },
    { type: 'divider' },
    {
      key: 'analyze',
      icon: <BarChartOutlined />,
      tooltip: 'Analyze Scene',
      onClick: handleAnalyzeScene,
      loading: isAnalyzing,
    },
    {
      key: 'assistant',
      icon: <BulbOutlined />,
      tooltip: 'AI Assistant',
      onClick: () => {
        setActiveRightPanel('assistant');
        setRightSiderCollapsed(false);
      },
    },
    {
      key: 'fullscreen',
      icon: isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
      tooltip: 'Toggle Fullscreen (F11)',
      onClick: toggleFullscreen,
    },
  ];

  const rightPanelTabs = [
    {
      key: 'assistant',
      label: 'AI Assistant',
      icon: <BulbOutlined />,
    },
    {
      key: 'analysis',
      label: 'Analysis',
      icon: <BarChartOutlined />,
      badge: sceneAnalysis ? 1 : 0,
    },
    {
      key: 'characters',
      label: 'Characters',
      icon: <UserOutlined />,
    },
    {
      key: 'goals',
      label: 'Goals',
      icon: <ThunderboltOutlined />,
    },
  ];

  const renderRightPanel = () => {
    switch (activeRightPanel) {
      case 'assistant':
        return (
          <WritingAssistant
            story={story}
            currentScene={currentScene}
            selectedText=""
            onSuggestionApply={(suggestion) => {
              setEditorContent(prev => prev + suggestion);
            }}
          />
        );
      case 'analysis':
        return (
          <SceneAnalysisPanel
            scene={currentScene}
            analysis={sceneAnalysis}
            onReanalyze={handleAnalyzeScene}
            isAnalyzing={isAnalyzing}
          />
        );
      case 'characters':
        return (
          <CharacterPanel
            story={story}
            currentScene={currentScene}
            onCharacterSelect={(character) => {
              // Insert character name at cursor
              const characterMention = `${character.name}`;
              setEditorContent(prev => prev + characterMention);
            }}
          />
        );
      case 'goals':
        return (
          <WritingGoals
            session={writingSession}
            onStartSession={startWritingSession}
            onEndSession={endWritingSession}
            onUpdateTarget={(target) => 
              setWritingSession(prev => ({ ...prev, targetWords: target }))
            }
          />
        );
      default:
        return null;
    }
  };

  if (editorSettings.distractionFree) {
    return (
      <DistractionFreeMode
        content={editorContent}
        onChange={handleContentChange}
        settings={editorSettings}
        onExit={() => setEditorSettings(prev => ({ ...prev, distractionFree: false }))}
        wordCount={wordCount}
        readingTime={readingTime}
      />
    );
  }

  return (
    <Layout className={`scene-editor ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Left Sidebar - Scene Outline */}
      <Sider
        width={300}
        collapsed={leftSiderCollapsed}
        onCollapse={setLeftSiderCollapsed}
        className="scene-outline-sider"
        theme="light"
      >
        <div className="sider-header">
          <Title level={4}>Scenes</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateScene}
            size="small"
          >
            Add Scene
          </Button>
        </div>
        
        <SceneOutline
          story={story}
          currentScene={currentScene}
          onSceneSelect={onSceneSelect}
          onSceneUpdate={onSceneUpdate}
          onSceneDelete={handleDeleteScene}
          collapsed={leftSiderCollapsed}
        />
      </Sider>

      {/* Main Editor Content */}
      <Content className="editor-content">
        {/* Editor Toolbar */}
        <div className="editor-toolbar">
          <div className="toolbar-left">
            <Space>
              {editorToolbarItems.map((item, index) => 
                item.type === 'divider' ? (
                  <Divider key={index} type="vertical" />
                ) : (
                  <Tooltip key={item.key} title={item.tooltip}>
                    <Button
                      type="text"
                      icon={item.icon}
                      onClick={item.onClick}
                      loading={item.loading}
                    />
                  </Tooltip>
                )
              )}
            </Space>
          </div>

          <div className="toolbar-center">
            {currentScene && (
              <Space>
                <Text strong>{currentScene.title}</Text>
                <Divider type="vertical" />
                <Text type="secondary">{wordCount} words</Text>
                <Divider type="vertical" />
                <Text type="secondary">{readingTime} min read</Text>
                {writingSession.isActive && (
                  <>
                    <Divider type="vertical" />
                    <Badge status="processing" text="Writing..." />
                    <Progress
                      percent={(writingSession.wordCount / writingSession.targetWords) * 100}
                      size="small"
                      style={{ width: 100 }}
                    />
                  </>
                )}
              </Space>
            )}
          </div>

          <div className="toolbar-right">
            <Space>
              <Select
                value={editorSettings.fontSize}
                onChange={(value) => setEditorSettings(prev => ({ ...prev, fontSize: value }))}
                size="small"
                style={{ width: 80 }}
              >
                <Option value={12}>12px</Option>
                <Option value={14}>14px</Option>
                <Option value={16}>16px</Option>
                <Option value={18}>18px</Option>
                <Option value={20}>20px</Option>
                <Option value={24}>24px</Option>
              </Select>

              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setShowSettingsModal(true)}
              />
            </Space>
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="editor-container">
          {currentScene ? (
            <RichTextEditor
              ref={editorRef}
              content={editorContent}
              onChange={handleContentChange}
              settings={editorSettings}
              placeholder="Start writing your scene..."
              onCursorPositionChange={setCursorPosition}
            />
          ) : (
            <div className="no-scene-selected">
              <div className="no-scene-content">
                <BookOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
                <Title level={3} type="secondary">No Scene Selected</Title>
                <Text type="secondary">
                  Select a scene from the outline or create a new one to start writing.
                </Text>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateScene}
                  size="large"
                  style={{ marginTop: 16 }}
                >
                  Create New Scene
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="editor-status-bar">
          <div className="status-left">
            <Space>
              <Text type="secondary">Line {cursorPosition.line}, Column {cursorPosition.column}</Text>
              {editorSettings.autoSave && (
                <>
                  <Divider type="vertical" />
                  <Text type="secondary">Auto-save enabled</Text>
                </>
              )}
            </Space>
          </div>
          
          <div className="status-right">
            <Space>
              <Text type="secondary">{editorSettings.theme} theme</Text>
              <Divider type="vertical" />
              <Text type="secondary">{editorSettings.fontFamily}</Text>
            </Space>
          </div>
        </div>
      </Content>

      {/* Right Sidebar - AI Tools */}
      <Sider
        width={400}
        collapsed={rightSiderCollapsed}
        onCollapse={setRightSiderCollapsed}
        className="ai-tools-sider"
        theme="light"
        reverseArrow
      >
        <div className="sider-header">
          <div className="panel-tabs">
            {rightPanelTabs.map(tab => (
              <Tooltip key={tab.key} title={tab.label}>
                <Button
                  type={activeRightPanel === tab.key ? 'primary' : 'text'}
                  icon={tab.badge ? <Badge count={tab.badge} size="small">{tab.icon}</Badge> : tab.icon}
                  onClick={() => setActiveRightPanel(tab.key as any)}
                  size="small"
                />
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="panel-content">
          {renderRightPanel()}
        </div>
      </Sider>

      {/* Editor Settings Modal */}
      <Modal
        title="Editor Settings"
        open={showSettingsModal}
        onCancel={() => setShowSettingsModal(false)}
        footer={null}
        width={600}
      >
        <div className="editor-settings">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div className="setting-item">
                <Text strong>Font Size</Text>
                <Slider
                  min={12}
                  max={24}
                  value={editorSettings.fontSize}
                  onChange={(value) => setEditorSettings(prev => ({ ...prev, fontSize: value }))}
                  marks={{ 12: '12px', 16: '16px', 20: '20px', 24: '24px' }}
                />
              </div>
            </Col>
            <Col span={12}>
              <div className="setting-item">
                <Text strong>Line Height</Text>
                <Slider
                  min={1.2}
                  max={2.0}
                  step={0.1}
                  value={editorSettings.lineHeight}
                  onChange={(value) => setEditorSettings(prev => ({ ...prev, lineHeight: value }))}
                  marks={{ 1.2: '1.2', 1.6: '1.6', 2.0: '2.0' }}
                />
              </div>
            </Col>
            <Col span={12}>
              <div className="setting-item">
                <Text strong>Font Family</Text>
                <Select
                  value={editorSettings.fontFamily}
                  onChange={(value) => setEditorSettings(prev => ({ ...prev, fontFamily: value }))}
                  style={{ width: '100%' }}
                >
                  <Option value="Georgia">Georgia</Option>
                  <Option value="Times New Roman">Times New Roman</Option>
                  <Option value="Arial">Arial</Option>
                  <Option value="Helvetica">Helvetica</Option>
                  <Option value="Courier New">Courier New</Option>
                  <Option value="Consolas">Consolas</Option>
                </Select>
              </div>
            </Col>
            <Col span={12}>
              <div className="setting-item">
                <Text strong>Theme</Text>
                <Select
                  value={editorSettings.theme}
                  onChange={(value) => setEditorSettings(prev => ({ ...prev, theme: value }))}
                  style={{ width: '100%' }}
                >
                  <Option value="light">Light</Option>
                  <Option value="dark">Dark</Option>
                  <Option value="sepia">Sepia</Option>
                </Select>
              </div>
            </Col>
            <Col span={24}>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <div className="setting-switch">
                  <Text>Show Word Count</Text>
                  <Switch
                    checked={editorSettings.showWordCount}
                    onChange={(checked) => setEditorSettings(prev => ({ ...prev, showWordCount: checked }))}
                  />
                </div>
                <div className="setting-switch">
                  <Text>Show Reading Time</Text>
                  <Switch
                    checked={editorSettings.showReadingTime}
                    onChange={(checked) => setEditorSettings(prev => ({ ...prev, showReadingTime: checked }))}
                  />
                </div>
                <div className="setting-switch">
                  <Text>Auto Save</Text>
                  <Switch
                    checked={editorSettings.autoSave}
                    onChange={(checked) => setEditorSettings(prev => ({ ...prev, autoSave: checked }))}
                  />
                </div>
                <div className="setting-switch">
                  <Text>Typewriter Mode</Text>
                  <Switch
                    checked={editorSettings.typewriterMode}
                    onChange={(checked) => setEditorSettings(prev => ({ ...prev, typewriterMode: checked }))}
                  />
                </div>
                <div className="setting-switch">
                  <Text>Focus Mode</Text>
                  <Switch
                    checked={editorSettings.focusMode}
                    onChange={(checked) => setEditorSettings(prev => ({ ...prev, focusMode: checked }))}
                  />
                </div>
              </Space>
            </Col>
          </Row>
        </div>
      </Modal>
    </Layout>
  );
};