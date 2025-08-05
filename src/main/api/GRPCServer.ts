import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { AIEngine } from '../ai/AIEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugin/PluginManager';
import { Story, Scene, Character } from '../../shared/types/Story';

export interface GRPCConfig {
  port: number;
  host: string;
  enableTLS: boolean;
  certPath?: string;
  keyPath?: string;
  maxReceiveMessageLength: number;
  maxSendMessageLength: number;
}

export class GRPCServer {
  private server: grpc.Server;
  private config: GRPCConfig;
  private aiEngine: AIEngine;
  private dbManager: DatabaseManager;
  private pluginManager: PluginManager;
  private isRunning = false;

  constructor(
    aiEngine: AIEngine,
    dbManager: DatabaseManager,
    pluginManager: PluginManager,
    config: Partial<GRPCConfig> = {}
  ) {
    this.aiEngine = aiEngine;
    this.dbManager = dbManager;
    this.pluginManager = pluginManager;
    
    this.config = {
      port: 50051,
      host: '0.0.0.0',
      enableTLS: false,
      maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
      maxSendMessageLength: 4 * 1024 * 1024, // 4MB
      ...config
    };

    this.server = new grpc.Server({
      'grpc.max_receive_message_length': this.config.maxReceiveMessageLength,
      'grpc.max_send_message_length': this.config.maxSendMessageLength
    });

    this.setupServices();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve, reject) => {
      const credentials = this.config.enableTLS && this.config.certPath && this.config.keyPath
        ? grpc.ServerCredentials.createSsl(
            null,
            [{
              cert_chain: require('fs').readFileSync(this.config.certPath),
              private_key: require('fs').readFileSync(this.config.keyPath)
            }]
          )
        : grpc.ServerCredentials.createInsecure();

      this.server.bindAsync(
        `${this.config.host}:${this.config.port}`,
        credentials,
        (error, port) => {
          if (error) {
            console.error('gRPC Server bind error:', error);
            reject(error);
            return;
          }

          this.server.start();
          this.isRunning = true;
          console.log(`gRPC Server running on ${this.config.host}:${port}`);
          resolve();
        }
      );
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      this.server.tryShutdown((error) => {
        if (error) {
          console.error('gRPC Server shutdown error:', error);
          this.server.forceShutdown();
        }
        
        this.isRunning = false;
        console.log('gRPC Server stopped');
        resolve();
      });
    });
  }

  private setupServices(): void {
    // Load proto definitions
    const protoPath = path.join(__dirname, '../../../proto/ai_creative_assistant.proto');
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    const aiCreativeAssistant = protoDescriptor.ai_creative_assistant;

    // Story Service
    this.server.addService(aiCreativeAssistant.StoryService.service, {
      GetStory: this.getStory.bind(this),
      CreateStory: this.createStory.bind(this),
      UpdateStory: this.updateStory.bind(this),
      DeleteStory: this.deleteStory.bind(this),
      ListStories: this.listStories.bind(this),
      SearchStories: this.searchStories.bind(this)
    });

    // AI Service
    this.server.addService(aiCreativeAssistant.AIService.service, {
      GenerateText: this.generateText.bind(this),
      AnalyzeStory: this.analyzeStory.bind(this),
      AnalyzeScene: this.analyzeScene.bind(this),
      AnalyzeCharacter: this.analyzeCharacter.bind(this),
      GenerateSuggestions: this.generateSuggestions.bind(this),
      StreamGeneration: this.streamGeneration.bind(this)
    });

    // Plugin Service
    this.server.addService(aiCreativeAssistant.PluginService.service, {
      ListPlugins: this.listPlugins.bind(this),
      GetPlugin: this.getPlugin.bind(this),
      ActivatePlugin: this.activatePlugin.bind(this),
      DeactivatePlugin: this.deactivatePlugin.bind(this),
      InstallPlugin: this.installPlugin.bind(this),
      UninstallPlugin: this.uninstallPlugin.bind(this)
    });
  }

  // Story Service Methods
  private async getStory(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { id } = call.request;
      const story = await this.dbManager.getStory(id);
      
      if (!story) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: 'Story not found'
        });
        return;
      }

      callback(null, { story: this.storyToProto(story) });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to get story'
      });
    }
  }

  private async createStory(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const story = this.protoToStory(call.request.story);
      const savedStory = await this.dbManager.saveStory(story);
      
      callback(null, { story: this.storyToProto(savedStory) });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to create story'
      });
    }
  }

  private async updateStory(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const story = this.protoToStory(call.request.story);
      const updatedStory = await this.dbManager.saveStory(story);
      
      callback(null, { story: this.storyToProto(updatedStory) });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to update story'
      });
    }
  }

  private async deleteStory(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { id } = call.request;
      await this.dbManager.deleteStory(id);
      
      callback(null, { success: true });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to delete story'
      });
    }
  }

  private async listStories(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const stories = await this.dbManager.getAllStories();
      const protoStories = stories.map(story => this.storyToProto(story));
      
      callback(null, { stories: protoStories });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to list stories'
      });
    }
  }

  private async searchStories(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { query } = call.request;
      const stories = await this.dbManager.searchStories(query);
      const protoStories = stories.map(story => this.storyToProto(story));
      
      callback(null, { stories: protoStories });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to search stories'
      });
    }
  }

  // AI Service Methods
  private async generateText(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { prompt, options } = call.request;
      const result = await this.aiEngine.generateText(prompt, options);
      
      callback(null, { text: result });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to generate text'
      });
    }
  }

  private async analyzeStory(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const story = this.protoToStory(call.request.story);
      const analysis = await this.aiEngine.analyzeStory(story);
      
      callback(null, { analysis });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to analyze story'
      });
    }
  }

  private async analyzeScene(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const scene = this.protoToScene(call.request.scene);
      const analysis = await this.aiEngine.analyzeScene(scene);
      
      callback(null, { analysis });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to analyze scene'
      });
    }
  }

  private async analyzeCharacter(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const character = this.protoToCharacter(call.request.character);
      const analysis = await this.aiEngine.analyzeCharacter(character);
      
      callback(null, { analysis });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to analyze character'
      });
    }
  }

  private async generateSuggestions(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { context } = call.request;
      const suggestions = await this.aiEngine.generateSuggestions(context);
      
      callback(null, { suggestions });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to generate suggestions'
      });
    }
  }

  private streamGeneration(call: grpc.ServerWritableStream<any, any>): void {
    const { prompt, options } = call.request;
    
    // This would implement streaming text generation
    // For now, we'll simulate it
    const words = ['The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog'];
    let index = 0;
    
    const interval = setInterval(() => {
      if (index >= words.length) {
        call.end();
        clearInterval(interval);
        return;
      }
      
      call.write({
        token: words[index],
        isComplete: index === words.length - 1
      });
      
      index++;
    }, 100);
    
    call.on('cancelled', () => {
      clearInterval(interval);
    });
  }

  // Plugin Service Methods
  private listPlugins(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    try {
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
      
      callback(null, { plugins });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to list plugins'
      });
    }
  }

  private getPlugin(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    try {
      const { id } = call.request;
      const plugin = this.pluginManager.getPlugin(id);
      
      if (!plugin) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: 'Plugin not found'
        });
        return;
      }
      
      callback(null, {
        plugin: {
          id: plugin.manifest.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version,
          description: plugin.manifest.description,
          author: plugin.manifest.author,
          homepage: plugin.manifest.homepage,
          permissions: plugin.manifest.permissions,
          isActive: plugin.isActive,
          isLoaded: plugin.isLoaded,
          loadTime: plugin.loadTime?.toISOString(),
          errorCount: plugin.errorCount,
          lastError: plugin.lastError?.message
        }
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to get plugin'
      });
    }
  }

  private async activatePlugin(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { id } = call.request;
      await this.pluginManager.activatePlugin(id);
      
      callback(null, { success: true });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to activate plugin'
      });
    }
  }

  private async deactivatePlugin(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { id } = call.request;
      await this.pluginManager.deactivatePlugin(id);
      
      callback(null, { success: true });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to deactivate plugin'
      });
    }
  }

  private async installPlugin(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { package: pluginPackage } = call.request;
      const plugin = await this.pluginManager.installPlugin(pluginPackage);
      
      callback(null, {
        plugin: {
          id: plugin.manifest.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version
        }
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to install plugin'
      });
    }
  }

  private async uninstallPlugin(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { id } = call.request;
      await this.pluginManager.uninstallPlugin(id);
      
      callback(null, { success: true });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Failed to uninstall plugin'
      });
    }
  }

  // Helper methods for proto conversion
  private storyToProto(story: Story): any {
    return {
      id: story.id,
      title: story.title,
      description: story.description,
      genre: story.genre,
      createdAt: story.createdAt?.toISOString(),
      updatedAt: story.updatedAt?.toISOString(),
      scenes: story.scenes?.map(scene => this.sceneToProto(scene)) || [],
      characters: story.characters?.map(character => this.characterToProto(character)) || []
    };
  }

  private protoToStory(proto: any): Story {
    return {
      id: proto.id,
      title: proto.title,
      description: proto.description,
      genre: proto.genre,
      createdAt: proto.createdAt ? new Date(proto.createdAt) : new Date(),
      updatedAt: proto.updatedAt ? new Date(proto.updatedAt) : new Date(),
      scenes: proto.scenes?.map((scene: any) => this.protoToScene(scene)) || [],
      characters: proto.characters?.map((character: any) => this.protoToCharacter(character)) || []
    };
  }

  private sceneToProto(scene: Scene): any {
    return {
      id: scene.id,
      title: scene.title,
      content: scene.content,
      order: scene.order,
      createdAt: scene.createdAt?.toISOString(),
      updatedAt: scene.updatedAt?.toISOString()
    };
  }

  private protoToScene(proto: any): Scene {
    return {
      id: proto.id,
      title: proto.title,
      content: proto.content,
      order: proto.order,
      createdAt: proto.createdAt ? new Date(proto.createdAt) : new Date(),
      updatedAt: proto.updatedAt ? new Date(proto.updatedAt) : new Date()
    };
  }

  private characterToProto(character: Character): any {
    return {
      id: character.id,
      name: character.name,
      description: character.description,
      role: character.role,
      traits: character.traits || [],
      backstory: character.backstory,
      createdAt: character.createdAt?.toISOString(),
      updatedAt: character.updatedAt?.toISOString()
    };
  }

  private protoToCharacter(proto: any): Character {
    return {
      id: proto.id,
      name: proto.name,
      description: proto.description,
      role: proto.role,
      traits: proto.traits || [],
      backstory: proto.backstory,
      createdAt: proto.createdAt ? new Date(proto.createdAt) : new Date(),
      updatedAt: proto.updatedAt ? new Date(proto.updatedAt) : new Date()
    };
  }

  public getStats(): any {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      tlsEnabled: this.config.enableTLS,
      maxMessageSize: this.config.maxReceiveMessageLength
    };
  }
}