#!/usr/bin/env node

/**
 * mlx version — Show MAILIX version and runtime info
 */

const { VERSION } = require('../core/installer');
const { resolveNode } = require('../core/runtime');

const node = resolveNode();
const runtimeLabel = node.source === 'bundled' ? 'Bundled Node.js' :
                     node.source === 'developer' ? 'System Node.js (developer mode)' :
                     node.source === 'system' ? 'System Node.js (fallback)' :
                     'Missing';

console.log(`MAILIX ${VERSION}`);
console.log('MAILIX — by its_viyan');
console.log('');
console.log('Runtime:');
console.log(`  ${runtimeLabel}`);
if (node.path) {
  console.log(`  Path: ${node.path}`);
}
