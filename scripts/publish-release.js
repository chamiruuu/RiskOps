#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, createReadStream, statSync } from 'fs';
import { request } from 'https';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const GITHUB_TOKEN = process.env.GH_TOKEN;
const REPO_OWNER = 'chamiruuu';
const REPO_NAME = 'RiskOps';
const RELEASE_DIR = resolve(__dirname, '../release');
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const GITHUB_HEADERS = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

if (!GITHUB_TOKEN) {
  console.error('ERROR: GH_TOKEN environment variable is not set');
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

async function fetchReleaseAssets(releaseId) {
  const response = await fetch(`${API_BASE}/releases/${releaseId}/assets?per_page=100`, {
    method: 'GET',
    headers: GITHUB_HEADERS
  });

  if (!response.ok) {
    const error = await parseResponseBody(response);
    throw new Error(`Failed to fetch release assets: ${formatGithubError(error)}`);
  }

  return response.json();
}

async function deleteExistingAsset(releaseId, fileName) {
  const assets = await fetchReleaseAssets(releaseId);
  const existingAsset = Array.isArray(assets)
    ? assets.find(asset => asset.name === fileName)
    : null;

  if (!existingAsset) {
    return false;
  }

  const deleteResponse = await fetch(`${API_BASE}/releases/assets/${existingAsset.id}`, {
    method: 'DELETE',
    headers: GITHUB_HEADERS
  });

  if (!deleteResponse.ok) {
    const error = await parseResponseBody(deleteResponse);
    throw new Error(`Failed to delete existing asset ${fileName}: ${formatGithubError(error)}`);
  }

  return true;
}

async function uploadAssetWithHttps(releaseId, file) {
  const uploadUrl = new URL(
    `https://uploads.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`
  );
  const fileSize = statSync(file.path).size;

  return new Promise((resolveUpload, rejectUpload) => {
    const req = request(
      uploadUrl,
      {
        method: 'POST',
        headers: {
          ...GITHUB_HEADERS,
          'User-Agent': 'RiskOps-release-publisher',
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize
        },
        timeout: 15 * 60 * 1000
      },
      response => {
        const chunks = [];

        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8');
          let payload = {};
          try {
            payload = bodyText ? JSON.parse(bodyText) : {};
          } catch {
            payload = bodyText ? { message: bodyText } : {};
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolveUpload(payload);
            return;
          }

          rejectUpload(new Error(`Failed to upload ${file.name}: ${formatGithubError(payload)}`));
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Timed out uploading ${file.name}`));
    });
    req.on('error', rejectUpload);

    createReadStream(file.path)
      .on('error', rejectUpload)
      .pipe(req);
  });
}

async function uploadReleaseAsset(releaseId, file) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const replaced = await deleteExistingAsset(releaseId, file.name);
      if (replaced) {
        console.log(`Replaced existing ${file.name}`);
      }

      await uploadAssetWithHttps(releaseId, file);
      console.log(`Uploaded ${file.name}`);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const delay = attempt * 5000;
      console.warn(`Upload failed for ${file.name} (attempt ${attempt}/${maxAttempts}): ${error.message}`);
      console.warn(`Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
}

async function publishRelease() {
  try {
    const packagePath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    const version = packageJson.version;
    const tagName = `v${version}`;

    console.log(`Publishing version ${version}...`);

    console.log('\nBuilding application...');
    execSync('npm run electron:build:nsis', { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
    console.log('Build completed');

    await sleep(1000);

    const files = [
      { name: 'latest.yml', path: resolve(RELEASE_DIR, 'latest.yml') },
      { name: `RiskOps-TMS-Setup-${version}.exe`, path: resolve(RELEASE_DIR, `RiskOps-TMS-Setup-${version}.exe`) },
      { name: `RiskOps-TMS-Setup-${version}.exe.blockmap`, path: resolve(RELEASE_DIR, `RiskOps-TMS-Setup-${version}.exe.blockmap`) }
    ];

    console.log('\nChecking release files...');
    for (const file of files) {
      if (!existsSync(file.path)) {
        console.error(`File not found: ${file.name}`);
        process.exit(1);
      }
      console.log(`Found ${file.name}`);
    }

    console.log(`\nCreating GitHub release ${tagName}...`);

    const createReleaseResponse = await fetch(`${API_BASE}/releases`, {
      method: 'POST',
      headers: {
        ...GITHUB_HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_name: tagName,
        name: `RiskOps TMS ${version}`,
        draft: false,
        prerelease: false,
        body: `## RiskOps TMS ${version}\n\nAutomatic release created and published.`
      })
    });

    let release;
    if (createReleaseResponse.ok) {
      release = await createReleaseResponse.json();
      console.log(`Release created (ID: ${release.id})`);
    } else if (createReleaseResponse.status === 422) {
      const existingReleaseResponse = await fetch(`${API_BASE}/releases/tags/${encodeURIComponent(tagName)}`, {
        method: 'GET',
        headers: GITHUB_HEADERS
      });

      if (!existingReleaseResponse.ok) {
        const error = await parseResponseBody(existingReleaseResponse);
        throw new Error(`Failed to fetch existing release: ${formatGithubError(error)}`);
      }

      release = await existingReleaseResponse.json();
      console.log(`Release ${tagName} already exists. Reusing release ID ${release.id} and replacing assets.`);
    } else {
      const error = await parseResponseBody(createReleaseResponse);
      throw new Error(`Failed to create release: ${formatGithubError(error)}`);
    }

    const releaseId = release.id;

    console.log('\nUploading release files...');
    for (const file of files) {
      await uploadReleaseAsset(releaseId, file);
    }

    console.log(`\nSuccessfully published version ${version}!`);
    console.log(`Release URL: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${tagName}`);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

publishRelease();
