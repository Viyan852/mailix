'use strict';

/**
 * MAILIX Release Orchestrator
 *
 * One-command production release:
 *
 *   npm run release
 *
 * Responsibilities:
 *   1. Read package version
 *   2. Verify Git working tree
 *   3. Validate required assets
 *   4. Run complete test suite
 *   5. Run secret scanner
 *   6. Build platform release
 *   7. Locate build output
 *   8. Verify bundled Node.js runtime
 *   9. Verify release icon
 *  10. Create portable ZIP
 *  11. Build Windows installer when available
 *  12. Generate SHA256SUMS
 *  13. Create and push Git tag
 *
 * Supported release platforms:
 *   - Windows x64
 *   - macOS
 *
 * MAILIX is Zero-Node:
 * End users receive a bundled Node.js runtime.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  execSync,
  execFileSync
} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin');

/* ============================================================
   Helpers
   ============================================================ */

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

/* ============================================================
   Version
   ============================================================ */

function readPackageVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(PACKAGE_JSON, 'utf8')
  );

  if (!packageJson.version) {
    throw new Error(
      'package.json does not contain a version.'
    );
  }

  return packageJson.version;
}

const VERSION = readPackageVersion();

/* ============================================================
   Git Working Tree
   ============================================================ */

/**
 * Release MUST NOT continue with uncommitted changes.
 *
 * This intentionally allows a source archive without Git.
 */
function ensureCleanTree() {
  try {
    const status = execSync(
      'git status --porcelain',
      {
        cwd: ROOT,
        encoding: 'utf8'
      }
    ).trim();

    if (status.length > 0) {
      throw new Error(
        'Git working tree has uncommitted changes. Commit or stash before releasing.'
      );
    }

    console.log('✓ Git working tree clean');
  } catch (error) {
    if (
      error.message &&
      error.message.includes(
        'Git working tree has uncommitted changes'
      )
    ) {
      throw error;
    }

    /*
     * Git is optional when running from a source archive.
     */
    console.log(
      '⚠ Git working-tree check skipped.'
    );
  }
}

/* ============================================================
   Asset Validation
   ============================================================ */

function validateIcon() {
  const icon = path.join(
    ROOT,
    'assets',
    'icon.ico'
  );

  console.log(
    '→ Validating assets/icon.ico…'
  );

  if (!exists(icon)) {
    throw new Error(
      `Missing required icon: ${icon}`
    );
  }

  const size = fs.statSync(icon).size;

  if (size <= 0) {
    throw new Error(
      'assets/icon.ico is empty.'
    );
  }

  console.log(
    `✓ Icon OK (${(size / 1024).toFixed(1)} KB)`
  );
}

/* ============================================================
   Tests
   ============================================================ */

function runTests() {
  console.log('→ Running tests…');

  run(
    IS_WINDOWS ? 'npm.cmd' : 'npm',
    ['test']
  );

  console.log('✓ Tests passed');
}

/* ============================================================
   Secret Scanner
   ============================================================ */

function runSecretScan() {
  const scanner = path.join(
    ROOT,
    'tests',
    'secrets.test.js'
  );

  if (!exists(scanner)) {
    console.log(
      '⚠ Secret scanner not found. Skipping.'
    );
    return;
  }

  console.log(
    '→ Running secret scanner…'
  );

  run(
    process.execPath,
    [scanner]
  );

  console.log(
    '✓ Secret scan passed'
  );
}

/* ============================================================
   macOS Target Detection
   ============================================================ */

function detectMacOSTarget() {
  const builder = path.join(
    ROOT,
    'scripts',
    'build-release.js'
  );

  if (!exists(builder)) {
    throw new Error(
      'scripts/build-release.js not found.'
    );
  }

  const source = fs.readFileSync(
    builder,
    'utf8'
  );

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
      source.includes(target)
    ) {
      return target;
    }
  }

  throw new Error(
    'No supported macOS target found in scripts/build-release.js.'
  );
}

/* ============================================================
   Build
   ============================================================ */

