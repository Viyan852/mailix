#!/usr/bin/env node
/**
 * build-icon.js
 * Creates a minimal valid ICO file (assets/icon.ico) from assets/icon.png.
 *
 * ICO format with embedded PNG frames (supported by Windows Vista+):
 *   - Header (6 bytes)
 *   - Directory entry (16 bytes per frame)
 *   - Frame data (raw PNG bytes)
 *
 * Run: node scripts/build-icon.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pngSource = path.join(ROOT, 'assets', 'icon.png');
const icoOut = path.join(ROOT, 'assets', 'icon.ico');

// Check if there's a png source
let pngData;
if (fs.existsSync(pngSource)) {
  pngData = fs.readFileSync(pngSource);
  console.log('Using existing assets/icon.png as source');
} else {
  // The existing icon.ico is actually a PNG — use it as source
  const existing = path.join(ROOT, 'assets', 'icon.ico');
  if (fs.existsSync(existing)) {
    const buf = fs.readFileSync(existing);
    if (buf[0] === 0x89) {
      // It's a PNG, use it as source
      pngData = buf;
      // Save as .png for future use
      fs.writeFileSync(pngSource, buf);
      console.log('Detected PNG source in icon.ico — saved as icon.png');
    }
  }
}

if (!pngData) {
  console.error('No PNG source found. Place a PNG at assets/icon.png');
  process.exit(1);
}

// Build an ICO file containing one entry: the PNG data as an embedded PNG frame
// ICO Header: reserved (2), type=1 (2), count=1 (2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);    // reserved
header.writeUInt16LE(1, 2);    // type: icon
header.writeUInt16LE(1, 4);    // count: 1 image

// ICONDIRENTRY (16 bytes):
//   width (1), height (1), colorCount (1), reserved (1),
//   planes (2), bitCount (2), bytesInRes (4), imageOffset (4)
const entry = Buffer.alloc(16);
// 0 = 256px for PNG embedded frames
entry[0] = 0;        // width = 256 (0 means 256 in ICO spec)
entry[1] = 0;        // height = 256
entry[2] = 0;        // colorCount (0 = not palette-based)
entry[3] = 0;        // reserved
entry.writeUInt16LE(1, 4);           // planes = 1
entry.writeUInt16LE(32, 6);          // bitCount = 32 (RGBA)
entry.writeUInt32LE(pngData.length, 8);  // bytesInRes
entry.writeUInt32LE(6 + 16, 12);    // imageOffset = header + directory = 22

const ico = Buffer.concat([header, entry, pngData]);
fs.writeFileSync(icoOut, ico);

// Verify the output
const verify = fs.readFileSync(icoOut);
if (verify[0] === 0x00 && verify[1] === 0x00 && verify[2] === 0x01 && verify[3] === 0x00) {
  console.log(`✓ Built ICO: ${icoOut} (${ico.length} bytes)`);
  console.log(`  Magic bytes: ${verify.slice(0, 4).toString('hex')} ✓`);
} else {
  console.error('Built ICO has wrong magic bytes!', verify.slice(0, 4).toString('hex'));
  process.exit(1);
}
