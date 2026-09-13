/**
 * MAILIX Runtime Resolver
 *
 * Locates the Node.js runtime that MAILIX should use.
 *
 * Modes of operation:
 *   - Packaged / installed: ALWAYS uses the bundled runtime at
 *     <appDir>/runtime/node.exe. NEVER silently falls back to system Node.
 *   - Developer mode: activated only with MAILIX_DEV=1. Allows using a
 *     system Node when running MAILIX from source.
 *
 * If the bundled runtime is missing and developer mode is OFF, the
 * resolver returns source='missing' so the caller can produce a clear
 * actionable error message ("MAILIX runtime is missing. Run mlx repair").
 */

const fs = require('fs');
const path = require('path');
const { appDir } = require('./paths');
const { isWindows, getExecutableExtension } = require('./platform');

const RUNTIME_DIR_NAME = 'runtime';
const NODE_EXECUTABLE = isWindows() ? 'node.exe' : 'node';

function isDeveloperMode() {
  return process.env.MAILIX_DEV === '1' || process.env.MAILIX_USE_SYSTEM_NODE === '1';
}

function findBundledNode() {
  const candidates = [
    path.join(appDir(), RUNTIME_DIR_NAME, NODE_EXECUTABLE),
    path.join(__dirname, '..', '..', RUNTIME_DIR_NAME, NODE_EXECUTABLE),
    path.join(__dirname, '..', '..', '..', RUNTIME_DIR_NAME, NODE_EXECUTABLE),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    } catch (err) { /* ignore */ }
  }
  return null;
}

function findSystemNode() {
  const { execSync } = require('child_process');
  const cmd = isWindows() ? 'where node' : 'which node';
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString().trim();
    if (out) return out.split(/\r?\n/)[0].trim();
  } catch (err) { /* not found */ }
  return null;
}

/**
 * Resolve the Node executable to use.
 *
 * Behavior matrix:
 *   - Bundled exists                  → bundled
 *   - Bundled missing, dev mode = on  → system (developer mode, explicit opt-in)
 *   - Bundled missing, dev mode = off → missing (caller must fail loudly)
 *
 * @returns {{ path: string|null, source: 'bundled'|'developer'|'missing' }}
 */
function resolveNode() {
  const bundled = findBundledNode();
  if (bundled) {
    return { path: bundled, source: 'bundled' };
  }
  if (isDeveloperMode()) {
    const system = findSystemNode();
    if (system) {
      return { path: system, source: 'developer' };
    }
    return { path: null, source: 'missing' };
  }
  // Packaged / production: NEVER use system Node. The installer / repair
  // path is the only way to recover.
  return { path: null, source: 'missing' };
}

function runtimeDir() {
  return path.join(appDir(), RUNTIME_DIR_NAME);
}

module.exports = {
  resolveNode,
  findBundledNode,
  findSystemNode,
  isDeveloperMode,
  runtimeDir,
  NODE_EXECUTABLE,
  RUNTIME_DIR_NAME,
};
