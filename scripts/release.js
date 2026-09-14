'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VERSION = require(path.join(ROOT, 'package.json')).version;

const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin';

function run(command, args = [], options = {}) {
  console.log(`\n→ ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: IS_WINDOWS,
    ...options
  });
}

function exists(file) {
  return fs.existsSync(file);
}

function remove(file) {
  if (exists(file)) {
    fs.rmSync(file, { recursive: true, force: true });
  }
}

function detectMacOSTarget() {
  const builder = path.join(ROOT, 'scripts', 'build-release.js');

  if (!exists(builder)) {
    throw new Error('scripts/build-release.js not found.');
  }

  const source = fs.readFileSync(builder, 'utf8');

  const targets = [
    'macos-universal',
    'macos-arm64',
    'macos-x64',
    'darwin-universal',
    'darwin-arm64',
    'darwin-x64',
    'macos',
    'darwin'
  ];

  for (const target of targets) {
    if (
      source.includes(`'${target}'`) ||
      source.includes(`"${target}"`) ||
      source.includes(`\`${target}\``)
    ) {
      return target;
    }
  }

  throw new Error(
    'Could not determine a supported macOS target from scripts/build-release.js.'
  );
}

function validatePlatform() {
  if (!IS_WINDOWS && !IS_MACOS) {
    throw new Error(
      `Unsupported release platform: ${process.platform}. MAILIX release supports Windows and macOS.`
    );
  }
}

function validateGitTree() {
  console.log('→ Checking Git working tree…');

  try {
    const status = execFileSync(
      'git',
      ['status', '--porcelain'],
      {
        cwd: ROOT,
        encoding: 'utf8'
      }
    ).trim();

    if (status) {
      throw new Error(
        'Git working tree is not clean. Commit or stash changes before releasing.'
      );
    }

    console.log('✓ Working tree clean');
  } catch (error) {
    if (error.message.includes('Git working tree is not clean')) {
      throw error;
    }

    console.log('⚠ Git check skipped.');
  }
}

function validateIcon() {
  const icon = path.join(ROOT, 'assets', 'icon.ico');

  console.log('→ Validating assets/icon.ico…');

  if (!exists(icon)) {
    throw new Error(`Missing icon: ${icon}`);
  }

  const size = fs.statSync(icon).size;

  if (size < 1000) {
    throw new Error('assets/icon.ico appears to be invalid or empty.');
  }

  console.log(`✓ Icon OK (${(size / 1024).toFixed(1)} KB)`);
}

function runTests() {
  console.log('→ Running tests…');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test']);
  console.log('✓ Tests passed');
}

function runSecretScan() {
  const scanner = path.join(ROOT, 'tests', 'secrets.test.js');

  if (!exists(scanner)) {
    console.log('⚠ Secret scanner not found. Skipping.');
    return;
  }

  console.log('→ Running secret scanner…');
  run(process.execPath, [scanner]);
  console.log('✓ Secret scan passed');
}

function buildRelease() {
  const builder = path.join(ROOT, 'scripts', 'build-release.js');

  if (!exists(builder)) {
    throw new Error('scripts/build-release.js not found.');
  }

  if (IS_WINDOWS) {
    run(process.execPath, [
      builder,
      '--platform=windows-x64',
      `--version=${VERSION}`
    ]);

    return 'windows-x64';
  }

  const target = detectMacOSTarget();

  console.log(`→ macOS target: ${target}`);

  run(process.execPath, [
    builder,
    `--platform=${target}`,
    `--version=${VERSION}`
  ]);

  return target;
}

