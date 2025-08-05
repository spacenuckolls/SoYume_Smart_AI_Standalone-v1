import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as keytar from 'keytar';
import * as os from 'os';

/**
 * Secure credential management for cloud AI providers
 * Handles encryption, storage, and secure access to sensitive credentials
 */
export class CredentialManager extends EventEmitter {
  private serviceName: string;
  private encryptionKey: Buffer | null;
  private credentialCache: Map<string, EncryptedCredential>;
  private masterPassword: string | null;
  private securityPolicy: SecurityPolicy;

  constructor(options: CredentialManagerOptions = {}) {
    super();
    
    this.serviceName = options.serviceName || 'ai-creative-assistant';
    this.encryptionKey = null;
    this.credentialCache = new Map();
    this.masterPassword = null;
    this.securityPolicy = {
      requireMasterPassword: options.requireMasterPassword || true,
      keyRotationInterval: options.keyRotationInterval || 30 * 24 * 60 * 60 * 1000, // 30 days
      maxCredentialAge: options.maxCredentialAge || 90 * 24 * 60 * 60 * 1000, // 90 days
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationIterations: 100000,
      ...options.securityPolicy
    };
    
    this.initializeEncryption();
  }

  /**
   * Initialize encryption system
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Try to load existing encryption key
      const existingKey = await this.loadEncryptionKey();
      
      if (existingKey) {
        this.encryptionKey = existingKey;
      } else {
        // Generate new encryption key
        this.encryptionKey = await this.generateEncryptionKey();
        await this.saveEncryptionKey(this.encryptionKey);
      }
      
      this.emit('encryptionInitialized');
    } catch (error) {
      this.emit('encryptionError', error);
      throw new Error(`Failed to initialize encryption: ${error.message}`);
    }
  }

  /**
   * Set master password for additional security
   */
  async setMasterPassword(password: string): Promise<void> {
    if (!password || password.length < 8) {
      throw new Error('Master password must be at least 8 characters long');
    }
    
    // Validate password strength
    const strength = this.calculatePasswordStrength(password);
    if (strength < 3) {
      throw new Error('Master password is too weak. Please use a stronger password.');
    }
    
    this.masterPassword = password;
    
    // Re-encrypt existing credentials with new master password
    await this.reencryptCredentials();
    
    this.emit('masterPasswordSet');
  }

  /**
   * Store encrypted credential
   */
  async storeCredential(providerId: string, credential: Credential): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    // Validate credential
    this.validateCredential(credential);
    
    // Encrypt credential
    const encryptedCredential = await this.encryptCredential(credential);
    
    // Store in system keychain
    const credentialKey = `${this.serviceName}:${providerId}`;
    await keytar.setPassword(this.serviceName, credentialKey, JSON.stringify(encryptedCredential));
    
    // Cache encrypted credential
    this.credentialCache.set(providerId, encryptedCredential);
    
