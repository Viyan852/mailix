#!/usr/bin/env node

/**
 * MAILIX mlx-install launcher
 *
 * Like mlx-run, this uses the bundled Node runtime when present. If a user
 * is running `mlx-install` for the very first time on a clean machine
 * without a bundled runtime yet, falls back to whatever Node is on the
 * developer's system (this is the one place a system Node is allowed).
 */

const path = require('path');
const fs = require('fs');

const { resolveNode } = require('../core/runtime');

const node = resolveNode();
if (!node.path) {
  process.stderr.write('\u2717 Cannot find a runtime to run the installer.\n\n');
  process.stderr.write('If you are a normal user, this should not happen — the\n');
  process.stderr.write('release archive bundles the runtime. Re-download the archive.\n\n');
  process.stderr.write('If you are building from source, run: mlx repair\n');
  process.exit(1);
}

const script = path.join(__dirname, '..', 'commands', 'install.js');
const child = require('child_process').spawn(node.path, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code || 0));
