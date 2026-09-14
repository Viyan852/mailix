'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

function exists(p) {
  return fs.existsSync(p);
}

function run(command, args = []) {
  console.log(`\n→ ${command} ${args.join(' ')}`);

  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function readVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(PACKAGE_JSON, 'utf8')
  );

  if (!pkg.version) {
    throw new Error('package.json version is missing.');
  }

  return pkg.version;
}

const VERSION = readVersion();
const TARGET = 'macos-universal';

console.log('\n========================================');
console.log('       MAILIX macOS RELEASE');
console.log('========================================');
console.log(`Version: ${VERSION}`);
console.log(`Target:  ${TARGET}`);
console.log('========================================\n');

/* ------------------------------------------------------------
   1. Verify macOS
------------------------------------------------------------ */

if (process.platform !== 'darwin') {
  throw new Error(
    'release-macos.js must run on macOS.'
  );
}

/* ------------------------------------------------------------
   2. Verify build script
------------------------------------------------------------ */

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

/* ------------------------------------------------------------
   3. Run tests
------------------------------------------------------------ */

console.log('→ Running npm test…');

run(
  'npm',
  ['test']
);

console.log('✓ Tests passed');

/* ------------------------------------------------------------
   4. Build macOS release
------------------------------------------------------------ */

console.log(
  '\n→ Building MAILIX for macOS…'
);

run(
  process.execPath,
  [
    builder,
    `--platform=${TARGET}`,
    `--version=${VERSION}`
  ]
);

/* ------------------------------------------------------------
   5. Locate build
------------------------------------------------------------ */

const candidates = [
  path.join(
    DIST,
    'build',
    `mailix-${TARGET}-v${VERSION}`
  ),

  path.join(
    DIST,
    `mailix-${TARGET}-v${VERSION}`
  ),

  path.join(
    DIST,
    'build',
    `mailix-${TARGET}`
  ),

  path.join(
    DIST,
    `mailix-${TARGET}`
  )
];

let buildDir = null;

for (const candidate of candidates) {
  if (
    exists(candidate) &&
    fs.statSync(candidate).isDirectory()
  ) {
    buildDir = candidate;
    break;
  }
}

if (!buildDir) {
  throw new Error(
    'Could not find the macOS MAILIX build output.'
  );
}

console.log(
  `✓ Build found: ${buildDir}`
);

/* ------------------------------------------------------------
   6. Verify bundled Node runtime
------------------------------------------------------------ */

const runtime = path.join(
  buildDir,
  'runtime',
  'node'
);

console.log(
  '\n→ Checking bundled Node.js runtime…'
);

if (!exists(runtime)) {
  throw new Error(
    `Bundled Node.js runtime missing: ${runtime}`
  );
}

if (!fs.statSync(runtime).isFile()) {
  throw new Error(
    `Bundled Node.js runtime is not a file: ${runtime}`
  );
}

fs.chmodSync(
  runtime,
  fs.statSync(runtime).mode | 0o755
);

console.log(
  '✓ Bundled Node.js runtime found'
);

/* ------------------------------------------------------------
   7. Verify icon
------------------------------------------------------------ */

const icon = path.join(
  buildDir,
  'assets',
  'icon.ico'
);

if (exists(icon)) {
  console.log('✓ Release icon found');
}

/* ------------------------------------------------------------
   8. Create ZIP
------------------------------------------------------------ */

fs.mkdirSync(
  DIST,
  { recursive: true }
);

const zipName =
  `mailix-macos-universal-v${VERSION}.zip`;

const zipPath = path.join(
  DIST,
  zipName
);

if (exists(zipPath)) {
  fs.rmSync(
    zipPath,
    { force: true }
  );
}

console.log(
  `\n→ Creating ${zipName}…`
);

run(
  'ditto',
  [
    '-c',
    '-k',
    '--sequesterRsrc',
    '--keepParent',
    buildDir,
    zipPath
  ]
);

console.log(
  `✓ Created ${zipPath}`
);

/* ------------------------------------------------------------
   9. SHA256
------------------------------------------------------------ */

const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(zipPath))
  .digest('hex');

const checksumPath = path.join(
  DIST,
  'SHA256SUMS'
);

fs.writeFileSync(
  checksumPath,
  `${hash}  ${zipName}\n`,
  'utf8'
);

console.log(
  `✓ Created ${checksumPath}`
);

/* ------------------------------------------------------------
   10. Final output
------------------------------------------------------------ */

console.log('\n========================================');
console.log('       MACOS RELEASE READY');
console.log('========================================');
console.log(`Version:   ${VERSION}`);
console.log(`Artifact:  ${zipName}`);
console.log('Checksum:  SHA256SUMS');
console.log('Node.js:   Bundled');
console.log('Target:    macOS Universal');
console.log('========================================\n');
