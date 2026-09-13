// Directly simulate only the two failing tests
const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

test('build-installer.js uninstall PRESERVES user data', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  assert.ok(!/RMDir\s+\/r\s+"\$INSTDIR"\s*$/.test(c),
    'installer must NOT recursively remove $INSTDIR (it would wipe user data)');
  // Should explicitly preserve data/, config/, logs/, backups/
  assert.ok(/PRESERVED|preserve/i.test(c),
    'installer should explicitly mention data preservation');
  // Should explicitly delete only specific app subdirectories
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\\\\\app"'),
    'installer should remove only the app/ directory');
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\\\\\runtime"'),
    'installer should remove only the runtime/ directory');
});

test('build-installer.js stops the running service before uninstalling', () => {
  const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
  // The Uninstall section should attempt to stop MAILIX first
  assert.ok(c.includes('commands\\\\\\\\stop.js') || c.includes('mlx stop'),
    'uninstall should attempt to stop MAILIX before removing files');
});

console.log(`Pass: ${pass}, Fail: ${fail}`);