function buildRelease() {
  const builder = path.join(
    ROOT,
    'scripts',
    'build-release.js'
  );

  if (!exists(builder)) {
    throw new Error(
      'scripts/build-release.js not found.'
    );
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

  console.log(
    `→ Building target: ${target}`
  );

  run(
    process.execPath,
    [
      builder,
      `--platform=${target}`,
      `--version=${VERSION}`
    ]
  );

  return target;
}

/* ============================================================
   Build Directory Detection
   ============================================================ */

function locateBuildDir(target) {
  const candidates = [
    path.join(
      DIST,
      'build',
      `mailix-${target}-v${VERSION}`
    ),

    path.join(
      DIST,
      `mailix-${target}`
    ),

    path.join(
      DIST,
      'build',
      `mailix-${target}`
    ),

    path.join(
      DIST,
      `mailix-${target}-v${VERSION}`
    )
  ];

  for (const directory of candidates) {
    if (
      exists(directory) &&
      fs.statSync(directory).isDirectory()
    ) {
      return directory;
    }
  }

  const buildDirectory = path.join(
    DIST,
    'build'
  );

  if (exists(buildDirectory)) {
    const entries = fs.readdirSync(
      buildDirectory,
      {
        withFileTypes: true
      }
    );

    const match = entries.find(
      entry =>
        entry.isDirectory() &&
        entry.name
          .toLowerCase()
          .includes('mailix')
    );

    if (match) {
      return path.join(
        buildDirectory,
        match.name
      );
    }
  }

  throw new Error(
    `Could not locate MAILIX build directory for target ${target}.`
  );
}

/* ============================================================
   Bundled Node.js Runtime Validation
   ============================================================ */

/**
 * MAILIX is Zero-Node.
 *
 * Every production build MUST contain its own
 * Node.js runtime.
 */
function verifyBundledRuntime(buildDir) {
  console.log(
    '→ Verifying bundled Node.js runtime…'
  );

  const runtime = IS_WINDOWS
    ? path.join(
        buildDir,
        'runtime',
        'node.exe'
      )
    : path.join(
        buildDir,
        'runtime',
        'node'
      );

  if (!exists(runtime)) {
    throw new Error(
      `Refusing to declare release successful: bundled runtime is missing: ${runtime}`
    );
  }

  const stat = fs.statSync(runtime);

  if (!stat.isFile()) {
    throw new Error(
      `Refusing to declare release successful: bundled runtime is not a file: ${runtime}`
    );
  }

  /*
   * macOS/Linux runtime needs executable permissions.
   */
  if (
    !IS_WINDOWS &&
    (stat.mode & 0o111) === 0
  ) {
    fs.chmodSync(
      runtime,
      stat.mode | 0o755
    );
  }

  console.log(
    `✓ Bundled Node.js runtime found: ${path.relative(
      ROOT,
      runtime
    )}`
  );
}

/* ============================================================
   Built Icon Validation
   ============================================================ */

function verifyBuiltIcon(buildDir) {
  console.log(
    '→ Verifying release icon…'
  );

  const icon = path.join(
    buildDir,
    'assets',
    'icon.ico'
  );

  if (!exists(icon)) {
    throw new Error(
      `Release validation failed: icon missing: ${icon}`
    );
  }

  if (
    fs.statSync(icon).size <= 0
  ) {
    throw new Error(
      `Release validation failed: icon is empty: ${icon}`
    );
  }

  console.log(
    '✓ Release icon found'
  );
}

/* ============================================================
   Portable ZIP
   ============================================================ */

function createPortableZip(
  buildDir,
  target
) {
  const filename =
    `mailix-${target}-v${VERSION}.zip`;

  const output = path.join(
    DIST,
    filename
  );

  fs.mkdirSync(
    DIST,
    {
      recursive: true
    }
  );

  if (exists(output)) {
    fs.rmSync(
      output,
      {
        force: true
      }
    );
  }

  console.log(
    `→ Creating ${filename}…`
  );

  if (IS_WINDOWS) {
    run(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${buildDir}\\*" -DestinationPath "${output}" -Force`
      ]
    );
  } else {
    run(
      'ditto',
      [
        '-c',
        '-k',
        '--sequesterRsrc',
        '--keepParent',
        buildDir,
        output
      ]
    );
  }

  console.log(
    `✓ Created ${path.relative(
      ROOT,
      output
    )}`
  );

  return output;
}

/* ============================================================
   Windows Installer
   ============================================================ */

/**
 * Windows installer is optional.
 *
 * macOS NEVER attempts to run the Windows
 * NSIS installer.
 */
function buildInstaller(buildDir) {
  if (!IS_WINDOWS) {
    return null;
  }

  const installerScript = path.join(
    ROOT,
    'scripts',
    'build-installer.js'
  );

  if (!exists(installerScript)) {
    console.log(
      '⚠ Windows installer builder not found. Skipping.'
    );

    return null;
  }

  console.log(
    '→ Building MAILIX-Setup-x64.exe…'
  );

  try {
    run(
      process.execPath,
      [
        installerScript,
        `--source=${buildDir}`,
        `--version=${VERSION}`
      ]
    );
  } catch (error) {
    console.log(
      '⚠ Windows installer build skipped.'
    );

    console.log(
      error.message
    );

    return null;
  }

  const output = path.join(
    DIST,
    'MAILIX-Setup-x64.exe'
  );

  if (!exists(output)) {
    console.log(
      '⚠ Windows installer was not produced. Continuing with portable release.'
    );

    return null;
  }

  console.log(
    `✓ Created ${path.basename(output)}`
  );

  return output;
}

