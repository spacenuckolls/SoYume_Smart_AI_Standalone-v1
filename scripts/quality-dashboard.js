#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Quality Metrics Dashboard Generator
 * Collects and displays comprehensive quality metrics for the AI Creative Assistant
 */
class QualityDashboard {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      coverage: {},
      performance: {},
      security: {},
      accessibility: {},
      codeQuality: {},
      tests: {},
      dependencies: {}
    };
  }

  /**
   * Collect all quality metrics
   */
  async collectMetrics() {
    console.log('🔍 Collecting quality metrics...');
    
    try {
      await this.collectCoverageMetrics();
      await this.collectPerformanceMetrics();
      await this.collectSecurityMetrics();
      await this.collectAccessibilityMetrics();
      await this.collectCodeQualityMetrics();
      await this.collectTestMetrics();
      await this.collectDependencyMetrics();
      
      console.log('✅ All metrics collected successfully');
    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message);
      throw error;
    }
  }

  /**
   * Collect code coverage metrics
   */
  async collectCoverageMetrics() {
    console.log('📊 Collecting coverage metrics...');
    
    try {
      // Run tests with coverage
      execSync('npm run test:coverage', { stdio: 'pipe' });
      
      // Read coverage summary
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        
        this.metrics.coverage = {
          lines: coverageData.total.lines.pct,
          functions: coverageData.total.functions.pct,
          branches: coverageData.total.branches.pct,
          statements: coverageData.total.statements.pct,
          threshold: {
            lines: 90,
            functions: 90,
            branches: 85,
            statements: 90
          },
          status: this.getCoverageStatus(coverageData.total)
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not collect coverage metrics:', error.message);
      this.metrics.coverage = { error: error.message };
    }
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics() {
    console.log('⚡ Collecting performance metrics...');
    
    try {
      // Run performance tests
      execSync('npm run test:performance', { stdio: 'pipe' });
      
      // Read performance results
      const performancePath = path.join(process.cwd(), 'performance-results', 'summary.json');
      if (fs.existsSync(performancePath)) {
        const performanceData = JSON.parse(fs.readFileSync(performancePath, 'utf8'));
        
        this.metrics.performance = {
          startupTime: performanceData.startupTime || 0,
          memoryUsage: performanceData.memoryUsage || {},
          renderTimes: performanceData.renderTimes || [],
          aiGenerationTimes: performanceData.aiGenerationTimes || [],
          databaseOperationTimes: performanceData.databaseOperationTimes || [],
          thresholds: {
            startupTime: 5000, // 5 seconds
            renderTime: 1000,  // 1 second
            aiGenerationTime: 10000, // 10 seconds
            memoryUsage: 500 * 1024 * 1024 // 500MB
          },
          status: this.getPerformanceStatus(performanceData)
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not collect performance metrics:', error.message);
      this.metrics.performance = { error: error.message };
    }
  }

  /**
   * Collect security metrics
   */
  async collectSecurityMetrics() {
    console.log('🔒 Collecting security metrics...');
    
    try {
      // Run security audit
      const auditResult = execSync('npm audit --json', { stdio: 'pipe', encoding: 'utf8' });
      const auditData = JSON.parse(auditResult);
      
      this.metrics.security = {
        vulnerabilities: {
          critical: auditData.metadata?.vulnerabilities?.critical || 0,
          high: auditData.metadata?.vulnerabilities?.high || 0,
          moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
          low: auditData.metadata?.vulnerabilities?.low || 0,
          info: auditData.metadata?.vulnerabilities?.info || 0
        },
        totalVulnerabilities: auditData.metadata?.vulnerabilities?.total || 0,
        status: this.getSecurityStatus(auditData.metadata?.vulnerabilities || {})
      };
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities are found
      try {
        const auditResult = execSync('npm audit --json', { stdio: 'pipe', encoding: 'utf8' });
        const auditData = JSON.parse(auditResult);
        this.metrics.security = {
          vulnerabilities: auditData.metadata?.vulnerabilities || {},
          totalVulnerabilities: auditData.metadata?.vulnerabilities?.total || 0,
          status: 'warning'
        };
      } catch (parseError) {
        console.warn('⚠️ Could not collect security metrics:', error.message);
        this.metrics.security = { error: error.message };
      }
    }
  }

  /**
   * Collect accessibility metrics
   */
  async collectAccessibilityMetrics() {
    console.log('♿ Collecting accessibility metrics...');
    
    try {
      // Run accessibility tests
      execSync('npm run test:accessibility', { stdio: 'pipe' });
      
      // Read accessibility results
      const accessibilityPath = path.join(process.cwd(), 'accessibility-results', 'summary.json');
      if (fs.existsSync(accessibilityPath)) {
        const accessibilityData = JSON.parse(fs.readFileSync(accessibilityPath, 'utf8'));
        
        this.metrics.accessibility = {
          violations: accessibilityData.violations || 0,
          passes: accessibilityData.passes || 0,
          incomplete: accessibilityData.incomplete || 0,
          wcagLevel: accessibilityData.wcagLevel || 'AA',
          colorContrast: accessibilityData.colorContrast || {},
          keyboardNavigation: accessibilityData.keyboardNavigation || {},
          screenReader: accessibilityData.screenReader || {},
          status: this.getAccessibilityStatus(accessibilityData)
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not collect accessibility metrics:', error.message);
      this.metrics.accessibility = { error: error.message };
    }
  }

  /**
   * Collect code quality metrics
   */
  async collectCodeQualityMetrics() {
    console.log('📝 Collecting code quality metrics...');
    
    try {
      // Run ESLint
      const lintResult = execSync('npx eslint src --format json', { stdio: 'pipe', encoding: 'utf8' });
      const lintData = JSON.parse(lintResult);
      
      const errors = lintData.reduce((sum, file) => sum + file.errorCount, 0);
      const warnings = lintData.reduce((sum, file) => sum + file.warningCount, 0);
      
      // Count lines of code
      const locResult = execSync('find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1', { stdio: 'pipe', encoding: 'utf8' });
      const totalLines = parseInt(locResult.trim().split(/\s+/)[0]) || 0;
      
      // Calculate complexity (simplified)
      const complexityResult = execSync('find src -name "*.ts" -o -name "*.tsx" | xargs grep -c "if\\|for\\|while\\|switch\\|catch" | awk -F: \'{sum+=$2} END {print sum}\'', { stdio: 'pipe', encoding: 'utf8' });
      const cyclomaticComplexity = parseInt(complexityResult.trim()) || 0;
      
      this.metrics.codeQuality = {
        linting: {
          errors,
          warnings,
          status: errors === 0 ? (warnings === 0 ? 'excellent' : 'good') : 'needs-improvement'
        },
        linesOfCode: totalLines,
        cyclomaticComplexity,
        maintainabilityIndex: this.calculateMaintainabilityIndex(totalLines, cyclomaticComplexity, errors + warnings),
        technicalDebt: this.calculateTechnicalDebt(errors, warnings, totalLines)
      };
    } catch (error) {
      console.warn('⚠️ Could not collect code quality metrics:', error.message);
      this.metrics.codeQuality = { error: error.message };
    }
  }

  /**
   * Collect test metrics
   */
  async collectTestMetrics() {
    console.log('🧪 Collecting test metrics...');
    
    try {
      // Run all tests and collect results
      const testResult = execSync('npm run test:all -- --reporter=json', { stdio: 'pipe', encoding: 'utf8' });
      const testData = JSON.parse(testResult);
      
      this.metrics.tests = {
        total: testData.numTotalTests || 0,
        passed: testData.numPassedTests || 0,
        failed: testData.numFailedTests || 0,
        skipped: testData.numPendingTests || 0,
        duration: testData.testResults?.reduce((sum, result) => sum + (result.perfStats?.end - result.perfStats?.start || 0), 0) || 0,
        suites: {
          unit: this.getTestSuiteMetrics('unit'),
          integration: this.getTestSuiteMetrics('integration'),
          e2e: this.getTestSuiteMetrics('e2e'),
          performance: this.getTestSuiteMetrics('performance'),
          accessibility: this.getTestSuiteMetrics('accessibility')
        },
        status: this.getTestStatus(testData)
      };
    } catch (error) {
      console.warn('⚠️ Could not collect test metrics:', error.message);
      this.metrics.tests = { error: error.message };
    }
  }

  /**
   * Collect dependency metrics
   */
  async collectDependencyMetrics() {
    console.log('📦 Collecting dependency metrics...');
    
    try {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Count dependencies
      const dependencies = Object.keys(packageJson.dependencies || {}).length;
      const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
      
      // Check for outdated packages
      const outdatedResult = execSync('npm outdated --json', { stdio: 'pipe', encoding: 'utf8' });
      const outdatedData = JSON.parse(outdatedResult || '{}');
      const outdatedCount = Object.keys(outdatedData).length;
      
      // Calculate bundle size (simplified)
      const bundleSize = this.calculateBundleSize();
      
      this.metrics.dependencies = {
        total: dependencies + devDependencies,
        production: dependencies,
        development: devDependencies,
        outdated: outdatedCount,
        bundleSize,
        status: this.getDependencyStatus(outdatedCount, bundleSize)
      };
    } catch (error) {
      console.warn('⚠️ Could not collect dependency metrics:', error.message);
      this.metrics.dependencies = { error: error.message };
    }
  }

  /**
   * Generate HTML dashboard
   */
  generateDashboard() {
    console.log('📊 Generating quality dashboard...');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Creative Assistant - Quality Dashboard</title>
    <style>
        ${this.getDashboardStyles()}
    </style>
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>🎭 AI Creative Assistant - Quality Dashboard</h1>
            <p class="timestamp">Generated: ${new Date(this.metrics.timestamp).toLocaleString()}</p>
        </header>
        
        <div class="metrics-grid">
            ${this.generateCoverageCard()}
            ${this.generatePerformanceCard()}
            ${this.generateSecurityCard()}
            ${this.generateAccessibilityCard()}
            ${this.generateCodeQualityCard()}
            ${this.generateTestCard()}
            ${this.generateDependencyCard()}
        </div>
        
        <div class="summary-section">
            ${this.generateSummary()}
        </div>
        
        <footer class="dashboard-footer">
            <p>Quality Dashboard v1.0 | Last updated: ${new Date().toLocaleString()}</p>
        </footer>
    </div>
    
    <script>
        ${this.getDashboardScript()}
    </script>
</body>
</html>`;

    // Write dashboard to file
    const dashboardPath = path.join(process.cwd(), 'quality-dashboard.html');
    fs.writeFileSync(dashboardPath, html);
    
    console.log(`✅ Quality dashboard generated: ${dashboardPath}`);
    return dashboardPath;
  }

  /**
   * Helper methods for status calculation
   */
  getCoverageStatus(coverage) {
    const linesPct = coverage.lines.pct;
    if (linesPct >= 90) return 'excellent';
    if (linesPct >= 80) return 'good';
    if (linesPct >= 70) return 'fair';
    return 'poor';
  }

  getPerformanceStatus(performance) {
    const startupTime = performance.startupTime || 0;
    if (startupTime <= 3000) return 'excellent';
    if (startupTime <= 5000) return 'good';
    if (startupTime <= 8000) return 'fair';
    return 'poor';
  }

  getSecurityStatus(vulnerabilities) {
    const critical = vulnerabilities.critical || 0;
    const high = vulnerabilities.high || 0;
    
    if (critical > 0) return 'critical';
    if (high > 0) return 'poor';
    if ((vulnerabilities.moderate || 0) > 5) return 'fair';
    return 'excellent';
  }

  getAccessibilityStatus(accessibility) {
    const violations = accessibility.violations || 0;
    if (violations === 0) return 'excellent';
    if (violations <= 3) return 'good';
    if (violations <= 10) return 'fair';
    return 'poor';
  }

  getTestStatus(testData) {
    const passed = testData.numPassedTests || 0;
    const total = testData.numTotalTests || 1;
    const passRate = (passed / total) * 100;
    
    if (passRate === 100) return 'excellent';
    if (passRate >= 95) return 'good';
    if (passRate >= 85) return 'fair';
    return 'poor';
  }

  getDependencyStatus(outdated, bundleSize) {
    if (outdated === 0 && bundleSize < 5 * 1024 * 1024) return 'excellent';
    if (outdated <= 3 && bundleSize < 10 * 1024 * 1024) return 'good';
    if (outdated <= 10 && bundleSize < 20 * 1024 * 1024) return 'fair';
    return 'poor';
  }

  calculateMaintainabilityIndex(loc, complexity, issues) {
    // Simplified maintainability index calculation
    const baseScore = 100;
    const locPenalty = Math.log(loc) * 2;
    const complexityPenalty = complexity * 0.5;
    const issuesPenalty = issues * 2;
    
    return Math.max(0, Math.round(baseScore - locPenalty - complexityPenalty - issuesPenalty));
  }

  calculateTechnicalDebt(errors, warnings, loc) {
    // Simplified technical debt calculation (hours)
    const errorTime = errors * 0.5; // 30 minutes per error
    const warningTime = warnings * 0.1; // 6 minutes per warning
    const complexityTime = (loc / 1000) * 0.2; // 12 minutes per 1000 LOC
    
    return Math.round((errorTime + warningTime + complexityTime) * 10) / 10;
  }

  calculateBundleSize() {
    // Simplified bundle size calculation
    try {
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        const stats = execSync(`du -sb ${distPath}`, { stdio: 'pipe', encoding: 'utf8' });
        return parseInt(stats.split('\t')[0]) || 0;
      }
    } catch (error) {
      // Fallback estimation
      return 15 * 1024 * 1024; // 15MB estimate
    }
    return 0;
  }

  getTestSuiteMetrics(suite) {
    // Mock test suite metrics (in real implementation, parse actual test results)
    return {
      total: 50,
      passed: 48,
      failed: 1,
      skipped: 1,
      duration: 5000
    };
  }

  /**
   * Dashboard HTML generation methods
   */
  getDashboardStyles() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; }
        .dashboard { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .dashboard-header { text-align: center; margin-bottom: 30px; }
        .dashboard-header h1 { color: #2c3e50; margin-bottom: 10px; }
        .timestamp { color: #7f8c8d; font-size: 14px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-card h3 { margin-bottom: 15px; color: #2c3e50; }
        .status-excellent { border-left: 4px solid #27ae60; }
        .status-good { border-left: 4px solid #f39c12; }
        .status-fair { border-left: 4px solid #e67e22; }
        .status-poor { border-left: 4px solid #e74c3c; }
        .status-critical { border-left: 4px solid #c0392b; }
        .metric-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #7f8c8d; font-size: 14px; }
        .progress-bar { width: 100%; height: 8px; background: #ecf0f1; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .summary-section { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .dashboard-footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 12px; }
    `;
  }

  generateCoverageCard() {
    const coverage = this.metrics.coverage;
    if (coverage.error) return this.generateErrorCard('Code Coverage', coverage.error);
    
    return `
        <div class="metric-card status-${coverage.status}">
            <h3>📊 Code Coverage</h3>
            <div class="metric-value">${coverage.lines}%</div>
            <div class="metric-label">Lines Covered</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${coverage.lines}%; background: #27ae60;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 12px;">
                Functions: ${coverage.functions}% | Branches: ${coverage.branches}% | Statements: ${coverage.statements}%
            </div>
        </div>
    `;
  }

  generatePerformanceCard() {
    const performance = this.metrics.performance;
    if (performance.error) return this.generateErrorCard('Performance', performance.error);
    
    return `
        <div class="metric-card status-${performance.status}">
            <h3>⚡ Performance</h3>
            <div class="metric-value">${performance.startupTime}ms</div>
            <div class="metric-label">Startup Time</div>
            <div style="margin-top: 10px; font-size: 12px;">
                Memory: ${Math.round((performance.memoryUsage.peak || 0) / 1024 / 1024)}MB<br>
                Render Time: ${performance.renderTimes.length > 0 ? Math.round(performance.renderTimes[0].duration) : 0}ms
            </div>
        </div>
    `;
  }

  generateSecurityCard() {
    const security = this.metrics.security;
    if (security.error) return this.generateErrorCard('Security', security.error);
    
    return `
        <div class="metric-card status-${security.status}">
            <h3>🔒 Security</h3>
            <div class="metric-value">${security.totalVulnerabilities}</div>
            <div class="metric-label">Total Vulnerabilities</div>
            <div style="margin-top: 10px; font-size: 12px;">
                Critical: ${security.vulnerabilities.critical} | High: ${security.vulnerabilities.high}<br>
                Moderate: ${security.vulnerabilities.moderate} | Low: ${security.vulnerabilities.low}
            </div>
        </div>
    `;
  }

  generateAccessibilityCard() {
    const accessibility = this.metrics.accessibility;
    if (accessibility.error) return this.generateErrorCard('Accessibility', accessibility.error);
    
    return `
        <div class="metric-card status-${accessibility.status}">
            <h3>♿ Accessibility</h3>
            <div class="metric-value">${accessibility.violations}</div>
            <div class="metric-label">WCAG Violations</div>
            <div style="margin-top: 10px; font-size: 12px;">
                WCAG Level: ${accessibility.wcagLevel}<br>
                Passes: ${accessibility.passes} | Incomplete: ${accessibility.incomplete}
            </div>
        </div>
    `;
  }

  generateCodeQualityCard() {
    const quality = this.metrics.codeQuality;
    if (quality.error) return this.generateErrorCard('Code Quality', quality.error);
    
    return `
        <div class="metric-card status-${quality.linting.status}">
            <h3>📝 Code Quality</h3>
            <div class="metric-value">${quality.maintainabilityIndex}</div>
            <div class="metric-label">Maintainability Index</div>
            <div style="margin-top: 10px; font-size: 12px;">
                Errors: ${quality.linting.errors} | Warnings: ${quality.linting.warnings}<br>
                LOC: ${quality.linesOfCode.toLocaleString()} | Complexity: ${quality.cyclomaticComplexity}<br>
                Technical Debt: ${quality.technicalDebt}h
            </div>
        </div>
    `;
  }

  generateTestCard() {
    const tests = this.metrics.tests;
    if (tests.error) return this.generateErrorCard('Tests', tests.error);
    
    const passRate = tests.total > 0 ? Math.round((tests.passed / tests.total) * 100) : 0;
    
    return `
        <div class="metric-card status-${tests.status}">
            <h3>🧪 Tests</h3>
            <div class="metric-value">${passRate}%</div>
            <div class="metric-label">Pass Rate</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${passRate}%; background: #27ae60;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 12px;">
                Passed: ${tests.passed} | Failed: ${tests.failed} | Skipped: ${tests.skipped}<br>
                Duration: ${Math.round(tests.duration / 1000)}s
            </div>
        </div>
    `;
  }

  generateDependencyCard() {
    const deps = this.metrics.dependencies;
    if (deps.error) return this.generateErrorCard('Dependencies', deps.error);
    
    return `
        <div class="metric-card status-${deps.status}">
            <h3>📦 Dependencies</h3>
            <div class="metric-value">${deps.total}</div>
            <div class="metric-label">Total Packages</div>
            <div style="margin-top: 10px; font-size: 12px;">
                Production: ${deps.production} | Dev: ${deps.development}<br>
                Outdated: ${deps.outdated} | Bundle: ${Math.round(deps.bundleSize / 1024 / 1024)}MB
            </div>
        </div>
    `;
  }

  generateErrorCard(title, error) {
    return `
        <div class="metric-card status-poor">
            <h3>❌ ${title}</h3>
            <div class="metric-value">Error</div>
            <div class="metric-label">Could not collect metrics</div>
            <div style="margin-top: 10px; font-size: 12px; color: #e74c3c;">
                ${error}
            </div>
        </div>
    `;
  }

  generateSummary() {
    const overallStatus = this.calculateOverallStatus();
    
    return `
        <h2>📋 Quality Summary</h2>
        <div style="margin-top: 15px;">
            <div class="metric-card status-${overallStatus.status}">
                <h3>Overall Quality Score</h3>
                <div class="metric-value">${overallStatus.score}/100</div>
                <div class="metric-label">${overallStatus.description}</div>
                <div style="margin-top: 15px;">
                    <h4>Recommendations:</h4>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        ${overallStatus.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
  }

  calculateOverallStatus() {
    const scores = [];
    const recommendations = [];
    
    // Coverage score
    if (!this.metrics.coverage.error) {
      const coverageScore = this.metrics.coverage.lines;
      scores.push(coverageScore);
      if (coverageScore < 90) {
        recommendations.push('Increase test coverage to at least 90%');
      }
    }
    
    // Performance score
    if (!this.metrics.performance.error) {
      const perfScore = Math.max(0, 100 - (this.metrics.performance.startupTime / 50));
      scores.push(perfScore);
      if (this.metrics.performance.startupTime > 5000) {
        recommendations.push('Optimize application startup time');
      }
    }
    
    // Security score
    if (!this.metrics.security.error) {
      const secScore = Math.max(0, 100 - (this.metrics.security.totalVulnerabilities * 10));
      scores.push(secScore);
      if (this.metrics.security.totalVulnerabilities > 0) {
        recommendations.push('Address security vulnerabilities');
      }
    }
    
    // Test score
    if (!this.metrics.tests.error) {
      const testScore = this.metrics.tests.total > 0 ? (this.metrics.tests.passed / this.metrics.tests.total) * 100 : 0;
      scores.push(testScore);
      if (testScore < 95) {
        recommendations.push('Fix failing tests');
      }
    }
    
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    
    let status, description;
    if (averageScore >= 90) {
      status = 'excellent';
      description = 'Excellent quality - ready for production';
    } else if (averageScore >= 80) {
      status = 'good';
      description = 'Good quality - minor improvements needed';
    } else if (averageScore >= 70) {
      status = 'fair';
      description = 'Fair quality - several improvements needed';
    } else {
      status = 'poor';
      description = 'Poor quality - significant improvements required';
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All quality metrics are meeting targets!');
    }
    
    return {
      score: averageScore,
      status,
      description,
      recommendations
    };
  }

  getDashboardScript() {
    return `
        // Auto-refresh dashboard every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 5 * 60 * 1000);
        
        // Add click handlers for metric cards
        document.querySelectorAll('.metric-card').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                card.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 150);
            });
        });
        
        console.log('Quality Dashboard loaded successfully');
    `;
  }

  /**
   * Save metrics to JSON file
   */
  saveMetrics() {
    const metricsPath = path.join(process.cwd(), 'quality-metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
    console.log(`📊 Metrics saved to: ${metricsPath}`);
    return metricsPath;
  }
}

// Main execution
async function main() {
  try {
    const dashboard = new QualityDashboard();
    await dashboard.collectMetrics();
    
    const dashboardPath = dashboard.generateDashboard();
    const metricsPath = dashboard.saveMetrics();
    
    console.log('\n🎉 Quality dashboard generation completed!');
    console.log(`📊 Dashboard: ${dashboardPath}`);
    console.log(`📋 Metrics: ${metricsPath}`);
    
    // Open dashboard in browser if requested
    if (process.argv.includes('--open')) {
      const { execSync } = require('child_process');
      const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${command} ${dashboardPath}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate quality dashboard:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = QualityDashboard;