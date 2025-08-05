import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Privacy audit logging for data access and transmission
 * Provides comprehensive logging and monitoring of privacy-sensitive operations
 */
export class PrivacyAuditLogger extends EventEmitter {
  private logPath: string;
  private encryptLogs: boolean;
  private retentionPeriod: number;
  private maxLogSize: number;
  private logBuffer: AuditLogEntry[];
  private flushInterval: NodeJS.Timeout | null;
  private encryptionKey: Buffer | null;

  constructor(options: PrivacyAuditOptions = {}) {
    super();
    
    this.logPath = options.logPath || path.join(process.cwd(), 'logs', 'privacy-audit');
    this.encryptLogs = options.encryptLogs !== false;
    this.retentionPeriod = options.retentionPeriod || 365 * 24 * 60 * 60 * 1000; // 1 year
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.logBuffer = [];
    this.flushInterval = null;
    this.encryptionKey = null;
    
    this.initialize();
  }

  /**
   * Initialize audit logger
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.logPath, { recursive: true });
      
      // Initialize encryption if enabled
      if (this.encryptLogs) {
        await this.initializeEncryption();
      }
      
      // Start periodic log flushing
      this.startLogFlushing();
      
      // Clean up old logs
      await this.cleanupOldLogs();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize privacy audit logger: ${(error as Error).message}`);
    }
  }

  /**
   * Log data access event
   */
  async logDataAccess(event: DataAccessEvent): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'data-access',
      category: event.category,
      action: event.action,
      resource: event.resource,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: {
        dataType: event.dataType,
        dataSize: event.dataSize,
        accessMethod: event.accessMethod,
        purpose: event.purpose,
        retention: event.retention,
        ...event.additionalDetails
      },
      riskLevel: this.calculateRiskLevel(event),
      complianceFlags: this.checkCompliance(event)
    };
    
    await this.addLogEntry(logEntry);
    this.emit('dataAccessLogged', logEntry);
  }

  /**
   * Log data transmission event
   */
  async logDataTransmission(event: DataTransmissionEvent): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'data-transmission',
      category: event.category,
      action: event.action,
      resource: event.resource,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: {
        destination: event.destination,
        protocol: event.protocol,
        encryption: event.encryption,
        dataType: event.dataType,
        dataSize: event.dataSize,
        purpose: event.purpose,
        thirdParty: event.thirdParty,
        ...event.additionalDetails
      },
      riskLevel: this.calculateTransmissionRisk(event),
      complianceFlags: this.checkTransmissionCompliance(event)
    };
    
    await this.addLogEntry(logEntry);
    this.emit('dataTransmissionLogged', logEntry);
  }

  /**
   * Log consent event
   */
  async logConsent(event: ConsentEvent): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'consent',
      category: 'user-consent',
      action: event.action,
      resource: event.resource,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: {
        consentType: event.consentType,
        consentScope: event.consentScope,
        consentMethod: event.consentMethod,
        consentVersion: event.consentVersion,
        expiresAt: event.expiresAt,
        ...event.additionalDetails
      },
      riskLevel: 'low',
      complianceFlags: []
    };
    
    await this.addLogEntry(logEntry);
    this.emit('consentLogged', logEntry);
  }

  /**
   * Log privacy violation or concern
   */
  async logPrivacyViolation(event: PrivacyViolationEvent): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'privacy-violation',
      category: 'security-incident',
      action: event.action,
      resource: event.resource,
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: {
        violationType: event.violationType,
        severity: event.severity,
        description: event.description,
        affectedData: event.affectedData,
        potentialImpact: event.potentialImpact,
        mitigationActions: event.mitigationActions,
        ...event.additionalDetails
      },
      riskLevel: 'critical',
      complianceFlags: ['GDPR_BREACH', 'CCPA_VIOLATION']
    };
    
    await this.addLogEntry(logEntry);
    this.emit('privacyViolationLogged', logEntry);
    
    // Trigger immediate notification for critical violations
    if (event.severity === 'critical' || event.severity === 'high') {
      this.emit('criticalViolation', logEntry);
    }
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    try {
      const logFiles = await this.getLogFiles();
      const results: AuditLogEntry[] = [];
      
      for (const logFile of logFiles) {
        const entries = await this.readLogFile(logFile);
        const filteredEntries = this.filterLogEntries(entries, query);
        results.push(...filteredEntries);
      }
      
      // Sort by timestamp
      results.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply limit
      if (query.limit) {
        return results.slice(0, query.limit);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to query audit logs: ${(error as Error).message}`);
    }
  }

  /**
   * Generate privacy report
   */
  async generatePrivacyReport(options: PrivacyReportOptions): Promise<PrivacyReport> {
    const startTime = options.startDate || Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endTime = options.endDate || Date.now();
    
    const query: AuditLogQuery = {
      startDate: startTime,
      endDate: endTime,
      types: options.includeTypes
    };
    
    const logs = await this.queryLogs(query);
    
    const report: PrivacyReport = {
      reportId: crypto.randomUUID(),
      generatedAt: Date.now(),
      period: { start: startTime, end: endTime },
      summary: {
        totalEvents: logs.length,
        dataAccessEvents: logs.filter(l => l.type === 'data-access').length,
        dataTransmissionEvents: logs.filter(l => l.type === 'data-transmission').length,
        consentEvents: logs.filter(l => l.type === 'consent').length,
        violationEvents: logs.filter(l => l.type === 'privacy-violation').length,
        highRiskEvents: logs.filter(l => l.riskLevel === 'high' || l.riskLevel === 'critical').length
      },
      dataAccessAnalysis: this.analyzeDataAccess(logs),
      transmissionAnalysis: this.analyzeTransmissions(logs),
      consentAnalysis: this.analyzeConsent(logs),
      complianceStatus: this.analyzeCompliance(logs),
      riskAssessment: this.assessRisks(logs),
      recommendations: this.generateRecommendations(logs)
    };
    
    // Save report if requested
    if (options.saveReport) {
      const reportPath = path.join(this.logPath, 'reports', `privacy-report-${report.reportId}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }
    
    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Export audit logs
   */
  async exportLogs(options: LogExportOptions): Promise<string> {
    const query: AuditLogQuery = {
      startDate: options.startDate,
      endDate: options.endDate,
      types: options.types,
      categories: options.categories,
      riskLevels: options.riskLevels
    };
    
    const logs = await this.queryLogs(query);
    
    let exportData: string;
    
    switch (options.format) {
      case 'json':
        exportData = JSON.stringify(logs, null, 2);
        break;
      case 'csv':
        exportData = this.convertToCSV(logs);
        break;
      case 'xml':
        exportData = this.convertToXML(logs);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
    
    const exportPath = options.outputPath || path.join(
      this.logPath, 
      'exports', 
      `audit-export-${Date.now()}.${options.format}`
    );
    
    await fs.mkdir(path.dirname(exportPath), { recursive: true });
    await fs.writeFile(exportPath, exportData);
    
    this.emit('logsExported', { path: exportPath, count: logs.length });
    return exportPath;
  }

  /**
   * Add log entry to buffer
   */
  private async addLogEntry(entry: AuditLogEntry): Promise<void> {
    this.logBuffer.push(entry);
    
    // Flush immediately for critical events
    if (entry.riskLevel === 'critical') {
      await this.flushLogs();
    }
  }

  /**
   * Start periodic log flushing
   */
  private startLogFlushing(): void {
    this.flushInterval = setInterval(async () => {
      try {
        await this.flushLogs();
      } catch (error) {
        this.emit('error', error);
      }
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Flush log buffer to disk
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    const entries = [...this.logBuffer];
    this.logBuffer = [];
    
    const logFileName = `audit-${new Date().toISOString().split('T')[0]}.log`;
    const logFilePath = path.join(this.logPath, logFileName);
    
    try {
      let logData = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      
      if (this.encryptLogs && this.encryptionKey) {
        logData = await this.encryptLogData(logData);
      }
      
      await fs.appendFile(logFilePath, logData);
      this.emit('logsFlushed', { count: entries.length, file: logFilePath });
    } catch (error) {
      // Put entries back in buffer on failure
      this.logBuffer.unshift(...entries);
      throw error;
    }
  }

  /**
   * Initialize encryption for logs
   */
  private async initializeEncryption(): Promise<void> {
    const keyPath = path.join(this.logPath, '.audit-key');
    
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
   * Encrypt log data
   */
  private async encryptLogData(data: string): Promise<string> {
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
    }) + '\n';
  }

  /**
   * Decrypt log data
   */
  private async decryptLogData(encryptedData: string): Promise<string> {
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
   * Get list of log files
   */
  private async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logPath);
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.logPath, file))
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Read and parse log file
   */
  private async readLogFile(filePath: string): Promise<AuditLogEntry[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const entries: AuditLogEntry[] = [];
      
      for (const line of lines) {
        try {
          let logData = line;
          
          // Decrypt if encrypted
          if (this.encryptLogs && this.encryptionKey) {
            logData = await this.decryptLogData(line);
          }
          
          const entry: AuditLogEntry = JSON.parse(logData);
          entries.push(entry);
        } catch (parseError) {
          // Skip invalid log entries
          continue;
        }
      }
      
      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Filter log entries based on query
   */
  private filterLogEntries(entries: AuditLogEntry[], query: AuditLogQuery): AuditLogEntry[] {
    return entries.filter(entry => {
      // Date range filter
      if (query.startDate && entry.timestamp < query.startDate) return false;
      if (query.endDate && entry.timestamp > query.endDate) return false;
      
      // Type filter
      if (query.types && !query.types.includes(entry.type)) return false;
      
      // Category filter
      if (query.categories && !query.categories.includes(entry.category)) return false;
      
      // User filter
      if (query.userId && entry.userId !== query.userId) return false;
      
      // Risk level filter
      if (query.riskLevels && !query.riskLevels.includes(entry.riskLevel)) return false;
      
      // Resource filter
      if (query.resource && !entry.resource.includes(query.resource)) return false;
      
      return true;
    });
  }

  /**
   * Calculate risk level for data access
   */
  private calculateRiskLevel(event: DataAccessEvent): RiskLevel {
    let riskScore = 0;
    
    // Data sensitivity
    if (event.dataType === 'personal' || event.dataType === 'sensitive') riskScore += 3;
    if (event.dataType === 'financial' || event.dataType === 'health') riskScore += 4;
    
    // Access method
    if (event.accessMethod === 'api' || event.accessMethod === 'bulk') riskScore += 2;
    
    // Data size
    if (event.dataSize && event.dataSize > 1000000) riskScore += 2; // > 1MB
    
    // Purpose
    if (event.purpose === 'analytics' || event.purpose === 'marketing') riskScore += 1;
    
    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate risk level for data transmission
   */
  private calculateTransmissionRisk(event: DataTransmissionEvent): RiskLevel {
    let riskScore = 0;
    
    // Third party transmission
    if (event.thirdParty) riskScore += 3;
    
    // Encryption
    if (!event.encryption || event.encryption === 'none') riskScore += 4;
    
    // Protocol security
    if (event.protocol === 'http' || event.protocol === 'ftp') riskScore += 3;
    
    // Data type
    if (event.dataType === 'personal' || event.dataType === 'sensitive') riskScore += 2;
    
    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Check compliance flags for data access
   */
  private checkCompliance(event: DataAccessEvent): string[] {
    const flags: string[] = [];
    
    // GDPR compliance checks
    if (event.dataType === 'personal' && !event.purpose) {
      flags.push('GDPR_NO_PURPOSE');
    }
    
    if (event.dataType === 'personal' && !event.retention) {
      flags.push('GDPR_NO_RETENTION');
    }
    
    // CCPA compliance checks
    if (event.dataType === 'personal' && event.accessMethod === 'sale') {
      flags.push('CCPA_DATA_SALE');
    }
    
    return flags;
  }

  /**
   * Check compliance flags for data transmission
   */
  private checkTransmissionCompliance(event: DataTransmissionEvent): string[] {
    const flags: string[] = [];
    
    // Cross-border transfer checks
    if (event.thirdParty && event.destination && !event.destination.includes('US')) {
      flags.push('GDPR_CROSS_BORDER');
    }
    
    // Encryption requirements
    if (event.dataType === 'personal' && (!event.encryption || event.encryption === 'none')) {
      flags.push('ENCRYPTION_REQUIRED');
    }
    
    return flags;
  }

  /**
   * Analyze data access patterns
   */
  private analyzeDataAccess(logs: AuditLogEntry[]): DataAccessAnalysis {
    const accessLogs = logs.filter(l => l.type === 'data-access');
    
    const byDataType: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    
    accessLogs.forEach(log => {
      const dataType = log.details.dataType || 'unknown';
      const purpose = log.details.purpose || 'unknown';
      const userId = log.userId || 'anonymous';
      
      byDataType[dataType] = (byDataType[dataType] || 0) + 1;
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1;
      byUser[userId] = (byUser[userId] || 0) + 1;
    });
    
    return {
      totalAccesses: accessLogs.length,
      byDataType,
      byPurpose,
      byUser,
      averageAccessesPerDay: accessLogs.length / 30, // Assuming 30-day period
      topAccessedResources: this.getTopResources(accessLogs)
    };
  }

  /**
   * Analyze data transmissions
   */
  private analyzeTransmissions(logs: AuditLogEntry[]): TransmissionAnalysis {
    const transmissionLogs = logs.filter(l => l.type === 'data-transmission');
    
    const byDestination: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};
    const encryptedCount = transmissionLogs.filter(l => 
      l.details.encryption && l.details.encryption !== 'none'
    ).length;
    
    transmissionLogs.forEach(log => {
      const destination = log.details.destination || 'unknown';
      const protocol = log.details.protocol || 'unknown';
      
      byDestination[destination] = (byDestination[destination] || 0) + 1;
      byProtocol[protocol] = (byProtocol[protocol] || 0) + 1;
    });
    
    return {
      totalTransmissions: transmissionLogs.length,
      encryptedTransmissions: encryptedCount,
      encryptionRate: transmissionLogs.length > 0 ? encryptedCount / transmissionLogs.length : 0,
      byDestination,
      byProtocol,
      thirdPartyTransmissions: transmissionLogs.filter(l => l.details.thirdParty).length
    };
  }

  /**
   * Analyze consent events
   */
  private analyzeConsent(logs: AuditLogEntry[]): ConsentAnalysis {
    const consentLogs = logs.filter(l => l.type === 'consent');
    
    const granted = consentLogs.filter(l => l.action === 'granted').length;
    const revoked = consentLogs.filter(l => l.action === 'revoked').length;
    const expired = consentLogs.filter(l => 
      l.details.expiresAt && l.details.expiresAt < Date.now()
    ).length;
    
    return {
      totalConsentEvents: consentLogs.length,
      consentGranted: granted,
      consentRevoked: revoked,
      consentExpired: expired,
      activeConsents: granted - revoked - expired
    };
  }

  /**
   * Analyze compliance status
   */
  private analyzeCompliance(logs: AuditLogEntry[]): ComplianceAnalysis {
    const allFlags = logs.flatMap(l => l.complianceFlags);
    const flagCounts: Record<string, number> = {};
    
    allFlags.forEach(flag => {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    });
    
    return {
      totalViolations: allFlags.length,
      violationsByType: flagCounts,
      complianceScore: Math.max(0, 100 - (allFlags.length * 5)), // Rough scoring
      criticalViolations: logs.filter(l => l.riskLevel === 'critical').length
    };
  }

  /**
   * Assess overall risks
   */
  private assessRisks(logs: AuditLogEntry[]): RiskAssessment {
    const riskCounts: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    logs.forEach(log => {
      riskCounts[log.riskLevel]++;
    });
    
    const totalEvents = logs.length;
    const highRiskEvents = riskCounts.high + riskCounts.critical;
    
    return {
      overallRiskScore: totalEvents > 0 ? (highRiskEvents / totalEvents) * 100 : 0,
      riskDistribution: riskCounts,
      trendAnalysis: 'stable', // Would require historical comparison
      riskFactors: this.identifyRiskFactors(logs)
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(logs: AuditLogEntry[]): string[] {
    const recommendations: string[] = [];
    
    const violations = logs.filter(l => l.complianceFlags.length > 0);
    if (violations.length > 0) {
      recommendations.push('Address compliance violations to reduce regulatory risk');
    }
    
    const unencryptedTransmissions = logs.filter(l => 
      l.type === 'data-transmission' && 
      (!l.details.encryption || l.details.encryption === 'none')
    );
    if (unencryptedTransmissions.length > 0) {
      recommendations.push('Enable encryption for all data transmissions');
    }
    
    const highRiskEvents = logs.filter(l => l.riskLevel === 'high' || l.riskLevel === 'critical');
    if (highRiskEvents.length > logs.length * 0.1) {
      recommendations.push('Review and reduce high-risk data operations');
    }
    
    return recommendations;
  }

  /**
   * Get top accessed resources
   */
  private getTopResources(logs: AuditLogEntry[]): Array<{ resource: string; count: number }> {
    const resourceCounts: Record<string, number> = {};
    
    logs.forEach(log => {
      resourceCounts[log.resource] = (resourceCounts[log.resource] || 0) + 1;
    });
    
    return Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(logs: AuditLogEntry[]): string[] {
    const factors: string[] = [];
    
    const thirdPartyTransmissions = logs.filter(l => 
      l.type === 'data-transmission' && l.details.thirdParty
    );
    if (thirdPartyTransmissions.length > 0) {
      factors.push('Third-party data sharing');
    }
    
    const bulkAccess = logs.filter(l => 
      l.type === 'data-access' && l.details.accessMethod === 'bulk'
    );
    if (bulkAccess.length > 0) {
      factors.push('Bulk data access operations');
    }
    
    return factors;
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'Type', 'Category', 'Action', 'Resource', 
      'User ID', 'Session ID', 'IP Address', 'Risk Level', 'Compliance Flags'
    ];
    
    const rows = logs.map(log => [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.type,
      log.category,
      log.action,
      log.resource,
      log.userId || '',
      log.sessionId || '',
      log.ipAddress || '',
      log.riskLevel,
      log.complianceFlags.join(';')
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Convert logs to XML format
   */
  private convertToXML(logs: AuditLogEntry[]): string {
    const xmlEntries = logs.map(log => `
    <entry>
      <id>${log.id}</id>
      <timestamp>${new Date(log.timestamp).toISOString()}</timestamp>
      <type>${log.type}</type>
      <category>${log.category}</category>
      <action>${log.action}</action>
      <resource><![CDATA[${log.resource}]]></resource>
      <userId>${log.userId || ''}</userId>
      <sessionId>${log.sessionId || ''}</sessionId>
      <ipAddress>${log.ipAddress || ''}</ipAddress>
      <riskLevel>${log.riskLevel}</riskLevel>
      <complianceFlags>${log.complianceFlags.join(',')}</complianceFlags>
      <details><![CDATA[${JSON.stringify(log.details)}]]></details>
    </entry>`).join('');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<auditLog>
  <metadata>
    <exportDate>${new Date().toISOString()}</exportDate>
    <entryCount>${logs.length}</entryCount>
  </metadata>
  <entries>${xmlEntries}
  </entries>
</auditLog>`;
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logPath);
      const cutoffTime = Date.now() - this.retentionPeriod;
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(this.logPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          this.emit('logFileDeleted', { file: filePath });
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush remaining logs
    this.flushLogs().catch(() => {
      // Ignore errors during cleanup
    });
    
    // Clear sensitive data
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
    
    this.logBuffer = [];
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface PrivacyAuditOptions {
  logPath?: string;
  encryptLogs?: boolean;
  retentionPeriod?: number;
  maxLogSize?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: 'data-access' | 'data-transmission' | 'consent' | 'privacy-violation';
  category: string;
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  riskLevel: RiskLevel;
  complianceFlags: string[];
}

export interface DataAccessEvent {
  category: string;
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  dataType: string;
  dataSize?: number;
  accessMethod: string;
  purpose?: string;
  retention?: string;
  additionalDetails?: Record<string, any>;
}

export interface DataTransmissionEvent {
  category: string;
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  destination: string;
  protocol: string;
  encryption?: string;
  dataType: string;
  dataSize?: number;
  purpose?: string;
  thirdParty: boolean;
  additionalDetails?: Record<string, any>;
}

export interface ConsentEvent {
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  consentType: string;
  consentScope: string[];
  consentMethod: string;
  consentVersion: string;
  expiresAt?: number;
  additionalDetails?: Record<string, any>;
}

export interface PrivacyViolationEvent {
  action: string;
  resource: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedData: string[];
  potentialImpact: string;
  mitigationActions: string[];
  additionalDetails?: Record<string, any>;
}

export interface AuditLogQuery {
  startDate?: number;
  endDate?: number;
  types?: string[];
  categories?: string[];
  userId?: string;
  riskLevels?: RiskLevel[];
  resource?: string;
  limit?: number;
}

export interface PrivacyReportOptions {
  startDate?: number;
  endDate?: number;
  includeTypes?: string[];
  saveReport?: boolean;
}

export interface LogExportOptions {
  startDate?: number;
  endDate?: number;
  types?: string[];
  categories?: string[];
  riskLevels?: RiskLevel[];
  format: 'json' | 'csv' | 'xml';
  outputPath?: string;
}

export interface PrivacyReport {
  reportId: string;
  generatedAt: number;
  period: { start: number; end: number };
  summary: {
    totalEvents: number;
    dataAccessEvents: number;
    dataTransmissionEvents: number;
    consentEvents: number;
    violationEvents: number;
    highRiskEvents: number;
  };
  dataAccessAnalysis: DataAccessAnalysis;
  transmissionAnalysis: TransmissionAnalysis;
  consentAnalysis: ConsentAnalysis;
  complianceStatus: ComplianceAnalysis;
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

export interface DataAccessAnalysis {
  totalAccesses: number;
  byDataType: Record<string, number>;
  byPurpose: Record<string, number>;
  byUser: Record<string, number>;
  averageAccessesPerDay: number;
  topAccessedResources: Array<{ resource: string; count: number }>;
}

export interface TransmissionAnalysis {
  totalTransmissions: number;
  encryptedTransmissions: number;
  encryptionRate: number;
  byDestination: Record<string, number>;
  byProtocol: Record<string, number>;
  thirdPartyTransmissions: number;
}

export interface ConsentAnalysis {
  totalConsentEvents: number;
  consentGranted: number;
  consentRevoked: number;
  consentExpired: number;
  activeConsents: number;
}

export interface ComplianceAnalysis {
  totalViolations: number;
  violationsByType: Record<string, number>;
  complianceScore: number;
  criticalViolations: number;
}

export interface RiskAssessment {
  overallRiskScore: number;
  riskDistribution: Record<RiskLevel, number>;
  trendAnalysis: string;
  riskFactors: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';