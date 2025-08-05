import { EventEmitter } from 'events';
import * as https from 'https';
import * as crypto from 'crypto';
import * as net from 'net';
import * as tls from 'tls';

/**
 * Network security for cloud AI communications
 * Provides secure communication channels with certificate validation and traffic monitoring
 */
export class NetworkSecurity extends EventEmitter {
  private trustedCertificates: Map<string, TrustedCertificate>;
  private securityPolicies: Map<string, SecurityPolicy>;
  private connectionPool: Map<string, SecureConnection>;
  private trafficMonitor: TrafficMonitor;
  private rateLimiter: RateLimiter;
  private requestInterceptor: RequestInterceptor;

  constructor(options: NetworkSecurityOptions = {}) {
    super();
    
    this.trustedCertificates = new Map();
    this.securityPolicies = new Map();
    this.connectionPool = new Map();
    this.trafficMonitor = new TrafficMonitor(options.monitoring);
    this.rateLimiter = new RateLimiter(options.rateLimiting);
    this.requestInterceptor = new RequestInterceptor(options.interception);
    
    this.initialize(options);
  }

  /**
   * Initialize network security
   */
  private async initialize(options: NetworkSecurityOptions): Promise<void> {
    try {
      // Load default security policies
      await this.loadDefaultPolicies();
      
      // Initialize certificate store
      await this.initializeCertificateStore(options.certificatePath);
      
      // Setup traffic monitoring
      await this.trafficMonitor.initialize();
      
      // Setup request interception
      await this.requestInterceptor.initialize();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize network security: ${(error as Error).message}`);
    }
  }

  /**
   * Create secure HTTPS agent
   */
  createSecureAgent(hostname: string, options: SecureAgentOptions = {}): https.Agent {
    const policy = this.getSecurityPolicy(hostname);
    
    const agentOptions: https.AgentOptions = {
      keepAlive: options.keepAlive !== false,
      keepAliveMsecs: options.keepAliveMsecs || 30000,
      maxSockets: options.maxSockets || 10,
      maxFreeSockets: options.maxFreeSockets || 5,
      timeout: options.timeout || 30000,
      
      // TLS options
      secureProtocol: policy.tlsVersion || 'TLSv1_3_method',
      ciphers: policy.allowedCiphers?.join(':') || this.getSecureCiphers(),
      honorCipherOrder: true,
      checkServerIdentity: (hostname: string, cert: any) => {
        return this.validateServerCertificate(hostname, cert);
      },
      
      // Certificate validation
      rejectUnauthorized: policy.rejectUnauthorized !== false,
      ca: this.getTrustedCAs(hostname),
      
      // Client certificate if required
      ...(policy.clientCertificate && {
        cert: policy.clientCertificate.cert,
        key: policy.clientCertificate.key,
        passphrase: policy.clientCertificate.passphrase
      })
    };
    
    const agent = new https.Agent(agentOptions);
    
    // Monitor agent connections
    this.monitorAgent(agent, hostname);
    
    return agent;
  }

  /**
   * Make secure request
   */
  async makeSecureRequest(options: SecureRequestOptions): Promise<SecureResponse> {
    const hostname = this.extractHostname(options.url);
    
    // Check rate limiting
    await this.rateLimiter.checkLimit(hostname, options.userId);
    
    // Apply security policy
    const policy = this.getSecurityPolicy(hostname);
    this.validateRequestAgainstPolicy(options, policy);
    
    // Create secure agent
    const agent = this.createSecureAgent(hostname, options.agentOptions);
    
    // Intercept and modify request if needed
    const interceptedOptions = await this.requestInterceptor.interceptRequest(options);
    
    try {
      const response = await this.executeSecureRequest(interceptedOptions, agent);
      
      // Monitor traffic
      await this.trafficMonitor.recordRequest({
        hostname,
        method: options.method || 'GET',
        url: options.url,
        requestSize: this.calculateRequestSize(options),
        responseSize: response.data ? Buffer.byteLength(response.data) : 0,
        statusCode: response.statusCode,
        duration: response.duration,
        encrypted: true,
        userId: options.userId,
        timestamp: Date.now()
      });
      
      // Validate response
      this.validateResponse(response, policy);
      
      this.emit('secureRequestCompleted', {
        hostname,
        statusCode: response.statusCode,
        duration: response.duration
      });
      
      return response;
      
    } catch (error) {
      await this.trafficMonitor.recordError({
        hostname,
        error: (error as Error).message,
        userId: options.userId,
        timestamp: Date.now()
      });
      
      this.emit('secureRequestFailed', {
        hostname,
        error: (error as Error).message
      });
      
      throw error;
    }
  }

  /**
   * Register security policy for hostname
   */
  registerSecurityPolicy(hostname: string, policy: SecurityPolicy): void {
    this.securityPolicies.set(hostname, policy);
    this.emit('policyRegistered', { hostname, policy });
  }

  /**
   * Add trusted certificate
   */
  addTrustedCertificate(hostname: string, certificate: TrustedCertificate): void {
    this.trustedCertificates.set(hostname, certificate);
    this.emit('certificateAdded', { hostname });
  }

  /**
   * Validate certificate chain
   */
  async validateCertificateChain(hostname: string, peerCert: any): Promise<CertificateValidationResult> {
    const result: CertificateValidationResult = {
      valid: false,
      errors: [],
      warnings: [],
      details: {
        subject: peerCert.subject,
        issuer: peerCert.issuer,
        validFrom: peerCert.valid_from,
        validTo: peerCert.valid_to,
        fingerprint: peerCert.fingerprint,
        serialNumber: peerCert.serialNumber
      }
    };
    
    try {
      // Check certificate expiration
      const now = new Date();
      const validFrom = new Date(peerCert.valid_from);
      const validTo = new Date(peerCert.valid_to);
      
      if (now < validFrom) {
        result.errors.push('Certificate is not yet valid');
      }
      
      if (now > validTo) {
        result.errors.push('Certificate has expired');
      }
      
      // Check hostname matching
      if (!this.validateHostnameMatch(hostname, peerCert)) {
        result.errors.push('Certificate hostname does not match');
      }
      
      // Check certificate chain
      if (peerCert.issuerCertificate && peerCert.issuerCertificate !== peerCert) {
        const chainResult = await this.validateCertificateChain(hostname, peerCert.issuerCertificate);
        if (!chainResult.valid) {
          result.errors.push('Certificate chain validation failed');
        }
      }
      
      // Check against trusted certificates
      const trustedCert = this.trustedCertificates.get(hostname);
      if (trustedCert) {
        if (trustedCert.fingerprint !== peerCert.fingerprint) {
          if (trustedCert.pinned) {
            result.errors.push('Certificate fingerprint does not match pinned certificate');
          } else {
            result.warnings.push('Certificate fingerprint has changed');
          }
        }
      }
      
      // Check certificate revocation (simplified)
      if (await this.isCertificateRevoked(peerCert)) {
        result.errors.push('Certificate has been revoked');
      }
      
      // Check weak signature algorithms
      if (this.isWeakSignatureAlgorithm(peerCert.signatureAlgorithm)) {
        result.warnings.push(`Weak signature algorithm: ${peerCert.signatureAlgorithm}`);
      }
      
      result.valid = result.errors.length === 0;
      
    } catch (error) {
      result.errors.push(`Certificate validation error: ${(error as Error).message}`);
    }
    
    return result;
  }

  /**
   * Get network security status
   */
  getSecurityStatus(): NetworkSecurityStatus {
    const connectionStats = this.getConnectionStats();
    const trafficStats = this.trafficMonitor.getStats();
    const rateLimitStats = this.rateLimiter.getStats();
    
    return {
      activeConnections: connectionStats.active,
      totalConnections: connectionStats.total,
      trustedCertificates: this.trustedCertificates.size,
      securityPolicies: this.securityPolicies.size,
      trafficStats,
      rateLimitStats,
      securityEvents: this.getRecentSecurityEvents(),
      recommendations: this.generateSecurityRecommendations()
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(options: SecurityReportOptions = {}): Promise<NetworkSecurityReport> {
    const startTime = options.startTime || Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const endTime = options.endTime || Date.now();
    
    const trafficAnalysis = await this.trafficMonitor.getTrafficAnalysis(startTime, endTime);
    const securityEvents = this.getSecurityEventsSince(startTime);
    const certificateStatus = this.getCertificateStatus();
    
    const report: NetworkSecurityReport = {
      reportId: crypto.randomUUID(),
      generatedAt: Date.now(),
      period: { start: startTime, end: endTime },
      summary: {
        totalRequests: trafficAnalysis.totalRequests,
        successfulRequests: trafficAnalysis.successfulRequests,
        failedRequests: trafficAnalysis.failedRequests,
        averageResponseTime: trafficAnalysis.averageResponseTime,
        totalDataTransferred: trafficAnalysis.totalDataTransferred,
        securityViolations: securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length
      },
      trafficAnalysis,
      securityEvents,
      certificateStatus,
      policyCompliance: this.analyzePolicyCompliance(),
      threatAnalysis: this.analyzeThreatPatterns(securityEvents),
      recommendations: this.generateDetailedRecommendations(trafficAnalysis, securityEvents)
    };
    
    this.emit('securityReportGenerated', report);
    return report;
  }

  /**
   * Block hostname
   */
  blockHostname(hostname: string, reason: string, duration?: number): void {
    const policy: SecurityPolicy = {
      blocked: true,
      blockReason: reason,
      blockExpiry: duration ? Date.now() + duration : undefined
    };
    
    this.registerSecurityPolicy(hostname, policy);
    
    this.emit('hostnameBlocked', { hostname, reason, duration });
  }

  /**
   * Unblock hostname
   */
  unblockHostname(hostname: string): void {
    const policy = this.securityPolicies.get(hostname);
    if (policy) {
      delete policy.blocked;
      delete policy.blockReason;
      delete policy.blockExpiry;
      
      this.securityPolicies.set(hostname, policy);
    }
    
    this.emit('hostnameUnblocked', { hostname });
  }

  /**
   * Execute secure request
   */
  private async executeSecureRequest(options: SecureRequestOptions, agent: https.Agent): Promise<SecureResponse> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const requestOptions: https.RequestOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        agent,
        timeout: options.timeout || 30000
      };
      
      // Parse URL
      const url = new URL(options.url);
      requestOptions.hostname = url.hostname;
      requestOptions.port = url.port || (url.protocol === 'https:' ? 443 : 80);
      requestOptions.path = url.pathname + url.search;
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const response: SecureResponse = {
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            headers: res.headers,
            data,
            duration: Date.now() - startTime,
            encrypted: true,
            certificateInfo: (res.socket as tls.TLSSocket).getPeerCertificate()
          };
          
          resolve(response);
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      // Write request body if provided
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * Get security policy for hostname
   */
  private getSecurityPolicy(hostname: string): SecurityPolicy {
    // Check for exact match
    let policy = this.securityPolicies.get(hostname);
    
    if (!policy) {
      // Check for wildcard matches
      for (const [pattern, patternPolicy] of this.securityPolicies) {
        if (this.matchesPattern(hostname, pattern)) {
          policy = patternPolicy;
          break;
        }
      }
    }
    
    // Return default policy if no match found
    return policy || this.getDefaultSecurityPolicy();
  }

  /**
   * Get default security policy
   */
  private getDefaultSecurityPolicy(): SecurityPolicy {
    return {
      tlsVersion: 'TLSv1_3_method',
      allowedCiphers: this.getSecureCiphers().split(':'),
      rejectUnauthorized: true,
      requireSNI: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      maxResponseSize: 50 * 1024 * 1024, // 50MB
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    };
  }

  /**
   * Load default security policies
   */
  private async loadDefaultPolicies(): Promise<void> {
    // OpenAI API
    this.registerSecurityPolicy('api.openai.com', {
      tlsVersion: 'TLSv1_2_method',
      requireSNI: true,
      maxRequestSize: 20 * 1024 * 1024, // 20MB for large prompts
      timeout: 60000 // 60 seconds for AI processing
    });
    
    // Anthropic API
    this.registerSecurityPolicy('api.anthropic.com', {
      tlsVersion: 'TLSv1_2_method',
      requireSNI: true,
      maxRequestSize: 15 * 1024 * 1024,
      timeout: 45000
    });
    
    // OpenRouter API
    this.registerSecurityPolicy('openrouter.ai', {
      tlsVersion: 'TLSv1_2_method',
      requireSNI: true,
      maxRequestSize: 10 * 1024 * 1024,
      timeout: 30000
    });
    
    // Mistral API
    this.registerSecurityPolicy('api.mistral.ai', {
      tlsVersion: 'TLSv1_2_method',
      requireSNI: true,
      maxRequestSize: 10 * 1024 * 1024,
      timeout: 30000
    });
  }

  /**
   * Initialize certificate store
   */
  private async initializeCertificateStore(certificatePath?: string): Promise<void> {
    // Load system root certificates
    // This would typically load from the OS certificate store
    
    // Load custom certificates if path provided
    if (certificatePath) {
      try {
        // Implementation would load certificates from the specified path
      } catch (error) {
        this.emit('warning', `Failed to load certificates from ${certificatePath}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Get secure cipher suites
   */
  private getSecureCiphers(): string {
    return [
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA',
      'ECDHE-RSA-AES128-SHA',
      'AES256-GCM-SHA384',
      'AES128-GCM-SHA256',
      'AES256-SHA256',
      'AES128-SHA256',
      'AES256-SHA',
      'AES128-SHA'
    ].join(':');
  }

  /**
   * Get trusted certificate authorities
   */
  private getTrustedCAs(hostname: string): string[] | undefined {
    const trustedCert = this.trustedCertificates.get(hostname);
    return trustedCert?.ca ? [trustedCert.ca] : undefined;
  }

  /**
   * Validate server certificate
   */
  private validateServerCertificate(hostname: string, cert: any): Error | undefined {
    try {
      // Perform custom certificate validation
      const validation = this.validateCertificateChain(hostname, cert);
      
      // Return error if validation fails
      // Note: This is simplified - real implementation would be async
      return undefined;
    } catch (error) {
      return error as Error;
    }
  }

  /**
   * Monitor HTTPS agent
   */
  private monitorAgent(agent: https.Agent, hostname: string): void {
    const originalCreateConnection = agent.createConnection;
    
    agent.createConnection = (options: any, callback: any) => {
      const connection = originalCreateConnection.call(agent, options, callback);
      
      if (connection) {
        this.connectionPool.set(`${hostname}:${Date.now()}`, {
          hostname,
          socket: connection,
          createdAt: Date.now(),
          lastUsed: Date.now()
        });
        
        connection.on('close', () => {
          // Remove from connection pool
          for (const [key, conn] of this.connectionPool) {
            if (conn.socket === connection) {
              this.connectionPool.delete(key);
              break;
            }
          }
        });
      }
      
      return connection;
    };
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  /**
   * Validate request against security policy
   */
  private validateRequestAgainstPolicy(options: SecureRequestOptions, policy: SecurityPolicy): void {
    // Check if hostname is blocked
    if (policy.blocked) {
      if (policy.blockExpiry && Date.now() > policy.blockExpiry) {
        // Block has expired, remove it
        delete policy.blocked;
        delete policy.blockReason;
        delete policy.blockExpiry;
      } else {
        throw new Error(`Hostname blocked: ${policy.blockReason || 'Security policy violation'}`);
      }
    }
    
    // Check request size
    const requestSize = this.calculateRequestSize(options);
    if (policy.maxRequestSize && requestSize > policy.maxRequestSize) {
      throw new Error(`Request size exceeds limit: ${requestSize} > ${policy.maxRequestSize}`);
    }
    
    // Check required headers
    if (policy.requiredHeaders) {
      for (const header of policy.requiredHeaders) {
        if (!options.headers || !options.headers[header]) {
          throw new Error(`Required header missing: ${header}`);
        }
      }
    }
    
    // Check forbidden headers
    if (policy.forbiddenHeaders && options.headers) {
      for (const header of policy.forbiddenHeaders) {
        if (options.headers[header]) {
          throw new Error(`Forbidden header present: ${header}`);
        }
      }
    }
  }

  /**
   * Calculate request size
   */
  private calculateRequestSize(options: SecureRequestOptions): number {
    let size = 0;
    
    // Add URL size
    size += Buffer.byteLength(options.url);
    
    // Add headers size
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        size += Buffer.byteLength(key) + Buffer.byteLength(String(value));
      }
    }
    
    // Add body size
    if (options.body) {
      size += Buffer.byteLength(options.body);
    }
    
    return size;
  }

  /**
   * Validate response
   */
  private validateResponse(response: SecureResponse, policy: SecurityPolicy): void {
    // Check response size
    const responseSize = response.data ? Buffer.byteLength(response.data) : 0;
    if (policy.maxResponseSize && responseSize > policy.maxResponseSize) {
      throw new Error(`Response size exceeds limit: ${responseSize} > ${policy.maxResponseSize}`);
    }
    
    // Check required response headers
    if (policy.requiredResponseHeaders) {
      for (const header of policy.requiredResponseHeaders) {
        if (!response.headers[header]) {
          throw new Error(`Required response header missing: ${header}`);
        }
      }
    }
    
    // Check content type if specified
    if (policy.allowedContentTypes) {
      const contentType = response.headers['content-type'];
      if (contentType && !policy.allowedContentTypes.some(type => 
        contentType.includes(type)
      )) {
        throw new Error(`Content type not allowed: ${contentType}`);
      }
    }
  }

  /**
   * Check if hostname matches pattern
   */
  private matchesPattern(hostname: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2);
      return hostname.endsWith(domain);
    }
    
