import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CredentialManager } from '../../src/main/security/CredentialManager';
import { DataEncryption } from '../../src/main/security/DataEncryption';
import { PrivacyAuditLogger } from '../../src/main/security/PrivacyAuditLogger';
import { ConsentManager } from '../../src/main/security/ConsentManager';
import { PluginSandbox } from '../../src/main/security/PluginSandbox';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

describe('Security System Tests', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp', crypto.randomUUID());
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('CredentialManager', () => {
    let credentialManager: CredentialManager;
    
    beforeEach(() => {
      credentialManager = new CredentialManager({
        serviceName: 'test-service',
        requireMasterPassword: false
      });
    });
    
    afterEach(() => {
      credentialManager.destroy();
    });

    it('should store and retrieve API key credentials', async () => {
      const credential = {
        type: 'api-key' as const,
        data: {
          apiKey: 'test-api-key-12345',
          baseUrl: 'https://api.example.com'
        }
      };
      
      await credentialManager.storeCredential('openai', credential);
      const retrieved = await credentialManager.getCredential('openai');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.type).toBe('api-key');
      expect(retrieved!.data.apiKey).toBe('test-api-key-12345');
      expect(retrieved!.data.baseUrl).toBe('https://api.example.com');
    });

    it('should store and retrieve OAuth credentials', async () => {
      const credential = {
        type: 'oauth' as const,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-456',
          expiresAt: Date.now() + 3600000
        }
      };
      
      await credentialManager.storeCredential('google', credential);
      const retrieved = await credentialManager.getCredential('google');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.type).toBe('oauth');
      expect(retrieved!.data.accessToken).toBe('access-token-123');
      expect(retrieved!.data.refreshToken).toBe('refresh-token-456');
    });

    it('should handle credential expiration', async () => {
      const credential = {
        type: 'api-key' as const,
        data: {
          apiKey: 'expired-key'
        }
      };
      
      // Mock expired credential
      const credentialManager = new CredentialManager({
        serviceName: 'test-service',
        securityPolicy: {
          maxCredentialAge: 1 // 1ms for immediate expiration
        }
      });
      
      await credentialManager.storeCredential('expired-provider', credential);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const retrieved = await credentialManager.getCredential('expired-provider');
      expect(retrieved).toBeNull();
      
      credentialManager.destroy();
    });

    it('should validate credential format', async () => {
      const invalidCredential = {
        type: 'api-key' as const,
        data: {
          apiKey: '' // Empty API key should be invalid
        }
      };
      
      await expect(
        credentialManager.storeCredential('invalid', invalidCredential)
      ).rejects.toThrow('API key is too short or missing');
    });

    it('should list stored credentials', async () => {
      const credentials = [
        {
          type: 'api-key' as const,
          data: { apiKey: 'key1' }
        },
        {
          type: 'oauth' as const,
          data: { accessToken: 'token1', refreshToken: 'refresh1' }
        }
      ];
      
      await credentialManager.storeCredential('provider1', credentials[0]);
      await credentialManager.storeCredential('provider2', credentials[1]);
      
      const list = await credentialManager.listCredentials();
      
      expect(list).toHaveLength(2);
      expect(list.map(c => c.providerId)).toContain('provider1');
      expect(list.map(c => c.providerId)).toContain('provider2');
    });

    it('should remove credentials', async () => {
      const credential = {
        type: 'api-key' as const,
        data: { apiKey: 'to-be-removed' }
      };
      
      await credentialManager.storeCredential('removable', credential);
      
      let retrieved = await credentialManager.getCredential('removable');
      expect(retrieved).toBeDefined();
      
      const removed = await credentialManager.removeCredential('removable');
      expect(removed).toBe(true);
      
      retrieved = await credentialManager.getCredential('removable');
      expect(retrieved).toBeNull();
    });

    it('should export and import credentials', async () => {
      const credential = {
        type: 'api-key' as const,
        data: { apiKey: 'export-test-key' }
      };
      
      await credentialManager.storeCredential('export-test', credential);
      
      const exportData = await credentialManager.exportCredentials('export-password-123');
      expect(exportData).toBeDefined();
      
      // Clear credentials
      await credentialManager.clearAllCredentials();
      
      // Import back
      const importedCount = await credentialManager.importCredentials(exportData, 'export-password-123');
      expect(importedCount).toBe(1);
      
      const retrieved = await credentialManager.getCredential('export-test');
      expect(retrieved).toBeDefined();
      expect(retrieved!.data.apiKey).toBe('export-test-key');
    });

    it('should handle master password', async () => {
      const credentialManager = new CredentialManager({
        serviceName: 'test-master-password',
        requireMasterPassword: true
      });
      
      await credentialManager.setMasterPassword('strong-master-password-123');
      
      const credential = {
        type: 'api-key' as const,
        data: { apiKey: 'master-protected-key' }
      };
      
      await credentialManager.storeCredential('protected', credential);
      const retrieved = await credentialManager.getCredential('protected');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.data.apiKey).toBe('master-protected-key');
      
      credentialManager.destroy();
    });

    it('should reject weak master passwords', async () => {
      await expect(
        credentialManager.setMasterPassword('weak')
      ).rejects.toThrow('Master password is too weak');
    });

    it('should provide security status', () => {
      const status = credentialManager.getSecurityStatus();
      
      expect(status).toHaveProperty('encryptionInitialized');
      expect(status).toHaveProperty('masterPasswordSet');
      expect(status).toHaveProperty('credentialCount');
      expect(status).toHaveProperty('securityPolicy');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.recommendations)).toBe(true);
    });
  });

  describe('DataEncryption', () => {
    let dataEncryption: DataEncryption;
    
    beforeEach(() => {
      dataEncryption = new DataEncryption({
        dataPath: path.join(tempDir, 'encrypted')
      });
    });
    
    afterEach(() => {
      dataEncryption.destroy();
    });

    it('should encrypt and decrypt data', async () => {
      await dataEncryption.setUserKey('test-password-123');
      
      const testData = 'This is sensitive test data';
      const encrypted = await dataEncryption.encryptData(testData, 'user-data');
      
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.keyType).toBe('user-data');
      
      const decrypted = await dataEncryption.decryptData(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should encrypt and decrypt files', async () => {
      await dataEncryption.setUserKey('file-encryption-password');
      
      const testFilePath = path.join(tempDir, 'test-file.txt');
      const testContent = 'This is test file content for encryption';
      
      await fs.writeFile(testFilePath, testContent);
      
      const encryptedFilePath = await dataEncryption.encryptFile(testFilePath, 'user-data');
      expect(encryptedFilePath).toBe(`${testFilePath}.encrypted`);
      
      const decryptedFilePath = await dataEncryption.decryptFile(encryptedFilePath);
      const decryptedContent = await fs.readFile(decryptedFilePath, 'utf8');
      
      expect(decryptedContent).toBe(testContent);
    });

    it('should verify user key', async () => {
      const password = 'verification-test-password';
      await dataEncryption.setUserKey(password);
      
      const isValid = await dataEncryption.verifyUserKey(password);
      expect(isValid).toBe(true);
      
      const isInvalid = await dataEncryption.verifyUserKey('wrong-password');
      expect(isInvalid).toBe(false);
    });

    it('should change user key', async () => {
      const oldPassword = 'old-password-123';
      const newPassword = 'new-password-456';
      
      await dataEncryption.setUserKey(oldPassword);
      
      const testData = 'Data encrypted with old key';
      const encrypted = await dataEncryption.encryptData(testData, 'user-data');
      
      await dataEncryption.changeUserKey(oldPassword, newPassword);
      
      // Should still be able to decrypt with new key
      const decrypted = await dataEncryption.decryptData(encrypted);
      expect(decrypted).toBe(testData);
      
      // Old password should no longer work
      const oldKeyValid = await dataEncryption.verifyUserKey(oldPassword);
      expect(oldKeyValid).toBe(false);
      
      // New password should work
      const newKeyValid = await dataEncryption.verifyUserKey(newPassword);
      expect(newKeyValid).toBe(true);
    });

    it('should reject weak passwords', async () => {
      await expect(
        dataEncryption.setUserKey('weak')
      ).rejects.toThrow('Password is too weak');
    });

    it('should handle key hints', async () => {
      const password = 'password-with-hint';
      const hint = 'My favorite color and birth year';
      
      await dataEncryption.setUserKey(password, hint);
      
      const retrievedHint = await dataEncryption.getKeyHint();
      expect(retrievedHint).toBe(hint);
    });

    it('should provide encryption status', () => {
      const status = dataEncryption.getEncryptionStatus();
      
      expect(status).toHaveProperty('userKeySet');
      expect(status).toHaveProperty('systemKeySet');
      expect(status).toHaveProperty('derivedKeysGenerated');
      expect(status).toHaveProperty('encryptionConfig');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.recommendations)).toBe(true);
    });

    it('should export and import encrypted data', async () => {
      await dataEncryption.setUserKey('export-import-password');
      
      // Create some encrypted data
      const testData1 = 'Test data 1';
      const testData2 = 'Test data 2';
      
      await dataEncryption.encryptData(testData1, 'user-data');
      await dataEncryption.encryptData(testData2, 'cache-data');
      
      const exportPath = path.join(tempDir, 'export.json');
      await dataEncryption.exportEncryptedData(exportPath, ['user-data', 'cache-data']);
      
      // Verify export file exists
      const exportExists = await fs.access(exportPath).then(() => true).catch(() => false);
      expect(exportExists).toBe(true);
      
      // Import data
      const importedCount = await dataEncryption.importEncryptedData(exportPath);
      expect(importedCount).toBeGreaterThan(0);
    });
  });

  describe('PrivacyAuditLogger', () => {
    let auditLogger: PrivacyAuditLogger;
    
    beforeEach(() => {
      auditLogger = new PrivacyAuditLogger({
        logPath: path.join(tempDir, 'audit-logs'),
        encryptLogs: false // Disable encryption for easier testing
      });
    });
    
    afterEach(() => {
      auditLogger.destroy();
    });

    it('should log data access events', async () => {
      const accessEvent = {
        category: 'user-data',
        action: 'read',
        resource: '/api/users/123',
        userId: 'user-123',
        sessionId: 'session-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
        dataType: 'personal',
        dataSize: 1024,
        accessMethod: 'api',
        purpose: 'user_profile',
        retention: '30_days'
      };
      
      await auditLogger.logDataAccess(accessEvent);
      
      // Query logs to verify
      const logs = await auditLogger.queryLogs({
        types: ['data-access'],
        limit: 10
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('data-access');
      expect(logs[0].resource).toBe('/api/users/123');
      expect(logs[0].userId).toBe('user-123');
    });

    it('should log data transmission events', async () => {
      const transmissionEvent = {
        category: 'data-export',
        action: 'transmit',
        resource: '/api/export',
        userId: 'user-789',
        destination: 'https://external-api.com',
        protocol: 'https',
        encryption: 'tls',
        dataType: 'personal',
        dataSize: 2048,
        purpose: 'data_export',
        thirdParty: true
      };
      
      await auditLogger.logDataTransmission(transmissionEvent);
      
      const logs = await auditLogger.queryLogs({
        types: ['data-transmission'],
        limit: 10
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('data-transmission');
      expect(logs[0].details.thirdParty).toBe(true);
      expect(logs[0].details.encryption).toBe('tls');
    });

    it('should log consent events', async () => {
      const consentEvent = {
        action: 'granted',
        resource: 'data-processing-consent',
        userId: 'user-consent-123',
        consentType: 'data_processing',
        consentScope: ['analytics', 'marketing'],
        consentMethod: 'explicit',
        consentVersion: '1.0',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
      };
      
      await auditLogger.logConsent(consentEvent);
      
      const logs = await auditLogger.queryLogs({
        types: ['consent'],
        limit: 10
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('consent');
      expect(logs[0].action).toBe('granted');
      expect(logs[0].details.consentScope).toEqual(['analytics', 'marketing']);
    });

    it('should log privacy violations', async () => {
      const violationEvent = {
        action: 'unauthorized_access',
        resource: '/api/sensitive-data',
        userId: 'user-violation-456',
        violationType: 'unauthorized_access',
        severity: 'high' as const,
        description: 'Attempted access to sensitive data without proper authorization',
        affectedData: ['personal_info', 'financial_data'],
        potentialImpact: 'Data breach risk',
        mitigationActions: ['Access revoked', 'Security team notified']
      };
      
      await auditLogger.logPrivacyViolation(violationEvent);
      
      const logs = await auditLogger.queryLogs({
        types: ['privacy-violation'],
        limit: 10
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('privacy-violation');
      expect(logs[0].riskLevel).toBe('critical');
      expect(logs[0].details.severity).toBe('high');
    });

    it('should query logs with filters', async () => {
      // Log multiple events
      const events = [
        {
          category: 'user-data',
          action: 'read',
          resource: '/api/users/1',
          userId: 'user-1',
          dataType: 'personal',
          accessMethod: 'api'
        },
        {
          category: 'user-data',
          action: 'write',
          resource: '/api/users/2',
          userId: 'user-2',
          dataType: 'personal',
          accessMethod: 'api'
        },
        {
          category: 'system-data',
          action: 'read',
          resource: '/api/system/config',
          userId: 'admin-1',
          dataType: 'system',
          accessMethod: 'admin'
        }
      ];
      
      for (const event of events) {
        await auditLogger.logDataAccess(event);
      }
      
      // Query by user
      const userLogs = await auditLogger.queryLogs({
        userId: 'user-1',
        limit: 10
      });
      expect(userLogs).toHaveLength(1);
      expect(userLogs[0].userId).toBe('user-1');
      
      // Query by category
      const categoryLogs = await auditLogger.queryLogs({
        categories: ['user-data'],
        limit: 10
      });
      expect(categoryLogs).toHaveLength(2);
      
      // Query by resource
      const resourceLogs = await auditLogger.queryLogs({
        resource: '/api/users',
        limit: 10
      });
      expect(resourceLogs).toHaveLength(2);
    });

    it('should generate privacy reports', async () => {
      // Log some test events
      const testEvents = [
        {
          category: 'user-data',
          action: 'read',
          resource: '/api/users/report-test',
          userId: 'report-user-1',
          dataType: 'personal',
          accessMethod: 'api'
        },
        {
          action: 'granted',
          resource: 'consent-test',
          userId: 'report-user-1',
          consentType: 'data_processing',
          consentScope: ['analytics'],
          consentMethod: 'explicit',
          consentVersion: '1.0'
        }
      ];
      
      await auditLogger.logDataAccess(testEvents[0]);
      await auditLogger.logConsent(testEvents[1]);
      
      const report = await auditLogger.generatePrivacyReport({
        saveReport: false
      });
      
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('dataAccessAnalysis');
      expect(report).toHaveProperty('transmissionAnalysis');
      expect(report).toHaveProperty('consentAnalysis');
      expect(report).toHaveProperty('complianceStatus');
      expect(report).toHaveProperty('riskAssessment');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should export logs in different formats', async () => {
      // Log test event
      await auditLogger.logDataAccess({
        category: 'export-test',
        action: 'read',
        resource: '/api/export-test',
        userId: 'export-user',
        dataType: 'test',
        accessMethod: 'api'
      });
      
      // Test JSON export
      const jsonPath = await auditLogger.exportLogs({
        format: 'json',
        outputPath: path.join(tempDir, 'export.json')
      });
      
      const jsonExists = await fs.access(jsonPath).then(() => true).catch(() => false);
      expect(jsonExists).toBe(true);
      
      // Test CSV export
      const csvPath = await auditLogger.exportLogs({
        format: 'csv',
        outputPath: path.join(tempDir, 'export.csv')
      });
      
      const csvExists = await fs.access(csvPath).then(() => true).catch(() => false);
      expect(csvExists).toBe(true);
      
      // Test XML export
      const xmlPath = await auditLogger.exportLogs({
        format: 'xml',
        outputPath: path.join(tempDir, 'export.xml')
      });
      
      const xmlExists = await fs.access(xmlPath).then(() => true).catch(() => false);
      expect(xmlExists).toBe(true);
    });
  });

  describe('ConsentManager', () => {
    let consentManager: ConsentManager;
    
    beforeEach(() => {
      consentManager = new ConsentManager({
        storePath: path.join(tempDir, 'consent')
      });
    });
    
    afterEach(() => {
      consentManager.destroy();
    });

    it('should register consent policies', async () => {
      const policy = {
        id: 'data-processing',
        name: 'Data Processing Consent',
        version: '1.0',
        description: 'Consent for processing user data for analytics and improvements',
        purposes: ['analytics', 'service_improvement'],
        dataTypes: ['usage_data', 'performance_data'],
        legalBasis: 'consent',
        defaultScope: ['analytics'],
        expirationPeriod: 365 * 24 * 60 * 60 * 1000 // 1 year
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      // Verify policy was registered by requesting consent
      const consentResponse = await consentManager.requestConsent({
        userId: 'test-user',
        policyId: 'data-processing'
      });
      
      expect(consentResponse).toHaveProperty('consentId');
      expect(consentResponse.granted).toBe(false); // Not yet granted
      expect(consentResponse.pendingUserResponse).toBe(true);
    });

    it('should handle consent requests and responses', async () => {
      // Register policy first
      const policy = {
        id: 'marketing-consent',
        name: 'Marketing Consent',
        version: '1.0',
        description: 'Consent for marketing communications',
        purposes: ['marketing'],
        dataTypes: ['contact_info'],
        legalBasis: 'consent',
        defaultScope: ['email_marketing']
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      // Request consent
      const consentResponse = await consentManager.requestConsent({
        userId: 'marketing-user',
        policyId: 'marketing-consent',
        scope: ['email_marketing', 'sms_marketing']
      });
      
      expect(consentResponse.consentId).toBeDefined();
      
      // Grant consent
      await consentManager.recordConsentResponse({
        consentId: consentResponse.consentId,
        granted: true,
        method: 'explicit'
      });
      
      // Verify consent is valid
      const hasConsent = await consentManager.hasValidConsent(
        'marketing-user',
        'marketing-consent'
      );
      expect(hasConsent).toBe(true);
    });

    it('should revoke consent', async () => {
      // Setup consent
      const policy = {
        id: 'revoke-test',
        name: 'Revoke Test Policy',
        version: '1.0',
        description: 'Policy for testing consent revocation',
        purposes: ['testing'],
        dataTypes: ['test_data'],
        legalBasis: 'consent',
        defaultScope: ['test']
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      const consentResponse = await consentManager.requestConsent({
        userId: 'revoke-user',
        policyId: 'revoke-test'
      });
      
      await consentManager.recordConsentResponse({
        consentId: consentResponse.consentId,
        granted: true
      });
      
      // Verify consent exists
      let hasConsent = await consentManager.hasValidConsent('revoke-user', 'revoke-test');
      expect(hasConsent).toBe(true);
      
      // Revoke consent
      await consentManager.revokeConsent('revoke-user', 'revoke-test', 'user_request');
      
      // Verify consent is revoked
      hasConsent = await consentManager.hasValidConsent('revoke-user', 'revoke-test');
      expect(hasConsent).toBe(false);
    });

    it('should check consent scope', async () => {
      const policy = {
        id: 'scope-test',
        name: 'Scope Test Policy',
        version: '1.0',
        description: 'Policy for testing consent scope',
        purposes: ['analytics', 'marketing'],
        dataTypes: ['usage_data', 'contact_info'],
        legalBasis: 'consent',
        defaultScope: ['analytics']
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      const consentResponse = await consentManager.requestConsent({
        userId: 'scope-user',
        policyId: 'scope-test',
        scope: ['analytics'] // Only analytics, not marketing
      });
      
      await consentManager.recordConsentResponse({
        consentId: consentResponse.consentId,
        granted: true
      });
      
      // Should have consent for analytics
      const hasAnalyticsConsent = await consentManager.hasValidConsent(
        'scope-user',
        'scope-test',
        ['analytics']
      );
      expect(hasAnalyticsConsent).toBe(true);
      
      // Should not have consent for marketing
      const hasMarketingConsent = await consentManager.hasValidConsent(
        'scope-user',
        'scope-test',
        ['marketing']
      );
      expect(hasMarketingConsent).toBe(false);
    });

    it('should generate consent reports', async () => {
      // Setup test data
      const policy = {
        id: 'report-test',
        name: 'Report Test Policy',
        version: '1.0',
        description: 'Policy for testing consent reports',
        purposes: ['testing'],
        dataTypes: ['test_data'],
        legalBasis: 'consent',
        defaultScope: ['test']
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      // Create multiple consent records
      const users = ['report-user-1', 'report-user-2', 'report-user-3'];
      
      for (const userId of users) {
        const consentResponse = await consentManager.requestConsent({
          userId,
          policyId: 'report-test'
        });
        
        await consentManager.recordConsentResponse({
          consentId: consentResponse.consentId,
          granted: true
        });
      }
      
      const report = await consentManager.generateConsentReport({
        saveReport: false
      });
      
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('summary');
      expect(report.summary.totalConsents).toBeGreaterThanOrEqual(3);
      expect(report.summary.grantedConsents).toBeGreaterThanOrEqual(3);
      expect(report).toHaveProperty('byPolicy');
      expect(report).toHaveProperty('byUser');
      expect(report).toHaveProperty('complianceMetrics');
    });

    it('should export consent data', async () => {
      // Setup test consent
      const policy = {
        id: 'export-test',
        name: 'Export Test Policy',
        version: '1.0',
        description: 'Policy for testing consent export',
        purposes: ['testing'],
        dataTypes: ['test_data'],
        legalBasis: 'consent',
        defaultScope: ['test']
      };
      
      await consentManager.registerConsentPolicy(policy);
      
      const consentResponse = await consentManager.requestConsent({
        userId: 'export-user',
        policyId: 'export-test'
      });
      
      await consentManager.recordConsentResponse({
        consentId: consentResponse.consentId,
        granted: true
      });
      
      // Test JSON export
      const jsonPath = await consentManager.exportConsentData({
        format: 'json',
        outputPath: path.join(tempDir, 'consent-export.json')
      });
      
      const jsonExists = await fs.access(jsonPath).then(() => true).catch(() => false);
      expect(jsonExists).toBe(true);
      
      // Test CSV export
      const csvPath = await consentManager.exportConsentData({
        format: 'csv',
        outputPath: path.join(tempDir, 'consent-export.csv')
      });
      
      const csvExists = await fs.access(csvPath).then(() => true).catch(() => false);
      expect(csvExists).toBe(true);
    });
  });

  describe('PluginSandbox', () => {
    let pluginSandbox: PluginSandbox;
    
    beforeEach(() => {
      pluginSandbox = new PluginSandbox({
        maxMemory: 64 * 1024 * 1024, // 64MB for testing
        maxCpuTime: 1000, // 1 second
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        auditPath: path.join(tempDir, 'sandbox-audit')
      });
    });
    
    afterEach(async () => {
      await pluginSandbox.destroy();
    });

    it('should create and execute code in sandbox', async () => {
      const sandboxId = await pluginSandbox.createSandbox('test-plugin', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      expect(sandboxId).toBeDefined();
      
      const result = await pluginSandbox.executeInSandbox(
        'test-plugin',
        'const x = 5; const y = 10; x + y;'
      );
      
      expect(result).toBe(15);
    });

    it('should enforce resource limits', async () => {
      await pluginSandbox.createSandbox('resource-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      // Test CPU timeout
      await expect(
        pluginSandbox.executeInSandbox(
          'resource-test',
          'while(true) { /* infinite loop */ }'
        )
      ).rejects.toThrow();
    });

    it('should block dangerous operations', async () => {
      await pluginSandbox.createSandbox('security-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      // Test blocked require
      await expect(
        pluginSandbox.executeInSandbox(
          'security-test',
          'require("fs").readFileSync("/etc/passwd")'
        )
      ).rejects.toThrow();
    });

    it('should manage permissions', async () => {
      await pluginSandbox.createSandbox('permission-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      // Grant network permission
      await pluginSandbox.grantPermission('permission-test', {
        name: 'network',
        scope: ['https://api.example.com']
      });
      
      const permissions = await pluginSandbox.getPluginPermissions('permission-test');
      expect(permissions).toHaveLength(1);
      expect(permissions[0].name).toBe('network');
      
      // Revoke permission
      await pluginSandbox.revokePermission('permission-test', 'network');
      
      const updatedPermissions = await pluginSandbox.getPluginPermissions('permission-test');
      expect(updatedPermissions).toHaveLength(0);
    });

    it('should provide sandbox status', async () => {
      await pluginSandbox.createSandbox('status-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      const status = pluginSandbox.getSandboxStatus('status-test');
      
      expect(status).toBeDefined();
      expect(status!.pluginId).toBe('status-test');
      expect(status!.state).toBe('ready');
      expect(status!).toHaveProperty('uptime');
      expect(status!).toHaveProperty('resourceUsage');
      expect(status!).toHaveProperty('permissions');
    });

    it('should pause and resume sandbox', async () => {
      await pluginSandbox.createSandbox('pause-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      await pluginSandbox.pauseSandbox('pause-test');
      
      let status = pluginSandbox.getSandboxStatus('pause-test');
      expect(status!.state).toBe('paused');
      
      await pluginSandbox.resumeSandbox('pause-test');
      
      status = pluginSandbox.getSandboxStatus('pause-test');
      expect(status!.state).toBe('ready');
    });

    it('should terminate sandbox', async () => {
      await pluginSandbox.createSandbox('terminate-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      let status = pluginSandbox.getSandboxStatus('terminate-test');
      expect(status).toBeDefined();
      
      await pluginSandbox.terminateSandbox('terminate-test');
      
      status = pluginSandbox.getSandboxStatus('terminate-test');
      expect(status).toBeNull();
    });

    it('should generate security reports', async () => {
      await pluginSandbox.createSandbox('report-test', {
        permissions: [{ name: 'network' }],
        isolationLevel: 'vm'
      });
      
      // Execute some code to generate audit events
      await pluginSandbox.executeInSandbox('report-test', '1 + 1');
      
      const report = await pluginSandbox.generateSecurityReport();
      
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('sandboxStatuses');
      expect(report).toHaveProperty('recentEvents');
      expect(report).toHaveProperty('riskAssessment');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.summary.totalSandboxes).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should load plugin files', async () => {
      await pluginSandbox.createSandbox('file-test', {
        permissions: [],
        isolationLevel: 'vm'
      });
      
      // Create test plugin file
      const pluginPath = path.join(tempDir, 'test-plugin.js');
      const pluginCode = `
        function greet(name) {
          return 'Hello, ' + name + '!';
        }
        
        exports.greet = greet;
      `;
      
      await fs.writeFile(pluginPath, pluginCode);
      
      await pluginSandbox.loadPlugin('file-test', pluginPath);
      
      const result = await pluginSandbox.callPluginMethod('file-test', 'greet', ['World']);
      expect(result).toBe('Hello, World!');
    });
  });

  describe('Security Integration', () => {
    it('should integrate all security components', async () => {
      // Initialize all components
      const credentialManager = new CredentialManager({
        serviceName: 'integration-test'
      });
      
      const dataEncryption = new DataEncryption({
        dataPath: path.join(tempDir, 'integration-encrypted')
      });
      
      const auditLogger = new PrivacyAuditLogger({
        logPath: path.join(tempDir, 'integration-audit'),
        encryptLogs: false
      });
      
      const consentManager = new ConsentManager({
        storePath: path.join(tempDir, 'integration-consent')
      });
      
      try {
        // Test credential storage with encryption
        await dataEncryption.setUserKey('integration-password');
        
        const credential = {
          type: 'api-key' as const,
          data: { apiKey: 'integration-test-key' }
        };
        
        await credentialManager.storeCredential('integration-provider', credential);
        
        // Log the credential access
        await auditLogger.logDataAccess({
          category: 'credentials',
          action: 'store',
          resource: 'integration-provider',
          userId: 'integration-user',
          dataType: 'credentials',
          accessMethod: 'api'
        });
        
        // Register consent policy
        const policy = {
          id: 'integration-policy',
          name: 'Integration Test Policy',
          version: '1.0',
          description: 'Policy for integration testing',
          purposes: ['testing'],
          dataTypes: ['test_data'],
          legalBasis: 'consent',
          defaultScope: ['test']
        };
        
        await consentManager.registerConsentPolicy(policy);
        
        // Request and grant consent
        const consentResponse = await consentManager.requestConsent({
          userId: 'integration-user',
          policyId: 'integration-policy'
        });
        
        await consentManager.recordConsentResponse({
          consentId: consentResponse.consentId,
          granted: true
        });
        
        // Log consent event
        await auditLogger.logConsent({
          action: 'granted',
          resource: 'integration-policy',
          userId: 'integration-user',
          consentType: 'data_processing',
          consentScope: ['test'],
          consentMethod: 'explicit',
          consentVersion: '1.0'
        });
        
        // Verify everything works together
        const retrievedCredential = await credentialManager.getCredential('integration-provider');
        expect(retrievedCredential).toBeDefined();
        
        const hasConsent = await consentManager.hasValidConsent('integration-user', 'integration-policy');
        expect(hasConsent).toBe(true);
        
        const auditLogs = await auditLogger.queryLogs({ limit: 10 });
        expect(auditLogs.length).toBeGreaterThan(0);
        
        // Generate comprehensive security report
        const privacyReport = await auditLogger.generatePrivacyReport();
        const consentReport = await consentManager.generateConsentReport();
        
        expect(privacyReport.summary.totalEvents).toBeGreaterThan(0);
        expect(consentReport.summary.totalConsents).toBeGreaterThan(0);
        
      } finally {
        // Cleanup
        credentialManager.destroy();
        dataEncryption.destroy();
        auditLogger.destroy();
        consentManager.destroy();
      }
    });
  });
});