#!/usr/bin/env node

/**
 * MAILIX — Single-Command Release Orchestrator
 *
 * Implements the `npm run release` developer command.
 *
 * What it does, in order:
 *   1. Validate the Git working tree (no unexpected uncommitted changes)
 *   2. Read the version from package.json
 *   3. Validate assets/icon.ico
 *   4. Run the test suite
 *   5. Build the Windows x64 release artifact (with the bundled Node runtime)
 *   6. Build the MAILIX-Setup-x64.exe Windows installer
 *   7. Build the portable mailix-windows-x64.zip
 *   8. Generate SHA256SUMS
 *   9. Stage the final dist/ output the developer can upload
 *  10. Create the vX.Y.Z Git tag (locally)
 *  11. Push the tag to GitHub
 *  12. Open the GitHub Actions release (or print the URL)
 *
 * If ANY step fails, the script exits non-zero immediately. It does NOT
 * create a broken GitHub release or push a broken tag.
 *
 * The release artifact that end users download is MAILIX-Setup-x64.exe.
 * It bundles a Node.js runtime and never needs the end user to install
 * Node.js, npm, Python, Git, or Docker.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

const useColor = process.stdout.isTTY;
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,cyan:36,yellow:33,gray:90}[color]||0)}m${t}\x1b[0m` : t;
const ok = (msg) => console.log(c('green', '✓') + ' ' + msg);
const step = (msg) => console.log(c('cyan', '→') + ' ' + msg);
const warn = (msg) => console.log(c('yellow', '!') + ' ' + msg);
const fail = (msg) => { console.error(c('red', '✗') + ' ' + msg); process.exit(1); };

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.silent ? 'ignore' : 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (r.status !== 0 && !opts.allowFail) {
    fail(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return r;
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  if (!pkg.version) fail('package.json has no "version" field');
  return pkg.version;
}

function ensureCleanTree() {
  step('Checking Git working tree…');
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    // Not a git repo — that's OK for first-time local release, but warn.
    warn('Not a Git repository; will skip tag and push steps.');
    return false;
  }
  const out = (r.stdout || '').trim();
  if (out.length > 0) {
    fail(`Git working tree has uncommitted changes:\n${out}\nCommit or stash before releasing.`);
  }
  ok('Working tree clean');
  return true;
}

function validateIcon() {
  step('Validating assets/icon.ico…');
  const { validateIcon } = require('../cli/core/icon');
  const p = validateIcon(ROOT);
  const stat = fs.statSync(p);
  ok(`Icon OK (${(stat.size / 1024).toFixed(1)} KB)`);
}

function runTests() {
  step('Running tests…');
  const r = spawnSync('npm', ['test'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail('Tests failed');
  ok('Tests passed');
}

function buildRelease() {
  step('Building Windows x64 release (bundles Node.js + dependencies + icon)…');
  // The existing build-release.js produces a self-contained release directory
  // for the chosen platform. We invoke it for windows-x64.
  const r = spawnSync('node', ['scripts/build-release.js', '--platform=windows-x64', '--out=dist/build'], {
    cwd: ROOT, stdio: 'inherit',
  });
  if (r.status !== 0) fail('Build failed');
  ok('Windows x64 build complete');
}

function locateBuildDir() {
  // The build script names the dir mailix-windows-x64-v<version>
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return path.join(DIST, 'build', `mailix-windows-x64-v${pkg.version}`);
}

function createPortableZip(buildDir) {
  step('Creating portable mailix-windows-x64.zip…');
  const zipPath = path.join(DIST, 'mailix-windows-x64.zip');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (process.platform === 'win32') {
    // Use PowerShell Compress-Archive
    const r = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path "${buildDir}" -DestinationPath "${zipPath}" -Force`
    ], { stdio: 'inherit' });
    if (r.status !== 0) fail('PowerShell Compress-Archive failed');
  } else {
    // zip is usually available on Linux/macOS
    const r = spawnSync('zip', ['-r', zipPath, path.basename(buildDir)], {
      cwd: path.dirname(buildDir),
      stdio: 'inherit',
    });
    if (r.status !== 0) fail('zip command failed');
  }
  ok(`Created ${path.relative(ROOT, zipPath)}`);
  return zipPath;
}

function buildInstaller(buildDir) {
  step('Building MAILIX-Setup-x64.exe…');
  // The installer is produced by scripts/build-installer.js (NSIS-based).
  // We pass the EXACT generated build directory, not the dist/ root, so
  // the installer packages the real release artifact.
  const script = path.join(ROOT, 'scripts', 'build-installer.js');
  if (!fs.existsSync(script)) {
    fail('scripts/build-installer.js is missing. Cannot produce MAILIX-Setup-x64.exe.');
  }
  if (!fs.existsSync(buildDir)) {
    fail(`Build directory does not exist: ${buildDir}. Cannot produce installer.`);
  }

  // Verify the build directory actually contains the runtime and icon —
  // otherwise NSIS would produce an installer pointing at nothing.
  if (!fs.existsSync(path.join(buildDir, 'runtime', 'node.exe'))) {
    fail('Build directory is missing runtime/node.exe. Refusing to produce an installer from a broken build.');
  }
  if (!fs.existsSync(path.join(buildDir, 'assets', 'icon.ico'))) {
    fail('Build directory is missing assets/icon.ico. Refusing to produce an installer without branding.');
  }

  const r = spawnSync('node', [
    script,
    '--platform=windows-x64',
    '--in', buildDir,
    '--out', DIST,
  ], {
    cwd: ROOT, stdio: 'inherit',
  });
  if (r.status !== 0) {
    fail('Installer build failed. NSIS is required to produce MAILIX-Setup-x64.exe. Install NSIS (https://nsis.sourceforge.io/) or skip the installer and use the portable ZIP only.');
  }
  const installer = path.join(DIST, 'MAILIX-Setup-x64.exe');
  if (!fs.existsSync(installer)) {
    fail('Installer script exited 0 but MAILIX-Setup-x64.exe was not produced. Build is corrupt.');
  }
  ok(`Created ${path.relative(ROOT, installer)}`);
  return installer;
}

function generateChecksums(artifacts) {
  step('Generating SHA256SUMS…');
  const lines = [];
  for (const file of artifacts) {
    const data = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const name = path.basename(file);
    lines.push(`${hash}  ${name}`);
  }
  const out = path.join(DIST, 'SHA256SUMS');
  fs.writeFileSync(out, lines.join('\n') + '\n');
  ok(`Created ${path.relative(ROOT, out)}`);
  return out;
}

function gitTagAndPush(version, hasRepo) {
  if (!hasRepo) {
    warn('Skipping tag/push (not a Git repository)');
    return;
  }
  const tag = `v${version}`;
  step(`Creating Git tag ${tag}…`);
  const exists = spawnSync('git', ['tag', '--list', tag], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (exists.stdout && exists.stdout.trim() === tag) {
    warn(`Tag ${tag} already exists locally; will push as-is`);
  } else {
    const r = spawnSync('git', ['tag', tag], { cwd: ROOT, shell: process.platform === 'win32' });
    if (r.status !== 0) fail('Failed to create tag');
    ok(`Created tag ${tag}`);
  }
  step(`Pushing tag ${tag} to origin…`);
  const r = spawnSync('git', ['push', 'origin', tag], { cwd: ROOT, shell: process.platform === 'win32' });
  if (r.status !== 0) {
    fail(`Failed to push tag ${tag}. Push manually with: git push origin ${tag}`);
  }
  ok(`Pushed ${tag} — GitHub Actions will produce the official release.`);
}

function printSummary(artifacts) {
  console.log('');
  console.log(c('cyan', '════════════════════════════════════════════════════════'));
  console.log(c('cyan', '  MAILIX RELEASE COMPLETE'));
  console.log(c('cyan', '════════════════════════════════════════════════════════'));
  console.log('');
  console.log('  Generated artifacts in dist/:');
  for (const a of artifacts) {
    const stat = fs.statSync(a);
    console.log(`    ${c('green', '✓')} ${path.relative(ROOT, a)}  (${(stat.size / 1024).toFixed(1)} KB)`);
  }
  console.log('');
  console.log('  End-user requirements:');
  console.log(`    ${c('green', '✓')} Node.js: not required (bundled)`);
  console.log(`    ${c('green', '✓')} npm: not required`);
  console.log(`    ${c('green', '✓')} Python: not required`);
  console.log(`    ${c('green', '✓')} Git: not required`);
  console.log(`    ${c('green', '✓')} Docker: not required`);
  console.log('');
  console.log('  Run on the user\'s machine:');
  console.log('    ' + c('cyan', 'Windows:') + ' Run MAILIX-Setup-x64.exe');
  console.log('    ' + c('cyan', 'macOS:') + '   Download the DMG from the GitHub Release, open, and launch MAILIX');
  console.log('');
  console.log('  Dashboard:  http://localhost:7345');
  console.log('');
}

async function main() {
  console.log('');
  console.log(c('cyan', 'MAILIX Release Orchestrator'));
  console.log('');

  // 1. Read the version
  const version = readPackageVersion();
  step(`Version: ${version}`);

  // 2. Check the working tree
  const hasRepo = ensureCleanTree();

  // 3. Validate the icon
  validateIcon();

  // 4. Run tests
  runTests();

  // 4b. Scan for accidental secrets
  step('Scanning for accidental secrets…');
  const scanResult = spawnSync('node', ['scripts/scan-secrets.js'], {
    cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32',
  });
  if (scanResult.status !== 0) {
    if (scanResult.stdout) console.log(scanResult.stdout);
    if (scanResult.stderr) console.error(scanResult.stderr);
    fail('Secret scan failed. Remove the secrets above before releasing.');
  } else {
    ok('Secret scan clean');
  }

  // 5. Build
  buildRelease();

  // 6. Locate the build output
  const buildDir = locateBuildDir();
  if (!fs.existsSync(buildDir)) {
    fail(`Build directory not found: ${buildDir}`);
  }

  // 7. Create portable ZIP
  const zipPath = createPortableZip(buildDir);

  // 8. Build installer (passes the exact build directory, fails loudly if missing)
  const installerPath = buildInstaller(buildDir);

  // 9. Generate checksums
  const artifacts = [zipPath];
  if (installerPath) artifacts.push(installerPath);
  generateChecksums(artifacts);

  // 10. Verify the bundled Node.js runtime is present in the build output
  //     (this is the core zero-runtime guarantee; do not declare success
  //     without it)
  step('Verifying bundled Node runtime in build…');
  const runtimeExe = process.platform === 'win32'
    ? path.join(buildDir, 'runtime', 'node.exe')
    : path.join(buildDir, 'runtime', 'node');
  if (!fs.existsSync(runtimeExe)) {
    fail('Bundled Node runtime is missing from the build output. Refusing to declare release successful.');
  }
  const runtimeStat = fs.statSync(runtimeExe);
  if (runtimeStat.size === 0) {
    fail('Bundled Node runtime is empty. Build is corrupt.');
  }
  ok(`Bundled Node runtime: ${runtimeExe} (${(runtimeStat.size / 1024 / 1024).toFixed(1)} MB)`);

  // 11. Verify the icon is in the build output
  const builtIcon = path.join(buildDir, 'assets', 'icon.ico');
  if (!fs.existsSync(builtIcon)) {
    fail('Icon is missing from the build output.');
  }
  ok(`Icon in build: ${builtIcon}`);

  // 12. Tag and push (if in a Git repo)
  gitTagAndPush(version, hasRepo);

  // 13. Summary
  printSummary(artifacts);
}

main().catch((err) => {
  console.error('Release failed:', err.message);
  process.exit(1);
});
