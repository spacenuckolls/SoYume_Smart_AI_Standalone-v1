import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * User consent management for cloud feature usage
 * Provides comprehensive consent tracking and management for privacy compliance
 */
export class ConsentManager extends EventEmitter {
  private consentStorePath: string;
  private consentCache: Map<string, ConsentRecord>;
  private consentPolicies: Map<string, ConsentPolicy>;
  private defaultRetentionPeriod: number;
  private encryptionKey: Buffer | null;

  constructor(options: ConsentManagerOptions = {}) {
    super();
    
    this.consentStorePath = options.storePath || path.join(process.cwd(), 'data', 'consent');
    this.consentCache = new Map();
    this.consentPolicies = new Map();
    this.defaultRetentionPeriod = options.defaultRetentionPeriod || 365 * 24 * 60 * 60 * 1000; // 1 year
    this.encryptionKey = null;
    
    this.initialize();
  }

  /**
   * Initialize consent manager
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure consent directory exists
      await fs.mkdir(this.consentStorePath, { recursive: true });
      
      // Initialize encryption
      await this.initializeEncryption();
      
      // Load existing consent records
      await this.loadConsentRecords();
      
      // Load consent policies
      await this.loadConsentPolicies();
      
      // Set up cleanup interval
      this.startCleanupInterval();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize consent manager: ${(error as Error).message}`);
    }
  }

  /**
   * Register a consent policy
   */
  async registerConsentPolicy(policy: ConsentPolicy): Promise<void> {
    // Validate policy
    this.validateConsentPolicy(policy);
    
    this.consentPolicies.set(policy.id, policy);
    
    // Save policy to disk
    await this.saveConsentPolicy(policy);
    
    this.emit('policyRegistered', policy);
  }

  /**
   * Request user consent
   */
  async requestConsent(request: ConsentRequest): Promise<ConsentResponse> {
    const policy = this.consentPolicies.get(request.policyId);
    if (!policy) {
      throw new Error(`Consent policy not found: ${request.policyId}`);
    }
    
    // Check if consent already exists and is valid
    const existingConsent = await this.getConsent(request.userId, request.policyId);
    if (existingConsent && this.isConsentValid(existingConsent)) {
      return {
        consentId: existingConsent.id,
        granted: existingConsent.granted,
        timestamp: existingConsent.timestamp,
        expiresAt: existingConsent.expiresAt,
        scope: existingConsent.scope,
        cached: true
      };
    }
    
    // Create consent request record
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId: request.userId,
      policyId: request.policyId,
      policyVersion: policy.version,
      granted: false, // Will be updated when user responds
      timestamp: Date.now(),
      expiresAt: this.calculateExpirationTime(policy),
      scope: request.scope || policy.defaultScope,
      method: request.method || 'ui',
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      metadata: request.metadata || {},
      revoked: false,
      revokedAt: null,
      renewalRequired: false
    };
    
    // Store pending consent
    await this.storeConsentRecord(consentRecord);
    
    this.emit('consentRequested', {
      consentId: consentRecord.id,
      userId: request.userId,
      policyId: request.policyId,
      policy
    });
    
