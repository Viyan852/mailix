'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function readPackageVersion() {
  const packagePath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  if (!pkg.version) {
    throw new Error('package.json does not contain a version.');
  }

  return pkg.version;
}

const VERSION = readPackageVersion();
const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin';

function exists(file) {
  return fs.existsSync(file);
}

function run(command, args = []) {
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: IS_WINDOWS
  });
}

function checkGitClean() {
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
        'Release aborted: uncommitted changes detected. Commit or stash all changes before releasing.'
      );
    }
  } catch (error) {
    if (error.message.includes('uncommitted changes')) {
      throw error;
    }

    console.log('⚠ Git repository check skipped.');
  }
}

function validateIcon() {
  const icon = path.join(ROOT, 'assets', 'icon.ico');

  console.log('→ Validating assets/icon.ico…');

  if (!exists(icon)) {
    throw new Error(`Missing required icon: ${icon}`);
  }

  const size = fs.statSync(icon).size;

  if (size <= 0) {
    throw new Error('assets/icon.ico is empty.');
  }

  console.log(`✓ Icon OK (${(size / 1024).toFixed(1)} KB)`);
}

function runTests() {
  console.log('→ Running tests…');

  run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['test']
  );

  console.log('✓ Tests passed');
}

function runSecretScan() {
  const scanner = path.join(ROOT, 'tests', 'secrets.test.js');

  if (!exists(scanner)) {
    return;
  }

  console.log('→ Running secret scanner…');
  run(process.execPath, [scanner]);
  console.log('✓ Secret scan passed');
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
      source.includes(`"${target}"`)
    ) {
      return target;
    }
  }

  throw new Error(
    'No supported macOS target found in scripts/build-release.js.'
  );
}

function buildRelease() {
  const builder = path.join(ROOT, 'scripts', 'build-release.js');

  if (!exists(builder)) {
    throw new Error('scripts/build-release.js not found.');
  }

  let target;

  if (IS_WINDOWS) {
    target = 'windows-x64';
  } else if (IS_MACOS) {
    target = detectMacOSTarget();
  } else {
    throw new Error(
      `Unsupported release platform: ${process.platform}`
    );
  }

  console.log(`→ Building target: ${target}`);

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
    path.join(DIST, `mailix-${target}`)
  ];

  for (const dir of candidates) {
    if (exists(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }

  const buildDir = path.join(DIST, 'build');

  if (exists(buildDir)) {
    const entries = fs.readdirSync(buildDir, {
      withFileTypes: true
    });

    const match = entries.find(
      entry =>
        entry.isDirectory() &&
        entry.name.toLowerCase().includes('mailix')
    );

    if (match) {
      return path.join(buildDir, match.name);
    }
  }

  throw new Error(
    `Could not locate MAILIX build directory for target ${target}.`
  );
}

function verifyRuntime(buildDir) {
  const runtimeName = IS_WINDOWS ? 'node.exe' : 'node';
  const runtime = path.join(buildDir, 'runtime', runtimeName);

  console.log('→ Verifying bundled Node.js runtime…');

  if (!exists(runtime)) {
    throw new Error(
      `Release validation failed: bundled Node.js runtime is missing: ${runtime}`
    );
  }

  if (!IS_WINDOWS) {
    const stat = fs.statSync(runtime);

    if ((stat.mode & 0o111) === 0) {
      fs.chmodSync(runtime, stat.mode | 0o755);
    }
  }

  console.log('✓ Bundled Node.js runtime found');
}

function verifyBuiltIcon(buildDir) {
  const icon = path.join(buildDir, 'assets', 'icon.ico');

  console.log('→ Verifying release icon…');

  if (!exists(icon)) {
    throw new Error(
      `Release validation failed: icon missing: ${icon}`
    );
  }

  console.log('✓ Release icon found');
}

function createPortableZip(buildDir, target) {
  const name = `mailix-${target}-v${VERSION}.zip`;
  const output = path.join(DIST, name);

  if (exists(output)) {
    fs.rmSync(output, { force: true });
  }

  console.log(`→ Creating ${name}…`);

  if (IS_WINDOWS) {
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${buildDir}\\*" -DestinationPath "${output}" -Force`
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

function buildInstaller(buildDir) {
  if (!IS_WINDOWS) {
    return null;
  }

  const installer = path.join(
    ROOT,
    'scripts',
    'build-installer.js'
  );

  if (!exists(installer)) {
    console.log('⚠ Windows installer builder not found. Skipping.');
    return null;
  }

  console.log('→ Building MAILIX-Setup-x64.exe…');

  try {
    run(process.execPath, [
      installer,
      `--source=${buildDir}`,
      `--version=${VERSION}`
    ]);
  } catch (error) {
    console.log('⚠ Windows installer build skipped.');
    console.log(error.message);
    return null;
  }

  const output = path.join(
    DIST,
    'MAILIX-Setup-x64.exe'
  );

  return exists(output) ? output : null;
}

function generateChecksums(files) {
  const crypto = require('crypto');
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

  fs.writeFileSync(
    checksumFile,
    `${lines.join('\n')}\n`,
    'utf8'
  );

  console.log(
    `✓ Created ${path.relative(ROOT, checksumFile)}`
  );

  return checksumFile;
}

function gitTagAndPush() {
  try {
    execFileSync(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      {
        cwd: ROOT,
        stdio: 'ignore'
      }
    );
  } catch {
    console.log('⚠ Not a Git repository. Skipping Git release.');
    return;
  }

  const tag = `v${VERSION}`;

  try {
    execFileSync(
      'git',
      ['rev-parse', tag],
      {
        cwd: ROOT,
        stdio: 'ignore'
      }
    );

    console.log(`✓ ${tag} already exists. Not recreating it.`);
    return;
  } catch {}

  try {
    run('git', [
      'tag',
      '-a',
      tag,
      '-m',
      `MAILIX ${tag}`
    ]);

    run('git', ['push', 'origin', tag]);

    console.log(`✓ Published ${tag}`);
  } catch (error) {
    console.log('⚠ Git release step skipped.');
    console.log(error.message);
  }
}

function main() {
  console.log('\nMAILIX Release Orchestrator\n');
  console.log(`→ Version: ${VERSION}`);

  if (!IS_WINDOWS && !IS_MACOS) {
    throw new Error(
      `Unsupported platform: ${process.platform}`
    );
  }

  checkGitClean();
  validateIcon();
  runTests();
  runSecretScan();

  const target = buildRelease();
  const buildDir = locateBuildDir(target);

  console.log(`✓ Build found: ${buildDir}`);

  verifyRuntime(buildDir);
  verifyBuiltIcon(buildDir);

  const zip = createPortableZip(
    buildDir,
    target
  );

  const installer = buildInstaller(buildDir);

  generateChecksums([
    zip,
    installer
  ]);

  gitTagAndPush();

  console.log('\n========================================');
  console.log('       MAILIX RELEASE COMPLETE');
  console.log('========================================');
  console.log(`Version: ${VERSION}`);
  console.log(`Target: ${target}`);
  console.log(`ZIP: ${path.basename(zip)}`);

  if (installer) {
    console.log(
      `Installer: ${path.basename(installer)}`
    );
  }

  console.log('Checksums: SHA256SUMS');
  console.log('========================================\n');
}

try {
  main();
} catch (error) {
  console.error('\n✗ Release failed.');
  console.error(error.message);
  process.exit(1);
}
