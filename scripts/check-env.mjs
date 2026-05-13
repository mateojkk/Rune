import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const examplePath = path.join(rootDir, '.env.example');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return values;
}

function isUnset(value) {
  return value === undefined || value === '';
}

function isPlaceholder(value) {
  if (isUnset(value)) return true;

  const normalized = value.toLowerCase();
  return (
    normalized.includes('your-google-client-id') ||
    normalized.includes('replace-me') ||
    normalized === 'changeme'
  );
}

const envValues = {
  ...parseEnvFile(examplePath),
  ...parseEnvFile(envPath),
  ...process.env,
};

const issues = [];
const warnings = [];

if (!fs.existsSync(envPath)) {
  issues.push('`.env` is missing. Copy `.env.example` to `.env` before starting the app.');
}

const network = (envValues.NETWORK || 'testnet').toLowerCase();
if (!['testnet', 'mainnet'].includes(network)) {
  issues.push(`\`NETWORK\` must be \`testnet\` or \`mainnet\`, received \`${envValues.NETWORK}\`.`);
}

for (const key of ['VITE_API_BASE', 'VITE_WEB_URL', 'VITE_REDIRECT_URL']) {
  if (isUnset(envValues[key])) {
    issues.push(`\`${key}\` is required.`);
  }
}

if (isPlaceholder(envValues.VITE_GOOGLE_CLIENT_ID)) {
  warnings.push('`VITE_GOOGLE_CLIENT_ID` is still unset or using the example placeholder. Google sign-in will fail until it is configured.');
}

if (network === 'mainnet') {
  for (const key of ['WALRUS_PUBLISHER_URL', 'WALRUS_AGGREGATOR_URL']) {
    if (isUnset(envValues[key])) {
      warnings.push(`\`${key}\` is not set. The app will fall back to its built-in default.`);
    }
  }
}

if (issues.length > 0) {
  console.error('Environment check failed:\n');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  if (warnings.length > 0) {
    console.error('\nWarnings:');
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exitCode = 1;
} else {
  console.log('Environment check passed.');

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}
