#!/usr/bin/env node

/**
 * mlx doctor — Diagnose the local environment
 *
 * Now checks the BUNDLED Node.js runtime as the primary requirement. A
 * system Node.js is informational only — it is NOT required for MAILIX
 * to function.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { appDir, configDir, dataDir, logsDir, binDir, configFile } = require('../core/paths');
const { isWindows } = require('../core/platform');
const { isRunning } = require('../core/process-manager');
const { resolveNode } = require('../core/runtime');
const { VERSION } = require('../core/installer');

const args = process.argv.slice(2);
const json = args.includes('--json');
const useColor = !args.includes('--no-color') && process.stdout.isTTY;
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,yellow:33,cyan:36,gray:90}[color]||0)}m${t}\x1b[0m` : t;

const results = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then((r) => { results.push(r); return r; });
    }
    results.push(result);
    return result;
  } catch (err) {
    results.push({ name, status: 'fail', message: err.message });
  }
}

function pass(name, message) { return { name, status: 'pass', message }; }
function warn(name, message) { return { name, status: 'warn', message }; }
function fail(name, message) { return { name, status: 'fail', message }; }

function checkBundledRuntime() {
  const node = resolveNode();
  if (node.source === 'bundled') {
    return pass('MAILIX runtime', `bundled (${path.basename(node.path)})`);
  }
  if (node.source === 'system') {
    return warn('MAILIX runtime', 'bundled missing, using system (run: mlx repair)');
  }
  return fail('MAILIX runtime', 'missing (run: mlx repair or mlx-install)');
}

function checkSystemNode() {
  // Informational only — NOT a failure.
  const { execSync } = require('child_process');
  const cmd = isWindows() ? 'where node' : 'which node';
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim();
    if (out) return { name: 'System Node.js', status: 'info', message: `Not required (found ${out.split(/\r?\n/)[0]})` };
  } catch (err) { /* not installed */ }
  return { name: 'System Node.js', status: 'info', message: 'Not installed (not required)' };
}

function checkInstallation() {
  return fs.existsSync(path.join(appDir(), 'package.json')) || fs.existsSync(path.join(appDir(), 'app', 'package.json'))
    ? pass('Installation', appDir())
    : warn('Installation', 'Not installed (running from source)');
}

function checkCli() {
  return fs.existsSync(path.join(binDir(), 'mlx')) || isWindows() && fs.existsSync(path.join(binDir(), 'mlx.cmd'))
    ? pass('CLI', 'Registered in ' + binDir())
    : warn('CLI', 'Not registered. Run: mlx install');
}

function checkConfig() {
  try {
    JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    return pass('Configuration', 'Loaded');
  } catch (err) {
    return warn('Configuration', 'Using defaults');
  }
}

function checkDatabase() {
  const projectsFile = path.join(dataDir(), 'projects.json');
  if (fs.existsSync(projectsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
      return pass('Database', `Connected (${data.projects?.length || 0} projects)`);
    } catch (err) {
      return fail('Database', 'Data file corrupted');
    }
  }
  return warn('Database', 'Not yet initialized');
}

function checkMigrations() {
  return pass('Migrations', 'Schema initialized');
}

function checkEmailProvider() {
  const provider = process.env.MAILIX_EMAIL_PROVIDER || 'local';
  if (provider === 'local') return pass('Email provider', 'local (simulated)');
  if (provider === 'smtp') {
    return process.env.MAILIX_SMTP_HOST
      ? pass('Email provider', `smtp (${process.env.MAILIX_SMTP_HOST})`)
      : fail('Email provider', 'SMTP selected but MAILIX_SMTP_HOST not set');
  }
  if (provider === 'ses') {
    return process.env.MAILIX_SES_ACCESS_KEY
      ? pass('Email provider', 'ses')
      : fail('Email provider', 'SES selected but credentials not set');
  }
  if (provider === 'resend') {
    return process.env.MAILIX_RESEND_API_KEY
      ? pass('Email provider', 'resend')
      : fail('Email provider', 'Resend selected but API key not set');
  }
  return warn('Email provider', `Unknown: ${provider}`);
}

function checkWorker() {
  return isRunning()
    ? pass('Email worker', 'Running')
    : warn('Email worker', 'Not running');
}

function checkPort(port = 7345) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ name: `Port ${port}`, status: 'warn', message: 'in use' });
      } else {
        resolve({ name: `Port ${port}`, status: 'fail', message: err.message });
      }
    });
    server.once('listening', () => {
      server.close();
      resolve({ name: `Port ${port}`, status: 'pass', message: 'available' });
    });
    server.listen(port, '127.0.0.1');
  });
}

function checkPermissions() {
  try {
    const testFile = path.join(dataDir(), '.doctor-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return pass('File permissions', 'Writable');
  } catch (err) {
    return fail('File permissions', err.message);
  }
}

function checkDiskSpace() {
  try {
    if (fs.statfsSync) {
      const stat = fs.statfsSync(appDir());
      const freeGB = (stat.bavail * stat.bsize) / (1024 ** 3);
      if (freeGB < 0.1) return fail('Disk space', `${freeGB.toFixed(2)} GB free`);
      return pass('Disk space', `${freeGB.toFixed(2)} GB free`);
    }
  } catch (err) { /* not supported */ }
  return warn('Disk space', 'Unable to determine');
}

function checkPath() {
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  if (pathDirs.includes(binDir())) {
    return pass('PATH', `${binDir()} is on PATH`);
  }
  return warn('PATH', `${binDir()} is not on PATH`);
}

async function main() {
  const checks = [
    checkInstallation,
    checkBundledRuntime,
    checkSystemNode,
    checkCli,
    checkConfig,
    checkDatabase,
    checkMigrations,
    checkEmailProvider,
    checkWorker,
    () => checkPort(7345),
    checkPermissions,
    checkDiskSpace,
    checkPath,
  ];
  for (const c of checks) await check(c.name, c);

  if (json) {
    const summary = results.map(r => ({ name: r.name, status: r.status, message: r.message }));
    const overall = results.some(r => r.status === 'fail') ? 'fail'
                   : results.some(r => r.status === 'warn') ? 'warn' : 'pass';
    console.log(JSON.stringify({ overall, version: VERSION, checks: summary }, null, 2));
    process.exit(overall === 'fail' ? 1 : 0);
  }

  console.log('\nMAILIX Doctor\n');
  for (const r of results) {
    const sym = r.status === 'pass' ? c('green', 'OK')
              : r.status === 'warn' ? c('yellow', '!')
              : r.status === 'info' ? c('gray', '·')
              : c('red', 'X');
    const label = r.name.padEnd(22);
    const value = r.message || (r.status === 'pass' ? 'OK' : (r.status === 'info' ? 'Not installed' : '—'));
    console.log(`  ${label} ${sym}  ${value}`);
  }

  const hasFail = results.some(r => r.status === 'fail');
  const hasWarn = results.some(r => r.status === 'warn');
  console.log('');
  if (hasFail) {
    console.log(c('red', 'MAILIX is not ready.'));
    process.exit(1);
  }
  if (hasWarn) {
    console.log(c('yellow', 'MAILIX is operational (with warnings).'));
    return;
  }
  console.log(c('green', 'MAILIX is healthy.'));
}

main();
