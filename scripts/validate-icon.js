#!/usr/bin/env node

/**
 * MAILIX Icon Validator
 *
 * Standalone script that validates the canonical icon.
 * Exits with code 0 if the icon is present and valid, 1 otherwise.
 *
 * Use this in CI before running build-release.js.
 */

const path = require('path');
const { validateIcon } = require('../cli/core/icon');

const root = path.resolve(__dirname, '..');

try {
  const p = validateIcon(root);
  const stat = require('fs').statSync(p);
  console.log(`✓ MAILIX icon OK: ${p} (${(stat.size / 1024).toFixed(1)} KB)`);
  process.exit(0);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
