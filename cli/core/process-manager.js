/**
 * MAILIX Process Manager
 *
 * Tracks the running MAILIX server, supports graceful start/stop/restart.
 * Uses PID files to avoid killing unrelated processes.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pidFile, runtimeInfoFile, runtimeDir } = require('./paths');

function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readPid() {
  try {
    if (!fs.existsSync(pidFile())) return null;
    const data = fs.readFileSync(pidFile(), 'utf8');
    const pid = parseInt(data, 10);
    return isNaN(pid) ? null : pid;
  } catch (err) {
    return null;
  }
}

function writePid(pid) {
  if (!fs.existsSync(runtimeDir())) {
    fs.mkdirSync(runtimeDir(), { recursive: true });
  }
  fs.writeFileSync(pidFile(), String(pid));
}

function clearPid() {
  try {
    if (fs.existsSync(pidFile())) fs.unlinkSync(pidFile());
  } catch (err) { /* ignore */ }
}

function writeRuntime(info) {
  if (!fs.existsSync(runtimeDir())) {
    fs.mkdirSync(runtimeDir(), { recursive: true });
  }
  fs.writeFileSync(runtimeInfoFile(), JSON.stringify(info, null, 2));
}

function readRuntime() {
  try {
    if (!fs.existsSync(runtimeInfoFile())) return null;
    return JSON.parse(fs.readFileSync(runtimeInfoFile(), 'utf8'));
  } catch (err) {
    return null;
  }
}

function isRunning() {
  const pid = readPid();
  if (!pid) return false;
  if (!isAlive(pid)) {
    clearPid();
    return false;
  }
  return true;
}

function getStatus() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    return { running: false };
  }
  const info = readRuntime();
  return {
    running: true,
    pid,
    port: info?.port,
    started_at: info?.started_at,
    version: info?.version,
    ...info,
  };
}

function startProcess({ cwd, command, args, env = {}, detached = true }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached,
  });

  // Forward logs
  if (child.stdout) {
    child.stdout.on('data', (d) => process.stdout.write(d));
  }
  if (child.stderr) {
    child.stderr.on('data', (d) => process.stderr.write(d));
  }

  if (detached && child.pid) {
    child.unref();
  }
  return child;
}

function stopProcess(timeoutMs = 5000) {
  const pid = readPid();
  if (!pid) return { stopped: true, reason: 'not running' };
  if (!isAlive(pid)) {
    clearPid();
    return { stopped: true, reason: 'stale pid' };
  }
  try {
    // Try graceful first
    process.kill(pid, 'SIGTERM');
    const start = Date.now();
    while (isAlive(pid) && Date.now() - start < timeoutMs) {
      // busy wait
    }
    if (isAlive(pid)) {
      // Force kill
      try { process.kill(pid, 'SIGKILL'); } catch (err) { /* ignore */ }
    }
    clearPid();
    return { stopped: true, pid };
  } catch (err) {
    return { stopped: false, error: err.message };
  }
}

module.exports = {
  isAlive,
  readPid,
  writePid,
  clearPid,
  writeRuntime,
  readRuntime,
  isRunning,
  getStatus,
  startProcess,
  stopProcess,
};
