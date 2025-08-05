import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { AIEngine } from '../ai/AIEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugin/PluginManager';
import { ConfigManager } from '../config/ConfigManager';
import { Story, Scene, Character } from '../../shared/types/Story';

export interface APIConfig {
  port: number;
  host: string;
  enableCors: boolean;
  corsOrigins: string[];
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  jwtSecret: string;
  enableWebSocket: boolean;
  enableSwagger: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface APIRequest extends Request {
  apiKey?: APIKey;
  user?: any;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  apiKey?: APIKey;
  subscriptions: Set<string>;
  lastPing: Date;
}

export class APIServer {
  private app: Express;
  private server: Server;
  private wss?: WebSocketServer;
  private config: APIConfig;
  private aiEngine: AIEngine;
  private dbManager: DatabaseManager;
  private pluginManager: PluginManager;
  private configManager: ConfigManager;
  private apiKeys: Map<string, APIKey> = new Map();
  private wsClients: Map<string, WebSocketClient> = new Map();
  private isRunning = false;

  constructor(
    aiEngine: AIEngine,
    dbManager: DatabaseManager,
    pluginManager: PluginManager,
    configManager: ConfigManager,
    config: Partial<APIConfig> = {}
  ) {
    this.aiEngine = aiEngine;
    this.dbManager = dbManager;
    this.pluginManager = pluginManager;
    this.configManager = configManager;
    
    this.config = {
      port: 3001,
      host: 'localhost',
      enableCors: true,
      corsOrigins: ['http://localhost:3000', 'http://localhost:8080'],
      enableRateLimit: true,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100,
      jwtSecret: crypto.randomBytes(64).toString('hex'),
      enableWebSocket: true,
      enableSwagger: true,
      logLevel: 'info',
      ...config
    };

    this.app = express();
    this.server = createServer(this.app);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.loadAPIKeys();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`API Server running on ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('API Server error:', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      // Close WebSocket connections
      this.wsClients.forEach(client => {
        client.ws.close();
      });
      this.wsClients.clear();

      // Close HTTP server
      this.server.close(() => {
        this.isRunning = false;
        console.log('API Server stopped');
        resolve();
      });
    });
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: this.config.corsOrigins,
        credentials: true
      }));
    }

    // Rate limiting
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimitWindow,
        max: this.config.rateLimitMax,
        message: 'Too many requests from this IP'
      });
      this.app.use('/api/', limiter);
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (this.config.logLevel === 'debug') {
        console.log(`${req.method} ${req.path}`, req.body);
      }
      next();
    });

    // API Key authentication
    this.app.use('/api/', this.authenticateAPIKey.bind(this));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // API Info
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'AI Creative Assistant API',
        version: '1.0.0',
        description: 'REST API for AI Creative Assistant',
        endpoints: {
          stories: '/api/stories',
          ai: '/api/ai',
          plugins: '/api/plugins',
          websocket: this.config.enableWebSocket ? `ws://${this.config.host}:${this.config.port}/ws` : null
        }
      });
    });

    // Story endpoints
    this.setupStoryRoutes();
    
    // AI endpoints
    this.setupAIRoutes();
    
    // Plugin endpoints
    this.setupPluginRoutes();
    
    // Configuration endpoints
    this.setupConfigRoutes();

    // Error handling
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`
      });
    });
  }

  private setupStoryRoutes(): void {
    const router = express.Router();

    // Get all stories
    router.get('/', async (req: APIRequest, res: Response) => {
      try {
        const stories = await this.dbManager.getAllStories();
        res.json(stories);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stories' });
      }
    });

    // Get story by ID
    router.get('/:id', async (req: APIRequest, res: Response) => {
      try {
        const story = await this.dbManager.getStory(req.params.id);
        if (!story) {
          return res.status(404).json({ error: 'Story not found' });
        }
        res.json(story);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch story' });
      }
    });

    // Create new story
    router.post('/', async (req: APIRequest, res: Response) => {
      try {
        const story: Story = req.body;
        const savedStory = await this.dbManager.saveStory(story);
        res.status(201).json(savedStory);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create story' });
      }
    });

    // Update story
    router.put('/:id', async (req: APIRequest, res: Response) => {
      try {
        const story: Story = { ...req.body, id: req.params.id };
        const updatedStory = await this.dbManager.saveStory(story);
        res.json(updatedStory);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update story' });
      }
    });

    // Delete story
    router.delete('/:id', async (req: APIRequest, res: Response) => {
      try {
        await this.dbManager.deleteStory(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete story' });
      }
    });

    // Search stories
    router.get('/search/:query', async (req: APIRequest, res: Response) => {
      try {
        const results = await this.dbManager.searchStories(req.params.query);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: 'Failed to search stories' });
      }
    });

    this.app.use('/api/stories', router);
  }

  private setupAIRoutes(): void {
    const router = express.Router();

    // Generate text
    router.post('/generate', async (req: APIRequest, res: Response) => {
      try {
        const { prompt, options } = req.body;
        const result = await this.aiEngine.generateText(prompt, options);
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate text' });
      }
    });

    // Analyze story
    router.post('/analyze/story', async (req: APIRequest, res: Response) => {
      try {
        const story: Story = req.body;
        const analysis = await this.aiEngine.analyzeStory(story);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze story' });
      }
    });

    // Analyze scene
    router.post('/analyze/scene', async (req: APIRequest, res: Response) => {
      try {
        const scene: Scene = req.body;
        const analysis = await this.aiEngine.analyzeScene(scene);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze scene' });
      }
    });

    // Analyze character
    router.post('/analyze/character', async (req: APIRequest, res: Response) => {
      try {
        const character: Character = req.body;
        const analysis = await this.aiEngine.analyzeCharacter(character);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze character' });
      }
    });

    // Generate suggestions
    router.post('/suggestions', async (req: APIRequest, res: Response) => {
      try {
        const context = req.body;
        const suggestions = await this.aiEngine.generateSuggestions(context);
        res.json(suggestions);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate suggestions' });
      }
    });

    // Get available AI providers
    router.get('/providers', async (req: APIRequest, res: Response) => {
      try {
        const providers = await this.aiEngine.getAvailableProviders();
        res.json(providers);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch providers' });
      }
    });

    this.app.use('/api/ai', router);
  }

  private setupPluginRoutes(): void {
    const router = express.Router();

    // Get all plugins
    router.get('/', (req: APIRequest, res: Response) => {
      const plugins = this.pluginManager.getAllPlugins().map(plugin => ({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author,
        isActive: plugin.isActive,
        isLoaded: plugin.isLoaded,
        errorCount: plugin.errorCount
      }));
      res.json(plugins);
    });

    // Get plugin by ID
    router.get('/:id', (req: APIRequest, res: Response) => {
      const plugin = this.pluginManager.getPlugin(req.params.id);
      if (!plugin) {
        return res.status(404).json({ error: 'Plugin not found' });
      }
      
      res.json({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author,
        homepage: plugin.manifest.homepage,
        permissions: plugin.manifest.permissions,
        isActive: plugin.isActive,
        isLoaded: plugin.isLoaded,
        loadTime: plugin.loadTime,
        errorCount: plugin.errorCount,
        lastError: plugin.lastError?.message
      });
    });

    // Activate plugin
    router.post('/:id/activate', async (req: APIRequest, res: Response) => {
      try {
        await this.pluginManager.activatePlugin(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to activate plugin' });
      }
    });

    // Deactivate plugin
    router.post('/:id/deactivate', async (req: APIRequest, res: Response) => {
      try {
        await this.pluginManager.deactivatePlugin(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to deactivate plugin' });
      }
    });

    // Install plugin
    router.post('/install', async (req: APIRequest, res: Response) => {
      try {
        const { package: pluginPackage } = req.body;
        const plugin = await this.pluginManager.installPlugin(pluginPackage);
        res.status(201).json({
          id: plugin.manifest.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to install plugin' });
      }
    });

    // Uninstall plugin
    router.delete('/:id', async (req: APIRequest, res: Response) => {
      try {
        await this.pluginManager.uninstallPlugin(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to uninstall plugin' });
      }
    });

    this.app.use('/api/plugins', router);
  }

  private setupConfigRoutes(): void {
    const router = express.Router();

    // Get configuration
    router.get('/', (req: APIRequest, res: Response) => {
      const config = this.configManager.getConfig();
      // Remove sensitive information
      const sanitizedConfig = { ...config };
      delete sanitizedConfig.apiKeys;
      delete sanitizedConfig.secrets;
      res.json(sanitizedConfig);
    });

    // Update configuration
    router.put('/', async (req: APIRequest, res: Response) => {
      try {
        await this.configManager.updateConfig(req.body);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
      }
    });

    // Get specific config value
    router.get('/:key', (req: APIRequest, res: Response) => {
      const value = this.configManager.get(req.params.key);
      res.json({ key: req.params.key, value });
    });

    // Set specific config value
    router.put('/:key', async (req: APIRequest, res: Response) => {
      try {
        await this.configManager.set(req.params.key, req.body.value);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to set configuration' });
      }
    });

    this.app.use('/api/config', router);
  }

  private setupWebSocket(): void {
    if (!this.config.enableWebSocket) return;

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = crypto.randomUUID();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: new Date()
      };

      this.wsClients.set(clientId, client);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(client, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.wsClients.delete(clientId);
      });

      ws.on('pong', () => {
        client.lastPing = new Date();
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));
    });

    // Ping clients periodically
    setInterval(() => {
      this.wsClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000);
  }

  private async handleWebSocketMessage(client: WebSocketClient, message: any): Promise<void> {
    switch (message.type) {
      case 'authenticate':
        await this.authenticateWebSocketClient(client, message.apiKey);
        break;
        
      case 'subscribe':
        client.subscriptions.add(message.channel);
        client.ws.send(JSON.stringify({
          type: 'subscribed',
          channel: message.channel
        }));
        break;
        
      case 'unsubscribe':
        client.subscriptions.delete(message.channel);
        client.ws.send(JSON.stringify({
          type: 'unsubscribed',
          channel: message.channel
        }));
        break;
        
      case 'ai_generate':
        if (client.apiKey) {
          try {
            const result = await this.aiEngine.generateText(message.prompt, message.options);
            client.ws.send(JSON.stringify({
              type: 'ai_result',
              requestId: message.requestId,
              result
            }));
          } catch (error) {
            client.ws.send(JSON.stringify({
              type: 'error',
              requestId: message.requestId,
              message: 'Failed to generate text'
            }));
          }
        } else {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Authentication required'
          }));
        }
        break;
        
      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  private async authenticateWebSocketClient(client: WebSocketClient, apiKey: string): Promise<void> {
    const key = this.apiKeys.get(apiKey);
    if (key && key.isActive) {
      client.apiKey = key;
      key.lastUsed = new Date();
      
      client.ws.send(JSON.stringify({
        type: 'authenticated',
        permissions: key.permissions
      }));
    } else {
      client.ws.send(JSON.stringify({
        type: 'authentication_failed',
        message: 'Invalid API key'
      }));
    }
  }

  private async authenticateAPIKey(req: APIRequest, res: Response, next: NextFunction): Promise<void> {
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const key = this.apiKeys.get(apiKey);
    if (!key || !key.isActive) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update last used timestamp
    key.lastUsed = new Date();
    req.apiKey = key;
    
    next();
  }

  private async loadAPIKeys(): Promise<void> {
    // Load API keys from configuration
    const keys = this.configManager.get('apiKeys', []);
    
    for (const keyData of keys) {
      this.apiKeys.set(keyData.key, keyData);
    }

    // Create default API key if none exist
    if (this.apiKeys.size === 0) {
      const defaultKey: APIKey = {
        id: crypto.randomUUID(),
        name: 'Default API Key',
        key: crypto.randomBytes(32).toString('hex'),
        permissions: ['*'],
        createdAt: new Date(),
        isActive: true
      };
      
      this.apiKeys.set(defaultKey.key, defaultKey);
      await this.configManager.set('apiKeys', [defaultKey]);
      
      console.log(`Created default API key: ${defaultKey.key}`);
    }
  }

  public async createAPIKey(name: string, permissions: string[]): Promise<APIKey> {
    const apiKey: APIKey = {
      id: crypto.randomUUID(),
      name,
      key: crypto.randomBytes(32).toString('hex'),
      permissions,
      createdAt: new Date(),
      isActive: true
    };

    this.apiKeys.set(apiKey.key, apiKey);
    
    // Save to configuration
    const keys = Array.from(this.apiKeys.values());
    await this.configManager.set('apiKeys', keys);

    return apiKey;
  }

  public async revokeAPIKey(keyId: string): Promise<void> {
    const key = Array.from(this.apiKeys.values()).find(k => k.id === keyId);
    if (key) {
      this.apiKeys.delete(key.key);
      
      // Save to configuration
      const keys = Array.from(this.apiKeys.values());
      await this.configManager.set('apiKeys', keys);
    }
  }

  public broadcastToChannel(channel: string, message: any): void {
    this.wsClients.forEach((client) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'broadcast',
          channel,
          data: message,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }

  public getStats(): any {
    return {
      isRunning: this.isRunning,
      connectedClients: this.wsClients.size,
      activeAPIKeys: Array.from(this.apiKeys.values()).filter(k => k.isActive).length,
      totalRequests: 0, // Would track this in a real implementation
      uptime: process.uptime()
    };
  }
}