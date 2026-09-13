/**
 * MAILIX Verifier
 *
 * Verifies the integrity of downloaded release artifacts.
 * Uses SHA-256 checksums and (optionally) signed checksums.
 */

const fs = require('fs');
const crypto = require('crypto');
const { downloadFile, sha256 } = require('./downloader');

async function verifyChecksum(archivePath, expectedSha256) {
  if (!expectedSha256) {
    // No checksum provided — reject (we never install unverified)
    throw new Error('No checksum available; refusing to install unverified artifact');
  }
  const actual = await sha256(archivePath);
  const expected = expectedSha256.toLowerCase().trim();
  if (actual !== expected) {
    throw new Error(`Checksum mismatch.\n  Expected: ${expected}\n  Actual:   ${actual}`);
  }
  return true;
}

async function fetchAndVerifyChecksum(archivePath, checksumUrl) {
  // Download the checksum file
  const tmpChecksum = archivePath + '.sha256';
  try {
    await downloadFile(checksumUrl, tmpChecksum);
  } catch (err) {
    throw new Error(`Failed to download checksum: ${err.message}`);
  }
  const content = fs.readFileSync(tmpChecksum, 'utf8');
  fs.unlinkSync(tmpChecksum);
  // Parse standard sha256sum format: "<hash>  <filename>"
  const archiveName = require('path').basename(archivePath);
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match && match[2] === archiveName) {
      return verifyChecksum(archivePath, match[1]);
    }
  }
  throw new Error('Checksum for this artifact not found in checksum file');
}

module.exports = { verifyChecksum, fetchAndVerifyChecksum };