    this.emit('credentialStored', { providerId, type: credential.type });
  }

  /**
   * Retrieve and decrypt credential
   */
  async getCredential(providerId: string): Promise<Credential | null> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    try {
      // Check cache first
      let encryptedCredential = this.credentialCache.get(providerId);
      
      if (!encryptedCredential) {
        // Load from keychain
        const credentialKey = `${this.serviceName}:${providerId}`;
        const storedData = await keytar.getPassword(this.serviceName, credentialKey);
        
        if (!storedData) {
          return null;
        }
        
        encryptedCredential = JSON.parse(storedData);
        this.credentialCache.set(providerId, encryptedCredential);
      }
      
      // Check if credential has expired
      if (this.isCredentialExpired(encryptedCredential)) {
        await this.removeCredential(providerId);
        return null;
      }
      
      // Decrypt credential
      const credential = await this.decryptCredential(encryptedCredential);
      
      this.emit('credentialAccessed', { providerId, type: credential.type });
      return credential;
      
    } catch (error) {
      this.emit('credentialError', { providerId, error: error.message });
      throw new Error(`Failed to retrieve credential for ${providerId}: ${error.message}`);
    }
  }

  /**
   * Remove credential
   */
  async removeCredential(providerId: string): Promise<boolean> {
    try {
      const credentialKey = `${this.serviceName}:${providerId}`;
      const removed = await keytar.deletePassword(this.serviceName, credentialKey);
      
      // Remove from cache
      this.credentialCache.delete(providerId);
      
      if (removed) {
        this.emit('credentialRemoved', { providerId });
      }
      
      return removed;
    } catch (error) {
      this.emit('credentialError', { providerId, error: error.message });
      return false;
    }
  }

  /**
   * List all stored credential providers
   */
  async listCredentials(): Promise<CredentialInfo[]> {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      const credentialInfos: CredentialInfo[] = [];
      
      for (const cred of credentials) {
        try {
          const encryptedCredential: EncryptedCredential = JSON.parse(cred.password);
          const providerId = cred.account.replace(`${this.serviceName}:`, '');
          
          credentialInfos.push({
            providerId,
            type: encryptedCredential.type,
            createdAt: encryptedCredential.createdAt,
            lastUsed: encryptedCredential.lastUsed,
            expiresAt: encryptedCredential.expiresAt,
            isExpired: this.isCredentialExpired(encryptedCredential)
          });
        } catch (parseError) {
          // Skip invalid credentials
          continue;
        }
      }
      
      return credentialInfos;
    } catch (error) {
      this.emit('credentialError', { error: error.message });
      return [];
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateEncryptionKey(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
    
    const oldKey = this.encryptionKey;
    
    try {
      // Generate new encryption key
      const newKey = await this.generateEncryptionKey();
      
      // Re-encrypt all credentials with new key
      const credentials = await this.listCredentials();
      const reencryptionPromises = credentials.map(async (credInfo) => {
        const credential = await this.getCredential(credInfo.providerId);
        if (credential) {
          // Temporarily set new key
          this.encryptionKey = newKey;
          await this.storeCredential(credInfo.providerId, credential);
        }
      });
      
      await Promise.all(reencryptionPromises);
      
      // Save new key
      await this.saveEncryptionKey(newKey);
      this.encryptionKey = newKey;
      
      this.emit('keyRotated');
    } catch (error) {
      // Restore old key on failure
      this.encryptionKey = oldKey;
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Clear all credentials (for security purposes)
   */
  async clearAllCredentials(): Promise<void> {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      
      const deletePromises = credentials.map(cred => 
        keytar.deletePassword(this.serviceName, cred.account)
      );
      
      await Promise.all(deletePromises);
      
      // Clear cache
      this.credentialCache.clear();
      
      this.emit('allCredentialsCleared');
    } catch (error) {
      throw new Error(`Failed to clear credentials: ${error.message}`);
    }
  }

  /**
   * Export encrypted credentials for backup
   */
  async exportCredentials(exportPassword: string): Promise<string> {
    if (!exportPassword || exportPassword.length < 12) {
      throw new Error('Export password must be at least 12 characters long');
    }
    
    const credentials = await this.listCredentials();
    const exportData: CredentialExport = {
      version: '1.0.0',
      timestamp: Date.now(),
      credentials: []
    };
    
    for (const credInfo of credentials) {
      const credential = await this.getCredential(credInfo.providerId);
      if (credential) {
        exportData.credentials.push({
          providerId: credInfo.providerId,
          credential: credential
        });
      }
    }
    
    // Encrypt export data with export password
    const exportKey = await this.deriveKeyFromPassword(exportPassword);
    const encryptedExport = await this.encryptData(JSON.stringify(exportData), exportKey);
    
    this.emit('credentialsExported', { count: exportData.credentials.length });
    
    return JSON.stringify(encryptedExport);
  }

  /**
   * Import encrypted credentials from backup
   */
  async importCredentials(encryptedData: string, importPassword: string): Promise<number> {
    try {
      const importKey = await this.deriveKeyFromPassword(importPassword);
      const encryptedExport = JSON.parse(encryptedData);
      
      const decryptedData = await this.decryptData(encryptedExport, importKey);
      const exportData: CredentialExport = JSON.parse(decryptedData);
      
      // Validate export format
      if (!exportData.version || !exportData.credentials) {
        throw new Error('Invalid export format');
      }
      
      let importedCount = 0;
      
      for (const credData of exportData.credentials) {
        try {
          await this.storeCredential(credData.providerId, credData.credential);
          importedCount++;
        } catch (error) {
          // Continue with other credentials if one fails
          console.warn(`Failed to import credential for ${credData.providerId}:`, error);
        }
      }
      
      this.emit('credentialsImported', { count: importedCount });
      
      return importedCount;
    } catch (error) {
      throw new Error(`Failed to import credentials: ${error.message}`);
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus(): SecurityStatus {
    return {
      encryptionInitialized: this.encryptionKey !== null,
      masterPasswordSet: this.masterPassword !== null,
      credentialCount: this.credentialCache.size,
      lastKeyRotation: this.getLastKeyRotationTime(),
      securityPolicy: this.securityPolicy,
      recommendations: this.getSecurityRecommendations()
    };
  }

  /**
   * Validate credential format and content
   */
  private validateCredential(credential: Credential): void {
    if (!credential.type || !credential.data) {
      throw new Error('Invalid credential format');
    }
    
    switch (credential.type) {
      case 'api-key':
        if (!credential.data.apiKey || credential.data.apiKey.length < 10) {
          throw new Error('API key is too short or missing');
        }
        break;
      case 'oauth':
        if (!credential.data.accessToken || !credential.data.refreshToken) {
          throw new Error('OAuth tokens are missing');
        }
        break;
      case 'basic-auth':
        if (!credential.data.username || !credential.data.password) {
          throw new Error('Username or password is missing');
        }
        break;
      default:
        throw new Error(`Unsupported credential type: ${credential.type}`);
    }
  }

  /**
   * Encrypt credential data
   */
  private async encryptCredential(credential: Credential): Promise<EncryptedCredential> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const plaintext = JSON.stringify(credential.data);
    const encrypted = await this.encryptData(plaintext, this.encryptionKey);
    
    return {
      type: credential.type,
      encryptedData: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      expiresAt: Date.now() + this.securityPolicy.maxCredentialAge
    };
  }

  /**
   * Decrypt credential data
   */
  private async decryptCredential(encryptedCredential: EncryptedCredential): Promise<Credential> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const decryptedData = await this.decryptData({
      encryptedData: encryptedCredential.encryptedData,
      iv: encryptedCredential.iv,
      authTag: encryptedCredential.authTag
    }, this.encryptionKey);
    
    // Update last used timestamp
    encryptedCredential.lastUsed = Date.now();
    
    return {
      type: encryptedCredential.type,
      data: JSON.parse(decryptedData)
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encryptData(plaintext: string, key: Buffer): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.securityPolicy.encryptionAlgorithm, key);
    cipher.setAAD(Buffer.from('ai-creative-assistant'));
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decryptData(encryptedData: EncryptedData, key: Buffer): Promise<string> {
    const decipher = crypto.createDecipher(this.securityPolicy.encryptionAlgorithm, key);
    decipher.setAAD(Buffer.from('ai-creative-assistant'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate encryption key
   */
  private async generateEncryptionKey(): Promise<Buffer> {
    const baseKey = crypto.randomBytes(32);
    
    if (this.masterPassword) {
      // Derive key from master password
      const salt = crypto.randomBytes(32);
      return crypto.pbkdf2Sync(this.masterPassword, salt, this.securityPolicy.keyDerivationIterations, 32, 'sha256');
    }
    
    return baseKey;
  }

  /**
   * Derive key from password
   */
  private async deriveKeyFromPassword(password: string): Promise<Buffer> {
    const salt = crypto.randomBytes(32);
    return crypto.pbkdf2Sync(password, salt, this.securityPolicy.keyDerivationIterations, 32, 'sha256');
  }

  /**
   * Load encryption key from secure storage
   */
  private async loadEncryptionKey(): Promise<Buffer | null> {
    try {
      const keyData = await keytar.getPassword(this.serviceName, 'encryption-key');
      return keyData ? Buffer.from(keyData, 'hex') : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save encryption key to secure storage
   */
  private async saveEncryptionKey(key: Buffer): Promise<void> {
    await keytar.setPassword(this.serviceName, 'encryption-key', key.toString('hex'));
  }

  /**
   * Check if credential has expired
   */
  private isCredentialExpired(credential: EncryptedCredential): boolean {
    return Date.now() > credential.expiresAt;
  }

  /**
   * Calculate password strength (0-5 scale)
   */
  private calculatePasswordStrength(password: string): number {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    return Math.min(score, 5);
  }

  /**
   * Re-encrypt all credentials (used when master password changes)
   */
  private async reencryptCredentials(): Promise<void> {
    const credentialInfos = await this.listCredentials();
    
    for (const credInfo of credentialInfos) {
      const credential = await this.getCredential(credInfo.providerId);
      if (credential) {
        await this.storeCredential(credInfo.providerId, credential);
      }
    }
  }

  /**
   * Get last key rotation time
   */
  private getLastKeyRotationTime(): number {
    // This would be stored in secure storage in a real implementation
    return Date.now() - (15 * 24 * 60 * 60 * 1000); // Mock: 15 days ago
  }

  /**
   * Get security recommendations
   */
  private getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.masterPassword) {
      recommendations.push('Set a master password for additional security');
    }
    
    const lastRotation = this.getLastKeyRotationTime();
    if (Date.now() - lastRotation > this.securityPolicy.keyRotationInterval) {
      recommendations.push('Consider rotating encryption keys');
    }
    
    if (this.credentialCache.size === 0) {
      recommendations.push('No credentials stored - add AI provider credentials');
    }
    
    return recommendations;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear sensitive data from memory
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
    
    if (this.masterPassword) {
      this.masterPassword = '';
      this.masterPassword = null;
    }
    
    this.credentialCache.clear();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface CredentialManagerOptions {
  serviceName?: string;
  requireMasterPassword?: boolean;
  keyRotationInterval?: number;
  maxCredentialAge?: number;
  securityPolicy?: Partial<SecurityPolicy>;
}

export interface SecurityPolicy {
  requireMasterPassword: boolean;
  keyRotationInterval: number;
  maxCredentialAge: number;
  encryptionAlgorithm: string;
  keyDerivationIterations: number;
}

export interface Credential {
  type: 'api-key' | 'oauth' | 'basic-auth';
  data: CredentialData;
}

export interface CredentialData {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  password?: string;
  baseUrl?: string;
  [key: string]: any;
}

export interface EncryptedCredential {
  type: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  createdAt: number;
  lastUsed: number;
  expiresAt: number;
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export interface CredentialInfo {
  providerId: string;
  type: string;
  createdAt: number;
  lastUsed: number;
  expiresAt: number;
  isExpired: boolean;
}

export interface CredentialExport {
  version: string;
  timestamp: number;
  credentials: Array<{
    providerId: string;
    credential: Credential;
  }>;
}

export interface SecurityStatus {
  encryptionInitialized: boolean;
  masterPasswordSet: boolean;
  credentialCount: number;
  lastKeyRotation: number;
  securityPolicy: SecurityPolicy;
  recommendations: string[];
}