/* ============================================================
   SHA256 Checksums
   ============================================================ */

function generateChecksums(files) {
  const checksumFile = path.join(
    DIST,
    'SHA256SUMS'
  );

  const lines = files
    .filter(Boolean)
    .filter(exists)
    .map(file => {
      const hash = crypto
        .createHash('sha256')
        .update(
          fs.readFileSync(file)
        )
        .digest('hex');

      return `${hash}  ${path.basename(file)}`;
    });

  if (lines.length === 0) {
    throw new Error(
      'No release artifacts available for SHA256SUMS.'
    );
  }

  fs.writeFileSync(
    checksumFile,
    `${lines.join('\n')}\n`,
    'utf8'
  );

  console.log(
    `✓ Created ${path.relative(
      ROOT,
      checksumFile
    )}`
  );

  return checksumFile;
}

/* ============================================================
   Git Tag + Push
   ============================================================ */

function gitTagAndPush() {
  try {
    execSync(
      'git rev-parse --is-inside-work-tree',
      {
        cwd: ROOT,
        stdio: 'ignore'
      }
    );
  } catch {
    console.log(
      '⚠ Not a Git repository. Skipping Git release.'
    );

    return;
  }

  const tag = `v${VERSION}`;

  /*
   * Never recreate an existing tag.
   */
  try {
    execSync(
      `git rev-parse ${tag}`,
      {
        cwd: ROOT,
        stdio: 'ignore'
      }
    );

    console.log(
      `✓ ${tag} already exists. Not recreating it.`
    );

    return;
  } catch {
    /*
     * Tag does not exist.
     */
  }

  try {
    run(
      'git',
      [
        'tag',
        '-a',
        tag,
        '-m',
        `MAILIX ${tag}`
      ]
    );

    run(
      'git',
      [
        'push',
        'origin',
        tag
      ]
    );

    console.log(
      `✓ Published ${tag}`
    );
  } catch (error) {
    console.log(
      '⚠ Git release step skipped.'
    );

    console.log(
      error.message
    );
  }
}

/* ============================================================
   Release Summary
   ============================================================ */

function printReleaseSummary(
  target,
  zip,
  installer,
  checksum
) {
  console.log(
    '\n========================================'
  );

  console.log(
    '       MAILIX RELEASE COMPLETE'
  );

  console.log(
    '========================================'
  );

  console.log(
    `Version: ${VERSION}`
  );

  console.log(
    `Target: ${target}`
  );

  console.log(
    `ZIP: ${path.basename(zip)}`
  );

  if (installer) {
    console.log(
      `Installer: ${path.basename(installer)}`
    );
  }

  console.log(
    `Checksums: ${path.basename(checksum)}`
  );

  console.log(
    '========================================\n'
  );
}

/* ============================================================
   Main Release Flow
   ============================================================ */

function main() {
  console.log(
    '\nMAILIX Release Orchestrator\n'
  );

  console.log(
    `→ Version: ${VERSION}`
  );

  console.log(
    `→ Platform: ${process.platform}`
  );

  if (
    !IS_WINDOWS &&
    !IS_MACOS
  ) {
    throw new Error(
      `Unsupported release platform: ${process.platform}`
    );
  }

  /*
   * 1. Git must be clean BEFORE building.
   */
  ensureCleanTree();

  /*
   * 2. Required project assets.
   */
  validateIcon();

  /*
   * 3. Full automated test suite.
   */
  runTests();

  /*
   * 4. Secret scan.
   */
  runSecretScan();

  /*
   * 5. Platform build.
   */
  const target =
    buildRelease();

  /*
   * 6. Find generated build.
   */
  const buildDir =
    locateBuildDir(target);

  console.log(
    `✓ Build found: ${buildDir}`
  );

  /*
   * 7. Zero-Node validation.
   */
  verifyBundledRuntime(
    buildDir
  );

  /*
   * 8. Icon validation.
   */
  verifyBuiltIcon(
    buildDir
  );

  /*
   * 9. Portable release.
   */
  const zip =
    createPortableZip(
      buildDir,
      target
    );

  /*
   * 10. Windows installer.
   *
   * Automatically skipped on macOS.
   */
  const installer =
    buildInstaller(
      buildDir
    );

  /*
   * 11. Checksums.
   */
  const checksum =
    generateChecksums([
      zip,
      installer
    ]);

  /*
   * 12. Git tag.
   *
   * Existing tags are never recreated.
   */
  gitTagAndPush();

  /*
   * 13. Final success message.
   */
  printReleaseSummary(
    target,
    zip,
    installer,
    checksum
  );
}

/* ============================================================
   Execute
   ============================================================ */

try {
  main();
} catch (error) {
  console.error(
    '\n✗ Release failed.'
  );

  console.error(
    error.message
  );

  process.exit(1);
}
