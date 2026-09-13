/**
 * MAILIX Installer
 *
 * Downloads, verifies, and installs MAILIX from GitHub Releases.
 * Also downloads the bundled Node.js runtime so the user never needs
 * a system Node installation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const {
  appDir, configDir, dataDir, logsDir, backupsDir, binDir,
  configFile, envFile,
} = require('./paths');
const { detectPlatform, isWindows, isLinux, isMacOS, getExecutableExtension } = require('./platform');
const { fetchLatestRelease, findAsset, findChecksumAsset, downloadFile } = require('./downloader');
const { verifyChecksum, fetchAndVerifyChecksum } = require('./verifier');
const { writeLaunchers } = require('./launcher');

const VERSION = require('../../package.json').version;
const NODE_VERSION = 'v20.11.0';

class Installer {
  constructor(opts = {}) {
    this.opts = opts;
    this.useColor = !opts.noColor && process.stdout.isTTY;
    this.dryRun = opts.dryRun || false;
    this.yes = opts.yes || false;
  }

  c(color, text) {
    if (!this.useColor) return text;
    const codes = { red: 31, green: 32, yellow: 33, blue: 34, cyan: 36, gray: 90 };
    return `\x1b[${codes[color] || 0}m${text}\x1b[0m`;
  }

  log(msg) { console.log(msg); }
  ok(msg) { console.log(this.c('green', '✓') + ' ' + msg); }
  warn(msg) { console.log(this.c('yellow', '!') + ' ' + msg); }
  fail(msg) { console.error(this.c('red', '✗') + ' ' + msg); }
  step(msg) { console.log(this.c('cyan', '→') + ' ' + msg); }

  async run() {
    this.log('\nMAILIX Installer\n');

    // 1. Detect platform
    const platform = detectPlatform();
    if (!platform) {
      this.fail(`Your operating system/architecture is not currently supported by this MAILIX release.`);
      this.log(`  Detected: ${process.platform} ${process.arch}`);
      process.exit(1);
    }
    this.ok(`Platform: ${platform.name}`);

    // 2. Check for existing installation
    if (fs.existsSync(path.join(appDir(), 'package.json')) || fs.existsSync(path.join(appDir(), 'app', 'package.json'))) {
      this.warn('MAILIX is already installed.');
      this.log('  Run: mlx update to upgrade.');
      if (!this.yes) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((r) => rl.question('Reinstall? (yes/no): ', r));
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
          this.log('Cancelled.');
          return;
        }
      }
    }

    // 3. Fetch release
    this.step('Fetching latest release from GitHub…');
    let release;
    try {
      release = await fetchLatestRelease();
    } catch (err) {
      this.fail(`Could not reach GitHub: ${err.message}`);
      this.log('  Falling back to bundled installation (development mode).');
      return this.installFromSource();
    }
    if (!release) {
      this.warn('No published release found on GitHub.');
      this.log('  Falling back to bundled installation (development mode).');
      return this.installFromSource();
    }
    this.ok(`Latest release: ${release.tag_name}`);

    // 4. Find platform asset
    const asset = findAsset(release, platform.name);
    if (!asset) {
      this.fail(`No release artifact found for ${platform.name}.`);
      process.exit(1);
    }
    this.ok(`Asset: ${asset.name}`);

    // 5. Download
    const tmpDir = path.join(require('os').tmpdir(), 'mailix-install');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const archivePath = path.join(tmpDir, asset.name);
    this.step('Downloading…');
    try {
      await downloadFile(asset.browser_download_url, archivePath, (downloaded, total) => {
        if (process.stdout.isTTY) {
          const pct = Math.floor((downloaded / total) * 100);
          process.stdout.write(`\r  ${pct}%   `);
        }
      });
      process.stdout.write('\n');
    } catch (err) {
      this.fail(`Download failed: ${err.message}`);
      process.exit(1);
    }
    this.ok('Download complete');

    // 6. Verify
    this.step('Verifying checksum…');
    const checksumAsset = findChecksumAsset(release, asset);
    if (checksumAsset) {
      try {
        await fetchAndVerifyChecksum(archivePath, checksumAsset.browser_download_url);
        this.ok('Checksum verified');
      } catch (err) {
        this.fail(`Verification failed: ${err.message}`);
        process.exit(1);
      }
    } else {
      this.fail('No checksum asset available — refusing to install unverified artifact.');
      process.exit(1);
    }

    // 7. Extract
    this.step('Extracting…');
    this.extractArchive(archivePath, platform.archive);
    this.ok('Extracted');

    // 8. Create directories
    this.createDirectories();

    // 9. Initialize configuration
    this.initializeConfig();

    // 10. Download the bundled Node.js runtime
    try {
      await this.installRuntime(platform.name);
    } catch (err) {
      this.fail(`Runtime install failed: ${err.message}`);
      process.exit(1);
    }

    // 11. Register CLI
    this.registerCli();

    // 12. Clean up
    try { fs.unlinkSync(archivePath); } catch (err) {}

    this.log('\n' + this.c('green', '✓ MAILIX installed successfully.'));
    this.log('\nRun:');
    this.log('  ' + this.c('cyan', 'mlx-run') + '  to start MAILIX.\n');
  }

  extractArchive(archivePath, type) {
    const target = appDir();
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    if (type === 'zip') {
      if (isWindows()) {
        const exitCode = require('child_process').spawnSync('powershell',
          ['-NoProfile', '-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${target}" -Force`]).status;
        if (exitCode !== 0) throw new Error('PowerShell Expand-Archive failed');
      } else {
        const r = require('child_process').spawnSync('unzip', ['-q', '-o', archivePath, '-d', target], { stdio: 'inherit' });
        if (r.status !== 0) throw new Error('unzip failed');
      }
    } else {
      const r = require('child_process').spawnSync('tar', ['-xzf', archivePath, '-C', target, '--strip-components=1'], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('tar extraction failed');
    }
  }

  createDirectories() {
    for (const d of [configDir(), dataDir(), logsDir(), backupsDir()]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }
  }

  initializeConfig() {
    if (!fs.existsSync(configFile())) {
      const config = {
        version: VERSION,
        installedAt: new Date().toISOString(),
        port: 7345,
        provider: 'local',
      };
      fs.writeFileSync(configFile(), JSON.stringify(config, null, 2));
    }
    if (!fs.existsSync(envFile())) {
      try {
        const example = fs.readFileSync(path.join(appDir(), '.env.example'), 'utf8');
        fs.writeFileSync(envFile(), example);
      } catch (err) { /* no example */ }
    }
  }

  /**
   * Download the bundled Node.js runtime for the current platform.
   */
  async installRuntime(platformName) {
    this.step('Installing bundled Node.js runtime…');
    const archMap = {
      'windows-x64': 'win-x64', 'windows-arm64': 'win-arm64',
      'linux-x64': 'linux-x64', 'linux-arm64': 'linux-arm64',
      'macos-x64': 'darwin-x64', 'macos-arm64': 'darwin-arm64',
    };
    const arch = archMap[platformName];
    if (!arch) throw new Error(`Unsupported platform: ${platformName}`);
    const ext = arch.startsWith('win-') ? 'zip' : 'tar.gz';
    const filename = `node-${NODE_VERSION}-${arch}.${ext}`;
    const url = `https://nodejs.org/dist/${NODE_VERSION}/${filename}`;

    const tmpDir = path.join(require('os').tmpdir(), 'mailix-install-runtime');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const archivePath = path.join(tmpDir, filename);
    await downloadFile(url, archivePath);
    this.ok('Runtime downloaded');

    const targetDir = path.join(appDir(), 'runtime');
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    if (ext === 'zip') {
      const r = require('child_process').spawnSync('powershell',
        ['-NoProfile', '-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${path.dirname(targetDir)}" -Force`],
        { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('PowerShell Expand-Archive failed');
      const extracted = path.join(path.dirname(targetDir), `node-${NODE_VERSION}-${arch}`);
      if (fs.existsSync(extracted)) {
        this.copyDirSync(extracted, targetDir);
        fs.rmSync(extracted, { recursive: true, force: true });
      }
    } else {
      const r = require('child_process').spawnSync('tar',
        ['-xzf', archivePath, '-C', targetDir, '--strip-components=1'],
        { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('tar extraction failed');
    }
    fs.unlinkSync(archivePath);
    this.ok('Runtime installed');
  }

  registerCli() {
    // Validate the canonical icon before we register anything
    let iconPath = null;
    try {
      const { validateIcon } = require('./icon');
      iconPath = validateIcon(appDir());
    } catch (err) {
      this.warn(`MAILIX icon missing at ${appDir()}/assets/icon.ico — launchers will not be branded.`);
    }
    writeLaunchers(binDir(), appDir(), { iconPath });
    this.ok('CLI registered in ' + binDir());

    // On Windows, also create Start Menu and Desktop shortcuts
    if (process.platform === 'win32' && iconPath) {
      this.createWindowsShortcuts(iconPath);
    }
  }

  /**
   * Create Windows shortcuts in the Start Menu and on the user's desktop,
   * each pointing at mlx.exe and using the MAILIX icon.
   */
  createWindowsShortcuts(iconPath) {
    try {
      const { buildWindowsShortcut } = require('./icon-builder');
      const mlxExe = path.join(binDir(), 'mlx.exe');
      const mlxInstallExe = path.join(binDir(), 'mlx-install.exe');
      if (!fs.existsSync(mlxExe)) {
        // Fall back to .cmd shim
        this.warn('Windows .exe launchers not found; skipping shortcut creation');
        return;
      }

      const startMenu = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MAILIX');
      fs.mkdirSync(startMenu, { recursive: true });

      // Start Menu entry
      buildWindowsShortcut({
        iconPath,
        targetPath: mlxExe,
        outDir: startMenu,
        shortcutName: 'MAILIX',
      });
      buildWindowsShortcut({
        iconPath,
        targetPath: mlxExe,
        outDir: startMenu,
        shortcutName: 'MAILIX Dashboard',
      });
      this.ok('Start Menu shortcuts created');

      // Desktop shortcut (only if desktop exists)
      const desktop = path.join(os.homedir(), 'Desktop');
      if (fs.existsSync(desktop)) {
        buildWindowsShortcut({
          iconPath,
          targetPath: mlxExe,
          outDir: desktop,
          shortcutName: 'MAILIX',
        });
        this.ok('Desktop shortcut created');
      }
    } catch (err) {
      this.warn(`Could not create Windows shortcuts: ${err.message}`);
    }
  }

  async installFromSource() {
    this.step('Installing from source…');
    const target = appDir();
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    const source = path.resolve(__dirname, '..', '..');
    this.copyDirSync(source, target, ['node_modules', '.git', 'data/inbox', 'dist']);
    this.createDirectories();
    this.initializeConfig();
    try {
      await this.installRuntime(detectPlatform()?.name || process.platform);
    } catch (err) {
      this.warn(`Could not download runtime: ${err.message}`);
    }
    this.registerCli();
    this.log('\n' + this.c('green', '✓ MAILIX installed (from source).'));
    this.log('\nRun:');
    this.log('  ' + this.c('cyan', 'mlx-run') + '  to start MAILIX.\n');
  }

  copyDirSync(src, dest, exclude = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) this.copyDirSync(s, d, exclude);
      else fs.copyFileSync(s, d);
    }
  }
}

module.exports = { Installer, VERSION, NODE_VERSION };