    return {
      consentId: consentRecord.id,
      granted: false,
      timestamp: consentRecord.timestamp,
      expiresAt: consentRecord.expiresAt,
      scope: consentRecord.scope,
      cached: false,
      pendingUserResponse: true
    };
  }

  /**
   * Record user consent response
   */
  async recordConsentResponse(response: UserConsentResponse): Promise<void> {
    const consentRecord = await this.getConsentById(response.consentId);
    if (!consentRecord) {
      throw new Error(`Consent record not found: ${response.consentId}`);
    }
    
    // Update consent record
    consentRecord.granted = response.granted;
    consentRecord.timestamp = Date.now();
    consentRecord.method = response.method || consentRecord.method;
    consentRecord.scope = response.scope || consentRecord.scope;
    consentRecord.metadata = { ...consentRecord.metadata, ...response.metadata };
    
    // Store updated record
    await this.storeConsentRecord(consentRecord);
    
    this.emit('consentRecorded', {
      consentId: response.consentId,
      userId: consentRecord.userId,
      policyId: consentRecord.policyId,
      granted: response.granted,
      scope: consentRecord.scope
    });
    
    // If consent was granted, check for dependent consents
    if (response.granted) {
      await this.processDependentConsents(consentRecord);
    }
  }

  /**
   * Revoke user consent
   */
  async revokeConsent(userId: string, policyId: string, reason?: string): Promise<void> {
    const consentRecord = await this.getConsent(userId, policyId);
    if (!consentRecord) {
      throw new Error(`No consent found for user ${userId} and policy ${policyId}`);
    }
    
    if (consentRecord.revoked) {
      throw new Error('Consent is already revoked');
    }
    
    // Update consent record
    consentRecord.revoked = true;
    consentRecord.revokedAt = Date.now();
    consentRecord.metadata.revocationReason = reason;
    
    // Store updated record
    await this.storeConsentRecord(consentRecord);
    
    this.emit('consentRevoked', {
      consentId: consentRecord.id,
      userId,
      policyId,
      reason,
      timestamp: consentRecord.revokedAt
    });
    
    // Process cascading revocations
    await this.processCascadingRevocations(consentRecord);
  }

  /**
   * Check if user has valid consent
   */
  async hasValidConsent(userId: string, policyId: string, requiredScope?: string[]): Promise<boolean> {
    const consent = await this.getConsent(userId, policyId);
    
    if (!consent || !consent.granted || consent.revoked) {
      return false;
    }
    
    // Check if consent is still valid (not expired)
    if (!this.isConsentValid(consent)) {
      return false;
    }
    
    // Check scope if required
    if (requiredScope && !this.hasSufficientScope(consent, requiredScope)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get user consent record
   */
  async getConsent(userId: string, policyId: string): Promise<ConsentRecord | null> {
    const cacheKey = `${userId}:${policyId}`;
    
    // Check cache first
    if (this.consentCache.has(cacheKey)) {
      return this.consentCache.get(cacheKey)!;
    }
    
    // Load from storage
    try {
      const consentPath = path.join(this.consentStorePath, userId, `${policyId}.json`);
      const consentData = await fs.readFile(consentPath, 'utf8');
      
      let consentRecord: ConsentRecord;
      if (this.encryptionKey) {
        const decryptedData = await this.decryptData(consentData);
        consentRecord = JSON.parse(decryptedData);
      } else {
        consentRecord = JSON.parse(consentData);
      }
      
      // Cache the record
      this.consentCache.set(cacheKey, consentRecord);
      
      return consentRecord;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get consent record by ID
   */
  async getConsentById(consentId: string): Promise<ConsentRecord | null> {
    // Search through cache first
    for (const [, record] of this.consentCache) {
      if (record.id === consentId) {
        return record;
      }
    }
    
    // Search through storage
    try {
      const userDirs = await fs.readdir(this.consentStorePath);
      
      for (const userDir of userDirs) {
        const userPath = path.join(this.consentStorePath, userDir);
        const stat = await fs.stat(userPath);
        
        if (!stat.isDirectory()) continue;
        
        const consentFiles = await fs.readdir(userPath);
        
        for (const file of consentFiles) {
          if (!file.endsWith('.json')) continue;
          
          const filePath = path.join(userPath, file);
          const consentData = await fs.readFile(filePath, 'utf8');
          
          let consentRecord: ConsentRecord;
          if (this.encryptionKey) {
            const decryptedData = await this.decryptData(consentData);
            consentRecord = JSON.parse(decryptedData);
          } else {
            consentRecord = JSON.parse(consentData);
          }
          
          if (consentRecord.id === consentId) {
            return consentRecord;
          }
        }
      }
    } catch (error) {
      // Continue searching
    }
    
    return null;
  }

  /**
   * Get all consents for a user
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const consents: ConsentRecord[] = [];
    
    try {
      const userPath = path.join(this.consentStorePath, userId);
      const consentFiles = await fs.readdir(userPath);
      
      for (const file of consentFiles) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(userPath, file);
        const consentData = await fs.readFile(filePath, 'utf8');
        
        let consentRecord: ConsentRecord;
        if (this.encryptionKey) {
          const decryptedData = await this.decryptData(consentData);
          consentRecord = JSON.parse(decryptedData);
        } else {
          consentRecord = JSON.parse(consentData);
        }
        
        consents.push(consentRecord);
      }
    } catch (error) {
      // User has no consents
    }
    
    return consents.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Renew consent
   */
  async renewConsent(userId: string, policyId: string): Promise<ConsentResponse> {
    const existingConsent = await this.getConsent(userId, policyId);
    if (!existingConsent) {
      throw new Error(`No existing consent found for user ${userId} and policy ${policyId}`);
    }
    
    const policy = this.consentPolicies.get(policyId);
    if (!policy) {
      throw new Error(`Consent policy not found: ${policyId}`);
    }
    
    // Create renewal request
    const renewalRequest: ConsentRequest = {
      userId,
      policyId,
      scope: existingConsent.scope,
      method: 'renewal',
      metadata: {
        originalConsentId: existingConsent.id,
        renewalReason: 'expiration'
      }
    };
    
    return await this.requestConsent(renewalRequest);
  }

  /**
   * Bulk consent operations
   */
  async bulkConsentOperation(operation: BulkConsentOperation): Promise<BulkConsentResult> {
    const results: BulkConsentResult = {
      successful: [],
      failed: [],
      totalProcessed: operation.items.length
    };
    
    for (const item of operation.items) {
      try {
        switch (operation.type) {
          case 'grant':
            await this.recordConsentResponse({
              consentId: item.consentId!,
              granted: true,
              method: 'bulk',
              metadata: { bulkOperationId: operation.id }
            });
            results.successful.push(item);
            break;
            
          case 'revoke':
            await this.revokeConsent(item.userId, item.policyId, 'bulk_revocation');
            results.successful.push(item);
            break;
            
          case 'renew':
            await this.renewConsent(item.userId, item.policyId);
            results.successful.push(item);
            break;
            
          default:
            throw new Error(`Unsupported bulk operation: ${operation.type}`);
        }
      } catch (error) {
        results.failed.push({
          item,
          error: (error as Error).message
        });
      }
    }
    
    this.emit('bulkOperationCompleted', results);
    return results;
  }

  /**
   * Generate consent report
   */
  async generateConsentReport(options: ConsentReportOptions = {}): Promise<ConsentReport> {
    const startTime = options.startDate || Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endTime = options.endDate || Date.now();
    
    const allConsents = await this.getAllConsents();
    const filteredConsents = allConsents.filter(consent => 
      consent.timestamp >= startTime && consent.timestamp <= endTime
    );
    
    const report: ConsentReport = {
      reportId: crypto.randomUUID(),
      generatedAt: Date.now(),
      period: { start: startTime, end: endTime },
      summary: {
        totalConsents: filteredConsents.length,
        grantedConsents: filteredConsents.filter(c => c.granted).length,
        revokedConsents: filteredConsents.filter(c => c.revoked).length,
        expiredConsents: filteredConsents.filter(c => this.isConsentExpired(c)).length,
        activeConsents: filteredConsents.filter(c => this.isConsentValid(c)).length
      },
      byPolicy: this.analyzeConsentsByPolicy(filteredConsents),
      byUser: this.analyzeConsentsByUser(filteredConsents),
      complianceMetrics: this.calculateComplianceMetrics(filteredConsents),
      trends: this.analyzeTrends(filteredConsents),
      recommendations: this.generateConsentRecommendations(filteredConsents)
    };
    
    // Save report if requested
    if (options.saveReport) {
      const reportPath = path.join(this.consentStorePath, 'reports', `consent-report-${report.reportId}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }
    
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Export consent data
   */
  async exportConsentData(options: ConsentExportOptions): Promise<string> {
    const consents = await this.getAllConsents();
    const filteredConsents = this.filterConsentsForExport(consents, options);
    
    let exportData: string;
    
    switch (options.format) {
      case 'json':
        exportData = JSON.stringify(filteredConsents, null, 2);
        break;
      case 'csv':
        exportData = this.convertConsentsToCSV(filteredConsents);
        break;
      case 'xml':
        exportData = this.convertConsentsToXML(filteredConsents);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
    
    const exportPath = options.outputPath || path.join(
      this.consentStorePath,
      'exports',
      `consent-export-${Date.now()}.${options.format}`
    );
    
    await fs.mkdir(path.dirname(exportPath), { recursive: true });
    await fs.writeFile(exportPath, exportData);
    
    this.emit('dataExported', { path: exportPath, count: filteredConsents.length });
    return exportPath;
  }

  /**
   * Validate consent policy
   */
  private validateConsentPolicy(policy: ConsentPolicy): void {
    if (!policy.id || !policy.name || !policy.version) {
      throw new Error('Policy must have id, name, and version');
    }
    
    if (!policy.description || policy.description.length < 10) {
      throw new Error('Policy must have a meaningful description');
    }
    
    if (!policy.purposes || policy.purposes.length === 0) {
      throw new Error('Policy must specify at least one purpose');
    }
    
    if (!policy.dataTypes || policy.dataTypes.length === 0) {
      throw new Error('Policy must specify data types');
    }
    
    if (!policy.legalBasis) {
      throw new Error('Policy must specify legal basis');
    }
  }

  /**
   * Calculate expiration time based on policy
   */
  private calculateExpirationTime(policy: ConsentPolicy): number | null {
    if (!policy.expirationPeriod) {
      return null; // No expiration
    }
    
    return Date.now() + policy.expirationPeriod;
  }

  /**
   * Check if consent is valid (not expired or revoked)
   */
  private isConsentValid(consent: ConsentRecord): boolean {
    if (!consent.granted || consent.revoked) {
      return false;
    }
    
    if (consent.expiresAt && Date.now() > consent.expiresAt) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if consent is expired
   */
  private isConsentExpired(consent: ConsentRecord): boolean {
    return consent.expiresAt !== null && Date.now() > consent.expiresAt;
  }

  /**
   * Check if consent has sufficient scope
   */
  private hasSufficientScope(consent: ConsentRecord, requiredScope: string[]): boolean {
    return requiredScope.every(scope => consent.scope.includes(scope));
  }

  /**
   * Store consent record
   */
  private async storeConsentRecord(record: ConsentRecord): Promise<void> {
    const userPath = path.join(this.consentStorePath, record.userId);
    await fs.mkdir(userPath, { recursive: true });
    
    const filePath = path.join(userPath, `${record.policyId}.json`);
    
    let data = JSON.stringify(record, null, 2);
    if (this.encryptionKey) {
      data = await this.encryptData(data);
    }
    
    await fs.writeFile(filePath, data);
    
    // Update cache
    const cacheKey = `${record.userId}:${record.policyId}`;
    this.consentCache.set(cacheKey, record);
  }

  /**
   * Load existing consent records
   */
  private async loadConsentRecords(): Promise<void> {
    try {
      const userDirs = await fs.readdir(this.consentStorePath);
      
      for (const userDir of userDirs) {
        const userPath = path.join(this.consentStorePath, userDir);
        const stat = await fs.stat(userPath);
        
        if (!stat.isDirectory()) continue;
        
        try {
          const consentFiles = await fs.readdir(userPath);
          
          for (const file of consentFiles) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(userPath, file);
            const consentData = await fs.readFile(filePath, 'utf8');
            
            let consentRecord: ConsentRecord;
            if (this.encryptionKey) {
              const decryptedData = await this.decryptData(consentData);
              consentRecord = JSON.parse(decryptedData);
            } else {
              consentRecord = JSON.parse(consentData);
            }
            
            const cacheKey = `${consentRecord.userId}:${consentRecord.policyId}`;
            this.consentCache.set(cacheKey, consentRecord);
          }
        } catch (error) {
          // Skip invalid user directories
          continue;
        }
      }
    } catch (error) {
      // No existing consent records
    }
  }

  /**
   * Load consent policies
   */
  private async loadConsentPolicies(): Promise<void> {
    try {
      const policiesPath = path.join(this.consentStorePath, 'policies');
      const policyFiles = await fs.readdir(policiesPath);
      
      for (const file of policyFiles) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(policiesPath, file);
        const policyData = await fs.readFile(filePath, 'utf8');
        const policy: ConsentPolicy = JSON.parse(policyData);
        
        this.consentPolicies.set(policy.id, policy);
      }
    } catch (error) {
      // No existing policies
    }
  }

  /**
   * Save consent policy
   */
  private async saveConsentPolicy(policy: ConsentPolicy): Promise<void> {
    const policiesPath = path.join(this.consentStorePath, 'policies');
    await fs.mkdir(policiesPath, { recursive: true });
    
    const filePath = path.join(policiesPath, `${policy.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(policy, null, 2));
  }

  /**
   * Process dependent consents
   */
  private async processDependentConsents(consent: ConsentRecord): Promise<void> {
    const policy = this.consentPolicies.get(consent.policyId);
    if (!policy || !policy.dependencies) {
      return;
    }
    
    // Check if dependent consents need to be requested
    for (const dependencyId of policy.dependencies) {
      const existingConsent = await this.getConsent(consent.userId, dependencyId);
      
      if (!existingConsent || !this.isConsentValid(existingConsent)) {
        // Request dependent consent
        await this.requestConsent({
          userId: consent.userId,
          policyId: dependencyId,
          method: 'dependency',
          metadata: {
            parentConsentId: consent.id,
            dependencyReason: 'required_for_service'
          }
        });
      }
    }
  }

  /**
   * Process cascading revocations
   */
  private async processCascadingRevocations(revokedConsent: ConsentRecord): Promise<void> {
    // Find policies that depend on the revoked consent
    for (const [policyId, policy] of this.consentPolicies) {
      if (policy.dependencies && policy.dependencies.includes(revokedConsent.policyId)) {
        const dependentConsent = await this.getConsent(revokedConsent.userId, policyId);
        
        if (dependentConsent && !dependentConsent.revoked) {
          await this.revokeConsent(
            revokedConsent.userId,
            policyId,
            `Cascading revocation due to ${revokedConsent.policyId} revocation`
          );
        }
      }
    }
  }

  /**
   * Get all consent records
   */
  private async getAllConsents(): Promise<ConsentRecord[]> {
    const allConsents: ConsentRecord[] = [];
    
    try {
      const userDirs = await fs.readdir(this.consentStorePath);
      
      for (const userDir of userDirs) {
        const userConsents = await this.getUserConsents(userDir);
        allConsents.push(...userConsents);
      }
    } catch (error) {
      // No consents found
    }
    
    return allConsents;
  }

  /**
   * Analyze consents by policy
   */
  private analyzeConsentsByPolicy(consents: ConsentRecord[]): Record<string, PolicyAnalysis> {
    const analysis: Record<string, PolicyAnalysis> = {};
    
    for (const consent of consents) {
      if (!analysis[consent.policyId]) {
        analysis[consent.policyId] = {
          total: 0,
          granted: 0,
          revoked: 0,
          expired: 0,
          active: 0
        };
      }
      
      const stats = analysis[consent.policyId];
      stats.total++;
      
      if (consent.granted) stats.granted++;
      if (consent.revoked) stats.revoked++;
      if (this.isConsentExpired(consent)) stats.expired++;
      if (this.isConsentValid(consent)) stats.active++;
    }
    
    return analysis;
  }

  /**
   * Analyze consents by user
   */
  private analyzeConsentsByUser(consents: ConsentRecord[]): Record<string, UserAnalysis> {
    const analysis: Record<string, UserAnalysis> = {};
    
    for (const consent of consents) {
      if (!analysis[consent.userId]) {
        analysis[consent.userId] = {
          totalConsents: 0,
          activeConsents: 0,
          revokedConsents: 0,
          lastActivity: 0
        };
      }
      
      const stats = analysis[consent.userId];
      stats.totalConsents++;
      stats.lastActivity = Math.max(stats.lastActivity, consent.timestamp);
      
      if (this.isConsentValid(consent)) stats.activeConsents++;
      if (consent.revoked) stats.revokedConsents++;
    }
    
    return analysis;
  }

  /**
   * Calculate compliance metrics
   */
  private calculateComplianceMetrics(consents: ConsentRecord[]): ComplianceMetrics {
    const total = consents.length;
    const explicit = consents.filter(c => c.method === 'explicit').length;
    const documented = consents.filter(c => c.metadata && Object.keys(c.metadata).length > 0).length;
    const renewable = consents.filter(c => c.expiresAt !== null).length;
    
    return {
      explicitConsentRate: total > 0 ? explicit / total : 0,
      documentationRate: total > 0 ? documented / total : 0,
      renewabilityRate: total > 0 ? renewable / total : 0,
      averageConsentLifetime: this.calculateAverageLifetime(consents),
      complianceScore: this.calculateComplianceScore(consents)
    };
  }

  /**
   * Analyze trends
   */
  private analyzeTrends(consents: ConsentRecord[]): ConsentTrends {
    // Group by time periods
    const daily = this.groupConsentsByPeriod(consents, 'day');
    const weekly = this.groupConsentsByPeriod(consents, 'week');
    const monthly = this.groupConsentsByPeriod(consents, 'month');
    
    return {
      daily,
      weekly,
      monthly,
      growthRate: this.calculateGrowthRate(daily),
      revocationRate: this.calculateRevocationRate(consents)
    };
  }

  /**
   * Generate consent recommendations
   */
  private generateConsentRecommendations(consents: ConsentRecord[]): string[] {
    const recommendations: string[] = [];
    
    const expiredCount = consents.filter(c => this.isConsentExpired(c)).length;
    if (expiredCount > 0) {
      recommendations.push(`${expiredCount} consents have expired and may need renewal`);
    }
    
    const implicitCount = consents.filter(c => c.method !== 'explicit').length;
    if (implicitCount > consents.length * 0.1) {
      recommendations.push('Consider requiring explicit consent for better compliance');
    }
    
    const undocumentedCount = consents.filter(c => 
      !c.metadata || Object.keys(c.metadata).length === 0
    ).length;
    if (undocumentedCount > 0) {
      recommendations.push('Improve consent documentation for audit purposes');
    }
    
    return recommendations;
  }

  /**
   * Filter consents for export
   */
  private filterConsentsForExport(consents: ConsentRecord[], options: ConsentExportOptions): ConsentRecord[] {
    return consents.filter(consent => {
      if (options.startDate && consent.timestamp < options.startDate) return false;
      if (options.endDate && consent.timestamp > options.endDate) return false;
      if (options.userIds && !options.userIds.includes(consent.userId)) return false;
      if (options.policyIds && !options.policyIds.includes(consent.policyId)) return false;
      if (options.onlyActive && !this.isConsentValid(consent)) return false;
      
      return true;
    });
  }

  /**
   * Convert consents to CSV
   */
  private convertConsentsToCSV(consents: ConsentRecord[]): string {
    const headers = [
      'ID', 'User ID', 'Policy ID', 'Policy Version', 'Granted', 'Timestamp',
      'Expires At', 'Scope', 'Method', 'Revoked', 'Revoked At'
    ];
    
    const rows = consents.map(consent => [
      consent.id,
      consent.userId,
      consent.policyId,
      consent.policyVersion,
      consent.granted.toString(),
      new Date(consent.timestamp).toISOString(),
      consent.expiresAt ? new Date(consent.expiresAt).toISOString() : '',
      consent.scope.join(';'),
      consent.method,
      consent.revoked.toString(),
      consent.revokedAt ? new Date(consent.revokedAt).toISOString() : ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Convert consents to XML
   */
  private convertConsentsToXML(consents: ConsentRecord[]): string {
    const xmlEntries = consents.map(consent => `
    <consent>
      <id>${consent.id}</id>
      <userId>${consent.userId}</userId>
      <policyId>${consent.policyId}</policyId>
      <policyVersion>${consent.policyVersion}</policyVersion>
      <granted>${consent.granted}</granted>
      <timestamp>${new Date(consent.timestamp).toISOString()}</timestamp>
      <expiresAt>${consent.expiresAt ? new Date(consent.expiresAt).toISOString() : ''}</expiresAt>
      <scope>${consent.scope.join(',')}</scope>
      <method>${consent.method}</method>
      <revoked>${consent.revoked}</revoked>
      <revokedAt>${consent.revokedAt ? new Date(consent.revokedAt).toISOString() : ''}</revokedAt>
    </consent>`).join('');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<consents>
  <metadata>
    <exportDate>${new Date().toISOString()}</exportDate>
    <consentCount>${consents.length}</consentCount>
  </metadata>
  <records>${xmlEntries}
  </records>
</consents>`;
  }

  /**
   * Calculate average consent lifetime
   */
  private calculateAverageLifetime(consents: ConsentRecord[]): number {
    const lifetimes = consents
      .filter(c => c.revokedAt || c.expiresAt)
      .map(c => {
        const endTime = c.revokedAt || c.expiresAt || Date.now();
        return endTime - c.timestamp;
      });
    
    return lifetimes.length > 0 
      ? lifetimes.reduce((sum, lifetime) => sum + lifetime, 0) / lifetimes.length
      : 0;
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(consents: ConsentRecord[]): number {
    if (consents.length === 0) return 100;
    
    let score = 100;
    
    // Deduct for implicit consents
    const implicitCount = consents.filter(c => c.method !== 'explicit').length;
    score -= (implicitCount / consents.length) * 20;
    
    // Deduct for undocumented consents
    const undocumentedCount = consents.filter(c => 
      !c.metadata || Object.keys(c.metadata).length === 0
    ).length;
    score -= (undocumentedCount / consents.length) * 15;
    
    // Deduct for expired consents
    const expiredCount = consents.filter(c => this.isConsentExpired(c)).length;
    score -= (expiredCount / consents.length) * 10;
    
    return Math.max(0, score);
  }

  /**
   * Group consents by time period
   */
  private groupConsentsByPeriod(consents: ConsentRecord[], period: 'day' | 'week' | 'month'): Record<string, number> {
    const groups: Record<string, number> = {};
    
    consents.forEach(consent => {
      const date = new Date(consent.timestamp);
      let key: string;
      
      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      
      groups[key] = (groups[key] || 0) + 1;
    });
    
    return groups;
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(dailyData: Record<string, number>): number {
    const dates = Object.keys(dailyData).sort();
    if (dates.length < 2) return 0;
    
    const firstWeek = dates.slice(0, 7).reduce((sum, date) => sum + dailyData[date], 0);
    const lastWeek = dates.slice(-7).reduce((sum, date) => sum + dailyData[date], 0);
    
    return firstWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0;
  }

  /**
   * Calculate revocation rate
   */
  private calculateRevocationRate(consents: ConsentRecord[]): number {
    const total = consents.length;
    const revoked = consents.filter(c => c.revoked).length;
    
    return total > 0 ? (revoked / total) * 100 : 0;
  }

  /**
   * Initialize encryption
   */
  private async initializeEncryption(): Promise<void> {
    const keyPath = path.join(this.consentStorePath, '.consent-key');
    
    try {
      const keyData = await fs.readFile(keyPath);
      this.encryptionKey = keyData;
    } catch (error) {
      // Generate new encryption key
      this.encryptionKey = crypto.randomBytes(32);
      await fs.writeFile(keyPath, this.encryptionKey);
    }
  }

  /**
   * Encrypt data
   */
  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt data
   */
  private async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }
    
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Start cleanup interval for expired consents
   */
  private startCleanupInterval(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredConsents();
      } catch (error) {
        this.emit('error', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Cleanup expired consents
   */
  private async cleanupExpiredConsents(): Promise<void> {
    const allConsents = await this.getAllConsents();
    const expiredConsents = allConsents.filter(c => this.isConsentExpired(c));
    
    for (const consent of expiredConsents) {
      // Mark as requiring renewal
      consent.renewalRequired = true;
      await this.storeConsentRecord(consent);
      
      this.emit('consentExpired', {
        consentId: consent.id,
        userId: consent.userId,
        policyId: consent.policyId
      });
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    // Clear sensitive data
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
    
    this.consentCache.clear();
    this.consentPolicies.clear();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface ConsentManagerOptions {
  storePath?: string;
  defaultRetentionPeriod?: number;
}

export interface ConsentPolicy {
  id: string;
  name: string;
  version: string;
  description: string;
  purposes: string[];
  dataTypes: string[];
  legalBasis: string;
  defaultScope: string[];
  expirationPeriod?: number;
  renewalRequired?: boolean;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface ConsentRequest {
  userId: string;
  policyId: string;
  scope?: string[];
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface ConsentResponse {
  consentId: string;
  granted: boolean;
  timestamp: number;
  expiresAt: number | null;
  scope: string[];
  cached?: boolean;
  pendingUserResponse?: boolean;
}

export interface UserConsentResponse {
  consentId: string;
  granted: boolean;
  scope?: string[];
  method?: string;
  metadata?: Record<string, any>;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  policyId: string;
  policyVersion: string;
  granted: boolean;
  timestamp: number;
  expiresAt: number | null;
  scope: string[];
  method: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  revoked: boolean;
  revokedAt: number | null;
  renewalRequired: boolean;
}

export interface BulkConsentOperation {
  id: string;
  type: 'grant' | 'revoke' | 'renew';
  items: Array<{
    userId: string;
    policyId: string;
    consentId?: string;
  }>;
}

export interface BulkConsentResult {
  successful: Array<{
    userId: string;
    policyId: string;
    consentId?: string;
  }>;
  failed: Array<{
    item: {
      userId: string;
      policyId: string;
      consentId?: string;
    };
    error: string;
  }>;
  totalProcessed: number;
}

export interface ConsentReportOptions {
  startDate?: number;
  endDate?: number;
  saveReport?: boolean;
}

export interface ConsentExportOptions {
  format: 'json' | 'csv' | 'xml';
  outputPath?: string;
  startDate?: number;
  endDate?: number;
  userIds?: string[];
  policyIds?: string[];
  onlyActive?: boolean;
}

export interface ConsentReport {
  reportId: string;
  generatedAt: number;
  period: { start: number; end: number };
  summary: {
    totalConsents: number;
    grantedConsents: number;
    revokedConsents: number;
    expiredConsents: number;
    activeConsents: number;
  };
  byPolicy: Record<string, PolicyAnalysis>;
  byUser: Record<string, UserAnalysis>;
  complianceMetrics: ComplianceMetrics;
  trends: ConsentTrends;
  recommendations: string[];
}

export interface PolicyAnalysis {
  total: number;
  granted: number;
  revoked: number;
  expired: number;
  active: number;
}

export interface UserAnalysis {
  totalConsents: number;
  activeConsents: number;
  revokedConsents: number;
  lastActivity: number;
}

export interface ComplianceMetrics {
  explicitConsentRate: number;
  documentationRate: number;
  renewabilityRate: number;
  averageConsentLifetime: number;
  complianceScore: number;
}

export interface ConsentTrends {
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  growthRate: number;
  revocationRate: number;
}