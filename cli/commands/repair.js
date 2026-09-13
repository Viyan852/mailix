#!/usr/bin/env node

/**
 * mlx repair — Restore missing or corrupted parts of the MAILIX install
 *
 * Preserves user data, configuration, and backups. Re-downloads and
 * re-verifies the application files and the bundled Node.js runtime.
 */

const fs = require('fs');
const path = require('path');
const { appDir, dataDir, configDir, runtimeDir, getGitHubOwner, getGitHubRepo } = require('../core/paths');
const { detectPlatform, isWindows } = require('../core/platform');
const { fetchLatestRelease, findAsset, findChecksumAsset, downloadFile } = require('../core/downloader');
const { fetchAndVerifyChecksum } = require('../core/verifier');
const { writeLaunchers } = require('../core/launcher');
const { resolveNode } = require('../core/runtime');

const useColor = !process.argv.includes('--no-color') && process.stdout.isTTY;
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,cyan:36,yellow:33}[color]||0)}m${t}\x1b[0m` : t;

function pass(msg) { console.log(c('green', '✓') + ' ' + msg); }
function warn(msg) { console.log(c('yellow', '!') + ' ' + msg); }
function fail(msg) { console.error(c('red', '✗') + ' ' + msg); }
function step(msg) { console.log(c('cyan', '→') + ' ' + msg); }

function copyDirSync(src, dest, exclude = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d, exclude);
    else fs.copyFileSync(s, d);
  }
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const e of fs.readdirSync(p)) rmrf(path.join(p, e));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

async function repairRuntime(targetPlatform, targetRuntimeDir) {
  step('Downloading bundled Node.js runtime…');
  const NODE_VERSION = 'v20.11.0';
  const NODE_BASE = `https://nodejs.org/dist/${NODE_VERSION}`;
  const archMap = {
    'windows-x64': 'win-x64', 'windows-arm64': 'win-arm64',
    'linux-x64': 'linux-x64', 'linux-arm64': 'linux-arm64',
    'macos-x64': 'darwin-x64', 'macos-arm64': 'darwin-arm64',
  };
  const arch = archMap[targetPlatform];
  if (!arch) throw new Error(`Unsupported platform: ${targetPlatform}`);
  const ext = arch.startsWith('win-') ? 'zip' : 'tar.gz';
  const filename = `node-${NODE_VERSION}-${arch}.${ext}`;
  const url = `${NODE_BASE}/${filename}`;
  const tmp = path.join(require('os').tmpdir(), 'mailix-repair', filename);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  await downloadFile(url, tmp);
  pass('Runtime downloaded');

  step('Extracting runtime…');
  if (fs.existsSync(targetRuntimeDir)) rmrf(targetRuntimeDir);
  fs.mkdirSync(targetRuntimeDir, { recursive: true });
  if (ext === 'zip') {
    const r = require('child_process').spawnSync('powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path "${tmp}" -DestinationPath "${path.dirname(targetRuntimeDir)}" -Force`],
      { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('PowerShell Expand-Archive failed');
    const extracted = path.join(path.dirname(targetRuntimeDir), `node-${NODE_VERSION}-${arch}`);
    if (fs.existsSync(extracted)) {
      copyDirSync(extracted, targetRuntimeDir);
      rmrf(extracted);
    }
  } else {
    const r = require('child_process').spawnSync('tar',
      ['-xzf', tmp, '-C', targetRuntimeDir, '--strip-components=1'],
      { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('tar extraction failed');
  }
  fs.unlinkSync(tmp);
  pass('Runtime installed');
}

async function repairApplication(targetPlatform) {
  step('Fetching latest release…');
  const release = await fetchLatestRelease();
  if (!release) {
    warn('No GitHub release available; falling back to local source');
    return repairFromSource();
  }
  const asset = findAsset(release, targetPlatform);
  const checksumAsset = findChecksumAsset(release, asset);
  if (!asset || !checksumAsset) {
    warn('No release asset/checksum for this platform; falling back to local source');
    return repairFromSource();
  }
  const tmp = path.join(require('os').tmpdir(), 'mailix-repair', asset.name);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  step('Downloading application…');
  await downloadFile(asset.browser_download_url, tmp);
  step('Verifying…');
  await fetchAndVerifyChecksum(tmp, checksumAsset.browser_download_url);
  pass('Verified');

  step('Replacing application files…');
  // Preserve data, config, runtime, logs, backups
  const preserved = ['data', 'config', 'runtime', 'logs', 'backups'];
  for (const p of preserved) {
    const src = path.join(appDir(), p);
    const dest = path.join(appDir(), '.preserve-' + p);
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, dest); } catch (err) { copyDirSync(src, dest); rmrf(src); }
    }
  }
  if (fs.existsSync(appDir())) rmrf(appDir());
  fs.mkdirSync(appDir(), { recursive: true });
  // Extract
  if (targetPlatform.startsWith('windows')) {
    require('child_process').spawnSync('powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path "${tmp}" -DestinationPath "${appDir()}" -Force`],
      { stdio: 'inherit' });
  } else {
    require('child_process').spawnSync('tar',
      ['-xzf', tmp, '-C', appDir(), '--strip-components=1'],
      { stdio: 'inherit' });
  }
  // Restore preserved
  for (const p of preserved) {
    const src = path.join(appDir(), '.preserve-' + p);
    const dest = path.join(appDir(), p);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dest)) rmrf(dest);
      try { fs.renameSync(src, dest); } catch (err) { copyDirSync(src, dest); rmrf(src); }
    }
  }
  fs.unlinkSync(tmp);
  pass('Application repaired');
}

function repairFromSource() {
  const src = path.resolve(__dirname, '..', '..');
  step('Copying from local source…');
  copyDirSync(src, appDir(), ['node_modules', 'data', 'data/inbox', 'data/backups', '.env', 'tests']);
  pass('Application files restored from source');
}

function repairLaunchers() {
  step('Regenerating CLI launchers…');
  writeLaunchers(path.join(appDir(), 'bin'), appDir());
  pass('Launchers written');
}

async function main() {
  console.log('\nMAILIX Repair\n');
  const platform = detectPlatform();
  if (!platform) {
    fail('Unsupported platform');
    process.exit(1);
  }
  pass(`Detected platform: ${platform.name}`);

  // 1. Check installation
  if (!fs.existsSync(appDir())) {
    fail('MAILIX installation not found');
    console.log('Run: mlx-install');
    process.exit(1);
  }
  pass('Installation directory exists');

  // 2. Repair runtime
  const node = resolveNode();
  if (!node.path || node.source !== 'bundled') {
    warn('Bundled runtime missing or unusable');
    try {
      await repairRuntime(platform.name, path.join(appDir(), 'runtime'));
    } catch (err) {
      fail('Could not repair runtime: ' + err.message);
      process.exit(1);
    }
  } else {
    pass('Bundled runtime OK');
  }

  // 3. Repair application
  try {
    await repairApplication(platform.name);
  } catch (err) {
    fail('Could not repair application: ' + err.message);
    process.exit(1);
  }

  // 4. Repair launchers
  repairLaunchers();

  // 5. Final check
  const after = resolveNode();
  if (after.source === 'bundled') {
    pass('Bundled runtime is now usable');
  } else {
    warn('Bundled runtime still not found after repair');
  }

  console.log('\n' + c('green', '✓ MAILIX repair complete.'));
  console.log('Run: mlx doctor  to verify the installation');
}

main().catch((err) => {
  console.error('Repair failed:', err.message);
  process.exit(1);
});
