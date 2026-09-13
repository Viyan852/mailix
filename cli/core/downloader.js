/**
 * MAILIX Downloader
 *
 * Downloads release artifacts from GitHub Releases.
 * Verifies SHA-256 checksums.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getGitHubOwner, getGitHubRepo } = require('./paths');

/**
 * Fetch the latest release from GitHub.
 * Returns null if GitHub returns 404 (no releases yet).
 */
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const owner = getGitHubOwner();
    const repo = getGitHubRepo();
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'mailix-cli',
        'Accept': 'application/vnd.github+json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('GitHub API timeout')));
  });
}

/**
 * Find the asset matching the given platform/arch.
 */
function findAsset(release, platform) {
  if (!release?.assets) return null;
  const archSuffix = platform.includes('arm64') ? 'arm64' : 'x64';
  const osPart = platform.includes('windows') ? 'windows'
              : platform.includes('macos') ? 'macos'
              : 'linux';
  const prefix = 'mailix';
  const candidates = release.assets.filter(a => {
    const n = a.name.toLowerCase();
    return n.startsWith(prefix) && n.includes(osPart) && n.includes(archSuffix);
  });
  // Prefer zip on Windows, tar.gz elsewhere
  if (osPart === 'windows') {
    return candidates.find(a => a.name.endsWith('.zip')) || candidates[0] || null;
  }
  return candidates.find(a => a.name.endsWith('.tar.gz')) || candidates[0] || null;
}

function findChecksumAsset(release, asset) {
  if (!release?.assets || !asset) return null;
  return release.assets.find(a =>
    a.name === `${asset.name}.sha256` ||
    a.name === 'SHA256SUMS' ||
    a.name === 'checksums.txt'
  ) || null;
}

/**
 * Download a URL to a file.
 */
function downloadFile(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = (url) => https.get(url, { headers: { 'User-Agent': 'mailix-cli' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return request(res.headers.location);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total) onProgress(downloaded, total);
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destination)));
    });
    request.on('error', (err) => {
      try { fs.unlinkSync(destination); } catch (e) {}
      reject(err);
    });
    request.setTimeout(120000, () => request.destroy(new Error('Download timeout')));
    request(url);
  });
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
  fetchLatestRelease,
  findAsset,
  findChecksumAsset,
  downloadFile,
  sha256,
};
