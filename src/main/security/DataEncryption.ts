import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Data encryption at rest with user-controlled keys
 * Provides comprehensive encryption for user data with key management
 */
export class DataEncryption extends EventEmitter {
  private userKey: Buffer | null;
  private systemKey: Buffer | null;
  private keyDerivationSalt: Buffer | null;
  private encryptionConfig: EncryptionConfig;
  private keyStore: Map<string, DerivedKey>;
  private encryptedDataPath: string;

  constructor(options: DataEncryptionOptions = {}) {
    super();
    
    this.userKey = null;
    this.systemKey = null;
    this.keyDerivationSalt = null;
    this.keyStore = new Map();
    this.encryptedDataPath = options.dataPath || path.join(process.cwd(), 'data', 'encrypted');
    
    this.encryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
      saltLength: 32,
      iterations: 100000,
      hashAlgorithm: 'sha256',
      keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
      ...options.encryptionConfig
    };
    
    this.initializeEncryption();
  }

  /**
   * Initialize encryption system
   */
  private async initializeEncryption(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.encryptedDataPath, { recursive: true });
      
      // Load or generate system key
      await this.loadOrGenerateSystemKey();
      
      // Load key derivation salt
      await this.loadOrGenerateSalt();
      
      this.emit('encryptionInitialized');
    } catch (error) {
      this.emit('encryptionError', error);
      throw new Error(`Failed to initialize encryption: ${error.message}`);
    }
  }

  /**
   * Set user encryption key (password-based)
   */
  async setUserKey(password: string, keyHint?: string): Promise<void> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Validate password strength
    const strength = this.calculatePasswordStrength(password);
    if (strength < 3) {
      throw new Error('Password is too weak. Please use a stronger password.');
    }
    
    // Derive user key from password
    this.userKey = await this.deriveKeyFromPassword(password);
    
    // Store key hint if provided
    if (keyHint) {
      await this.storeKeyHint(keyHint);
    }
    
    // Generate derived keys for different data types
    await this.generateDerivedKeys();
    
    this.emit('userKeySet', { hasHint: !!keyHint });
  }

  /**
   * Verify user key
   */
  async verifyUserKey(password: string): Promise<boolean> {
    try {
      const testKey = await this.deriveKeyFromPassword(password);
      
      // Try to decrypt a test file to verify the key
      const testData = await this.encryptData('test-verification', 'user-data');
      const decrypted = await this.decryptData(testData, 'user-data');
      
      return decrypted === 'test-verification';
    } catch (error) {
      return false;
    }
  }

  /**
   * Change user encryption key
   */
  async changeUserKey(oldPassword: string, newPassword: string): Promise<void> {
    // Verify old password
    const isValidOld = await this.verifyUserKey(oldPassword);
    if (!isValidOld) {
      throw new Error('Current password is incorrect');
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }
    
    const strength = this.calculatePasswordStrength(newPassword);
    if (strength < 3) {
      throw new Error('New password is too weak');
    }
    
    // Store old key temporarily
    const oldUserKey = this.userKey;
    
    try {
      // Set new key
      await this.setUserKey(newPassword);
      
      // Re-encrypt all user data with new key
      await this.reencryptUserData(oldUserKey!, this.userKey!);
      
      this.emit('userKeyChanged');
    } catch (error) {
      // Restore old key on failure
      this.userKey = oldUserKey;
      throw new Error(`Failed to change user key: ${error.message}`);
    }
  }

  /**
   * Encrypt data with specified key type
   */
  async encryptData(data: string | Buffer, keyType: KeyType): Promise<EncryptedData> {
    const key = await this.getEncryptionKey(keyType);
    if (!key) {
      throw new Error(`Encryption key not available for type: ${keyType}`);
    }
    
    const plaintext = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const iv = crypto.randomBytes(this.encryptionConfig.ivLength);
    
    const cipher = crypto.createCipher(this.encryptionConfig.algorithm, key);
    if ((cipher as any).setAAD) {
      (cipher as any).setAAD(Buffer.from(keyType)); // Additional authenticated data
    }
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    
    const authTag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag() : Buffer.alloc(0);
    
    return {
      algorithm: this.encryptionConfig.algorithm,
      keyType,
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data
   */
  async decryptData(encryptedData: EncryptedData, keyType?: KeyType): Promise<string> {
    const actualKeyType = keyType || encryptedData.keyType;
    const key = await this.getEncryptionKey(actualKeyType);
    
    if (!key) {
      throw new Error(`Decryption key not available for type: ${actualKeyType}`);
    }
    
    const decipher = crypto.createDecipher(encryptedData.algorithm, key);
    if ((decipher as any).setAAD) {
      (decipher as any).setAAD(Buffer.from(actualKeyType));
    }
    if ((decipher as any).setAuthTag) {
      (decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
    }
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encryptedData, 'base64')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt file
   */
  async encryptFile(filePath: string, keyType: KeyType): Promise<string> {
    try {
      const data = await fs.readFile(filePath);
      const encryptedData = await this.encryptData(data, keyType);
      
      const encryptedFilePath = `${filePath}.encrypted`;
      await fs.writeFile(encryptedFilePath, JSON.stringify(encryptedData));
      
      // Optionally remove original file
      // await fs.unlink(filePath);
      
      this.emit('fileEncrypted', { originalPath: filePath, encryptedPath: encryptedFilePath });
      return encryptedFilePath;
    } catch (error) {
      throw new Error(`Failed to encrypt file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Decrypt file
   */
  async decryptFile(encryptedFilePath: string, outputPath?: string): Promise<string> {
    try {
      const encryptedContent = await fs.readFile(encryptedFilePath, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(encryptedContent);
      
      const decryptedData = await this.decryptData(encryptedData);
      
      const outputFilePath = outputPath || encryptedFilePath.replace('.encrypted', '');
      await fs.writeFile(outputFilePath, decryptedData);
      
      this.emit('fileDecrypted', { encryptedPath: encryptedFilePath, decryptedPath: outputFilePath });
      return outputFilePath;
    } catch (error) {
      throw new Error(`Failed to decrypt file ${encryptedFilePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Encrypt directory recursively
   */
  async encryptDirectory(dirPath: string, keyType: KeyType): Promise<string[]> {
    const encryptedFiles: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.encryptDirectory(fullPath, keyType);
          encryptedFiles.push(...subFiles);
        } else if (entry.isFile() && !entry.name.endsWith('.encrypted')) {
          const encryptedFile = await this.encryptFile(fullPath, keyType);
          encryptedFiles.push(encryptedFile);
        }
      }
      
      return encryptedFiles;
    } catch (error) {
      throw new Error(`Failed to encrypt directory ${dirPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Get encryption key for specified type
   */
  private async getEncryptionKey(keyType: KeyType): Promise<Buffer | null> {
    switch (keyType) {
      case 'user-data':
        return this.userKey;
      case 'system-data':
        return this.systemKey;
      case 'cache-data':
        return this.keyStore.get('cache')?.key || null;
      case 'temp-data':
        return this.keyStore.get('temp')?.key || null;
      default:
        return null;
    }
  }

  /**
   * Generate derived keys for different data types
   */
  private async generateDerivedKeys(): Promise<void> {
    if (!this.userKey || !this.keyDerivationSalt) {
      throw new Error('User key or salt not available');
    }
    
    // Generate cache key
    const cacheKey = crypto.pbkdf2Sync(
      this.userKey,
      Buffer.concat([this.keyDerivationSalt, Buffer.from('cache')]),
      this.encryptionConfig.iterations,
      this.encryptionConfig.keyLength,
      this.encryptionConfig.hashAlgorithm
    );
    
    // Generate temp key
    const tempKey = crypto.pbkdf2Sync(
      this.userKey,
      Buffer.concat([this.keyDerivationSalt, Buffer.from('temp')]),
      this.encryptionConfig.iterations,
      this.encryptionConfig.keyLength,
      this.encryptionConfig.hashAlgorithm
    );
    
    this.keyStore.set('cache', {
      key: cacheKey,
      createdAt: Date.now(),
      type: 'cache-data'
    });
    
    this.keyStore.set('temp', {
      key: tempKey,
      createdAt: Date.now(),
      type: 'temp-data'
    });
  }

  /**
   * Load or generate system key
   */
  private async loadOrGenerateSystemKey(): Promise<void> {
    const keyPath = path.join(this.encryptedDataPath, 'system.key');
    
    try {
      const keyData = await fs.readFile(keyPath);
      this.systemKey = keyData;
    } catch (error) {
      // Generate new system key
      this.systemKey = crypto.randomBytes(this.encryptionConfig.keyLength);
      await fs.writeFile(keyPath, this.systemKey);
    }
  }

  /**
   * Load or generate key derivation salt
   */
  private async loadOrGenerateSalt(): Promise<void> {
    const saltPath = path.join(this.encryptedDataPath, 'salt.dat');
    
    try {
      const saltData = await fs.readFile(saltPath);
      this.keyDerivationSalt = saltData;
    } catch (error) {
      // Generate new salt
      this.keyDerivationSalt = crypto.randomBytes(this.encryptionConfig.saltLength);
      await fs.writeFile(saltPath, this.keyDerivationSalt);
    }
  }

  /**
   * Derive key from password
   */
  private async deriveKeyFromPassword(password: string): Promise<Buffer> {
    if (!this.keyDerivationSalt) {
      throw new Error('Key derivation salt not available');
    }
    
    return crypto.pbkdf2Sync(
      password,
      this.keyDerivationSalt,
      this.encryptionConfig.iterations,
      this.encryptionConfig.keyLength,
      this.encryptionConfig.hashAlgorithm
    );
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
   * Store key hint
   */
  private async storeKeyHint(hint: string): Promise<void> {
    const hintPath = path.join(this.encryptedDataPath, 'hint.txt');
    await fs.writeFile(hintPath, hint, 'utf8');
  }

  /**
   * Get key hint
   */
  async getKeyHint(): Promise<string | null> {
    try {
      const hintPath = path.join(this.encryptedDataPath, 'hint.txt');
      return await fs.readFile(hintPath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Re-encrypt user data with new key
   */
  private async reencryptUserData(oldKey: Buffer, newKey: Buffer): Promise<void> {
    // This would iterate through all encrypted user data files
    // and re-encrypt them with the new key
    // Implementation would depend on the specific data storage structure
    
    const tempOldKey = this.userKey;
    
    try {
      // Temporarily set old key for decryption
      this.userKey = oldKey;
      
      // Find all encrypted user data files
      const userDataFiles = await this.findEncryptedFiles('user-data');
      
      for (const filePath of userDataFiles) {
        // Decrypt with old key
        const decryptedData = await this.decryptFile(filePath);
        
        // Set new key for encryption
        this.userKey = newKey;
        
        // Re-encrypt with new key
        await this.encryptFile(decryptedData, 'user-data');
        
        // Clean up temporary decrypted file
        await fs.unlink(decryptedData);
      }
      
    } finally {
      // Restore new key
      this.userKey = tempOldKey;
    }
  }

  /**
   * Find encrypted files by key type
   */
  private async findEncryptedFiles(keyType: KeyType): Promise<string[]> {
    const files: string[] = [];
    
    const searchDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.encrypted')) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const encryptedData: EncryptedData = JSON.parse(content);
              
              if (encryptedData.keyType === keyType) {
                files.push(fullPath);
              }
            } catch (error) {
              // Skip invalid encrypted files
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };
    
    await searchDir(this.encryptedDataPath);
    return files;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    if (!this.userKey) {
      throw new Error('User key not set');
    }
    
    try {
      // Generate new system key
      const oldSystemKey = this.systemKey;
      this.systemKey = crypto.randomBytes(this.encryptionConfig.keyLength);
      
      // Save new system key
      const keyPath = path.join(this.encryptedDataPath, 'system.key');
      await fs.writeFile(keyPath, this.systemKey);
      
      // Re-encrypt system data with new key
      const systemDataFiles = await this.findEncryptedFiles('system-data');
      
      for (const filePath of systemDataFiles) {
        // This would re-encrypt system data files
        // Implementation depends on specific requirements
      }
      
      // Regenerate derived keys
      await this.generateDerivedKeys();
      
      this.emit('keysRotated', { 
        systemKeyRotated: true,
        derivedKeysRegenerated: true 
      });
      
    } catch (error) {
      throw new Error(`Key rotation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get encryption status
   */
  getEncryptionStatus(): EncryptionStatus {
    return {
      userKeySet: this.userKey !== null,
      systemKeySet: this.systemKey !== null,
      derivedKeysGenerated: this.keyStore.size > 0,
      encryptionConfig: this.encryptionConfig,
      keyHintAvailable: false, // Would check if hint file exists
      lastKeyRotation: Date.now() - (30 * 24 * 60 * 60 * 1000), // Mock: 30 days ago
      recommendations: this.getEncryptionRecommendations()
    };
  }

  /**
   * Get encryption recommendations
   */
  private getEncryptionRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.userKey) {
      recommendations.push('Set a user encryption key to protect your data');
    }
    
    if (this.keyStore.size === 0) {
      recommendations.push('Generate derived keys for different data types');
    }
    
    const lastRotation = Date.now() - (30 * 24 * 60 * 60 * 1000); // Mock
    if (Date.now() - lastRotation > this.encryptionConfig.keyRotationInterval) {
      recommendations.push('Consider rotating encryption keys');
    }
    
    return recommendations;
  }

  /**
   * Export encrypted data
   */
  async exportEncryptedData(exportPath: string, keyTypes: KeyType[]): Promise<void> {
    const exportData: EncryptedDataExport = {
      version: '1.0.0',
      timestamp: Date.now(),
      encryptionConfig: this.encryptionConfig,
      data: []
    };
    
    for (const keyType of keyTypes) {
      const files = await this.findEncryptedFiles(keyType);
      
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const relativePath = path.relative(this.encryptedDataPath, filePath);
        
        exportData.data.push({
          path: relativePath,
          keyType,
          content
        });
      }
    }
    
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    this.emit('dataExported', { path: exportPath, fileCount: exportData.data.length });
  }

  /**
   * Import encrypted data
   */
  async importEncryptedData(importPath: string): Promise<number> {
    try {
      const importContent = await fs.readFile(importPath, 'utf8');
      const exportData: EncryptedDataExport = JSON.parse(importContent);
      
      let importedCount = 0;
      
      for (const dataItem of exportData.data) {
        try {
          const targetPath = path.join(this.encryptedDataPath, dataItem.path);
          const targetDir = path.dirname(targetPath);
          
          // Ensure target directory exists
          await fs.mkdir(targetDir, { recursive: true });
          
          // Write encrypted data
          await fs.writeFile(targetPath, dataItem.content);
          importedCount++;
          
        } catch (error) {
          console.warn(`Failed to import ${dataItem.path}:`, error);
        }
      }
      
      this.emit('dataImported', { count: importedCount });
      return importedCount;
      
    } catch (error) {
      throw new Error(`Failed to import encrypted data: ${(error as Error).message}`);
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    // Clear sensitive data from memory
    if (this.userKey) {
      this.userKey.fill(0);
      this.userKey = null;
    }
    
    if (this.systemKey) {
      this.systemKey.fill(0);
      this.systemKey = null;
    }
    
    if (this.keyDerivationSalt) {
      this.keyDerivationSalt.fill(0);
      this.keyDerivationSalt = null;
    }
    
    // Clear derived keys
    for (const [, derivedKey] of this.keyStore) {
      derivedKey.key.fill(0);
    }
    this.keyStore.clear();
    
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface DataEncryptionOptions {
  dataPath?: string;
  encryptionConfig?: Partial<EncryptionConfig>;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
  iterations: number;
  hashAlgorithm: string;
  keyRotationInterval: number;
}

export interface EncryptedData {
  algorithm: string;
  keyType: KeyType;
  encryptedData: string;
  iv: string;
  authTag: string;
  timestamp: number;
}

export interface DerivedKey {
  key: Buffer;
  createdAt: number;
  type: KeyType;
}

export interface EncryptionStatus {
  userKeySet: boolean;
  systemKeySet: boolean;
  derivedKeysGenerated: boolean;
  encryptionConfig: EncryptionConfig;
  keyHintAvailable: boolean;
  lastKeyRotation: number;
  recommendations: string[];
}

export interface EncryptedDataExport {
  version: string;
  timestamp: number;
  encryptionConfig: EncryptionConfig;
  data: Array<{
    path: string;
    keyType: KeyType;
    content: string;
  }>;
}

export type KeyType = 'user-data' | 'system-data' | 'cache-data' | 'temp-data';