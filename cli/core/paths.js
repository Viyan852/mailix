/**
 * MAILIX Paths
 *
 * Centralized, platform-appropriate installation paths.
 * Persistent user data survives application updates.
 */

const os = require('os');
const path = require('path');
const { isWindows, isMacOS, isLinux } = require('./platform');

const REPO_OWNER = process.env.MAILIX_REPO_OWNER || 'its-viyan';
const REPO_NAME = process.env.MAILIX_REPO_NAME || 'mailix';

function homeDir() {
  return os.homedir();
}

/**
 * Application directory — where the binaries, server, and dashboard live.
 * Updated when MAILIX is upgraded.
 */
function appDir() {
  if (isWindows()) {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local'), 'Mailix');
  }
  if (isMacOS()) {
    return path.join(homeDir(), 'Applications', 'Mailix.app', 'Contents', 'Resources');
  }
  // Linux
  return path.join(homeDir(), '.local', 'share', 'mailix');
}

/**
 * Configuration directory — config files, .env.
 */
function configDir() {
  if (isWindows()) {
    return path.join(process.env.APPDATA || path.join(homeDir(), 'AppData', 'Roaming'), 'Mailix');
  }
  if (isMacOS()) {
    return path.join(homeDir(), 'Library', 'Application Support', 'Mailix');
  }
  return path.join(homeDir(), '.config', 'mailix');
}

/**
 * Data directory — database, captured emails, persistent state.
 */
function dataDir() {
  if (isWindows()) {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local'), 'Mailix', 'Data');
  }
  if (isMacOS()) {
    return path.join(homeDir(), 'Library', 'Application Support', 'Mailix', 'Data');
  }
  return path.join(homeDir(), '.local', 'share', 'mailix', 'data');
}

/**
 * Logs directory.
 */
function logsDir() {
  if (isWindows()) {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local'), 'Mailix', 'Logs');
  }
  if (isMacOS()) {
    return path.join(homeDir(), 'Library', 'Logs', 'Mailix');
  }
  return path.join(homeDir(), '.local', 'share', 'mailix', 'logs');
}

/**
 * Backups directory.
 */
function backupsDir() {
  return path.join(dataDir(), 'backups');
}

/**
 * Bundled Node.js runtime directory (populated by the installer).
 */
function runtimeDir() {
  return path.join(appDir(), 'runtime');
}

/**
 * Runtime directory — process info, lock files, PID files.
 */
function runtimeDir() {
  if (isWindows()) {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local'), 'Mailix', 'Runtime');
  }
  return path.join(dataDir(), 'runtime');
}

/**
 * CLI bin directory — where the mlx / mlx-install / mlx-run symlinks/scripts live.
 */
function binDir() {
  if (isWindows()) {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local'), 'Mailix', 'Bin');
  }
  if (isMacOS()) {
    return path.join(homeDir(), '.local', 'bin');
  }
  return path.join(homeDir(), '.local', 'bin');
}

function configFile() {
  return path.join(configDir(), 'config.json');
}

function envFile() {
  return path.join(configDir(), '.env');
}

function pidFile() {
  return path.join(runtimeDir(), 'mailix.pid');
}

function runtimeInfoFile() {
  return path.join(runtimeDir(), 'runtime.json');
}

function logFile() {
  return path.join(logsDir(), 'mailix.log');
}

function workerLogFile() {
  return path.join(logsDir(), 'worker.log');
}

function getGitHubOwner() {
  return REPO_OWNER;
}

function getGitHubRepo() {
  return REPO_NAME;
}

module.exports = {
  homeDir,
  appDir,
  configDir,
  dataDir,
  logsDir,
  backupsDir,
  runtimeDir,
  binDir,
  configFile,
  envFile,
  pidFile,
  runtimeInfoFile,
  logFile,
  workerLogFile,
  getGitHubOwner,
  getGitHubRepo,
};
