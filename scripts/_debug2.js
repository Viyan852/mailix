const fs = require('fs');
const c = fs.readFileSync('scripts/build-installer.js', 'utf8');

// Test 1: the assertion strings from release.test.js
const t1 = 'RMDir /r "$INSTDIR\\\\\\\\app"';
const t2 = 'RMDir /r "$INSTDIR\\\\\\\\runtime"';
const t3 = 'commands\\\\\\\\stop.js';

console.log('t1 (app rmdir) actual string:', JSON.stringify(t1));
console.log('t2 (runtime rmdir):', JSON.stringify(t2));
console.log('t3 (stop.js):', JSON.stringify(t3));
console.log('');
console.log('File includes t1:', c.includes(t1));
console.log('File includes t2:', c.includes(t2));
console.log('File includes t3:', c.includes(t3));
console.log('File includes mlx stop:', c.includes('mlx stop'));
console.log('');

// Show what the uninstall section looks like in the file
const idx = c.indexOf('Section "Uninstall"');
console.log('Uninstall section excerpt:');
console.log(JSON.stringify(c.slice(idx, idx + 400)));
