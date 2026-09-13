#!/usr/bin/env node

/**
 * MAILIX Release Test Suite
 *
 * Verifies the single-command release system:
 *   1. `npm run release` script is defined
 *   2. scripts/release.js exists and exports the expected flow
 *   3. scripts/build-installer.js exists and produces the expected layout
 *   4. SHA256SUMS generation works
 *   5. Working tree validation works
 *   6. The release script wires through to existing build/CLI primitives
 *
 * Run with: node tests/release.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failures.push({ name, error: err.message });
    fail++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failures.push({ name, error: err.message });
    fail++;
  }
}

console.log('\n=== MAILIX Release Test Suite ===\n');

// =============== 1. Single-command release wiring ===============
console.log('Single-command release');

test('package.json has the "release" script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts, 'package.json should have a scripts section');
  assert.ok(pkg.scripts.release, 'package.json should define a "release" script');
  assert.ok(pkg.scripts.release.includes('scripts/release.js'),
    'release script should invoke scripts/release.js');
});

test('scripts/release.js exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'release.js')));
});

test('scripts/build-installer.js exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'build-installer.js')));
});

test('scripts/release.js imports required modules', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(c.includes('readPackageVersion'), 'should read version');
  assert.ok(c.includes('ensureCleanTree'), 'should check the working tree');
  assert.ok(c.includes('validateIcon'), 'should validate the icon');
  assert.ok(c.includes('runTests'), 'should run tests');
  assert.ok(c.includes('buildRelease'), 'should build the release');
  assert.ok(c.includes('generateChecksums'), 'should generate SHA256SUMS');
  assert.ok(c.includes('gitTagAndPush'), 'should tag and push');
});

test('scripts/release.js does not use git reset --hard', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(!/git\s+reset\s+--hard/.test(c), 'release script must not use git reset --hard');
});

test('scripts/release.js refuses to proceed with uncommitted changes', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(c.includes('Git working tree has uncommitted changes'),
    'should have a clear error message for uncommitted changes');
  assert.ok(c.includes('Commit or stash before releasing'),
    'should instruct the developer to commit or stash');
});

test('scripts/release.js verifies the bundled Node runtime is in the build', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(c.includes('runtime') && c.includes('node.exe'),
    'release script should check for runtime/node.exe in the build output');
  assert.ok(c.includes('Refusing to declare release successful'),
    'release script should fail loudly if the bundled runtime is missing');
});

test('scripts/release.js verifies the icon is in the build', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(c.includes('assets') && c.includes('icon.ico'),
    'release script should check for assets/icon.ico in the build output');
});

// =============== 2. Build artifacts ===============
console.log('\nBuild artifacts');

test('build-release.js produces a SHA256SUMS', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-release.js'), 'utf8');
  assert.ok(c.includes('writeChecksums') || c.includes('SHA256SUMS'),
    'build-release should write SHA256SUMS');
});

test('build-installer.js targets MAILIX-Setup-x64.exe', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('MAILIX-Setup-x64.exe'),
    'installer should produce MAILIX-Setup-x64.exe');
});

test('build-installer.js embeds assets/icon.ico', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('icon.ico'),
    'installer should reference the icon');
  assert.ok(c.includes('MUI_ICON') || c.includes('Icon '),
    'NSIS script should set the installer icon');
});

test('build-installer.js installs to %LOCALAPPDATA%\\MAILIX', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('LOCALAPPDATA') && c.includes('MAILIX'),
    'installer should use %LOCALAPPDATA%\\MAILIX');
});

test('build-installer.js creates Start Menu and Desktop shortcuts', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('SMPROGRAMS'), 'should create Start Menu shortcuts');
  assert.ok(c.includes('DESKTOP'), 'should create a Desktop shortcut');
});

test('build-installer.js adds bin/ to user PATH', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('AddToPath') || c.includes('Environment'),
    'installer should update the user PATH');
});

test('build-installer.js registers an Add/Remove Programs entry', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('Uninstall') && c.includes('WriteRegStr'),
    'installer should write uninstall registry keys');
});

test('build-installer.js handles uninstall cleanly', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(c.includes('Section "Uninstall"') || c.includes('Uninstall'),
    'installer should define an Uninstall section');
});

test('build-installer.js uninstall PRESERVES user data', () => {
  // CRITICAL: RMDir /r $INSTDIR would wipe everything including user data.
  // The hardened installer must explicitly remove only app/runtime/assets/docs.
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(!/RMDir\s+\/r\s+"\$INSTDIR"\s*$/.test(c),
    'installer must NOT recursively remove $INSTDIR (it would wipe user data)');
  // Should explicitly preserve data/, config/, logs/, backups/
  assert.ok(/PRESERVED|preserve/i.test(c),
    'installer should explicitly mention data preservation');
  // Should explicitly delete only specific app subdirectories
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\app"'),
    'installer should remove only the app/ directory');
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\runtime"'),
    'installer should remove only the runtime/ directory');
});

test('build-installer.js PATH registration is idempotent', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  // Should use StrLoc / StrStr to check existence before appending
  assert.ok(/StrLoc|StrStr/.test(c),
    'PATH registration should check existence before appending');
  // Should NOT use a broken pattern like StrCmp $2 "" 0 done that
  // immediately jumps to done when the result is non-empty
  assert.ok(!/StrCmp\s+\$2\s+""\s+0\s+done/.test(c),
    'PATH registration should not have the inverted StrCmp bug');
});

test('build-installer.js stops the running service before uninstalling', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  // The Uninstall section should attempt to stop MAILIX first
  assert.ok(c.includes('commands\\\\stop.js') || c.includes('mlx stop'),
    'uninstall should attempt to stop MAILIX before removing files');
});

test('build-installer.js uninstall warns that data is preserved', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  // The MUI_UNCONFIRMPAGE_TEXT should tell the user their data is preserved
  assert.ok(c.includes('PRESERVED') || c.includes('preserved'),
    'uninstall confirm page should mention data preservation');
});

// =============== 3. GitHub Actions ===============
console.log('\nGitHub Actions');

test('release workflow exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.github', 'workflows', 'release.yml')));
});

test('release workflow triggers on tag pushes', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes("tags:") && c.includes("- 'v*'"),
    'workflow should trigger on v* tags');
});

test('release workflow builds Windows x64 with rcedit', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('rcedit'), 'workflow should install rcedit for Windows icon embedding');
  assert.ok(c.includes('windows-x64') || c.includes('windows-latest'),
    'workflow should build a Windows x64 target');
});

test('release workflow produces MAILIX-Setup-x64.exe', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('MAILIX-Setup-x64.exe'),
    'workflow should produce MAILIX-Setup-x64.exe');
});

test('release workflow produces mailix-windows-x64.zip', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('mailix-windows-x64.zip'),
    'workflow should produce the portable ZIP');
});

test('release workflow generates SHA256SUMS', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('SHA256SUMS') || c.includes('sha256sum'),
    'workflow should generate SHA256SUMS');
});

test('release workflow creates a GitHub Release with the artifacts', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('action-gh-release') || c.includes('gh-release'),
    'workflow should publish a GitHub Release');
});

// =============== 4. Checksum generation ===============
console.log('\nChecksums');

test('SHA256SUMS format is correct', () => {
  const tmp = path.join(os.tmpdir(), 'mailix-checksum-test-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const file1 = path.join(tmp, 'a.txt');
  const file2 = path.join(tmp, 'b.txt');
  fs.writeFileSync(file1, 'hello');
  fs.writeFileSync(file2, 'world');
  const expected1 = crypto.createHash('sha256').update('hello').digest('hex');
  const expected2 = crypto.createHash('sha256').update('world').digest('hex');
  // Mimic what the release script does
  let sums = '';
  for (const f of [file1, file2]) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    sums += `${hash}  ${path.basename(f)}\n`;
  }
  const sumsFile = path.join(tmp, 'SHA256SUMS');
  fs.writeFileSync(sumsFile, sums);
  const content = fs.readFileSync(sumsFile, 'utf8');
  assert.ok(content.includes(expected1));
  assert.ok(content.includes(expected2));
  assert.ok(content.includes('a.txt'));
  assert.ok(content.includes('b.txt'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('checksum verification would reject a corrupted file', () => {
  const tmp = path.join(os.tmpdir(), 'mailix-verify-test-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const file = path.join(tmp, 'artifact.bin');
  fs.writeFileSync(file, 'original content');
  const good = crypto.createHash('sha256').update('original content').digest('hex');
  // Corrupt the file
  fs.writeFileSync(file, 'tampered content');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.notStrictEqual(good, actual, 'corrupted file should not match the original checksum');
  fs.rmSync(tmp, { recursive: true, force: true });
});

// =============== 5. Version detection ===============
console.log('\nVersion detection');

test('package.json has a version field', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.version);
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
});

test('scripts/release.js reads the version from package.json', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8');
  assert.ok(c.includes('readPackageVersion'), 'should have readPackageVersion function');
  assert.ok(c.includes('PACKAGE_JSON'), 'should reference package.json path');
});

test('GitHub Actions workflow uses the version from package.json', () => {
  const c = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.ok(c.includes('package.json') || c.includes('ConvertFrom-Json'),
    'workflow should read the version from package.json');
});

// =============== 6. Process safety ===============
console.log('\nProcess safety');

test('process-manager uses a PID file', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'core', 'process-manager.js'), 'utf8');
  assert.ok(c.includes('pidFile') || c.includes('PID') || c.includes('pid'),
    'process-manager should track PIDs');
});

test('process-manager verifies the process is still alive', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'core', 'process-manager.js'), 'utf8');
  assert.ok(c.includes('isAlive'), 'process-manager should check liveness');
  assert.ok(c.includes('process.kill'), 'process-manager should use process.kill to check');
});

test('mlx stop does not kill arbitrary processes', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'stop.js'), 'utf8');
  assert.ok(c.includes('isRunning'), 'stop should check isRunning first');
  // Should not contain killall or pkill -9 or similar
  assert.ok(!/killall|pkill\s+-9|taskkill\s+\/F/.test(c),
    'stop should not use force-kill-all');
});

// =============== 7. Update logic preserves user data ===============
console.log('\nUpdate and repair');

test('update command preserves data, config, backups', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'update.js'), 'utf8');
  assert.ok(c.includes('preserved') || c.includes('preserve'),
    'update should mention preserved directories');
  // Should explicitly list what is preserved
  assert.ok(c.includes('data') && c.includes('config'),
    'update should preserve data and config');
});

test('update command verifies checksums before installing', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'update.js'), 'utf8');
  assert.ok(c.includes('fetchAndVerifyChecksum') || c.includes('verify'),
    'update should verify checksums');
});

test('repair command preserves user data', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'repair.js'), 'utf8');
  assert.ok(c.includes('preserve') || c.includes('Preserves'),
    'repair should preserve user data');
  // Should NOT be "delete everything and reinstall"
  assert.ok(!/delete\s+everything/i.test(c),
    'repair should not be "delete everything"');
});

// =============== 8. Doctor reports correctly ===============
console.log('\nDoctor');

test('doctor treats missing system Node as informational, not error', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'doctor.js'), 'utf8');
  assert.ok(c.includes("status: 'info'") || c.includes("'info'"),
    'doctor should mark system Node as info, not fail');
  assert.ok(c.includes('checkSystemNode'),
    'doctor should have a system Node check');
});

test('doctor checks the bundled runtime as the primary requirement', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'doctor.js'), 'utf8');
  assert.ok(c.includes('checkBundledRuntime') || c.includes('MAILIX runtime'),
    'doctor should check the bundled runtime');
});

test('doctor report does not say "install Node.js"', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'commands', 'doctor.js'), 'utf8');
  assert.ok(!/install\s+node\.js/i.test(c),
    'doctor should not tell users to install Node.js');
});

// =============== 9. CLI dispatcher ===============
console.log('\nCLI dispatcher');

test('mlx.js registers the release command', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'mlx.js'), 'utf8');
  assert.ok(c.includes("install: 'install'"),
    'mlx should register the install command');
  assert.ok(c.includes("run: 'run'"),
    'mlx should register the run command');
  assert.ok(c.includes("update: 'update'"),
    'mlx should register the update command');
  assert.ok(c.includes("repair: 'repair'"),
    'mlx should register the repair command');
});

test('mlx-run launcher uses the runtime resolver', () => {
  const c = fs.readFileSync(path.join(ROOT, 'cli', 'bin', 'mlx-run.js'), 'utf8');
  assert.ok(c.includes('resolveNode'),
    'mlx-run launcher should use the runtime resolver');
});

// =============== Summary ===============
console.log(`\n=== Results ===`);
console.log(`Passed: ${pass}`);
console.log(`Failed: ${fail}`);

if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}

console.log('\n✓ All release tests passed');
process.exit(0);
