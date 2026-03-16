#!/usr/bin/env node
/* global process */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const GITHUB_TOKEN = process.env.GH_TOKEN;
const REPO_OWNER = 'chamiruuu';
const REPO_NAME = 'RiskOps';
const RELEASE_DIR = resolve(__dirname, '../release');
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

if (!GITHUB_TOKEN) {
  console.error('❌ GH_TOKEN environment variable is not set');
  process.exit(1);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatGithubError(errorPayload) {
  if (!errorPayload || typeof errorPayload !== 'object') {
    return 'Unknown GitHub API error';
  }

  const message = errorPayload.message || 'GitHub API request failed';
  const details = Array.isArray(errorPayload.errors)
    ? errorPayload.errors
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        return item.message || `${item.code || 'error'} ${item.field || ''}`.trim();
      })
      .filter(Boolean)
      .join('; ')
    : '';

  return details ? `${message} (${details})` : message;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

async function publishRelease() {
  try {
    // Read version from package.json
    const packagePath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    const version = packageJson.version;
    const tagName = `v${version}`;

    console.log(`📦 Publishing version ${version}...`);

    // Step 1: Build
    console.log('\n🔨 Building application...');
    execSync('npm run electron:build:nsis', { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
    console.log('✅ Build completed');

    // Step 2: Wait for files to be available
    await sleep(1000);

    // Step 3: Check if required files exist
    const files = [
      { name: 'latest.yml', path: resolve(RELEASE_DIR, 'latest.yml') },
      { name: `RiskOps-TMS-Setup-${version}.exe`, path: resolve(RELEASE_DIR, `RiskOps-TMS-Setup-${version}.exe`) },
      { name: `RiskOps-TMS-Setup-${version}.exe.blockmap`, path: resolve(RELEASE_DIR, `RiskOps-TMS-Setup-${version}.exe.blockmap`) }
    ];

    console.log('\n📋 Checking release files...');
    for (const file of files) {
      if (!existsSync(file.path)) {
        console.error(`❌ File not found: ${file.name}`);
        process.exit(1);
      }
      console.log(`✅ Found ${file.name}`);
    }

    // Step 4: Create release on GitHub
    console.log(`\n📤 Creating GitHub release ${tagName}...`);
    
    const createReleaseResponse = await fetch(
      `${API_BASE}/releases`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_name: tagName,
          name: `RiskOps TMS ${version}`,
          draft: false,
          prerelease: false,
          body: `## RiskOps TMS ${version}\n\nAutomatic release created and published.`
        })
      }
    );

    let release;
    if (createReleaseResponse.ok) {
      release = await createReleaseResponse.json();
      console.log(`✅ Release created (ID: ${release.id})`);
    } else if (createReleaseResponse.status === 422) {
      const existingReleaseResponse = await fetch(
        `${API_BASE}/releases/tags/${encodeURIComponent(tagName)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!existingReleaseResponse.ok) {
        const error = await parseResponseBody(existingReleaseResponse);
        throw new Error(`Failed to fetch existing release: ${formatGithubError(error)}`);
      }

      release = await existingReleaseResponse.json();
      console.log(`ℹ️ Release ${tagName} already exists. Reusing release ID ${release.id} and replacing assets.`);
    } else {
      const error = await parseResponseBody(createReleaseResponse);
      throw new Error(`Failed to create release: ${formatGithubError(error)}`);
    }

    const releaseId = release.id;

    // Step 5: Upload files
    console.log(`\n📁 Uploading release files...`);
    for (const file of files) {
      const existingAsset = Array.isArray(release.assets)
        ? release.assets.find(asset => asset.name === file.name)
        : null;

      if (existingAsset) {
        const deleteResponse = await fetch(
          `${API_BASE}/releases/assets/${existingAsset.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        );

        if (!deleteResponse.ok) {
          const error = await parseResponseBody(deleteResponse);
          throw new Error(`Failed to delete existing asset ${file.name}: ${formatGithubError(error)}`);
        }

        console.log(`♻️ Replaced existing ${file.name}`);
      }

      const fileContent = readFileSync(file.path);
      const uploadResponse = await fetch(
        `https://uploads.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/octet-stream'
          },
          body: fileContent
        }
      );

      if (!uploadResponse.ok) {
        const error = await parseResponseBody(uploadResponse);
        throw new Error(`Failed to upload ${file.name}: ${formatGithubError(error)}`);
      }

      console.log(`✅ Uploaded ${file.name}`);
    }

    console.log(`\n🎉 Successfully published version ${version}!`);
    console.log(`📍 Release URL: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${tagName}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

publishRelease();
