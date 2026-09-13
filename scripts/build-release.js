#!/usr/bin/env node

/**
 * MAILIX Release Builder
 *
 * Produces a self-contained, platform-specific release directory that
 * bundles the MAILIX application, a Node.js runtime, branded Windows
 * launchers with the MAILIX icon, and a SHA256SUMS file.
 *
 * Usage:
 *   node scripts/build-release.js [--platform=windows-x64] [--out=dist]
 *
 * Steps:
 *   1. Validate assets/icon.ico (fails if missing).
 *   2. Install production dependencies (npm ci --omit=dev).
 *   3. Download a Node.js runtime for the target platform.
 *   4. Copy the application files into the release directory.
 *   5. Copy assets/icon.ico to the release directory.
 *   6. Write bin/ launchers — for Windows targets, real .exe files with
 *      the MAILIX icon embedded; for other targets, POSIX sh scripts.
 *   7. Generate SHA256SUMS.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const target = (args.find(a => a.startsWith('--platform=')) || '').split('=')[1]
  || (process.platform === 'win32' ? 'windows-x64'
   : process.platform === 'darwin' ? 'macos-universal'
   : (process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'));
const outDir = path.resolve((args.find(a => a.startsWith('--out=')) || '').split('=')[1] || 'dist');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const NODE_VERSION = 'v20.11.0';
const NODE_BASE_URL = `https://nodejs.org/dist/${NODE_VERSION}`;

// Import the icon module early so the build fails fast if the icon is
// missing or invalid.
const { validateIcon, runtimeIconPath } = require('../cli/core/icon');
const { isWindows } = require('../cli/core/platform');

console.log(`\nMAILIX release builder`);
console.log(`  Target:  ${target}`);
console.log(`  Output:  ${outDir}`);
console.log(`  Version: ${version}\n`);

// 1. Validate the icon. The build will NOT proceed without it.
console.log('Validating icon…');
const iconPath = validateIcon(ROOT);
const iconStat = fs.statSync(iconPath);
console.log(`  ✓ ${iconPath} (${(iconStat.size / 1024).toFixed(1)} KB)`);

function archSuffix(platform) {
  if (platform === 'windows-x64') return { node: 'win-x64', archive: 'zip' };
  if (platform === 'windows-arm64') return { node: 'win-arm64', archive: 'zip' };
  if (platform === 'linux-x64') return { node: 'linux-x64', archive: 'tar.gz' };
  if (platform === 'linux-arm64') return { node: 'linux-arm64', archive: 'tar.gz' };
  if (platform === 'macos-x64') return { node: 'darwin-x64', archive: 'tar.gz' };
  if (platform === 'macos-arm64') return { node: 'darwin-arm64', archive: 'tar.gz' };
  throw new Error(`Unsupported platform: ${platform}`);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (u) => https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return follow(res.headers.location);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
      }
    res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
    follow(url);
  });
}

async function downloadNodeRuntime(platform, targetDir) {
  if (platform === 'macos-universal') {
    const tmpDir = path.join(require('os').tmpdir(), 'mailix-build', 'universal-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });

    const dlAndExtract = async (arch) => {
      const filename = `node-${NODE_VERSION}-darwin-${arch}.tar.gz`;
      const url = `${NODE_BASE_URL}/${filename}`;
      const tmpFile = path.join(tmpDir, filename);
      console.log(`Downloading Node.js runtime (${arch})…\n  ${url}`);
      await downloadFile(url, tmpFile);
      const extDir = path.join(tmpDir, arch);
      fs.mkdirSync(extDir, { recursive: true });
      const r = spawnSync('tar', ['-xzf', tmpFile, '-C', extDir, '--strip-components=1'], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('tar extraction failed for ' + arch);
      return extDir;
    };

    const x64Dir = await dlAndExtract('x64');
    const armDir = await dlAndExtract('arm64');

    console.log('Merging Node binaries using lipo…');
    copyDirSync(armDir, targetDir); // Use arm64 as base
    
    const nodeX64 = path.join(x64Dir, 'bin', 'node');
    const nodeArm = path.join(armDir, 'bin', 'node');
    const nodeUniv = path.join(targetDir, 'bin', 'node');
    
    const rLipo = spawnSync('lipo', ['-create', nodeX64, nodeArm, '-output', nodeUniv], { stdio: 'inherit' });
    if (rLipo.status !== 0) {
      console.warn('lipo failed or is not available. Falling back to arm64 Node runtime only.');
    } else {
      console.log('  ✓ Created universal Node binary');
    }
    rmrf(tmpDir);
    return;
  }

  const { node: nodeArch, archive } = archSuffix(platform);
  const filename = `node-${NODE_VERSION}-${nodeArch}.${archive}`;
  const url = `${NODE_BASE_URL}/${filename}`;
  const tmp = path.join(require('os').tmpdir(), 'mailix-build', filename);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });

  console.log(`Downloading Node.js runtime…\n  ${url}`);
  await downloadFile(url, tmp);
  console.log('  done');

  console.log('Extracting runtime…');
  fs.mkdirSync(targetDir, { recursive: true });
  if (archive === 'zip') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${tmp}" -DestinationPath "${path.dirname(targetDir)}" -Force`], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('PowerShell Expand-Archive failed');
    const extracted = path.join(path.dirname(targetDir), `node-${NODE_VERSION}-${nodeArch}`);
    if (fs.existsSync(extracted)) {
      copyDirSync(extracted, targetDir);
      rmrf(extracted);
    }
  } else {
    const r = spawnSync('tar', ['-xzf', tmp, '-C', targetDir, '--strip-components=1'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('tar extraction failed');
  }
  fs.unlinkSync(tmp);
  console.log('  done');
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

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const e of fs.readdirSync(p)) rmrf(path.join(p, e));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

function installProdDependencies(appDir) {
  console.log('Installing production dependencies…');
  const r = spawnSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: appDir, stdio: 'inherit', shell: true,
  });
  if (r.status !== 0) {
    const r2 = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: appDir, stdio: 'inherit', shell: true,
    });
    if (r2.status !== 0) throw new Error('Failed to install production dependencies');
  }
}

function writeWindowsLaunchers(releaseDir, iconPath, target) {
  // Use the icon-builder module to produce real .exe files with the icon embedded.
  const { writeLaunchers } = require('../cli/core/launcher');
  const binDir = path.join(releaseDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  // Resolve the bundled node from the RELEASE TARGET, not the build host.
  // Windows targets always have node.exe; POSIX targets have node.
  const nodeExeName = (target && target.startsWith('windows')) ? 'node.exe' : 'node';
  const bundledNode = path.join(releaseDir, 'runtime', nodeExeName);
  if (!fs.existsSync(bundledNode)) {
    throw new Error(`Bundled Node runtime missing at ${bundledNode}. Build is corrupt.`);
  }
  writeLaunchers(binDir, releaseDir, { iconPath, bundledNode, target });
  console.log(`  ✓ Launchers written with MAILIX icon (target=${target})`);
}

function writeChecksumsForArtifacts(artifacts) {
  // Hashes the supplied list of absolute file paths, writes a deterministic
  // SHA256SUMS file at the first artifact's directory level (or CWD if none).
  if (!artifacts || artifacts.length === 0) return null;
  const lines = [];
  for (const file of artifacts) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    lines.push(`${hash}  ${path.basename(file)}`);
  }
  const checksumFile = path.join(path.dirname(artifacts[0]), 'SHA256SUMS');
  fs.writeFileSync(checksumFile, lines.join('\n') + '\n');
  return checksumFile;
}

function writeChecksums(releaseDir) {
  // DEPRECATED: kept for compatibility. Use writeChecksumsForArtifacts.
  // Hashes every file in the release root (legacy behavior).
  const file = path.join(releaseDir, 'SHA256SUMS');
  const entries = [];
  for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === 'SHA256SUMS') continue;
    const fullPath = path.join(releaseDir, entry.name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
    entries.push(`${hash}  ${entry.name}`);
  }
  fs.writeFileSync(file, entries.join('\n') + '\n');
  console.log(`  ✓ Checksums written to SHA256SUMS`);
}

async function build() {
  const releaseName = `mailix-${target}-v${version}`;
  const releaseDir = path.join(outDir, releaseName);
  
  const isMac = target.startsWith('macos');
  const rootDir = isMac ? path.join(releaseDir, 'MAILIX.app', 'Contents', 'Resources') : releaseDir;
  
  const appDir = path.join(rootDir, 'app');
  const runtimeDir = path.join(rootDir, 'runtime');
  const assetsDir = path.join(rootDir, 'assets');

  if (fs.existsSync(releaseDir)) rmrf(releaseDir);
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // 1. Copy source
  console.log('Copying application source…');
  copyDirSync(ROOT, appDir, [
    'node_modules', 'dist', '.git', 'data', 'data/inbox',
    'data/backups', 'data/runtime', '.env', '.env.local', 'tests', 'assets',
  ]);
  console.log('  done');

  // 2. Install production dependencies in the app dir
  installProdDependencies(appDir);

  // 3. Download and place the runtime
  await downloadNodeRuntime(target, runtimeDir);

  // 4. Copy the canonical icon to the release
  console.log('Embedding MAILIX icon…');
  fs.copyFileSync(iconPath, path.join(assetsDir, 'icon.ico'));
  const installedIcon = path.join(assetsDir, 'icon.ico');
  console.log(`  ✓ Copied to ${installedIcon}`);

  // 5. Write launchers — target-aware. Do NOT inspect the build host.
  if (target.startsWith('windows')) {
    writeWindowsLaunchers(rootDir, installedIcon, target);
  } else if (isMac) {
    console.log('Writing macOS .app bundle…');
    const macOsDir = path.join(releaseDir, 'MAILIX.app', 'Contents', 'MacOS');
    fs.mkdirSync(macOsDir, { recursive: true });
    
    // Create bash launcher
    const sh = `#!/bin/bash
DIR="$( cd "$( dirname "$0" )" && pwd )"
MAILIX_HOME="$DIR/../Resources"
export MAILIX_ICON="$MAILIX_HOME/assets/icon.icns"
exec "$MAILIX_HOME/runtime/bin/node" "$MAILIX_HOME/app/cli/bin/mlx-run.js" "$@"
`;
    const launcherDest = path.join(macOsDir, 'MAILIX');
    fs.writeFileSync(launcherDest, sh);
    fs.chmodSync(launcherDest, 0o755);
    
    // Create Info.plist
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>MAILIX</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>CFBundleIdentifier</key>
    <string>com.viyan.mailix</string>
    <key>CFBundleName</key>
    <string>MAILIX</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
</dict>
</plist>`;
    fs.writeFileSync(path.join(releaseDir, 'MAILIX.app', 'Contents', 'Info.plist'), plist);
    
    // Create icon.icns if sips is available
    const icnsDest = path.join(assetsDir, 'icon.icns');
    const tmpIconSet = path.join(assetsDir, 'icon.iconset');
    fs.mkdirSync(tmpIconSet, { recursive: true });
    const rSips = spawnSync('sips', ['-z', '256', '256', path.join(ROOT, 'assets', 'icon.png'), '--out', path.join(tmpIconSet, 'icon_256x256.png')], { stdio: 'ignore' });
    if (rSips.status === 0) {
      spawnSync('iconutil', ['-c', 'icns', tmpIconSet, '-o', icnsDest], { stdio: 'ignore' });
    }
    rmrf(tmpIconSet);
    
    // Ad-hoc sign the bundle
    spawnSync('xattr', ['-cr', path.join(releaseDir, 'MAILIX.app')], { stdio: 'ignore' });
    spawnSync('codesign', ['--force', '--deep', '-s', '-', path.join(releaseDir, 'MAILIX.app')], { stdio: 'ignore' });
    
    console.log(`  ✓ MAILIX.app created`);
  } else {
    const { writeLaunchers } = require('../cli/core/launcher');
    const binDir = path.join(rootDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    writeLaunchers(binDir, rootDir, { iconPath: installedIcon, target });
    console.log(`  ✓ POSIX launchers written (target=${target})`);
  }

  // 6. Generate checksums
  console.log('Generating checksums…');
  writeChecksums(releaseDir);

  // 6b. Write a VERSION file for the installer to consume
  const versionFile = path.join(releaseDir, 'VERSION');
  fs.writeFileSync(versionFile, `${version}\n`);

  console.log(`\nRelease built: ${releaseDir}`);
  console.log('Archive with:');
  console.log(`  tar -czf ${releaseName}.${target.startsWith('windows') ? 'zip' : 'tar.gz'} -C ${outDir} ${releaseName}`);
}

build().catch((err) => {
  console.error('\n✗ Build failed:', err.message);
  process.exit(1);
});
