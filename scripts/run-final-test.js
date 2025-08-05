#!/usr/bin/env node

/**
 * Final System Test Runner
 * Executes comprehensive system validation and integration testing
 */

const { FinalSystemTest } = require('../dist/test/integration/FinalSystemTest');
const path = require('path');
const fs = require('fs').promises;

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.finalTest = new FinalSystemTest();
    this.startTime = Date.now();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Main test events
    this.finalTest.on('finalTestStarted', (data) => {
      this.log('🚀 Starting Final System Test...', 'cyan');
      this.log(`Timestamp: ${new Date(data.timestamp).toISOString()}`, 'blue');
      console.log();
    });

    this.finalTest.on('phaseStarted', (data) => {
      this.log(`📋 Phase: ${data.description}`, 'magenta');
    });

    this.finalTest.on('phaseCompleted', (data) => {
      const status = data.success ? '✅ PASSED' : '❌ FAILED';
      const color = data.success ? 'green' : 'red';
      this.log(`${status} ${data.phase}`, color);
    });

    this.finalTest.on('phaseSkipped', (data) => {
      this.log(`⏭️  SKIPPED ${data.phase}: ${data.reason}`, 'yellow');
    });

    // Validation events
    this.finalTest.on('systemValidationStarted', () => {
      this.log('  🔍 Running system validations...', 'blue');
    });

    this.finalTest.on('validationSuiteStarted', (data) => {
      this.log(`    • ${data.suite}`, 'blue');
    });

    // Integration test events
    this.finalTest.on('integrationTestingStarted', () => {
      this.log('  🔗 Running integration tests...', 'blue');
    });

    this.finalTest.on('integrationSuiteStarted', (data) => {
      this.log(`    • ${data.suite}`, 'blue');
    });

    this.finalTest.on('integrationTestCompleted', (data) => {
      this.log(`      ✅ ${data.test}`, 'green');
    });

    this.finalTest.on('integrationTestFailed', (data) => {
      this.log(`      ❌ ${data.test}: ${data.error}`, 'red');
    });

    // Report generation
    this.finalTest.on('reportGenerated', (data) => {
      this.log(`📄 Test reports generated in: ${data.path}`, 'cyan');
      data.files.forEach(file => {
        this.log(`    • ${file}`, 'blue');
      });
    });

    // Final completion
    this.finalTest.on('finalTestCompleted', (data) => {
      console.log();
      this.printFinalResults(data);
    });

    this.finalTest.on('finalTestError', (data) => {
      this.log(`💥 Test execution failed: ${data.error}`, 'red');
    });
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    const colorCode = colors[color] || colors.reset;
    console.log(`${colors.blue}[${timestamp}]${colors.reset} ${colorCode}${message}${colors.reset}`);
  }

  printFinalResults(data) {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    // Print header
    console.log('='.repeat(80));
    console.log();
    
    if (data.deploymentReady) {
      this.log('🎉 FINAL SYSTEM TEST PASSED', 'green');
      this.log('✅ System is ready for deployment!', 'green');
    } else {
      this.log('❌ FINAL SYSTEM TEST FAILED', 'red');
      this.log('🚫 System is NOT ready for deployment', 'red');
    }
    
    console.log();
    this.log(`⏱️  Total Duration: ${duration} seconds`, 'blue');
    this.log(`📊 Deployment Status: ${data.results.deploymentReadiness.toUpperCase().replace('-', ' ')}`, 'cyan');
    
    // Print summary statistics
    console.log();
    this.log('📈 Test Summary:', 'magenta');
    
    if (data.results.validationResults) {
      const val = data.results.validationResults.summary;
      this.log(`  System Validation: ${val.passedValidations}/${val.totalValidations} passed (${Math.round(val.successRate)}%)`, 'blue');
      if (val.criticalIssues > 0) {
        this.log(`  ⚠️  Critical Issues: ${val.criticalIssues}`, 'red');
      }
      if (val.warnings > 0) {
        this.log(`  ⚠️  Warnings: ${val.warnings}`, 'yellow');
      }
    }
    
    if (data.results.integrationResults) {
      const int = data.results.integrationResults.summary;
      this.log(`  Integration Tests: ${int.passedTests}/${int.totalTests} passed (${Math.round(int.successRate)}%)`, 'blue');
    }
    
    // Print recommendations
    if (data.results.recommendations.length > 0) {
      console.log();
      this.log('💡 Recommendations:', 'magenta');
      data.results.recommendations.forEach(rec => {
        // Color code recommendations based on content
        let color = 'reset';
        if (rec.includes('✅') || rec.includes('passed')) color = 'green';
        else if (rec.includes('❌') || rec.includes('Critical')) color = 'red';
        else if (rec.includes('⚠️') || rec.includes('Warning')) color = 'yellow';
        
        this.log(`  ${rec}`, color);
      });
    }
    
    console.log();
    console.log('='.repeat(80));
  }

  async run(options = {}) {
    try {
      // Parse command line arguments
      const args = process.argv.slice(2);
      const parsedOptions = this.parseArguments(args);
      const finalOptions = { ...options, ...parsedOptions };
      
      // Show configuration
      if (finalOptions.verbose) {
        this.log('🔧 Test Configuration:', 'cyan');
        if (finalOptions.validationSuites) {
          this.log(`  Validation Suites: ${finalOptions.validationSuites.join(', ')}`, 'blue');
        }
        if (finalOptions.integrationSuites) {
          this.log(`  Integration Suites: ${finalOptions.integrationSuites.join(', ')}`, 'blue');
        }
        this.log(`  Generate Report: ${finalOptions.generateReport ? 'Yes' : 'No'}`, 'blue');
        if (finalOptions.reportPath) {
          this.log(`  Report Path: ${finalOptions.reportPath}`, 'blue');
        }
        console.log();
      }
      
      // Run the final test
      const results = await this.finalTest.runFinalTest(finalOptions);
      
      // Exit with appropriate code
      const exitCode = results.deploymentReadiness === 'ready' || 
                      results.deploymentReadiness === 'ready-with-warnings' ? 0 : 1;
      
      process.exit(exitCode);
      
    } catch (error) {
      this.log(`💥 Fatal error: ${error.message}`, 'red');
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  parseArguments(args) {
    const options = {
      generateReport: true,
      verbose: false
    };
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--help':
        case '-h':
          this.printHelp();
          process.exit(0);
          break;
          
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
          
        case '--no-report':
          options.generateReport = false;
          break;
          
        case '--report-path':
          if (i + 1 < args.length) {
            options.reportPath = args[++i];
          }
          break;
          
        case '--validation-suites':
          if (i + 1 < args.length) {
            options.validationSuites = args[++i].split(',');
          }
          break;
          
        case '--integration-suites':
          if (i + 1 < args.length) {
            options.integrationSuites = args[++i].split(',');
          }
          break;
          
        case '--timeout':
          if (i + 1 < args.length) {
            options.timeout = parseInt(args[++i]);
          }
          break;
          
        default:
          if (arg.startsWith('--')) {
            this.log(`Unknown option: ${arg}`, 'yellow');
          }
          break;
      }
    }
    
    return options;
  }

  printHelp() {
    console.log(`
${colors.cyan}AI Creative Assistant - Final System Test Runner${colors.reset}

${colors.bright}USAGE:${colors.reset}
  node scripts/run-final-test.js [OPTIONS]

${colors.bright}OPTIONS:${colors.reset}
  -h, --help                    Show this help message
  -v, --verbose                 Enable verbose output
  --no-report                   Skip generating test reports
  --report-path <path>          Custom path for test reports
  --validation-suites <suites>  Comma-separated list of validation suites to run
  --integration-suites <suites> Comma-separated list of integration suites to run
  --timeout <ms>                Test timeout in milliseconds

${colors.bright}EXAMPLES:${colors.reset}
  # Run all tests with default settings
  node scripts/run-final-test.js

  # Run with verbose output and custom report path
  node scripts/run-final-test.js --verbose --report-path ./custom-reports

  # Run only specific test suites
  node scripts/run-final-test.js --validation-suites system-requirements,security-validation

  # Run without generating reports
  node scripts/run-final-test.js --no-report

${colors.bright}EXIT CODES:${colors.reset}
  0  All tests passed, system ready for deployment
  1  Tests failed or system not ready for deployment

${colors.bright}AVAILABLE TEST SUITES:${colors.reset}
  ${colors.yellow}Validation Suites:${colors.reset}
    • system-requirements      - Check system meets minimum requirements
    • component-validation      - Validate all components are configured
    • security-validation       - Check security configurations
    • performance-validation    - Validate performance requirements
    • accessibility-validation  - Check accessibility compliance
    • cross-platform-validation - Validate cross-platform compatibility

  ${colors.yellow}Integration Suites:${colors.reset}
    • core-integration          - Test core component integration
    • ai-provider-integration   - Test AI provider switching and fallback
    • accessibility-integration - Test accessibility feature integration
    • plugin-integration        - Test plugin system and SoYume Studio compatibility
    • performance-integration   - Test performance optimization integration
    • e2e-workflows            - Test complete end-to-end user workflows
`);
  }

  async cleanup() {
    await this.finalTest.destroy();
  }
}

// Handle process signals for graceful shutdown
const testRunner = new TestRunner();

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await testRunner.cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await testRunner.cleanup();
  process.exit(143);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await testRunner.cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  await testRunner.cleanup();
  process.exit(1);
});

// Run the test if this script is executed directly
if (require.main === module) {
  testRunner.run().catch(async (error) => {
    console.error('💥 Test runner failed:', error);
    await testRunner.cleanup();
    process.exit(1);
  });
}

module.exports = { TestRunner };