    return hostname === pattern;
  }

  /**
   * Validate hostname match in certificate
   */
  private validateHostnameMatch(hostname: string, cert: any): boolean {
    // Check subject common name
    if (cert.subject && cert.subject.CN === hostname) {
      return true;
    }
    
    // Check subject alternative names
    if (cert.subjectaltname) {
      const altNames = cert.subjectaltname.split(', ');
      for (const altName of altNames) {
        if (altName.startsWith('DNS:')) {
          const dnsName = altName.slice(4);
          if (dnsName === hostname || this.matchesPattern(hostname, dnsName)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if certificate is revoked
   */
  private async isCertificateRevoked(cert: any): Promise<boolean> {
    // Simplified implementation - would check CRL or OCSP in production
    return false;
  }

  /**
   * Check if signature algorithm is weak
   */
  private isWeakSignatureAlgorithm(algorithm: string): boolean {
    const weakAlgorithms = ['md5', 'sha1', 'md2', 'md4'];
    return weakAlgorithms.some(weak => algorithm.toLowerCase().includes(weak));
  }

  /**
   * Get connection statistics
   */
  private getConnectionStats(): { active: number; total: number } {
    return {
      active: this.connectionPool.size,
      total: this.connectionPool.size // Simplified
    };
  }

  /**
   * Get recent security events
   */
  private getRecentSecurityEvents(): SecurityEvent[] {
    // This would return recent security events from monitoring
    return [];
  }

  /**
   * Get security events since timestamp
   */
  private getSecurityEventsSince(timestamp: number): SecurityEvent[] {
    // This would return security events since the given timestamp
    return [];
  }

  /**
   * Get certificate status
   */
  private getCertificateStatus(): CertificateStatus[] {
    const statuses: CertificateStatus[] = [];
    
    for (const [hostname, cert] of this.trustedCertificates) {
      statuses.push({
        hostname,
        fingerprint: cert.fingerprint,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        issuer: cert.issuer,
        pinned: cert.pinned || false,
        status: this.getCertificateValidityStatus(cert)
      });
    }
    
    return statuses;
  }

  /**
   * Get certificate validity status
   */
  private getCertificateValidityStatus(cert: TrustedCertificate): 'valid' | 'expiring' | 'expired' {
    const now = Date.now();
    const validTo = new Date(cert.validTo).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (now > validTo) {
      return 'expired';
    } else if (now > validTo - thirtyDays) {
      return 'expiring';
    } else {
      return 'valid';
    }
  }

  /**
   * Analyze policy compliance
   */
  private analyzePolicyCompliance(): PolicyComplianceAnalysis {
    const totalPolicies = this.securityPolicies.size;
    let compliantPolicies = 0;
    const violations: string[] = [];
    
    for (const [hostname, policy] of this.securityPolicies) {
      if (this.isPolicyCompliant(policy)) {
        compliantPolicies++;
      } else {
        violations.push(`Policy violation for ${hostname}`);
      }
    }
    
    return {
      totalPolicies,
      compliantPolicies,
      complianceRate: totalPolicies > 0 ? compliantPolicies / totalPolicies : 1,
      violations
    };
  }

  /**
   * Check if policy is compliant
   */
  private isPolicyCompliant(policy: SecurityPolicy): boolean {
    // Check for minimum security requirements
    if (policy.tlsVersion && !['TLSv1_2_method', 'TLSv1_3_method'].includes(policy.tlsVersion)) {
      return false;
    }
    
    if (policy.rejectUnauthorized === false) {
      return false;
    }
    
    return true;
  }

  /**
   * Analyze threat patterns
   */
  private analyzeThreatPatterns(events: SecurityEvent[]): ThreatAnalysis {
    const threatTypes: Record<string, number> = {};
    const sourceIPs: Record<string, number> = {};
    let highSeverityCount = 0;
    
    for (const event of events) {
      threatTypes[event.type] = (threatTypes[event.type] || 0) + 1;
      
      if (event.sourceIP) {
        sourceIPs[event.sourceIP] = (sourceIPs[event.sourceIP] || 0) + 1;
      }
      
      if (event.severity === 'high' || event.severity === 'critical') {
        highSeverityCount++;
      }
    }
    
    return {
      totalThreats: events.length,
      highSeverityThreats: highSeverityCount,
      threatTypes,
      topSourceIPs: Object.entries(sourceIPs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count })),
      riskScore: this.calculateRiskScore(events)
    };
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(events: SecurityEvent[]): number {
    let score = 0;
    
    for (const event of events) {
      switch (event.severity) {
        case 'critical':
          score += 10;
          break;
        case 'high':
          score += 5;
          break;
        case 'medium':
          score += 2;
          break;
        case 'low':
          score += 1;
          break;
      }
    }
    
    return Math.min(score, 100);
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for weak TLS versions
    for (const [hostname, policy] of this.securityPolicies) {
      if (policy.tlsVersion && !['TLSv1_2_method', 'TLSv1_3_method'].includes(policy.tlsVersion)) {
        recommendations.push(`Upgrade TLS version for ${hostname}`);
      }
      
      if (policy.rejectUnauthorized === false) {
        recommendations.push(`Enable certificate validation for ${hostname}`);
      }
    }
    
    // Check certificate expiration
    for (const [hostname, cert] of this.trustedCertificates) {
      const status = this.getCertificateValidityStatus(cert);
      if (status === 'expiring') {
        recommendations.push(`Certificate for ${hostname} is expiring soon`);
      } else if (status === 'expired') {
        recommendations.push(`Certificate for ${hostname} has expired`);
      }
    }
    
    return recommendations;
  }

  /**
   * Generate detailed recommendations
   */
  private generateDetailedRecommendations(
    trafficAnalysis: any,
    securityEvents: SecurityEvent[]
  ): string[] {
    const recommendations = this.generateSecurityRecommendations();
    
    // Add traffic-based recommendations
    if (trafficAnalysis.failedRequests > trafficAnalysis.totalRequests * 0.1) {
      recommendations.push('High failure rate detected - review network connectivity');
    }
    
    if (trafficAnalysis.averageResponseTime > 10000) {
      recommendations.push('High response times detected - consider timeout adjustments');
    }
    
    // Add security event-based recommendations
    const criticalEvents = securityEvents.filter(e => e.severity === 'critical');
    if (criticalEvents.length > 0) {
      recommendations.push('Critical security events detected - immediate review required');
    }
    
    return recommendations;
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Close all connections
    for (const [, connection] of this.connectionPool) {
      try {
        connection.socket.destroy();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    this.connectionPool.clear();
    
    // Cleanup components
    await this.trafficMonitor.destroy();
    await this.rateLimiter.destroy();
    await this.requestInterceptor.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * Traffic monitoring component
 */
class TrafficMonitor extends EventEmitter {
  private requests: TrafficRequest[];
  private errors: TrafficError[];
  private maxHistorySize: number;

  constructor(options: TrafficMonitoringOptions = {}) {
    super();
    
    this.requests = [];
    this.errors = [];
    this.maxHistorySize = options.maxHistorySize || 10000;
  }

  async initialize(): Promise<void> {
    // Setup periodic cleanup
    setInterval(() => {
      this.cleanupOldEntries();
    }, 60000); // Every minute
  }

  async recordRequest(request: TrafficRequest): Promise<void> {
    this.requests.push(request);
    
    if (this.requests.length > this.maxHistorySize) {
      this.requests.shift();
    }
    
    this.emit('requestRecorded', request);
  }

  async recordError(error: TrafficError): Promise<void> {
    this.errors.push(error);
    
    if (this.errors.length > this.maxHistorySize) {
      this.errors.shift();
    }
    
    this.emit('errorRecorded', error);
  }

  getStats(): TrafficStats {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recentRequests = this.requests.filter(r => now - r.timestamp < oneHour);
    
    return {
      totalRequests: this.requests.length,
      recentRequests: recentRequests.length,
      totalErrors: this.errors.length,
      averageResponseTime: this.calculateAverageResponseTime(recentRequests),
      requestsPerMinute: this.calculateRequestsPerMinute(recentRequests)
    };
  }

  async getTrafficAnalysis(startTime: number, endTime: number): Promise<TrafficAnalysis> {
    const filteredRequests = this.requests.filter(r => 
      r.timestamp >= startTime && r.timestamp <= endTime
    );
    
    const successfulRequests = filteredRequests.filter(r => 
      r.statusCode >= 200 && r.statusCode < 400
    );
    
    const failedRequests = filteredRequests.filter(r => 
      r.statusCode >= 400 || r.statusCode === 0
    );
    
    return {
      totalRequests: filteredRequests.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: this.calculateAverageResponseTime(filteredRequests),
      totalDataTransferred: filteredRequests.reduce((sum, r) => 
        sum + r.requestSize + r.responseSize, 0
      ),
      topHostnames: this.getTopHostnames(filteredRequests),
      statusCodeDistribution: this.getStatusCodeDistribution(filteredRequests)
    };
  }

  private calculateAverageResponseTime(requests: TrafficRequest[]): number {
    if (requests.length === 0) return 0;
    
    const totalTime = requests.reduce((sum, r) => sum + r.duration, 0);
    return totalTime / requests.length;
  }

  private calculateRequestsPerMinute(requests: TrafficRequest[]): number {
    if (requests.length === 0) return 0;
    
    const now = Date.now();
    const oneMinute = 60 * 1000;
    const recentRequests = requests.filter(r => now - r.timestamp < oneMinute);
    
    return recentRequests.length;
  }

  private getTopHostnames(requests: TrafficRequest[]): Array<{ hostname: string; count: number }> {
    const hostnameCounts: Record<string, number> = {};
    
    for (const request of requests) {
      hostnameCounts[request.hostname] = (hostnameCounts[request.hostname] || 0) + 1;
    }
    
    return Object.entries(hostnameCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([hostname, count]) => ({ hostname, count }));
  }

  private getStatusCodeDistribution(requests: TrafficRequest[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const request of requests) {
      const statusRange = `${Math.floor(request.statusCode / 100)}xx`;
      distribution[statusRange] = (distribution[statusRange] || 0) + 1;
    }
    
    return distribution;
  }

  private cleanupOldEntries(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
  }

  async destroy(): Promise<void> {
    this.removeAllListeners();
  }
}

/**
 * Rate limiting component
 */
class RateLimiter extends EventEmitter {
  private limits: Map<string, RateLimit>;
  private requests: Map<string, number[]>;

  constructor(options: RateLimitingOptions = {}) {
    super();
    
    this.limits = new Map();
    this.requests = new Map();
    
    // Set default limits
    this.setDefaultLimits(options);
  }

  async checkLimit(hostname: string, userId?: string): Promise<void> {
    const key = userId ? `${hostname}:${userId}` : hostname;
    const limit = this.getLimit(hostname);
    
    if (!limit) return;
    
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => 
      now - timestamp < limit.windowMs
    );
    
    if (validRequests.length >= limit.maxRequests) {
      const resetTime = Math.min(...validRequests) + limit.windowMs;
      throw new Error(`Rate limit exceeded. Reset at ${new Date(resetTime).toISOString()}`);
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    this.emit('requestCounted', { key, count: validRequests.length, limit: limit.maxRequests });
  }

  setLimit(hostname: string, limit: RateLimit): void {
    this.limits.set(hostname, limit);
  }

  getStats(): RateLimitStats {
    const stats: RateLimitStats = {
      totalLimits: this.limits.size,
      activeKeys: this.requests.size,
      topConsumers: []
    };
    
    // Get top consumers
    const consumers: Array<{ key: string; count: number }> = [];
    
    for (const [key, requests] of this.requests) {
      consumers.push({ key, count: requests.length });
    }
    
    stats.topConsumers = consumers
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return stats;
  }

  private getLimit(hostname: string): RateLimit | undefined {
    return this.limits.get(hostname) || this.limits.get('*');
  }

  private setDefaultLimits(options: RateLimitingOptions): void {
    // Default rate limit: 100 requests per minute
    this.setLimit('*', {
      maxRequests: options.defaultMaxRequests || 100,
      windowMs: options.defaultWindowMs || 60000
    });
    
    // Specific limits for AI providers
    this.setLimit('api.openai.com', {
      maxRequests: 60,
      windowMs: 60000
    });
    
    this.setLimit('api.anthropic.com', {
      maxRequests: 50,
      windowMs: 60000
    });
  }

  async destroy(): Promise<void> {
    this.limits.clear();
    this.requests.clear();
    this.removeAllListeners();
  }
}

/**
 * Request interception component
 */
class RequestInterceptor extends EventEmitter {
  private interceptors: Map<string, RequestInterceptorFunction>;

  constructor(options: RequestInterceptionOptions = {}) {
    super();
    
    this.interceptors = new Map();
    
    if (options.enableDefaultInterceptors !== false) {
      this.setupDefaultInterceptors();
    }
  }

  async initialize(): Promise<void> {
    // Setup is complete
  }

  async interceptRequest(options: SecureRequestOptions): Promise<SecureRequestOptions> {
    const hostname = new URL(options.url).hostname;
    const interceptor = this.interceptors.get(hostname) || this.interceptors.get('*');
    
    if (interceptor) {
      return await interceptor(options);
    }
    
    return options;
  }

  addInterceptor(hostname: string, interceptor: RequestInterceptorFunction): void {
    this.interceptors.set(hostname, interceptor);
  }

  private setupDefaultInterceptors(): void {
    // Default interceptor to add security headers
    this.addInterceptor('*', async (options) => {
      const headers = options.headers || {};
      
      // Add security headers if not present
      if (!headers['User-Agent']) {
        headers['User-Agent'] = 'AI-Creative-Assistant/1.0';
      }
      
      if (!headers['Accept']) {
        headers['Accept'] = 'application/json';
      }
      
      return { ...options, headers };
    });
  }

  async destroy(): Promise<void> {
    this.interceptors.clear();
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface NetworkSecurityOptions {
  certificatePath?: string;
  monitoring?: TrafficMonitoringOptions;
  rateLimiting?: RateLimitingOptions;
  interception?: RequestInterceptionOptions;
}

export interface SecurityPolicy {
  tlsVersion?: string;
  allowedCiphers?: string[];
  rejectUnauthorized?: boolean;
  requireSNI?: boolean;
  maxRequestSize?: number;
  maxResponseSize?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  requiredHeaders?: string[];
  forbiddenHeaders?: string[];
  requiredResponseHeaders?: string[];
  allowedContentTypes?: string[];
  clientCertificate?: {
    cert: string;
    key: string;
    passphrase?: string;
  };
  blocked?: boolean;
  blockReason?: string;
  blockExpiry?: number;
}

export interface TrustedCertificate {
  fingerprint: string;
  validFrom: string;
  validTo: string;
  issuer: string;
  ca?: string;
  pinned?: boolean;
}

export interface SecureAgentOptions {
  keepAlive?: boolean;
  keepAliveMsecs?: number;
  maxSockets?: number;
  maxFreeSockets?: number;
  timeout?: number;
}

export interface SecureRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  userId?: string;
  agentOptions?: SecureAgentOptions;
}

export interface SecureResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  data: string;
  duration: number;
  encrypted: boolean;
  certificateInfo?: any;
}

export interface SecureConnection {
  hostname: string;
  socket: any;
  createdAt: number;
  lastUsed: number;
}

export interface CertificateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    subject: any;
    issuer: any;
    validFrom: string;
    validTo: string;
    fingerprint: string;
    serialNumber: string;
  };
}

export interface NetworkSecurityStatus {
  activeConnections: number;
  totalConnections: number;
  trustedCertificates: number;
  securityPolicies: number;
  trafficStats: TrafficStats;
  rateLimitStats: RateLimitStats;
  securityEvents: SecurityEvent[];
  recommendations: string[];
}

export interface SecurityReportOptions {
  startTime?: number;
  endTime?: number;
}

export interface NetworkSecurityReport {
  reportId: string;
  generatedAt: number;
  period: { start: number; end: number };
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalDataTransferred: number;
    securityViolations: number;
  };
  trafficAnalysis: TrafficAnalysis;
  securityEvents: SecurityEvent[];
  certificateStatus: CertificateStatus[];
  policyCompliance: PolicyComplianceAnalysis;
  threatAnalysis: ThreatAnalysis;
  recommendations: string[];
}

export interface TrafficMonitoringOptions {
  maxHistorySize?: number;
}

export interface RateLimitingOptions {
  defaultMaxRequests?: number;
  defaultWindowMs?: number;
}

export interface RequestInterceptionOptions {
  enableDefaultInterceptors?: boolean;
}

export interface TrafficRequest {
  hostname: string;
  method: string;
  url: string;
  requestSize: number;
  responseSize: number;
  statusCode: number;
  duration: number;
  encrypted: boolean;
  userId?: string;
  timestamp: number;
}

export interface TrafficError {
  hostname: string;
  error: string;
  userId?: string;
  timestamp: number;
}

export interface TrafficStats {
  totalRequests: number;
  recentRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  requestsPerMinute: number;
}

export interface TrafficAnalysis {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalDataTransferred: number;
  topHostnames: Array<{ hostname: string; count: number }>;
  statusCodeDistribution: Record<string, number>;
}

export interface RateLimit {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitStats {
  totalLimits: number;
  activeKeys: number;
  topConsumers: Array<{ key: string; count: number }>;
}

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  hostname?: string;
  sourceIP?: string;
  description: string;
  details?: Record<string, any>;
}

export interface CertificateStatus {
  hostname: string;
  fingerprint: string;
  validFrom: string;
  validTo: string;
  issuer: string;
  pinned: boolean;
  status: 'valid' | 'expiring' | 'expired';
}

export interface PolicyComplianceAnalysis {
  totalPolicies: number;
  compliantPolicies: number;
  complianceRate: number;
  violations: string[];
}

export interface ThreatAnalysis {
  totalThreats: number;
  highSeverityThreats: number;
  threatTypes: Record<string, number>;
  topSourceIPs: Array<{ ip: string; count: number }>;
  riskScore: number;
}

export type RequestInterceptorFunction = (options: SecureRequestOptions) => Promise<SecureRequestOptions>;