function locateBuildDir(target) {
  const candidates = [
    path.join(DIST, 'build', `mailix-${target}-v${VERSION}`),
    path.join(DIST, `mailix-${target}-v${VERSION}`),
    path.join(DIST, 'build', `mailix-${target}`),
    path.join(DIST, `mailix-${target}`),
    path.join(DIST, 'build')
  ];

  for (const candidate of candidates) {
    if (exists(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(
    `Could not locate built MAILIX directory for target ${target}.`
  );
}

function verifyRuntime(buildDir) {
  const runtime = path.join(
    buildDir,
    'runtime',
    IS_WINDOWS ? 'node.exe' : 'node'
  );

  console.log('→ Verifying bundled Node.js runtime…');

  if (!exists(runtime)) {
    throw new Error(`Bundled Node.js runtime missing: ${runtime}`);
  }

  if (!IS_WINDOWS) {
    const mode = fs.statSync(runtime).mode;

    if ((mode & 0o111) === 0) {
      fs.chmodSync(runtime, mode | 0o755);
    }
  }

  console.log('✓ Bundled Node.js runtime found');
}

function verifyBuiltIcon(buildDir) {
  const icon = path.join(buildDir, 'assets', 'icon.ico');

  console.log('→ Verifying release icon…');

  if (!exists(icon)) {
    throw new Error(`Release icon missing: ${icon}`);
  }

  console.log('✓ Release icon found');
}

function createPortableZip(buildDir, target) {
  const outputName = IS_WINDOWS
    ? `mailix-windows-x64-v${VERSION}.zip`
    : `mailix-${target}-v${VERSION}.zip`;

  const output = path.join(DIST, outputName);

  remove(output);

  console.log(`→ Creating ${outputName}…`);

  if (IS_WINDOWS) {
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${output}' -Force`
    ]);
  } else {
    run('ditto', [
      '-c',
      '-k',
      '--sequesterRsrc',
      '--keepParent',
      buildDir,
      output
    ]);
  }

  console.log(`✓ Created ${path.relative(ROOT, output)}`);

  return output;
}

function buildWindowsInstaller(buildDir) {
  if (!IS_WINDOWS) {
    return null;
  }

  const installerScript = path.join(ROOT, 'scripts', 'build-installer.js');

  if (!exists(installerScript)) {
    console.log('⚠ Windows installer builder not found. Skipping installer.');
    return null;
  }

  console.log('→ Building MAILIX-Setup-x64.exe…');

  try {
    run(process.execPath, [
      installerScript,
      `--source=${buildDir}`,
      `--version=${VERSION}`
    ]);

    const installer = path.join(DIST, 'MAILIX-Setup-x64.exe');

    if (exists(installer)) {
      console.log('✓ Windows installer created');
      return installer;
    }

    console.log('⚠ Installer builder completed but installer was not found.');
    return null;
  } catch (error) {
    console.log('⚠ Windows installer skipped.');
    console.log(error.message);
    return null;
  }
}

function generateChecksums(files) {
  const checksumFile = path.join(DIST, 'SHA256SUMS');

  const lines = files
    .filter(Boolean)
    .filter(exists)
    .map(file => {
      const hash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex');

      return `${hash}  ${path.basename(file)}`;
    });

  fs.writeFileSync(checksumFile, `${lines.join('\n')}\n`);

  console.log(`✓ Created ${path.relative(ROOT, checksumFile)}`);

  return checksumFile;
}

function gitTagAndPush() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: ROOT,
      stdio: 'ignore'
    });
  } catch {
    console.log('⚠ Not a Git repository. Skipping Git release steps.');
    return;
  }

  const tag = `v${VERSION}`;

  try {
    execFileSync('git', ['rev-parse', tag], {
      cwd: ROOT,
      stdio: 'ignore'
    });

    console.log(`✓ Git tag ${tag} already exists. Not recreating it.`);
    return;
  } catch {}

  try {
    run('git', ['tag', '-a', tag, '-m', `MAILIX ${tag}`]);
    run('git', ['push', 'origin', tag]);
    console.log(`✓ Published Git tag ${tag}`);
  } catch (error) {
    console.log('⚠ Git tag/push skipped.');
    console.log(error.message);
  }
}

function printSummary(target, zip, installer, checksum) {
  console.log('\n========================================');
  console.log('        MAILIX RELEASE COMPLETE');
  console.log('========================================');
  console.log(`Version: ${VERSION}`);
  console.log(`Platform: ${target}`);
  console.log(`ZIP: ${path.relative(ROOT, zip)}`);

  if (installer) {
    console.log(`Installer: ${path.relative(ROOT, installer)}`);
  }

  console.log(`Checksums: ${path.relative(ROOT, checksum)}`);

  console.log('\nRun instructions:');

  if (IS_WINDOWS) {
    console.log('  Use the portable ZIP or MAILIX-Setup-x64.exe');
    console.log('  Dashboard: http://localhost:7345');
  } else {
    console.log('  Extract the ZIP and run the bundled MAILIX launcher.');
    console.log('  Dashboard: http://localhost:7345');
  }

  console.log('========================================\n');
}

async function main() {
  console.log('\nMAILIX Release Orchestrator\n');

  console.log(`→ Version: ${VERSION}`);

  validatePlatform();
  validateGitTree();
  validateIcon();
  runTests();
  runSecretScan();

  const target = buildRelease();
  const buildDir = locateBuildDir(target);

  console.log(`✓ Build found: ${buildDir}`);

  verifyRuntime(buildDir);
  verifyBuiltIcon(buildDir);

  const zip = createPortableZip(buildDir, target);
  const installer = buildWindowsInstaller(buildDir);

  const checksum = generateChecksums([
    zip,
    installer
  ]);

  gitTagAndPush();

  printSummary(
    target,
    zip,
    installer,
    checksum
  );
}

main().catch(error => {
  console.error('\n✗ Release failed.');
  console.error(error.message);
  process.exit(1);
});
