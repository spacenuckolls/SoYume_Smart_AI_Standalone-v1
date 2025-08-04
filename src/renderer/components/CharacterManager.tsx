import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Form,
  Modal,
  Row,
  Col,
  Avatar,
  Tag,
  Space,
  Typography,
  Tabs,
  Progress,
  Tooltip,
  Dropdown,
  List,
  Empty,
  Badge,
  Divider,
  Select,
  Upload,
  message,
  Popover,
  Timeline,
  Statistic
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  HeartOutlined,
  TeamOutlined,
  BranchesOutlined,
  BarChartOutlined,
  EyeOutlined,
  BookOutlined,
  StarOutlined,
  CameraOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { Story, Character, CharacterRelationship, CharacterArc } from '../../shared/types/Story';
import './CharacterManager.css';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface CharacterManagerProps {
  story: Story;
  onStoryUpdate: (story: Story) => void;
}

export const CharacterManager: React.FC<CharacterManagerProps> = ({
  story,
  onStoryUpdate
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [relationshipModalVisible, setRelationshipModalVisible] = useState(false);
  const [arcAnalysisVisible, setArcAnalysisVisible] = useState(false);
  
  const [form] = Form.useForm();
  const [relationshipForm] = Form.useForm();

  const characters = story.characters || [];

  useEffect(() => {
    if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    }
  }, [characters]);

  const handleCreateCharacter = async (values: any) => {
    const newCharacter: Character = {
      id: `char_${Date.now()}`,
      name: values.name,
      description: values.description,
      role: values.role,
      age: values.age,
      appearance: values.appearance,
      personality: values.personality,
      background: values.background,
      goals: values.goals?.split('\n').filter((g: string) => g.trim()) || [],
      relationships: [],
      arc: {
        startState: values.startState || '',
        endState: values.endState || '',
        keyMoments: [],
        growth: 0
      },
      traits: values.traits?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    const updatedStory = {
      ...story,
      characters: [...characters, newCharacter]
    };

    onStoryUpdate(updatedStory);
    setSelectedCharacter(newCharacter);
    setIsModalVisible(false);
    form.resetFields();
    message.success('Character created successfully!');
  };  co
nst handleUpdateCharacter = async (values: any) => {
    if (!editingCharacter) return;

    const updatedCharacter: Character = {
      ...editingCharacter,
      ...values,
      goals: values.goals?.split('\n').filter((g: string) => g.trim()) || [],
      traits: values.traits?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      lastModified: new Date().toISOString()
    };

    const updatedStory = {
      ...story,
      characters: characters.map(c => c.id === editingCharacter.id ? updatedCharacter : c)
    };

    onStoryUpdate(updatedStory);
    setSelectedCharacter(updatedCharacter);
    setIsModalVisible(false);
    setEditingCharacter(null);
    form.resetFields();
    message.success('Character updated successfully!');
  };

  const handleDeleteCharacter = (character: Character) => {
    Modal.confirm({
      title: 'Delete Character',
      content: `Are you sure you want to delete "${character.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const updatedStory = {
          ...story,
          characters: characters.filter(c => c.id !== character.id)
        };
        
        onStoryUpdate(updatedStory);
        
        if (selectedCharacter?.id === character.id) {
          setSelectedCharacter(characters.find(c => c.id !== character.id) || null);
        }
        
        message.success('Character deleted successfully');
      }
    });
  };

  const handleAddRelationship = async (values: any) => {
    if (!selectedCharacter) return;

    const newRelationship: CharacterRelationship = {
      characterId: values.characterId,
      type: values.type,
      description: values.description,
      strength: values.strength || 5,
      status: values.status || 'active'
    };

    const updatedCharacter = {
      ...selectedCharacter,
      relationships: [...(selectedCharacter.relationships || []), newRelationship]
    };

    const updatedStory = {
      ...story,
      characters: characters.map(c => c.id === selectedCharacter.id ? updatedCharacter : c)
    };

    onStoryUpdate(updatedStory);
    setSelectedCharacter(updatedCharacter);
    setRelationshipModalVisible(false);
    relationshipForm.resetFields();
    message.success('Relationship added successfully!');
  };

  const analyzeCharacterArc = async (character: Character) => {
    try {
      const analysis = await window.electronAPI.character.analyzeArc(character, story);
      
      const updatedCharacter = {
        ...character,
        arc: {
          ...character.arc,
          ...analysis,
          lastAnalyzed: new Date().toISOString()
        }
      };

      const updatedStory = {
        ...story,
        characters: characters.map(c => c.id === character.id ? updatedCharacter : c)
      };

      onStoryUpdate(updatedStory);
      setSelectedCharacter(updatedCharacter);
      message.success('Character arc analyzed successfully!');
    } catch (error) {
      message.error('Failed to analyze character arc');
    }
  };

  const getCharacterMenuItems = (character: Character) => [
    {
      key: 'edit',
      label: 'Edit Character',
      icon: <EditOutlined />,
      onClick: () => {
        setEditingCharacter(character);
        form.setFieldsValue({
          ...character,
          goals: character.goals?.join('\n') || '',
          traits: character.traits?.join(', ') || ''
        });
        setIsModalVisible(true);
      }
    },
    {
      key: 'analyze',
      label: 'Analyze Arc',
      icon: <BarChartOutlined />,
      onClick: () => analyzeCharacterArc(character)
    },
    {
      key: 'relationships',
      label: 'Add Relationship',
      icon: <TeamOutlined />,
      onClick: () => {
        setSelectedCharacter(character);
        setRelationshipModalVisible(true);
      }
    },
    {
      type: 'divider' as const
    },
    {
      key: 'delete',
      label: 'Delete Character',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDeleteCharacter(character)
    }
  ];

  const renderCharacterCard = (character: Character) => {
    const isSelected = selectedCharacter?.id === character.id;
    const relationshipCount = character.relationships?.length || 0;
    const arcProgress = character.arc?.growth || 0;

    return (
      <Card
        key={character.id}
        className={`character-card ${isSelected ? 'selected' : ''}`}
        hoverable
        onClick={() => setSelectedCharacter(character)}
        actions={[
          <Tooltip title="Character Relationships">
            <Badge count={relationshipCount} size="small">
              <TeamOutlined />
            </Badge>
          </Tooltip>,
          <Tooltip title="Character Arc Progress">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrophyOutlined />
              <Text style={{ fontSize: '12px' }}>{arcProgress}%</Text>
            </div>
          </Tooltip>,
          <Dropdown
            menu={{
              items: getCharacterMenuItems(character),
              onClick: ({ key }) => {
                const item = getCharacterMenuItems(character).find(i => i.key === key);
                if (item && 'onClick' in item) {
                  item.onClick();
                }
              }
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        ]}
      >
        <div className="character-card-header">
          <Avatar
            size={48}
            src={character.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: character.color || '#1890ff' }}
          />
          <div className="character-info">
            <Title level={4} style={{ margin: 0 }}>
              {character.name}
            </Title>
            <Text type="secondary">{character.role}</Text>
            {character.age && (
              <Text type="secondary"> • {character.age} years old</Text>
            )}
          </div>
        </div>

        <div className="character-traits">
          {character.traits?.slice(0, 3).map(trait => (
            <Tag key={trait} size="small">{trait}</Tag>
          ))}
          {(character.traits?.length || 0) > 3 && (
            <Tag size="small">+{(character.traits?.length || 0) - 3} more</Tag>
          )}
        </div>

        {character.description && (
          <Paragraph
            ellipsis={{ rows: 2, tooltip: character.description }}
            style={{ marginTop: 8, marginBottom: 0 }}
          >
            {character.description}
          </Paragraph>
        )}
      </Card>
    );
  };  const rend
erCharacterDetails = () => {
    if (!selectedCharacter) {
      return (
        <div className="no-character-selected">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select a character to view details"
          />
        </div>
      );
    }

    return (
      <div className="character-details">
        <div className="character-header">
          <div className="character-avatar-section">
            <Avatar
              size={80}
              src={selectedCharacter.avatar}
              icon={<UserOutlined />}
              style={{ backgroundColor: selectedCharacter.color || '#1890ff' }}
            />
            <div className="character-basic-info">
              <Title level={2}>{selectedCharacter.name}</Title>
              <Space>
                <Tag color="blue">{selectedCharacter.role}</Tag>
                {selectedCharacter.age && <Tag>{selectedCharacter.age} years old</Tag>}
              </Space>
            </div>
          </div>
          
          <div className="character-actions">
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingCharacter(selectedCharacter);
                form.setFieldsValue({
                  ...selectedCharacter,
                  goals: selectedCharacter.goals?.join('\n') || '',
                  traits: selectedCharacter.traits?.join(', ') || ''
                });
                setIsModalVisible(true);
              }}
            >
              Edit
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => analyzeCharacterArc(selectedCharacter)}
            >
              Analyze Arc
            </Button>
          </div>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Overview" key="overview">
            <div className="character-overview">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="Description" size="small">
                    <Paragraph>{selectedCharacter.description || 'No description provided.'}</Paragraph>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Appearance" size="small">
                    <Paragraph>{selectedCharacter.appearance || 'No appearance description provided.'}</Paragraph>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Personality" size="small">
                    <Paragraph>{selectedCharacter.personality || 'No personality description provided.'}</Paragraph>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Background" size="small">
                    <Paragraph>{selectedCharacter.background || 'No background provided.'}</Paragraph>
                  </Card>
                </Col>
              </Row>

              <Card title="Character Traits" style={{ marginTop: 16 }}>
                <div className="traits-container">
                  {selectedCharacter.traits?.map(trait => (
                    <Tag key={trait} color="blue">{trait}</Tag>
                  )) || <Text type="secondary">No traits defined</Text>}
                </div>
              </Card>

              <Card title="Goals & Motivations" style={{ marginTop: 16 }}>
                {selectedCharacter.goals?.length ? (
                  <List
                    size="small"
                    dataSource={selectedCharacter.goals}
                    renderItem={(goal) => (
                      <List.Item>
                        <ThunderboltOutlined style={{ marginRight: 8 }} />
                        {goal}
                      </List.Item>
                    )}
                  />
                ) : (
                  <Text type="secondary">No goals defined</Text>
                )}
              </Card>
            </div>
          </TabPane>

          <TabPane tab="Relationships" key="relationships">
            <div className="character-relationships">
              <div className="relationships-header">
                <Title level={4}>Character Relationships</Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setRelationshipModalVisible(true)}
                >
                  Add Relationship
                </Button>
              </div>

              {selectedCharacter.relationships?.length ? (
                <List
                  dataSource={selectedCharacter.relationships}
                  renderItem={(relationship) => {
                    const relatedCharacter = characters.find(c => c.id === relationship.characterId);
                    return (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <Avatar
                              src={relatedCharacter?.avatar}
                              icon={<UserOutlined />}
                              style={{ backgroundColor: relatedCharacter?.color || '#1890ff' }}
                            />
                          }
                          title={
                            <Space>
                              <Text strong>{relatedCharacter?.name || 'Unknown Character'}</Text>
                              <Tag color="green">{relationship.type}</Tag>
                              <Progress
                                percent={relationship.strength * 10}
                                size="small"
                                style={{ width: 60 }}
                                showInfo={false}
                              />
                            </Space>
                          }
                          description={relationship.description}
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="No relationships defined" />
              )}
            </div>
          </TabPane>

          <TabPane tab="Character Arc" key="arc">
            <div className="character-arc">
              <Card title="Arc Overview">
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Arc Progress"
                      value={selectedCharacter.arc?.growth || 0}
                      suffix="%"
                      prefix={<TrophyOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Key Moments"
                      value={selectedCharacter.arc?.keyMoments?.length || 0}
                      prefix={<StarOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Scenes Appeared"
                      value={story.scenes?.filter(scene => 
                        scene.characters?.includes(selectedCharacter.id)
                      ).length || 0}
                      prefix={<BookOutlined />}
                    />
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Card title="Starting State" size="small">
                    <Paragraph>
                      {selectedCharacter.arc?.startState || 'No starting state defined'}
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Ending State" size="small">
                    <Paragraph>
                      {selectedCharacter.arc?.endState || 'No ending state defined'}
                    </Paragraph>
                  </Card>
                </Col>
              </Row>

              {selectedCharacter.arc?.keyMoments?.length && (
                <Card title="Key Moments" style={{ marginTop: 16 }}>
                  <Timeline>
                    {selectedCharacter.arc.keyMoments.map((moment, index) => (
                      <Timeline.Item key={index} color="blue">
                        <Text strong>{moment.title}</Text>
                        <br />
                        <Text type="secondary">{moment.description}</Text>
                        <br />
                        <Text type="secondary">
                          <ClockCircleOutlined /> Scene {moment.sceneIndex + 1}
                        </Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              )}
            </div>
          </TabPane>
        </Tabs>
      </div>
    );
  }; 
 return (
    <div className="character-manager">
      <div className="character-manager-header">
        <div className="header-title">
          <Title level={2}>Character Manager</Title>
          <Text type="secondary">Develop and track your story's characters</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingCharacter(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
          size="large"
        >
          Create Character
        </Button>
      </div>

      <div className="character-manager-content">
        <div className="characters-sidebar">
          <div className="characters-list">
            {characters.length > 0 ? (
              characters.map(character => renderCharacterCard(character))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No characters created yet"
                style={{ padding: '40px 20px' }}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsModalVisible(true)}
                >
                  Create First Character
                </Button>
              </Empty>
            )}
          </div>
        </div>

        <div className="character-details-panel">
          {renderCharacterDetails()}
        </div>
      </div>

      {/* Character Creation/Edit Modal */}
      <Modal
        title={editingCharacter ? 'Edit Character' : 'Create New Character'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingCharacter(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingCharacter ? handleUpdateCharacter : handleCreateCharacter}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Character Name"
                rules={[{ required: true, message: 'Please enter character name' }]}
              >
                <Input placeholder="Enter character name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Role">
                <Select placeholder="Select character role">
                  <Option value="protagonist">Protagonist</Option>
                  <Option value="antagonist">Antagonist</Option>
                  <Option value="supporting">Supporting Character</Option>
                  <Option value="minor">Minor Character</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="age" label="Age">
                <Input placeholder="Character age" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="traits" label="Character Traits">
                <Input placeholder="Enter traits separated by commas" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Brief character description..." />
          </Form.Item>

          <Form.Item name="appearance" label="Physical Appearance">
            <TextArea rows={3} placeholder="Describe the character's appearance..." />
          </Form.Item>

          <Form.Item name="personality" label="Personality">
            <TextArea rows={3} placeholder="Describe the character's personality..." />
          </Form.Item>

          <Form.Item name="background" label="Background">
            <TextArea rows={3} placeholder="Character's background and history..." />
          </Form.Item>

          <Form.Item name="goals" label="Goals & Motivations">
            <TextArea
              rows={4}
              placeholder="Enter each goal on a new line..."
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startState" label="Starting State">
                <TextArea rows={2} placeholder="Character's state at story beginning..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endState" label="Ending State">
                <TextArea rows={2} placeholder="Character's state at story end..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="large">
                {editingCharacter ? 'Update Character' : 'Create Character'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingCharacter(null);
                  form.resetFields();
                }}
                size="large"
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Relationship Modal */}
      <Modal
        title="Add Character Relationship"
        open={relationshipModalVisible}
        onCancel={() => {
          setRelationshipModalVisible(false);
          relationshipForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={relationshipForm}
          layout="vertical"
          onFinish={handleAddRelationship}
        >
          <Form.Item
            name="characterId"
            label="Related Character"
            rules={[{ required: true, message: 'Please select a character' }]}
          >
            <Select placeholder="Select character">
              {characters
                .filter(c => c.id !== selectedCharacter?.id)
                .map(character => (
                  <Option key={character.id} value={character.id}>
                    {character.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label="Relationship Type"
            rules={[{ required: true, message: 'Please select relationship type' }]}
          >
            <Select placeholder="Select relationship type">
              <Option value="family">Family</Option>
              <Option value="friend">Friend</Option>
              <Option value="enemy">Enemy</Option>
              <Option value="romantic">Romantic</Option>
              <Option value="mentor">Mentor</Option>
              <Option value="colleague">Colleague</Option>
              <Option value="rival">Rival</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Describe the relationship..." />
          </Form.Item>

          <Form.Item name="strength" label="Relationship Strength">
            <Slider
              min={1}
              max={10}
              marks={{ 1: 'Weak', 5: 'Moderate', 10: 'Strong' }}
              defaultValue={5}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Add Relationship
              </Button>
              <Button
                onClick={() => {
                  setRelationshipModalVisible(false);
                  relationshipForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};