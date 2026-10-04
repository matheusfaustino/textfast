/**
 * check-release-version.js — fail unless every declared version matches the tag.
 *
 * Usage:
 *   node scripts/check-release-version.js v1.4.1
 *
 * A leading "v" on the tag is optional. Checked sources:
 *   package.json                        version
 *   manifest.json                       version
 *   build.js ==UserScript== banner      @version
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (err) {
    console.error(`check-release-version: cannot read ${relativePath}: ${err.message}`);
    process.exit(1);
  }
}

const pkg = readJson('package.json');
const manifest = readJson('manifest.json');

let buildSource;
try {
  buildSource = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
} catch (err) {
  console.error(`check-release-version: cannot read build.js: ${err.message}`);
  process.exit(1);
}

const banner = buildSource.match(/^\/\/ @version\s+(\S+)\s*$/m);
if (!banner) {
  console.error('check-release-version: no "// @version" line in the build.js userscript banner');
  process.exit(1);
}

const expected = String(process.argv[2] || '').trim().replace(/^v/, '');
if (!expected) {
  console.error('usage: node scripts/check-release-version.js <tag>');
  process.exit(1);
}

const checks = [
  ['package.json version', pkg.version],
  ['manifest.json version', manifest.version],
  ['build.js userscript @version', banner[1]],
];

const mismatches = checks.filter(([, value]) => value !== expected);

if (mismatches.length > 0) {
  for (const [label, value] of mismatches) {
    console.error(`version mismatch: ${label} is "${value}", release tag is "${expected}"`);
  }
  process.exit(1);
}

console.log(`version guard ok — package.json, manifest.json and build.js are all ${expected}`);
