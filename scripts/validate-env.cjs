#!/usr/bin/env node
// ✅ DEPLOY-VERCEL-001: Build-time environment validation
// This script runs BEFORE vite build to ensure all required env vars are present

const fs = require('fs');
const path = require('path');

function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadLocalEnvFiles() {
  const rootDir = path.resolve(__dirname, '..');
  const envFiles = ['.env', '.env.local'];

  for (const fileName of envFiles) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// Define all required environment variables
const REQUIRED_ENV_VARS = {
  'VITE_SUPABASE_URL': {
    description: 'Supabase project URL',
    pattern: /https:\/\/.*\.supabase\.co/,
  },
  'VITE_SUPABASE_ANON_KEY': {
    description: 'Supabase anonymous key',
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/,
  },
};

function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');

  loadLocalEnvFiles();

  const missing = [];
  const invalid = [];

  for (const [varName, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[varName];

    if (!value) {
      missing.push(`  ❌ ${varName}: ${config.description}`);
      continue;
    }

    // Optional: validate format if pattern provided
    if (config.pattern && !config.pattern.test(value)) {
      invalid.push(`  ⚠️  ${varName}: Invalid format. Expected pattern: ${config.pattern}`);
    } else {
      console.log(`  ✅ ${varName}: Present and valid`);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:\n' + missing.join('\n'));
    console.error('\n📋 To fix this:');
    console.error('1. Create .env.local file in project root');
    console.error('2. Add the following variables:');
    for (const varName of Object.keys(REQUIRED_ENV_VARS)) {
      console.error(`   ${varName}=your_value_here`);
    }
    process.exit(1);
  }

  if (invalid.length > 0) {
    console.warn('\n⚠️  WARNING: Some environment values may have invalid format:\n' + invalid.join('\n'));
  }

  console.log('\n✅ All required environment variables are present and valid!\n');
  process.exit(0);
}

// Run validation
validateEnvironment();
