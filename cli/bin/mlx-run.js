#!/usr/bin/env node

/**
 * MAILIX mlx-run launcher
 *
 * Resolves the bundled Node.js runtime and re-execs the run command under it.
 * Falls back to a system Node only in developer mode (MAILIX_DEV=1).
 */

const path = require('path');
const fs = require('fs');

const { resolveNode } = require('../core/runtime');

const node = resolveNode();
if (!node.path) {
  process.stderr.write('\u2717 MAILIX runtime is missing.\n\n');
  process.stderr.write('Run:\n');
  process.stderr.write('    mlx repair\n');
  process.stderr.write('or reinstall MAILIX via:\n');
  process.stderr.write('    mlx-install\n');
  process.exit(1);
}

// Re-exec under the resolved Node runtime.
// Target: cli/commands/run.js
const script = path.join(__dirname, '..', 'commands', 'run.js');
const child = require('child_process').spawn(node.path, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, MAILIX_BUNDLED_NODE: node.source === 'bundled' ? '1' : '0' },
});
child.on('exit', (code) => process.exit(code || 0));
