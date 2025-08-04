import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Row,
  Col,
  Modal,
  Form,
  Upload,
  Progress,
  Tag,
  Tooltip,
  Empty,
  Dropdown,
  Space,
  Statistic,
  Avatar,
  List,
  Typography,
  Divider,
  Badge,
  message
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  ImportOutlined,
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  ClockCircleOutlined,
  BookOutlined,
  UserOutlined,
  BarChartOutlined,
  StarOutlined,
  StarFilled,
  EyeOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Story, StoryTemplate, ProjectStats } from '../../shared/types/Story';
import { StoryTemplateSelector } from './StoryTemplateSelector';
import { ImportWizard } from './ImportWizard';
import './StoryProjectManager.css';

const { Search } = Input;
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

interface StoryProjectManagerProps {
  onStorySelect: (story: Story) => void;
  onStoryCreate: (story: Story) => void;
  recentFiles: Story[];
}

interface ProjectFilter {
  genre?: string;
  status?: string;
  favorite?: boolean;
  dateRange?: [string, string];
  wordCountRange?: [number, number];
}

export const StoryProjectManager: React.FC<StoryProjectManagerProps> = ({
  onStorySelect,
  onStoryCreate,
  recentFiles
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [filteredStories, setFilteredStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'modified' | 'created' | 'wordCount'>('modified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<ProjectFilter>({});
  const [selectedStories, setSelectedStories] = useState<string[]>([]);
  
  // Modal states
  const [newStoryModalVisible, setNewStoryModalVisible] = useState(false);
  const [templateSelectorVisible, setTemplateSelectorVisible] = useState(false);
  const [importWizardVisible, setImportWizardVisible] = useState(false);
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null);

  const [newStoryForm] = Form.useForm();

  useEffect(() => {
    loadStories();
    loadProjectStats();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [stories, searchTerm, sortBy, sortOrder, filter]);

  const loadStories = async () => {
    setLoading(true);
    try {
      const loadedStories = await window.electronAPI.story.getAllStories();
      setStories(loadedStories);
    } catch (error) {
      message.error('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectStats = async () => {
    try {
      const stats = await window.electronAPI.story.getProjectStats();
      setProjectStats(stats);
    } catch (error) {
      console.error('Failed to load project stats:', error);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...stories];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(story =>
        story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.genre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.summary?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filters
    if (filter.genre) {
      filtered = filtered.filter(story => story.genre === filter.genre);
    }
    if (filter.status) {
      filtered = filtered.filter(story => story.status === filter.status);
    }
    if (filter.favorite) {
      filtered = filtered.filter(story => story.favorite);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'modified':
          aValue = new Date(a.lastModified || 0);
          bValue = new Date(b.lastModified || 0);
          break;
        case 'created':
          aValue = new Date(a.createdAt || 0);
          bValue = new Date(b.createdAt || 0);
          break;
        case 'wordCount':
          aValue = a.wordCount || 0;
          bValue = b.wordCount || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredStories(filtered);
  };

  const handleCreateStory = async (values: any) => {
    try {
      const newStory: Story = {
        id: `story_${Date.now()}`,
        title: values.title,
        author: values.author,
        genre: values.genre,
        summary: values.summary,
        status: 'draft',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        wordCount: 0,
        scenes: [],
        characters: [],
        favorite: false
      };

      await window.electronAPI.story.createStory(newStory);
      setStories(prev => [newStory, ...prev]);
      setNewStoryModalVisible(false);
      newStoryForm.resetFields();
      onStoryCreate(newStory);
      message.success('Story created successfully!');
    } catch (error) {
      message.error('Failed to create story');
    }
  };

  const handleCreateFromTemplate = (template: StoryTemplate) => {
    const newStory: Story = {
      id: `story_${Date.now()}`,
      title: template.title,
      author: template.author || '',
      genre: template.genre,
      summary: template.description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      wordCount: 0,
      scenes: template.scenes || [],
      characters: template.characters || [],
      favorite: false,
      template: template.id
    };

    setStories(prev => [newStory, ...prev]);
    setTemplateSelectorVisible(false);
    onStoryCreate(newStory);
    message.success(`Story created from ${template.name} template!`);
  };

  const handleImportComplete = (importedStories: Story[]) => {
    setStories(prev => [...importedStories, ...prev]);
    setImportWizardVisible(false);
    message.success(`Successfully imported ${importedStories.length} story(ies)!`);
  };

  const handleStoryAction = async (action: string, story: Story) => {
    switch (action) {
      case 'open':
        onStorySelect(story);
        break;
      case 'duplicate':
        try {
          const duplicatedStory = {
            ...story,
            id: `story_${Date.now()}`,
            title: `${story.title} (Copy)`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
          };
          await window.electronAPI.story.createStory(duplicatedStory);
          setStories(prev => [duplicatedStory, ...prev]);
          message.success('Story duplicated successfully!');
        } catch (error) {
          message.error('Failed to duplicate story');
        }
        break;
      case 'favorite':
        try {
          const updatedStory = { ...story, favorite: !story.favorite };
          await window.electronAPI.story.updateStory(updatedStory);
          setStories(prev => prev.map(s => s.id === story.id ? updatedStory : s));
          message.success(updatedStory.favorite ? 'Added to favorites' : 'Removed from favorites');
        } catch (error) {
          message.error('Failed to update favorite status');
        }
        break;
      case 'delete':
        Modal.confirm({
          title: 'Delete Story',
          content: `Are you sure you want to delete "${story.title}"? This action cannot be undone.`,
          okText: 'Delete',
          okType: 'danger',
          onOk: async () => {
            try {
              await window.electronAPI.story.deleteStory(story.id);
              setStories(prev => prev.filter(s => s.id !== story.id));
              message.success('Story deleted successfully');
            } catch (error) {
              message.error('Failed to delete story');
            }
          }
        });
        break;
    }
  };

  const getStoryMenuItems = (story: Story) => [
    {
      key: 'open',
      label: 'Open',
      icon: <FolderOpenOutlined />,
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: <CopyOutlined />,
    },
    {
      key: 'favorite',
      label: story.favorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: story.favorite ? <StarFilled /> : <StarOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'export',
      label: 'Export',
      icon: <ExportOutlined />,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const renderStoryCard = (story: Story) => {
    const progress = story.targetWordCount ? (story.wordCount || 0) / story.targetWordCount * 100 : 0;
    
    return (
      <Card
        key={story.id}
        className="story-card"
        hoverable
        actions={[
          <Tooltip title="Open Story">
            <Button
              type="text"
              icon={<FolderOpenOutlined />}
              onClick={() => handleStoryAction('open', story)}
            />
          </Tooltip>,
          <Tooltip title={story.favorite ? 'Remove from Favorites' : 'Add to Favorites'}>
            <Button
              type="text"
              icon={story.favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => handleStoryAction('favorite', story)}
            />
          </Tooltip>,
          <Dropdown
            menu={{
              items: getStoryMenuItems(story),
              onClick: ({ key }) => handleStoryAction(key, story)
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        ]}
      >
        <div className="story-card-header">
          <div className="story-title">
            <Title level={4} ellipsis={{ tooltip: story.title }}>
              {story.title}
            </Title>
            {story.favorite && <StarFilled className="favorite-icon" />}
          </div>
          <div className="story-meta">
            <Space size="small">
              {story.genre && <Tag color="blue">{story.genre}</Tag>}
              {story.status && (
                <Tag color={
                  story.status === 'completed' ? 'green' :
                  story.status === 'in-progress' ? 'orange' : 'default'
                }>
                  {story.status}
                </Tag>
              )}
            </Space>
          </div>
        </div>

        <div className="story-card-content">
          {story.summary && (
            <Paragraph
              ellipsis={{ rows: 3, tooltip: story.summary }}
              className="story-summary"
            >
              {story.summary}
            </Paragraph>
          )}

          <div className="story-stats">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Words"
                  value={story.wordCount || 0}
                  formatter={(value) => value?.toLocaleString()}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Scenes"
                  value={story.scenes?.length || 0}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Characters"
                  value={story.characters?.length || 0}
                />
              </Col>
            </Row>
          </div>

          {story.targetWordCount && (
            <div className="story-progress">
              <Text type="secondary">Progress</Text>
              <Progress
                percent={Math.min(100, progress)}
                size="small"
                status={progress >= 100 ? 'success' : 'active'}
              />
            </div>
          )}

          <div className="story-footer">
            <Space>
              {story.author && (
                <Text type="secondary">
                  <UserOutlined /> {story.author}
                </Text>
              )}
              <Text type="secondary">
                <ClockCircleOutlined /> {new Date(story.lastModified || story.createdAt || '').toLocaleDateString()}
              </Text>
            </Space>
          </div>
        </div>
      </Card>
    );
  };

  const renderStoryList = (story: Story) => {
    const progress = story.targetWordCount ? (story.wordCount || 0) / story.targetWordCount * 100 : 0;
    
    return (
      <List.Item
        key={story.id}
        className="story-list-item"
        actions={[
          <Button
            type="text"
            icon={story.favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={() => handleStoryAction('favorite', story)}
          />,
          <Dropdown
            menu={{
              items: getStoryMenuItems(story),
              onClick: ({ key }) => handleStoryAction(key, story)
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        ]}
        onClick={() => handleStoryAction('open', story)}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              size={48}
              icon={<BookOutlined />}
              style={{ backgroundColor: story.favorite ? '#faad14' : '#1890ff' }}
            />
          }
          title={
            <div className="story-list-title">
              <span>{story.title}</span>
              <Space size="small" style={{ marginLeft: 8 }}>
                {story.genre && <Tag color="blue">{story.genre}</Tag>}
                {story.status && (
                  <Tag color={
                    story.status === 'completed' ? 'green' :
                    story.status === 'in-progress' ? 'orange' : 'default'
                  }>
                    {story.status}
                  </Tag>
                )}
              </Space>
            </div>
          }
          description={
            <div>
              <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                {story.summary}
              </Paragraph>
              <Space size="large">
                <Text type="secondary">
                  <FileTextOutlined /> {story.wordCount?.toLocaleString() || 0} words
                </Text>
                <Text type="secondary">
                  <TeamOutlined /> {story.scenes?.length || 0} scenes
                </Text>
                <Text type="secondary">
                  <UserOutlined /> {story.characters?.length || 0} characters
                </Text>
                <Text type="secondary">
                  <ClockCircleOutlined /> {new Date(story.lastModified || story.createdAt || '').toLocaleDateString()}
                </Text>
              </Space>
              {story.targetWordCount && (
                <Progress
                  percent={Math.min(100, progress)}
                  size="small"
                  status={progress >= 100 ? 'success' : 'active'}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <div className="story-project-manager">
      {/* Header Section */}
      <div className="project-header">
        <div className="header-title">
          <Title level={2}>Your Stories</Title>
          <Text type="secondary">Manage and organize your creative projects</Text>
        </div>

        <div className="header-actions">
          <Space size="middle">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setNewStoryModalVisible(true)}
              size="large"
            >
              New Story
            </Button>
            
            <Button
              icon={<FileTextOutlined />}
              onClick={() => setTemplateSelectorVisible(true)}
              size="large"
            >
              From Template
            </Button>
            
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportWizardVisible(true)}
              size="large"
            >
              Import
            </Button>
          </Space>
        </div>
      </div>

      {/* Stats Section */}
      {projectStats && (
        <Row gutter={16} className="project-stats">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Stories"
                value={projectStats.totalStories}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Words"
                value={projectStats.totalWords}
                formatter={(value) => value?.toLocaleString()}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Completed"
                value={projectStats.completedStories}
                suffix={`/ ${projectStats.totalStories}`}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="This Month"
                value={projectStats.wordsThisMonth}
                formatter={(value) => value?.toLocaleString()}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Recent Files Section */}
      {recentFiles.length > 0 && (
        <div className="recent-files-section">
          <Title level={4}>Recent Files</Title>
          <div className="recent-files-list">
            {recentFiles.slice(0, 5).map(story => (
              <Card
                key={story.id}
                size="small"
                className="recent-file-card"
                hoverable
                onClick={() => onStorySelect(story)}
              >
                <Space>
                  <Avatar size="small" icon={<BookOutlined />} />
                  <div>
                    <Text strong>{story.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {story.wordCount?.toLocaleString() || 0} words
                    </Text>
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="project-filters">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="Search stories by title, author, genre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="large"
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Genre"
              value={filter.genre}
              onChange={(value) => setFilter(prev => ({ ...prev, genre: value }))}
              allowClear
              style={{ width: 120 }}
            >
              <Option value="fantasy">Fantasy</Option>
              <Option value="sci-fi">Sci-Fi</Option>
              <Option value="romance">Romance</Option>
              <Option value="mystery">Mystery</Option>
              <Option value="thriller">Thriller</Option>
              <Option value="literary">Literary</Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="Status"
              value={filter.status}
              onChange={(value) => setFilter(prev => ({ ...prev, status: value }))}
              allowClear
              style={{ width: 120 }}
            >
              <Option value="draft">Draft</Option>
              <Option value="in-progress">In Progress</Option>
              <Option value="completed">Completed</Option>
              <Option value="published">Published</Option>
            </Select>
          </Col>
          <Col>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 140 }}
            >
              <Option value="modified">Last Modified</Option>
              <Option value="created">Date Created</Option>
              <Option value="title">Title</Option>
              <Option value="wordCount">Word Count</Option>
            </Select>
          </Col>
          <Col>
            <Button
              icon={<SortAscendingOutlined />}
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              type={sortOrder === 'desc' ? 'primary' : 'default'}
            />
          </Col>
          <Col>
            <Button.Group>
              <Button
                icon={<EyeOutlined />}
                type={viewMode === 'grid' ? 'primary' : 'default'}
                onClick={() => setViewMode('grid')}
              />
              <Button
                icon={<FileTextOutlined />}
                type={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => setViewMode('list')}
              />
            </Button.Group>
          </Col>
        </Row>
      </div>

      {/* Stories Display */}
      <div className="stories-container">
        {loading ? (
          <div className="loading-container">
            <Progress type="circle" />
          </div>
        ) : filteredStories.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              stories.length === 0 ? (
                <span>
                  No stories yet. <Button type="link" onClick={() => setNewStoryModalVisible(true)}>Create your first story</Button>
                </span>
              ) : (
                'No stories match your search criteria'
              )
            }
          />
        ) : viewMode === 'grid' ? (
          <Row gutter={[16, 16]}>
            {filteredStories.map(story => (
              <Col key={story.id} xs={24} sm={12} md={8} lg={6}>
                {renderStoryCard(story)}
              </Col>
            ))}
          </Row>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={filteredStories}
            renderItem={renderStoryList}
            className="stories-list"
          />
        )}
      </div>

      {/* New Story Modal */}
      <Modal
        title="Create New Story"
        open={newStoryModalVisible}
        onCancel={() => {
          setNewStoryModalVisible(false);
          newStoryForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={newStoryForm}
          layout="vertical"
          onFinish={handleCreateStory}
        >
          <Form.Item
            name="title"
            label="Story Title"
            rules={[{ required: true, message: 'Please enter a story title' }]}
          >
            <Input placeholder="Enter your story title" size="large" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="author"
                label="Author"
                rules={[{ required: true, message: 'Please enter author name' }]}
              >
                <Input placeholder="Author name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="genre" label="Genre">
                <Select placeholder="Select genre">
                  <Option value="fantasy">Fantasy</Option>
                  <Option value="sci-fi">Science Fiction</Option>
                  <Option value="romance">Romance</Option>
                  <Option value="mystery">Mystery</Option>
                  <Option value="thriller">Thriller</Option>
                  <Option value="literary">Literary Fiction</Option>
                  <Option value="historical">Historical Fiction</Option>
                  <Option value="contemporary">Contemporary Fiction</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="summary" label="Summary">
            <Input.TextArea
              rows={4}
              placeholder="Brief description of your story..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="large">
                Create Story
              </Button>
              <Button
                onClick={() => {
                  setNewStoryModalVisible(false);
                  newStoryForm.resetFields();
                }}
                size="large"
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Selector Modal */}
      <StoryTemplateSelector
        visible={templateSelectorVisible}
        onClose={() => setTemplateSelectorVisible(false)}
        onSelect={handleCreateFromTemplate}
      />

      {/* Import Wizard Modal */}
      <ImportWizard
        visible={importWizardVisible}
        onClose={() => setImportWizardVisible(false)}
        onComplete={handleImportComplete}
      />
    </div>
  );
};