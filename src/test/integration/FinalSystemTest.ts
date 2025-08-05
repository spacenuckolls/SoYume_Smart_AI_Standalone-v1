import { EventEmitter } from 'events';
import { IntegrationTestCoordinator } from './IntegrationTestCoordinator';
import { SystemValidator } from '../validation/SystemValidator';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Final system integration test runner
 * Coordinates comprehensive testing before production deployment
 */
export class FinalSystemTest extends EventEmitter {
  private integrationTester: IntegrationTestCoordinator;
  private systemValidator: SystemValidator;
  private testResults: FinalTestResults;
  private isRunning: boolean;

  constructor() {
    super();
    
    this.integrationTester = new IntegrationTestCoordinator();
    this.systemValidator = new SystemValidator();
    this.testResults = {
      startTime: 0,
      endTime: 0,
      duration: 0,
      overallSuccess: false,
      integrationResults: null,
      validationResults: null,
      recommendations: [],
      deploymentReadiness: 'not-ready'
    };
    this.isRunning = false;
    
    this.setupEventListeners();
  }

  /**
   * Run complete final system test
   */
  async runFinalTest(options: FinalTestOptions = {}): Promise<FinalTestResults> {
    if (this.isRunning) {
      throw new Error('Final system test is already running');
    }

    this.isRunning = true;
    this.testResults.startTime = Date.now();
    
    try {
      this.emit('finalTestStarted', { timestamp: this.testResults.startTime });
      
      // Phase 1: System Validation
      this.emit('phaseStarted', { phase: 'validation', description: 'System Validation' });
      
      const validationResults = await this.systemValidator.validateSystem({
        suites: options.validationSuites
      });
      
      this.testResults.validationResults = validationResults;
      this.emit('phaseCompleted', { phase: 'validation', success: validationResults.success });
      
      // Phase 2: Integration Testing (only if validation passes critical checks)
      if (validationResults.summary.criticalIssues === 0) {
        this.emit('phaseStarted', { phase: 'integration', description: 'Integration Testing' });
        
        const integrationResults = await this.integrationTester.runIntegrationTests({
          suites: options.integrationSuites
        });
        
        this.testResults.integrationResults = integrationResults;
        this.emit('phaseCompleted', { 
          phase: 'integration', 
          success: integrationResults.summary.successRate >= 95 
        });
      } else {
        this.emit('phaseSkipped', { 
          phase: 'integration', 
          reason: 'Critical validation issues must be resolved first' 
        });
      }
      
      // Phase 3: Final Analysis and Recommendations
      this.emit('phaseStarted', { phase: 'analysis', description: 'Final Analysis' });
      
      this.testResults.endTime = Date.now();
      this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
      
      this.analyzeResults();
      this.generateRecommendations();
      this.determineDeploymentReadiness();
      
      this.emit('phaseCompleted', { phase: 'analysis', success: true });
      
      // Generate comprehensive report
      if (options.generateReport) {
        await this.generateTestReport(options.reportPath);
      }
      
      this.emit('finalTestCompleted', { 
        results: this.testResults,
        deploymentReady: this.testResults.deploymentReadiness === 'ready'
      });
      
      return this.testResults;
      
    } catch (error) {
      this.emit('finalTestError', { error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Setup event listeners for sub-components
   */
  private setupEventListeners(): void {
    // Forward integration test events
    this.integrationTester.on('testingStarted', (data) => {
      this.emit('integrationTestingStarted', data);
    });
    
    this.integrationTester.on('suiteStarted', (data) => {
      this.emit('integrationSuiteStarted', data);
    });
    
    this.integrationTester.on('testCompleted', (data) => {
      this.emit('integrationTestCompleted', data);
    });
    
    this.integrationTester.on('testFailed', (data) => {
      this.emit('integrationTestFailed', data);
    });
    
    // Forward validation events
    this.systemValidator.on('validationStarted', (data) => {
      this.emit('systemValidationStarted', data);
    });
    
    this.systemValidator.on('suiteStarted', (data) => {
      this.emit('validationSuiteStarted', data);
    });
    
    this.systemValidator.on('validationCompleted', (data) => {
      this.emit('systemValidationCompleted', data);
    });
    
    this.systemValidator.on('validationFailed', (data) => {
      this.emit('systemValidationFailed', data);
    });
  }

  /**
   * Analyze test results
   */
  private analyzeResults(): void {
    const validation = this.testResults.validationResults;
    const integration = this.testResults.integrationResults;
    
    // Determine overall success
    let overallSuccess = true;
    
    if (validation) {
      // Critical validation issues fail the entire test
      if (validation.summary.criticalIssues > 0) {
        overallSuccess = false;
      }
    } else {
      overallSuccess = false;
    }
    
    if (integration) {
      // Integration tests must have at least 95% success rate
      if (integration.summary.successRate < 95) {
        overallSuccess = false;
      }
    }
    
    this.testResults.overallSuccess = overallSuccess;
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateRecommendations(): void {
    const recommendations: string[] = [];
    
    // Add validation recommendations
    if (this.testResults.validationResults) {
      recommendations.push(...this.testResults.validationResults.recommendations);
    }
    
    // Add integration recommendations
    if (this.testResults.integrationResults) {
      recommendations.push(...this.testResults.integrationResults.recommendations);
    }
    
    // Add final test specific recommendations
    if (this.testResults.overallSuccess) {
      recommendations.push('🎉 All tests passed! System is ready for production deployment.');
      recommendations.push('📋 Recommended next steps:');
      recommendations.push('  • Create production build');
      recommendations.push('  • Deploy to staging environment for final validation');
      recommendations.push('  • Prepare rollback plan');
      recommendations.push('  • Schedule production deployment');
    } else {
      recommendations.push('❌ System is not ready for deployment. Address the following issues:');
      
      if (this.testResults.validationResults?.summary.criticalIssues > 0) {
        recommendations.push(`  • Resolve ${this.testResults.validationResults.summary.criticalIssues} critical validation issue(s)`);
      }
      
      if (this.testResults.integrationResults && this.testResults.integrationResults.summary.successRate < 95) {
        const failedTests = this.testResults.integrationResults.summary.failedTests;
        recommendations.push(`  • Fix ${failedTests} failed integration test(s)`);
      }
      
      recommendations.push('  • Re-run final system test after fixes');
    }
    
    // Performance recommendations
    if (this.testResults.validationResults) {
      const perfSuite = this.testResults.validationResults.suiteResults.find(
        s => s.suite === 'performance-validation'
      );
      if (perfSuite && !perfSuite.success) {
        recommendations.push('⚡ Performance optimization recommended before deployment');
      }
    }
    
    // Security recommendations
    if (this.testResults.validationResults) {
      const secSuite = this.testResults.validationResults.suiteResults.find(
        s => s.suite === 'security-validation'
      );
      if (secSuite && !secSuite.success) {
        recommendations.push('🔒 Security issues must be resolved before deployment');
      }
    }
    
    // Accessibility recommendations
    if (this.testResults.validationResults) {
      const a11ySuite = this.testResults.validationResults.suiteResults.find(
        s => s.suite === 'accessibility-validation'
      );
      if (a11ySuite && !a11ySuite.success) {
        recommendations.push('♿ Accessibility compliance issues should be addressed');
      }
    }
    
    this.testResults.recommendations = recommendations;
  }

  /**
   * Determine deployment readiness
   */
  private determineDeploymentReadiness(): void {
    if (this.testResults.overallSuccess) {
      // Check for any warnings that might affect deployment
      const hasWarnings = this.testResults.validationResults?.summary.warnings > 0;
      
      if (hasWarnings) {
        this.testResults.deploymentReadiness = 'ready-with-warnings';
      } else {
        this.testResults.deploymentReadiness = 'ready';
      }
    } else {
      // Check if issues are critical or can be addressed post-deployment
      const criticalIssues = this.testResults.validationResults?.summary.criticalIssues || 0;
      const integrationFailures = this.testResults.integrationResults?.summary.failedTests || 0;
      
      if (criticalIssues > 0 || integrationFailures > 0) {
        this.testResults.deploymentReadiness = 'not-ready';
      } else {
        this.testResults.deploymentReadiness = 'conditional';
      }
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(reportPath?: string): Promise<void> {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        testDuration: this.testResults.duration,
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
          arch: process.arch
        }
      },
      summary: {
        overallSuccess: this.testResults.overallSuccess,
        deploymentReadiness: this.testResults.deploymentReadiness,
        totalDuration: this.testResults.duration
      },
      validation: this.testResults.validationResults,
      integration: this.testResults.integrationResults,
      recommendations: this.testResults.recommendations,
      nextSteps: this.generateNextSteps()
    };
    
    const reportJson = JSON.stringify(report, null, 2);
    const reportHtml = this.generateHtmlReport(report);
    
    const outputPath = reportPath || path.join(process.cwd(), 'test-reports');
    
    try {
      await fs.mkdir(outputPath, { recursive: true });
      
      // Save JSON report
      await fs.writeFile(
        path.join(outputPath, 'final-system-test.json'),
        reportJson
      );
      
      // Save HTML report
      await fs.writeFile(
        path.join(outputPath, 'final-system-test.html'),
        reportHtml
      );
      
      // Save summary report
      const summary = this.generateSummaryReport();
      await fs.writeFile(
        path.join(outputPath, 'test-summary.md'),
        summary
      );
      
      this.emit('reportGenerated', { 
        path: outputPath,
        files: ['final-system-test.json', 'final-system-test.html', 'test-summary.md']
      });
      
    } catch (error) {
      this.emit('reportError', { error: error.message });
      throw new Error(`Failed to generate test report: ${error.message}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: any): string {
    const statusColor = report.summary.overallSuccess ? '#10B981' : '#EF4444';
    const statusIcon = report.summary.overallSuccess ? '✅' : '❌';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Creative Assistant - Final System Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${statusColor}; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header .status { font-size: 18px; margin-top: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .metric { display: inline-block; background: #f3f4f6; padding: 15px; margin: 10px; border-radius: 6px; min-width: 120px; text-align: center; }
        .metric .value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .metric .label { font-size: 14px; color: #6b7280; }
        .success { color: #10B981; }
        .error { color: #EF4444; }
        .warning { color: #F59E0B; }
        .recommendations { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; }
        .recommendations ul { margin: 10px 0; }
        .test-results { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .test-suite { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; }
        .test-suite h3 { margin-top: 0; color: #374151; }
        .test-case { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .test-case:last-child { border-bottom: none; }
        .test-case.passed { color: #10B981; }
        .test-case.failed { color: #EF4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusIcon} AI Creative Assistant - Final System Test</h1>
            <div class="status">
                Status: ${report.summary.overallSuccess ? 'PASSED' : 'FAILED'} | 
                Deployment: ${report.summary.deploymentReadiness.toUpperCase().replace('-', ' ')} |
                Duration: ${Math.round(report.summary.totalDuration / 1000)}s
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>Test Summary</h2>
                <div class="metrics">
                    ${report.validation ? `
                    <div class="metric">
                        <div class="value ${report.validation.success ? 'success' : 'error'}">${report.validation.summary.passedValidations}</div>
                        <div class="label">Validations Passed</div>
                    </div>
                    <div class="metric">
                        <div class="value ${report.validation.summary.criticalIssues === 0 ? 'success' : 'error'}">${report.validation.summary.criticalIssues}</div>
                        <div class="label">Critical Issues</div>
                    </div>
                    ` : ''}
                    ${report.integration ? `
                    <div class="metric">
                        <div class="value ${report.integration.summary.successRate >= 95 ? 'success' : 'error'}">${Math.round(report.integration.summary.successRate)}%</div>
                        <div class="label">Integration Success</div>
                    </div>
                    <div class="metric">
                        <div class="value ${report.integration.summary.passedTests === report.integration.summary.totalTests ? 'success' : 'error'}">${report.integration.summary.passedTests}/${report.integration.summary.totalTests}</div>
                        <div class="label">Tests Passed</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="section">
                <h2>Recommendations</h2>
                <div class="recommendations">
                    <ul>
                        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="section">
                <h2>Detailed Results</h2>
                <div class="test-results">
                    ${report.validation ? `
                    <div class="test-suite">
                        <h3>System Validation</h3>
                        ${report.validation.suiteResults.map(suite => `
                            <div class="test-case ${suite.success ? 'passed' : 'failed'}">
                                ${suite.success ? '✅' : '❌'} ${suite.suite}
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    ${report.integration ? `
                    <div class="test-suite">
                        <h3>Integration Tests</h3>
                        ${report.integration.suiteResults.map(suite => `
                            <div class="test-case ${suite.success ? 'passed' : 'failed'}">
                                ${suite.success ? '✅' : '❌'} ${suite.suite}
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate markdown summary report
   */
  private generateSummaryReport(): string {
    const status = this.testResults.overallSuccess ? '✅ PASSED' : '❌ FAILED';
    const readiness = this.testResults.deploymentReadiness.toUpperCase().replace('-', ' ');
    
    return `# AI Creative Assistant - Final System Test Summary

## Overall Status: ${status}
**Deployment Readiness:** ${readiness}  
**Test Duration:** ${Math.round(this.testResults.duration / 1000)} seconds  
**Timestamp:** ${new Date().toISOString()}

## Test Results

### System Validation
${this.testResults.validationResults ? `
- **Total Validations:** ${this.testResults.validationResults.summary.totalValidations}
- **Passed:** ${this.testResults.validationResults.summary.passedValidations}
- **Failed:** ${this.testResults.validationResults.summary.failedValidations}
- **Critical Issues:** ${this.testResults.validationResults.summary.criticalIssues}
- **Warnings:** ${this.testResults.validationResults.summary.warnings}
- **Success Rate:** ${Math.round(this.testResults.validationResults.summary.successRate)}%
` : 'Not executed'}

### Integration Testing
${this.testResults.integrationResults ? `
- **Total Tests:** ${this.testResults.integrationResults.summary.totalTests}
- **Passed:** ${this.testResults.integrationResults.summary.passedTests}
- **Failed:** ${this.testResults.integrationResults.summary.failedTests}
- **Success Rate:** ${Math.round(this.testResults.integrationResults.summary.successRate)}%
` : 'Not executed (validation issues prevented execution)'}

## Recommendations

${this.testResults.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${this.generateNextSteps().map(step => `- ${step}`).join('\n')}

---
*Generated by AI Creative Assistant Final System Test v1.0.0*`;
  }

  /**
   * Generate next steps based on results
   */
  private generateNextSteps(): string[] {
    const steps: string[] = [];
    
    if (this.testResults.deploymentReadiness === 'ready') {
      steps.push('✅ Create production build');
      steps.push('✅ Deploy to staging environment');
      steps.push('✅ Perform final user acceptance testing');
      steps.push('✅ Schedule production deployment');
      steps.push('✅ Prepare monitoring and alerting');
    } else if (this.testResults.deploymentReadiness === 'ready-with-warnings') {
      steps.push('⚠️ Review and address warnings');
      steps.push('✅ Create production build');
      steps.push('✅ Deploy to staging with monitoring');
      steps.push('✅ Conduct extended testing period');
    } else {
      steps.push('❌ Fix critical issues identified in test results');
      steps.push('❌ Re-run failed test suites');
      steps.push('❌ Execute final system test again');
      steps.push('❌ Only proceed to deployment after all tests pass');
    }
    
    return steps;
  }

  /**
   * Get current test results
   */
  getTestResults(): FinalTestResults {
    return { ...this.testResults };
  }

  /**
   * Check if test is currently running
   */
  isTestInProgress(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
    }
    
    await this.integrationTester.destroy();
    await this.systemValidator.destroy();
    
    this.removeAllListeners();
  }
}

// Types and interfaces
export interface FinalTestOptions {
  validationSuites?: string[];
  integrationSuites?: string[];
  generateReport?: boolean;
  reportPath?: string;
  timeout?: number;
}

export interface FinalTestResults {
  startTime: number;
  endTime: number;
  duration: number;
  overallSuccess: boolean;
  integrationResults: any | null;
  validationResults: any | null;
  recommendations: string[];
  deploymentReadiness: 'ready' | 'ready-with-warnings' | 'conditional' | 'not-ready';
}

export default FinalSystemTest;