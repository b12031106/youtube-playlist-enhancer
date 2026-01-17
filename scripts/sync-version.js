#!/usr/bin/env node

/**
 * Sync version from package.json to manifest.json
 * This script is automatically run by npm version command
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Read manifest.json
const manifestPath = path.join(__dirname, '../dist/manifest.json');

// Check if dist/manifest.json exists (after build)
if (!fs.existsSync(manifestPath)) {
  console.log('⚠️  dist/manifest.json not found. Run "npm run build" first.');
  console.log('   Updating source manifest.json instead...');

  // Update source manifest.json
  const srcManifestPath = path.join(__dirname, '../manifest.json');
  const manifestJson = JSON.parse(fs.readFileSync(srcManifestPath, 'utf8'));

  const oldVersion = manifestJson.version;
  const newVersion = packageJson.version;

  manifestJson.version = newVersion;

  fs.writeFileSync(srcManifestPath, JSON.stringify(manifestJson, null, 2) + '\n');

  console.log(`✅ Version synced: ${oldVersion} → ${newVersion}`);
  console.log(`   - package.json: ${newVersion}`);
  console.log(`   - manifest.json: ${newVersion}`);
  process.exit(0);
}

// Update dist/manifest.json
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const oldVersion = manifestJson.version;
const newVersion = packageJson.version;

manifestJson.version = newVersion;

fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n');

// Also update source manifest.json
const srcManifestPath = path.join(__dirname, '../manifest.json');
const srcManifestJson = JSON.parse(fs.readFileSync(srcManifestPath, 'utf8'));
srcManifestJson.version = newVersion;
fs.writeFileSync(srcManifestPath, JSON.stringify(srcManifestJson, null, 2) + '\n');

console.log(`✅ Version synced: ${oldVersion} → ${newVersion}`);
console.log(`   - package.json: ${newVersion}`);
console.log(`   - manifest.json: ${newVersion}`);
console.log(`   - dist/manifest.json: ${newVersion}`);
