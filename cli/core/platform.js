/**
 * MAILIX Platform Detection
 *
 * Detects OS, architecture, and provides platform-specific helpers.
 */

const os = require('os');
const fs = require('fs');

const PLATFORMS = {
  'win32-x64': { name: 'windows-x64', archive: 'zip' },
  'win32-arm64': { name: 'windows-arm64', archive: 'zip' },
  'linux-x64': { name: 'linux-x64', archive: 'tar.gz' },
  'linux-arm64': { name: 'linux-arm64', archive: 'tar.gz' },
  'darwin-x64': { name: 'macos-x64', archive: 'tar.gz' },
  'darwin-arm64': { name: 'macos-arm64', archive: 'tar.gz' },
};

function detectOS() {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

function detectArch() {
  const arch = process.arch;
  if (arch === 'x64' || arch === 'amd64') return 'x64';
  if (arch === 'arm64' || arch === 'aarch64') return 'arm64';
  if (arch === 'ia32' || arch === 'x86') return 'x86';
  return arch;
}

function detectPlatform() {
  const key = `${process.platform}-${detectArch()}`;
  return PLATFORMS[key] || null;
}

function getArchiveExtension() {
  const platform = detectPlatform();
  return platform ? `.${platform.archive}` : '';
}

function getExecutableExtension() {
  return process.platform === 'win32' ? '.exe' : '';
}

function isWindows() {
  return process.platform === 'win32';
}

function isMacOS() {
  return process.platform === 'darwin';
}

function isLinux() {
  return process.platform === 'linux';
}

function getPlatformLabel() {
  const os = detectOS();
  const arch = detectArch();
  return `${os} ${arch}`;
}

function checkDiskSpace(path, minBytes = 100 * 1024 * 1024) {
  try {
    const stat = fs.statfsSync ? fs.statfsSync(path) : null;
    if (!stat) return null;
    const free = stat.bavail * stat.bsize;
    return free >= minBytes;
  } catch (err) {
    return null;
  }
}

module.exports = {
  PLATFORMS,
  detectOS,
  detectArch,
  detectPlatform,
  getArchiveExtension,
  getExecutableExtension,
  isWindows,
  isMacOS,
  isLinux,
  getPlatformLabel,
  checkDiskSpace,
};
