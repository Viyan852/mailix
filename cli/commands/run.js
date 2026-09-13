#!/usr/bin/env node

/**
 * mlx run — Start the MAILIX service
 *
 * Always uses the bundled Node.js runtime shipped with MAILIX. The user
 * never needs a system Node installation.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { appDir, dataDir, logFile, configFile, runtimeDir } = require('../core/paths');
const { getStatus, writePid, writeRuntime, isRunning, startProcess } = require('../core/process-manager');
const { resolveNode, NODE_EXECUTABLE } = require('../core/runtime');
const { VERSION } = require('../core/installer');

const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser');
const portArg = args.find(a => a.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1], 10) : null;

const useColor = !args.includes('--no-color') && process.stdout.isTTY;
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,cyan:36,gray:90,yellow:33}[color]||0)}m${t}\x1b[0m` : t;

function findServerEntry() {
  const appPath = path.join(appDir(), 'app', 'server', 'server.js');
  if (fs.existsSync(appPath)) return appPath;
  // Legacy layout (some early releases)
  const legacyPath = path.join(appDir(), 'server', 'server.js');
  if (fs.existsSync(legacyPath)) return legacyPath;
  // Development layout
  const sourcePath = path.resolve(__dirname, '..', '..', 'server', 'server.js');
  if (fs.existsSync(sourcePath)) return sourcePath;
  return null;
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port, path: '/health', timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function openBrowser(url) {
  let cmd;
  if (process.platform === 'win32') cmd = `start "" "${url}"`;
  else if (process.platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  try { require('child_process').exec(cmd); } catch (err) { /* ignore */ }
}

async function waitForHealth(port, maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await checkHealth(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function failMissingRuntime() {
  console.error(c('red', '✗') + ' MAILIX runtime is missing.');
  console.error('');
  console.error('Run:');
  console.error('  ' + c('cyan', 'mlx repair'));
  console.error('or reinstall MAILIX via:');
  console.error('  ' + c('cyan', 'mlx-install'));
  process.exit(1);
}

async function main() {
  console.log(`\n${c('cyan', 'MAILIX')}\n${c('gray', '─'.repeat(40))}\n`);

  if (isRunning()) {
    const status = getStatus();
    console.log(`${c('green', '✓')} MAILIX is already running (PID ${status.pid})`);
    console.log(`  http://localhost:${status.port || 7345}\n`);
    if (!noBrowser) openBrowser(`http://localhost:${status.port || 7345}`);
    return;
  }

  const serverEntry = findServerEntry();
  if (!serverEntry) {
    console.error(`${c('red', '✗')} MAILIX application files not found.`);
    console.error(`  Run: ${c('cyan', 'mlx-install')} to install.`);
    process.exit(1);
  }
  console.log(`${c('green', '✓')} Installation found`);

  // Resolve the Node runtime
  const node = resolveNode();
  if (!node.path) {
    failMissingRuntime();
  }
  if (node.source === 'bundled') {
    console.log(`${c('green', '✓')} MAILIX runtime found (bundled)`);
  } else if (node.source === 'system') {
    console.log(`${c('yellow', '!')} Using system Node (bundled runtime not found)`);
    console.log(`  Run: ${c('cyan', 'mlx repair')} to install the bundled runtime`);
  }

  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch (err) { /* no config file yet */ }
  const finalPort = port || config.port || process.env.MAILIX_PORT || 7345;
  console.log(`${c('green', '✓')} Configuration loaded`);

  // Start the server
  console.log(`${c('cyan', '→')} Starting API server…`);
  const appDirPath = path.dirname(path.dirname(serverEntry));
  const child = startProcess({
    cwd: appDirPath,
    command: node.path,
    args: [serverEntry],
    env: {
      MAILIX_PORT: String(finalPort),
      MAILIX_DATA_DIR: dataDir(),
      MAILIX_RUNTIME_DIR: runtimeDir(),
      MAILIX_BIN: path.join(appDir(), 'bin'),
      MAILIX_ENV: process.env.MAILIX_ENV || 'production',
      NODE_ENV: 'production',
      MAILIX_BUNDLED_NODE: node.source === 'bundled' ? '1' : '0',
    },
    detached: false,
  });

  const healthy = await waitForHealth(finalPort);
  if (healthy) {
    writePid(child.pid);
    writeRuntime({
      pid: child.pid,
      port: finalPort,
      version: VERSION,
      node: node.source,
      started_at: new Date().toISOString(),
    });
    console.log(`${c('green', '✓')} Database ready`);
    console.log(`${c('green', '✓')} Email worker started`);
    console.log(`${c('green', '✓')} API server started`);
    console.log(`${c('green', '✓')} Health check passed\n`);
    console.log(`Dashboard:`);
    console.log(`  http://localhost:${finalPort}\n`);
    console.log(`API:`);
    console.log(`  http://localhost:${finalPort}/api\n`);
    if (!noBrowser) {
      setTimeout(() => openBrowser(`http://localhost:${finalPort}`), 500);
    }
    console.log('Press Ctrl+C to stop.\n');
    process.on('SIGINT', () => {
      console.log('\nShutting down…');
      child.kill('SIGTERM');
      setTimeout(() => process.exit(0), 1000);
    });
    child.on('exit', (code) => process.exit(code || 0));
  } else {
    console.error(`${c('red', '✗')} Server did not become healthy in time.`);
    console.log(`  Run ${c('cyan', 'mlx doctor')} for diagnostics.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to start MAILIX:', err.message);
  process.exit(1);
});
