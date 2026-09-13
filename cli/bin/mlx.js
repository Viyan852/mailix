#!/usr/bin/env node

/**
 * MAILIX mlx launcher (the unified CLI).
 *
 * Resolves the bundled Node runtime and re-execs the dispatcher.
 */

const path = require('path');
const { resolveNode } = require('../core/runtime');

const node = resolveNode();
if (!node.path) {
  process.stderr.write('\u2717 MAILIX runtime is missing.\n');
  process.stderr.write('Run: mlx repair\n');
  process.exit(1);
}

const script = path.join(__dirname, '..', 'mlx.js');
const child = require('child_process').spawn(node.path, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code || 0));
