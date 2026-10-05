// Fail unless every declared version matches the release tag (leading "v" optional).
// Usage: node scripts/check-release-version.js 1.4.2

const fs = require('fs');
const path = require('path');

const expected = String(process.argv[2] || '').trim().replace(/^v/, '');
if (!expected) {
  console.error('usage: node scripts/check-release-version.js <tag>');
  process.exit(1);
}

const banner = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8')
  .match(/^\/\/ @version\s+(\S+)\s*$/m);
if (!banner) {
  console.error('check-release-version: no "// @version" line in the build.js userscript banner');
  process.exit(1);
}

const checks = {
  'package.json version': require('../package.json').version,
  'manifest.json version': require('../manifest.json').version,
  'build.js userscript @version': banner[1],
};

let bad = false;
for (const [label, value] of Object.entries(checks)) {
  if (value !== expected) {
    console.error(`version mismatch: ${label} is "${value}", release tag is "${expected}"`);
    bad = true;
  }
}
if (bad) process.exit(1);

console.log(`version guard ok — package.json, manifest.json and build.js are all ${expected}`);
