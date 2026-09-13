// Exactly reproduce what the test does
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');

// Test assertion 1:
const t1 = 'RMDir /r "$INSTDIR\\\\\\\\app"';
console.log('String t1 is:', JSON.stringify(t1));
console.log('c.includes(t1):', c.includes(t1));

// Find where stop.js appears in the file
const stopIdx = c.indexOf('stop.js');
if (stopIdx !== -1) {
  console.log('\nstop.js context:', JSON.stringify(c.slice(Math.max(0, stopIdx - 50), stopIdx + 60)));
} else {
  console.log('\nstop.js NOT found in file');
}

// The stop test assertion:
const stopT = 'commands\\\\\\\\stop.js';
console.log('Stop pattern:', JSON.stringify(stopT));
console.log('c.includes(stopT):', c.includes(stopT));
