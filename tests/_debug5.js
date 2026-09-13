// Run from tests/ directory like the test suite does
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// The test defines ROOT as:
const ROOT = path.resolve(__dirname, '..');
console.log('ROOT:', ROOT);

const c = fs.readFileSync(path.join(ROOT, 'scripts', 'build-installer.js'), 'utf8');
console.log('File length:', c.length);

// Check 3 - the one that fails
const searchStr = 'RMDir /r "$INSTDIR\\\\\\\\app"';
console.log('Searching for:', JSON.stringify(searchStr));
const idx = c.indexOf(searchStr);
console.log('indexOf result:', idx);
if (idx !== -1) {
  console.log('FOUND at:', idx);
  console.log('Context:', JSON.stringify(c.slice(idx-10, idx+60)));
}

// Check 5 - stop
const stopStr = 'commands\\\\\\\\stop.js';
console.log('\nSearching for stop:', JSON.stringify(stopStr));
const stopIdx = c.indexOf(stopStr);
console.log('stop indexOf:', stopIdx);
if (stopIdx !== -1) {
  console.log('Context:', JSON.stringify(c.slice(stopIdx-10, stopIdx+60)));
}
