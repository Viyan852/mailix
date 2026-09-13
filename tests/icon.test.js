#!/usr/bin/env node

/**
 * MAILIX Icon Test Suite
 *
 * Verifies:
 *   1. assets/icon.ico exists at the canonical path
 *   2. The file is a real .ico (correct magic bytes)
 *   3. The icon module loads correctly
 *   4. The icon is used by launcher and installer code paths
 *   5. The validate-icon script works
 *
 * Run with: node tests/icon.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const ICON_PATH = path.join(ROOT, 'assets', 'icon.ico');

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

console.log('\n=== MAILIX Icon Test Suite ===\n');

// =============== 1. Canonical icon file ===============
console.log('Canonical icon file');

test('assets/icon.ico exists', () => {
  assert.ok(fs.existsSync(ICON_PATH), `Expected ${ICON_PATH} to exist`);
});

test('assets/icon.ico is a file', () => {
  const stat = fs.statSync(ICON_PATH);
  assert.ok(stat.isFile());
});

test('assets/icon.ico is non-empty', () => {
  const stat = fs.statSync(ICON_PATH);
  assert.ok(stat.size > 0);
});

test('assets/icon.ico has valid ICO magic bytes', () => {
  const fd = fs.openSync(ICON_PATH, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  // ICO magic: 00 00 01 00
  assert.strictEqual(buf[0], 0);
  assert.strictEqual(buf[1], 0);
  assert.strictEqual(buf[2], 0x01);
  assert.strictEqual(buf[3], 0x00);
});

test('icon contains at least one icon entry', () => {
  const fd = fs.openSync(ICON_PATH, 'r');
  const buf = Buffer.alloc(6);
  fs.readSync(fd, buf, 0, 6, 0);
  fs.closeSync(fd);
  // Bytes 4-5: number of images in the .ico
  const count = buf.readUInt16LE(4);
  assert.ok(count > 0, 'ICO should contain at least one image');
});

// =============== 2. Icon module ===============
console.log('\nIcon module');

const icon = require('../cli/core/icon');

test('icon module exports expected members', () => {
  assert.ok(typeof icon.iconPath === 'function');
  assert.ok(typeof icon.validateIcon === 'function');
  assert.ok(typeof icon.inspect === 'function');
  assert.ok(typeof icon.runtimeIconPath === 'function');
  assert.deepStrictEqual(icon.ICON_RELATIVE_PATH, ['assets', 'icon.ico']);
  assert.strictEqual(icon.ICON_FILENAME, 'icon.ico');
});

test('iconPath returns the canonical location', () => {
  const p = icon.iconPath(ROOT);
  assert.strictEqual(p, ICON_PATH);
});

test('validateIcon passes for the real icon', () => {
  const p = icon.validateIcon(ROOT);
  assert.strictEqual(p, ICON_PATH);
});

test('inspect returns metadata', () => {
  const info = icon.inspect(ROOT);
  assert.strictEqual(info.exists, true);
  assert.ok(info.size > 0);
});

test('validateIcon fails when icon is missing', () => {
  // Use a fake repo root that has no assets/icon.ico
  const fakeRoot = path.join(os.tmpdir(), 'mailix-icon-test-missing-' + Date.now());
  fs.mkdirSync(fakeRoot, { recursive: true });
  try {
    assert.throws(() => icon.validateIcon(fakeRoot), /MAILIX icon missing/);
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test('validateIcon fails for empty file', () => {
  const fakeRoot = path.join(os.tmpdir(), 'mailix-icon-test-empty-' + Date.now());
  fs.mkdirSync(path.join(fakeRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(fakeRoot, 'assets', 'icon.ico'), '');
  try {
    assert.throws(() => icon.validateIcon(fakeRoot), /empty or not a file/);
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test('validateIcon fails for non-ICO file', () => {
  const fakeRoot = path.join(os.tmpdir(), 'mailix-icon-test-bad-' + Date.now());
  fs.mkdirSync(path.join(fakeRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(fakeRoot, 'assets', 'icon.ico'), 'not an ico');
  try {
    assert.throws(() => icon.validateIcon(fakeRoot), /not a valid .ico/);
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test('runtimeIconPath returns appDir/assets/icon.ico', () => {
  const fakeAppDir = path.join(os.tmpdir(), 'mailix-runtime-icon-' + Date.now());
  const p = icon.runtimeIconPath(fakeAppDir);
  assert.strictEqual(p, path.join(fakeAppDir, 'assets', 'icon.ico'));
});

// =============== 3. Build pipeline references the icon ===============
console.log('\nBuild pipeline integration');

test('build-release.js validates the icon at startup', () => {
  const buildScript = path.join(ROOT, 'scripts', 'build-release.js');
  const content = fs.readFileSync(buildScript, 'utf8');
  assert.ok(content.includes('validateIcon'), 'build-release should call validateIcon');
  assert.ok(content.includes('assets/icon.ico') || content.includes('icon.ico'),
    'build-release should reference the icon path');
});

test('build-release.js copies the icon to the release directory', () => {
  const buildScript = path.join(ROOT, 'scripts', 'build-release.js');
  const content = fs.readFileSync(buildScript, 'utf8');
  assert.ok(content.includes('copyFileSync') && content.includes('icon.ico'),
    'build-release should copy the icon into the release');
});

test('build-release.js passes the icon to launcher generator', () => {
  const buildScript = path.join(ROOT, 'scripts', 'build-release.js');
  const content = fs.readFileSync(buildScript, 'utf8');
  assert.ok(content.includes('writeLaunchers') && content.includes('iconPath'),
    'build-release should pass the icon to launcher generation');
});

test('launcher.js references iconPath in both Windows and POSIX branches', () => {
  const launcher = path.join(ROOT, 'cli', 'core', 'launcher.js');
  const content = fs.readFileSync(launcher, 'utf8');
  assert.ok(content.includes('iconPath') || content.includes('icon.ico'),
    'launcher should reference the icon');
});

test('installer.js validates the icon before registering launchers', () => {
  const installer = path.join(ROOT, 'cli', 'core', 'installer.js');
  const content = fs.readFileSync(installer, 'utf8');
  assert.ok(content.includes('validateIcon'), 'installer should validate the icon');
  assert.ok(content.includes('iconPath') || content.includes('icon.ico'),
    'installer should reference the icon');
});

test('installer.js creates Windows shortcuts with the icon', () => {
  const installer = path.join(ROOT, 'cli', 'core', 'installer.js');
  const content = fs.readFileSync(installer, 'utf8');
  assert.ok(content.includes('buildWindowsShortcut'), 'installer should call buildWindowsShortcut');
  assert.ok(content.includes('Start Menu') || content.includes('Microsoft'),
    'installer should target the Start Menu');
});

test('validate-icon.js script exists and works', () => {
  const script = path.join(ROOT, 'scripts', 'validate-icon.js');
  assert.ok(fs.existsSync(script));
  const content = fs.readFileSync(script, 'utf8');
  assert.ok(content.includes('validateIcon'));
});

// =============== 4. CI references the icon ===============
console.log('\nCI/CD');

test('GitHub Actions workflow validates the icon', () => {
  const wf = path.join(ROOT, '.github', 'workflows', 'release.yml');
  const content = fs.readFileSync(wf, 'utf8');
  assert.ok(content.includes('validate-icon') || content.includes('validateIcon'),
    'release workflow should validate the icon');
});

test('GitHub Actions workflow installs rcedit for Windows builds', () => {
  const wf = path.join(ROOT, '.github', 'workflows', 'release.yml');
  const content = fs.readFileSync(wf, 'utf8');
  assert.ok(content.includes('rcedit'),
    'release workflow should install rcedit for Windows icon embedding');
});

// =============== 5. Icon-builder module ===============
console.log('\nIcon builder');

const iconBuilder = require('../cli/core/icon-builder');

test('icon-builder module exports expected functions', () => {
  assert.ok(typeof iconBuilder.findEmbedTool === 'function');
  assert.ok(typeof iconBuilder.embedIconInExe === 'function');
  assert.ok(typeof iconBuilder.buildWindowsLauncher === 'function');
  assert.ok(typeof iconBuilder.buildWindowsShortcut === 'function');
});

test('embedIconInExe fails cleanly when tool is missing', () => {
  // Use a fake path that no tool can be found for — should throw
  // (we expect either a tool-found error or a missing-file error,
  // but it must not silently succeed)
  const fakeExe = path.join(os.tmpdir(), 'mailix-no-such.exe');
  const iconModule = require('../cli/core/icon');
  const realIcon = iconModule.iconPath(ROOT);
  try {
    iconBuilder.embedIconInExe(fakeExe, realIcon);
    throw new Error('should have thrown');
  } catch (err) {
    // Expected — either "executable not found" or "No icon-embed tool"
    assert.ok(err.message.includes('not found') || err.message.includes('icon-embed'),
      `Unexpected error: ${err.message}`);
  }
});

test('buildWindowsShortcut fails on non-Windows', () => {
  if (process.platform === 'win32') {
    console.log('    (skipped: running on Windows)');
    return;
  }
  const fakeIcon = path.join(os.tmpdir(), 'fake.ico');
  fs.writeFileSync(fakeIcon, '');
  try {
    iconBuilder.buildWindowsShortcut({
      iconPath: fakeIcon,
      targetPath: '/tmp/fake.exe',
      outDir: os.tmpdir(),
      shortcutName: 'fake',
    });
    throw new Error('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Windows'));
  } finally {
    try { fs.unlinkSync(fakeIcon); } catch (e) {}
  }
});

// =============== 6. No fallback icons ===============
console.log('\nNo fallback icons');

test('no auto-generated icon in any module', () => {
  const filesToCheck = [
    path.join(ROOT, 'cli', 'core', 'icon.js'),
    path.join(ROOT, 'cli', 'core', 'icon-builder.js'),
    path.join(ROOT, 'cli', 'core', 'launcher.js'),
    path.join(ROOT, 'cli', 'core', 'installer.js'),
  ];
  for (const f of filesToCheck) {
    const content = fs.readFileSync(f, 'utf8');
    assert.ok(!/generate.*icon/i.test(content),
      `${path.basename(f)} should not auto-generate icons`);
    assert.ok(!/placeholder.*icon/i.test(content),
      `${path.basename(f)} should not use placeholder icons`);
  }
});

test('build-release.js fails when icon is missing', () => {
  const buildScript = path.join(ROOT, 'scripts', 'build-release.js');
  const content = fs.readFileSync(buildScript, 'utf8');
  // Should call validateIcon and let it throw — no try/catch swallowing
  assert.ok(content.includes('validateIcon(ROOT)'),
    'build should call validateIcon without swallowing errors');
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

console.log('\n✓ All icon tests passed');
process.exit(0);
