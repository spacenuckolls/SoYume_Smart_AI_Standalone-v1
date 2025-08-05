# AI Creative Assistant API Documentation

The AI Creative Assistant provides both REST and gRPC APIs for integration with external applications, including SoYume Studio and third-party tools.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [REST API](#rest-api)
- [gRPC API](#grpc-api)
- [WebSocket API](#websocket-api)
- [Plugin API](#plugin-api)
- [SDK Usage](#sdk-usage)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Getting Started

### Prerequisites

- AI Creative Assistant v1.0.0 or later
- API access enabled in configuration
- Valid API key

### Base URLs

- **REST API**: `http://localhost:3001/api`
- **gRPC API**: `localhost:50051`
- **WebSocket**: `ws://localhost:3001/ws`

### Quick Start

```bash
# Health check
curl http://localhost:3001/health

# Get API information
curl http://localhost:3001/api
```

## Authentication

All API requests require authentication using an API key.

### API Key Authentication

Include your API key in requests using one of these methods:

**Header (Recommended)**:
```bash
curl -H "X-API-Key: your-api-key-here" http://localhost:3001/api/stories
```

**Query Parameter**:
```bash
curl "http://localhost:3001/api/stories?apiKey=your-api-key-here"
```

### Creating API Keys

API keys can be created through the application settings or programmatically:

```javascript
const apiServer = new APIServer(/* ... */);
const apiKey = await apiServer.createAPIKey('My Integration', ['ai:*', 'data:*']);
console.log('API Key:', apiKey.key);
```

## REST API

### Stories

#### List Stories

```http
GET /api/stories
```

**Response**:
```json
[
  {
    "id": "story-123",
    "title": "My Novel",
    "description": "A thrilling adventure",
    "genre": "fantasy",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z",
    "scenes": [...],
    "characters": [...]
  }
]
```

#### Get Story

```http
GET /api/stories/{id}
```

**Response**:
```json
{
  "id": "story-123",
  "title": "My Novel",
  "description": "A thrilling adventure",
  "genre": "fantasy",
  "scenes": [
    {
      "id": "scene-456",
      "title": "Opening Scene",
      "content": "It was a dark and stormy night...",
      "order": 1
    }
  ],
  "characters": [
    {
      "id": "char-789",
      "name": "John Doe",
      "description": "The protagonist",
      "role": "hero"
    }
  ]
}
```

#### Create Story

```http
POST /api/stories
Content-Type: application/json

{
  "title": "New Story",
  "description": "A new adventure begins",
  "genre": "sci-fi"
}
```

#### Update Story

```http
PUT /api/stories/{id}
Content-Type: application/json

{
  "id": "story-123",
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### Delete Story

```http
DELETE /api/stories/{id}
```

#### Search Stories

```http
GET /api/stories/search/{query}
```

### AI Services

#### Generate Text

```http
POST /api/ai/generate
Content-Type: application/json

{
  "prompt": "Write a dramatic opening scene",
  "options": {
    "maxTokens": 500,
    "temperature": 0.7,
    "model": "gpt-4"
  }
}
```

**Response**:
```json
{
  "result": "The thunder crashed overhead as Sarah stepped into the abandoned mansion..."
}
```

#### Analyze Story

```http
POST /api/ai/analyze/story
Content-Type: application/json

{
  "id": "story-123",
  "title": "My Novel",
  "scenes": [...],
  "characters": [...]
}
```

**Response**:
```json
{
  "structure": {
    "type": "three-act",
    "adherence": 0.85,
    "plotPoints": [...]
  },
  "pacing": {
    "overallScore": 0.78,
    "issues": [...]
  },
  "suggestions": [...]
}
```

#### Analyze Scene

```http
POST /api/ai/analyze/scene
Content-Type: application/json

{
  "id": "scene-456",
  "title": "Opening Scene",
  "content": "It was a dark and stormy night..."
}
```

#### Analyze Character

```http
POST /api/ai/analyze/character
Content-Type: application/json

{
  "id": "char-789",
  "name": "John Doe",
  "description": "The protagonist",
  "backstory": "Born in a small town..."
}
```

#### Generate Suggestions

```http
POST /api/ai/suggestions
Content-Type: application/json

{
  "context": {
    "type": "scene",
    "currentText": "The hero approached the door...",
    "genre": "fantasy"
  }
}
```

#### Get AI Providers

```http
GET /api/ai/providers
```

### Plugins

#### List Plugins

```http
GET /api/plugins
```

**Response**:
```json
[
  {
    "id": "grammar-checker",
    "name": "Grammar Checker",
    "version": "1.0.0",
    "description": "Advanced grammar checking",
    "author": "Plugin Developer",
    "isActive": true,
    "isLoaded": true,
    "errorCount": 0
  }
]
```

#### Get Plugin

```http
GET /api/plugins/{id}
```

#### Activate Plugin

```http
POST /api/plugins/{id}/activate
```

#### Deactivate Plugin

```http
POST /api/plugins/{id}/deactivate
```

#### Install Plugin

```http
POST /api/plugins/install
Content-Type: application/json

{
  "package": "plugin-package-data-or-url"
}
```

#### Uninstall Plugin

```http
DELETE /api/plugins/{id}
```

### Configuration

#### Get Configuration

```http
GET /api/config
```

#### Update Configuration

```http
PUT /api/config
Content-Type: application/json

{
  "aiProvider": "openai",
  "theme": "dark"
}
```

#### Get Config Value

```http
GET /api/config/{key}
```

#### Set Config Value

```http
PUT /api/config/{key}
Content-Type: application/json

{
  "value": "new-value"
}
```

## gRPC API

The gRPC API provides high-performance, strongly-typed access to all functionality.

### Protocol Buffer Definition

```protobuf
service StoryService {
  rpc GetStory(GetStoryRequest) returns (GetStoryResponse);
  rpc CreateStory(CreateStoryRequest) returns (CreateStoryResponse);
  rpc UpdateStory(UpdateStoryRequest) returns (UpdateStoryResponse);
  rpc DeleteStory(DeleteStoryRequest) returns (DeleteStoryResponse);
  rpc ListStories(ListStoriesRequest) returns (ListStoriesResponse);
  rpc SearchStories(SearchStoriesRequest) returns (SearchStoriesResponse);
}

service AIService {
  rpc GenerateText(GenerateTextRequest) returns (GenerateTextResponse);
  rpc AnalyzeStory(AnalyzeStoryRequest) returns (AnalyzeStoryResponse);
  rpc StreamGeneration(StreamGenerationRequest) returns (stream StreamGenerationResponse);
}
```

### Client Examples

#### Node.js gRPC Client

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load proto definition
const packageDefinition = protoLoader.loadSync('ai_creative_assistant.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);

// Create client
const client = new proto.ai_creative_assistant.StoryService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Get story
client.GetStory({ id: 'story-123' }, (error, response) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Story:', response.story);
  }
});
```

#### Python gRPC Client

```python
import grpc
import ai_creative_assistant_pb2
import ai_creative_assistant_pb2_grpc

# Create channel and stub
channel = grpc.insecure_channel('localhost:50051')
stub = ai_creative_assistant_pb2_grpc.StoryServiceStub(channel)

# Get story
request = ai_creative_assistant_pb2.GetStoryRequest(id='story-123')
response = stub.GetStory(request)
print(f"Story: {response.story.title}")
```

## WebSocket API

Real-time communication for live updates and streaming operations.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'authenticate',
    apiKey: 'your-api-key'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Message Types

#### Authentication

```json
{
  "type": "authenticate",
  "apiKey": "your-api-key"
}
```

#### Subscribe to Channel

```json
{
  "type": "subscribe",
  "channel": "story-updates"
}
```

#### AI Text Generation

```json
{
  "type": "ai_generate",
  "requestId": "req-123",
  "prompt": "Write a story about...",
  "options": {
    "maxTokens": 500
  }
}
```

#### Response

```json
{
  "type": "ai_result",
  "requestId": "req-123",
  "result": "Generated text..."
}
```

## Plugin API

### Plugin Development

Plugins extend the functionality of the AI Creative Assistant.

#### Basic Plugin Structure

```javascript
const { BasePlugin, CommonPermissions } = require('@ai-creative-assistant/sdk');

class MyPlugin extends BasePlugin {
  async activate() {
    this.info('Plugin activated');
    
    // Register commands
    this.registerCommand('my-command', this.handleCommand.bind(this));
    
    // Listen for events
    this.onEvent('story-saved', this.onStorySaved.bind(this));
  }

  async deactivate() {
    this.info('Plugin deactivated');
  }

  async handleCommand(params) {
    // Command implementation
    return { success: true };
  }

  async onStorySaved(story) {
    this.info(`Story saved: ${story.title}`);
  }
}

module.exports = MyPlugin;
```

#### Plugin Manifest (package.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.js",
  "author": "Plugin Developer",
  "license": "MIT",
  "engines": {
    "ai-creative-assistant": "^1.0.0"
  },
  "permissions": [
    {
      "type": "ai",
      "scope": ["generate", "analyze"],
      "description": "Access AI services"
    },
    {
      "type": "database",
      "scope": ["read", "write"],
      "description": "Access story data"
    }
  ],
  "categories": ["writing", "analysis"]
}
```

### Plugin Types

#### Writing Assistant Plugin

```javascript
const { WritingAssistantPlugin } = require('@ai-creative-assistant/sdk');

class GrammarPlugin extends WritingAssistantPlugin {
  async provideSuggestions(context) {
    // Analyze text and provide suggestions
    return [
      {
        id: 'suggestion-1',
        type: 'correction',
        text: 'their',
        description: 'Correct spelling',
        confidence: 0.95,
        position: 10,
        length: 5
      }
    ];
  }

  async enhanceText(text, options) {
    // Enhance text quality
    return improvedText;
  }
}
```

#### Analysis Plugin

```javascript
const { AnalysisPlugin } = require('@ai-creative-assistant/sdk');

class SentimentPlugin extends AnalysisPlugin {
  async analyzeContent(content) {
    // Perform sentiment analysis
    return {
      type: 'sentiment',
      score: 0.75,
      insights: [
        {
          id: 'sentiment-1',
          title: 'Positive Sentiment',
          description: 'The text has a generally positive tone',
          severity: 'info'
        }
      ],
      suggestions: []
    };
  }

  getAnalysisTypes() {
    return ['sentiment', 'emotion', 'tone'];
  }
}
```

#### Export Plugin

```javascript
const { ExportPlugin } = require('@ai-creative-assistant/sdk');

class PDFExportPlugin extends ExportPlugin {
  async exportStory(story, options) {
    // Export story to PDF
    const pdfPath = await this.generatePDF(story, options);
    
    return {
      success: true,
      filePath: pdfPath,
      metadata: {
        pages: 150,
        fileSize: '2.5MB'
      }
    };
  }

  getSupportedFormats() {
    return [
      {
        id: 'pdf',
        name: 'PDF Document',
        extension: 'pdf',
        description: 'Portable Document Format',
        options: [
          {
            id: 'pageSize',
            name: 'Page Size',
            type: 'select',
            defaultValue: 'A4',
            options: ['A4', 'Letter', 'Legal']
          }
        ]
      }
    ];
  }
}
```

## SDK Usage

### Installation

```bash
npm install @ai-creative-assistant/sdk
```

### Basic Usage

```javascript
const { PluginBuilder, CommonPermissions } = require('@ai-creative-assistant/sdk');

// Build plugin manifest
const { manifest, pluginClass } = new PluginBuilder()
  .setId('my-plugin')
  .setName('My Plugin')
  .setVersion('1.0.0')
  .setDescription('A sample plugin')
  .setAuthor('Developer')
  .setLicense('MIT')
  .setMain('index.js')
  .addPermission(CommonPermissions.AI_GENERATE)
  .addPermission(CommonPermissions.DATA_READ)
  .setEngineVersion('^1.0.0')
  .setPluginClass(MyPlugin)
  .build();
```

### Testing Plugins

```javascript
const { PluginTester } = require('@ai-creative-assistant/sdk');

const tester = new PluginTester(MyPlugin, manifest);

// Test plugin lifecycle
const activationResult = await tester.testActivation();
const deactivationResult = await tester.testDeactivation();
const cleanupResult = await tester.testCleanup();

console.log('Tests passed:', activationResult && deactivationResult && cleanupResult);
```

## Examples

### Complete Integration Example

```javascript
const axios = require('axios');

class AICreativeAssistantClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.axios = axios.create({
      baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async createStory(storyData) {
    const response = await this.axios.post('/stories', storyData);
    return response.data;
  }

  async generateText(prompt, options = {}) {
    const response = await this.axios.post('/ai/generate', {
      prompt,
      options
    });
    return response.data.result;
  }

  async analyzeStory(story) {
    const response = await this.axios.post('/ai/analyze/story', story);
    return response.data;
  }

  async listPlugins() {
    const response = await this.axios.get('/plugins');
    return response.data;
  }
}

// Usage
const client = new AICreativeAssistantClient(
  'http://localhost:3001/api',
  'your-api-key'
);

// Create a new story
const story = await client.createStory({
  title: 'My New Novel',
  description: 'An epic adventure',
  genre: 'fantasy'
});

// Generate opening text
const openingText = await client.generateText(
  'Write an engaging opening for a fantasy novel',
  { maxTokens: 200, temperature: 0.8 }
);

// Analyze the story
const analysis = await client.analyzeStory(story);
console.log('Story analysis:', analysis);
```

### SoYume Studio Integration

```javascript
// SoYume Studio plugin integration
class SoYumeStudioIntegration {
  constructor() {
    this.client = new AICreativeAssistantClient(
      'http://localhost:3001/api',
      process.env.AI_CREATIVE_ASSISTANT_API_KEY
    );
  }

  async enhanceScript(script) {
    // Analyze script structure
    const analysis = await this.client.analyzeStory({
      title: script.title,
      scenes: script.scenes.map(scene => ({
        id: scene.id,
        title: scene.title,
        content: scene.dialogue + '\n' + scene.action
      }))
    });

    // Generate suggestions for improvement
    const suggestions = await this.client.generateSuggestions({
      type: 'script',
      content: script,
      analysis: analysis
    });

    return {
      analysis,
      suggestions,
      enhancedScript: this.applyEnhancements(script, suggestions)
    };
  }

  async generateDialogue(character, context) {
    const prompt = `Generate dialogue for ${character.name} in this context: ${context}`;
    return await this.client.generateText(prompt, {
      maxTokens: 150,
      temperature: 0.7
    });
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Errors

#### Authentication Errors

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key",
  "code": "INVALID_API_KEY"
}
```

#### Validation Errors

```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "title": "Title is required",
    "genre": "Invalid genre value"
  }
}
```

#### Rate Limit Errors

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "window": "15 minutes",
    "retryAfter": 300
  }
}
```

## Rate Limiting

### Default Limits

- **API Requests**: 100 requests per 15 minutes per API key
- **AI Generation**: 50 requests per hour per API key
- **WebSocket Connections**: 10 concurrent connections per API key

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 900
```

### Handling Rate Limits

```javascript
async function makeRequestWithRetry(requestFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Support

For API support and questions:

- **Documentation**: [https://docs.ai-creative-assistant.com](https://docs.ai-creative-assistant.com)
- **GitHub Issues**: [https://github.com/soyume/ai-creative-assistant/issues](https://github.com/soyume/ai-creative-assistant/issues)
- **Discord**: [https://discord.gg/ai-creative-assistant](https://discord.gg/ai-creative-assistant)
- **Email**: api-support@soyume.com

## Changelog

### v1.0.0
- Initial API release
- REST and gRPC APIs
- WebSocket support
- Plugin system
- SDK for plugin development