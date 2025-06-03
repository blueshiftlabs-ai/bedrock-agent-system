#!/usr/bin/env node
/**
 * Validate environment files against configuration
 * Ensures all required parameters are present
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from './env-config';

interface ValidationResult {
  app: string;
  type: 'apps' | 'packages';
  valid: boolean;
  missing: string[];
  warnings: string[];
}

class EnvValidator {
  private results: ValidationResult[] = [];

  validate() {
    console.log('🔍 Validating environment files...\n');

    // Validate apps
    Object.keys(config.apps).forEach((appName) => {
      this.validateEnvFile('apps', appName, config.apps[appName]);
    });

    // Validate packages
    Object.keys(config.packages).forEach((pkgName) => {
      this.validateEnvFile('packages', pkgName, config.packages[pkgName]);
    });

    // Print results
    this.printResults();

    // Exit with error if any validation failed
    const hasErrors = this.results.some(r => !r.valid);
    if (hasErrors) {
      process.exit(1);
    }
  }

  private validateEnvFile(type: 'apps' | 'packages', name: string, appConfig: any) {
    const envPath = path.join(process.cwd(), type, name, '.env');
    const result: ValidationResult = {
      app: name,
      type,
      valid: true,
      missing: [],
      warnings: [],
    };

    if (!fs.existsSync(envPath)) {
      result.valid = false;
      result.warnings.push('.env file not found');
      this.results.push(result);
      return;
    }

    // Read and parse .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = this.parseEnvFile(envContent);

    // Check required parameters
    if (appConfig.required) {
      appConfig.required.forEach((param: string) => {
        if (!envVars[param] || envVars[param].trim() === '') {
          result.valid = false;
          result.missing.push(param);
        }
      });
    }

    // Check for all expected parameters (warnings only)
    const allExpected = [
      ...(appConfig.parameters || []),
      ...(appConfig.secrets || []),
    ];

    allExpected.forEach((param: string) => {
      if (!envVars[param] && !appConfig.required?.includes(param)) {
        result.warnings.push(`Optional parameter '${param}' is missing`);
      }
    });

    this.results.push(result);
  }

  private parseEnvFile(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    const lines = content.split('\n');

    lines.forEach((line) => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        return;
      }

      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        vars[match[1].trim()] = match[2].trim();
      }
    });

    return vars;
  }

  private printResults() {
    let totalValid = 0;
    let totalInvalid = 0;

    this.results.forEach((result) => {
      const status = result.valid ? '✅' : '❌';
      console.log(`${status} ${result.type}/${result.app}`);

      if (result.missing.length > 0) {
        console.log(`   Missing required: ${result.missing.join(', ')}`);
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          console.log(`   ⚠️  ${warning}`);
        });
      }

      if (result.valid) {
        totalValid++;
      } else {
        totalInvalid++;
      }
    });

    console.log('\n📊 Summary:');
    console.log(`   Valid: ${totalValid}`);
    console.log(`   Invalid: ${totalInvalid}`);
    console.log(`   Total: ${this.results.length}`);
  }
}

// CLI execution
if (require.main === module) {
  const validator = new EnvValidator();
  validator.validate();
}

export { EnvValidator };