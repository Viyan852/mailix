#!/usr/bin/env node

/**
 * mlx update — Update MAILIX to the latest release
 *
 * Preserves configuration, database, and data.
 * Reverts the application directory if the update fails.
 */

const fs = require('fs');
const path = require('path');
const { appDir, dataDir, configDir, isRunning, stopProcess } = require('../core/paths');
const { detectPlatform } = require('../core/platform');
const { fetchLatestRelease, findAsset, findChecksumAsset, downloadFile } = require('../core/download');
const { fetchAndVerifyChecksum } = require('../core/verifier');
const { Installer, VERSION } = require('../core/installer');

async function main() {
  const args = process.argv.slice(2);
  const useColor = !args.includes('--no-color') && process.stdout.isTTY;
  const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,cyan:36,yellow:33}[color]||0)}m${t}\x1b[0m` : t;

  console.log(c('cyan', '\nMAILIX Updater\n'));

  // Check current version
  console.log(`Current version: ${VERSION}`);

  // Stop service if running
  if (isRunning()) {
    console.log(c('yellow', '!') + ' Stopping MAILIX…');
    stopProcess();
    await new Promise(r => setTimeout(r, 1500));
  }

  // Detect platform
  const platform = detectPlatform();
  if (!platform) {
    console.error(c('red', '✗') + ' Unsupported platform');
    process.exit(1);
  }

  // Fetch release
  console.log('Fetching latest release…');
  const release = await fetchLatestRelease();
  if (!release) {
    console.error(c('red', '✗') + ' No releases available');
    process.exit(1);
  }
  console.log(`Latest: ${release.tag_name}`);

  if (release.tag_name === `v${VERSION}`) {
    console.log(c('green', '✓') + ' Already up to date.');
    return;
  }

  // Find asset
  const asset = findAsset(release, platform.name);
  if (!asset) {
    console.error(c('red', '✗') + ' No asset for this platform');
    process.exit(1);
  }
  const checksumAsset = findChecksumAsset(release, asset);
  if (!checksumAsset) {
    console.error(c('red', '✗') + ' No checksum available — refusing to update unverified');
    process.exit(1);
  }

  // Backup current app
  console.log('Backing up current installation…');
  const backupDir = path.join(dataDir(), 'backups', 'app-' + Date.now());
  if (fs.existsSync(appDir())) {
    copyDirSync(appDir, backupDir, ['backups', 'inbox']);
  }
  console.log(c('green', '✓') + ' Backed up to ' + backupDir);

  // Download
  const tmpDir = path.join(require('os').tmpdir(), 'mailix-update');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const archivePath = path.join(tmpDir, asset.name);
  console.log('Downloading ' + asset.name + '…');
  await downloadFile(asset.browser_download_url, archivePath);
  console.log(c('green', '✓') + ' Downloaded');

  // Verify
  console.log('Verifying…');
  try {
    await fetchAndVerifyChecksum(archivePath, checksumAsset.browser_download_url);
  } catch (err) {
    console.error(c('red', '✗') + ' Verification failed: ' + err.message);
    console.log('Restoring previous installation…');
    restoreApp(backupDir);
    process.exit(1);
  }
  console.log(c('green', '✓') + ' Verified');

  // Preserve persistent dirs
  const preserved = ['data', 'config', 'backups', 'inbox'];

  // Install
  try {
    const installer = new Installer({ noColor: !useColor, yes: true });
    installer.extractArchive(archivePath, platform.archive);
    console.log(c('green', '✓') + ' Updated to ' + release.tag_name);
  } catch (err) {
    console.error(c('red', '✗') + ' Installation failed: ' + err.message);
    console.log('Restoring previous installation…');
    restoreApp(backupDir);
    process.exit(1);
  }

  // Clean up
  try { fs.unlinkSync(archivePath); } catch (err) {}
  console.log(c('green', '\n✓ MAILIX updated successfully.'));
  console.log('Run: mlx-run to start the new version.');
}

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

function restoreApp(backupDir) {
  if (!fs.existsSync(backupDir)) return;
  // Remove current app, then copy from backup
  rmrf(appDir());
  copyDirSync(backupDir, appDir());
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

main().catch((err) => {
  console.error('Update failed:', err.message);
  process.exit(1);
});
