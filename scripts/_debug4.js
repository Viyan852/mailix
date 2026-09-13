const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');

const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');

try {
  assert.ok(!/RMDir\s+\/r\s+"\$INSTDIR"\s*$/.test(c),
    'installer must NOT recursively remove $INSTDIR (it would wipe user data)');
  console.log('CHECK 1 passed - no broad RMDir');
} catch(e) { console.log('CHECK 1 FAILED:', e.message); }

try {
  assert.ok(/PRESERVED|preserve/i.test(c),
    'installer should explicitly mention data preservation');
  console.log('CHECK 2 passed - PRESERVED keyword found');
} catch(e) { console.log('CHECK 2 FAILED:', e.message); }

try {
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\\\\\app"'),
    'installer should remove only the app/ directory');
  console.log('CHECK 3 passed - app rmdir found');
} catch(e) { console.log('CHECK 3 FAILED:', e.message); }

try {
  assert.ok(c.includes('RMDir /r "$INSTDIR\\\\\\\\runtime"'),
    'installer should remove only the runtime/ directory');
  console.log('CHECK 4 passed - runtime rmdir found');
} catch(e) { console.log('CHECK 4 FAILED:', e.message); }

try {
  assert.ok(c.includes('commands\\\\\\\\stop.js') || c.includes('mlx stop'),
    'uninstall should attempt to stop MAILIX before removing files');
  console.log('CHECK 5 passed - stop command found');
} catch(e) { console.log('CHECK 5 FAILED:', e.message); }
