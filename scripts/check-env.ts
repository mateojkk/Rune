#!/usr/bin/env npx tsx
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validValues?: string[];
}

const ROOT_ENV_VARS: EnvVar[] = [
  { name: 'NETWORK', required: false, description: 'Network: testnet | mainnet', validValues: ['testnet', 'mainnet'] },
  { name: 'API_HOST', required: false, description: 'API server host', default: '0.0.0.0' },
  { name: 'API_PORT', required: false, description: 'API server port', default: '3001' },
  { name: 'WALRUS_PUBLISHER_URL', required: false, description: 'Walrus publisher URL override' },
  { name: 'WALRUS_AGGREGATOR_URL', required: false, description: 'Walrus aggregator URL override' },
  { name: 'SEAL_PACKAGE_ID', required: false, description: 'Seal package ID override' },
  { name: 'SEAL_KEY_SERVER_1', required: false, description: 'Seal key server 1 object ID' },
  { name: 'SEAL_KEY_SERVER_2', required: false, description: 'Seal key server 2 object ID' },
];

const WEB_ENV_VARS: EnvVar[] = [
  { name: 'VITE_API_BASE', required: false, description: 'Web app API base URL', default: 'http://localhost:3001' },
];

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  });
  return env;
}

function validateEnv(vars: EnvVar[], env: Record<string, string>, prefix = '') {
  let hasError = false;
  
  for (const v of vars) {
    const value = env[v.name];
    
    if (!value && v.required) {
      console.error(`❌ ${prefix}${v.name} is required but not set`);
      hasError = true;
      continue;
    }
    
    if (v.validValues && value && !v.validValues.includes(value)) {
      console.error(`❌ ${prefix}${v.name} must be one of: ${v.validValues.join(' | ')}`);
      hasError = true;
      continue;
    }
    
    if (value) {
      console.log(`✅ ${prefix}${v.name}=${value}`);
    } else if (v.default) {
      console.log(`✅ ${prefix}${v.name}=${v.default} (default)`);
    } else {
      console.log(`✅ ${prefix}${v.name} not set (optional)`);
    }
  }
  
  return hasError;
}

function main() {
  console.log('🔍 Checking environment configuration...\n');
  
  console.log('📁 Root .env:');
  const rootEnvPath = resolve(process.cwd(), '.env');
  let rootEnv: Record<string, string> = {};
  
  if (existsSync(rootEnvPath)) {
    rootEnv = parseEnvFile(readFileSync(rootEnvPath, 'utf-8'));
  } else {
    console.log('⚠️  .env file not found (run: cp .env.example .env)');
  }
  
  const rootErrors = validateEnv(ROOT_ENV_VARS, rootEnv);
  
  console.log('\n📁 Web .env:');
  const webEnvPath = resolve(process.cwd(), 'apps/web/.env');
  let webEnv: Record<string, string> = {};
  
  if (existsSync(webEnvPath)) {
    webEnv = parseEnvFile(readFileSync(webEnvPath, 'utf-8'));
  } else {
    console.log('⚠️  apps/web/.env not found (optional)');
  }
  
  const webErrors = validateEnv(WEB_ENV_VARS, webEnv, '');
  
  console.log('\n' + '='.repeat(50));
  
  if (rootErrors || webErrors) {
    console.error('\n❌ Environment validation failed');
    process.exit(1);
  }
  
  console.log('\n✅ Environment validation passed');
}

main();