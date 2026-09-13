#!/usr/bin/env node

/**
 * mlx restart — Stop and start MAILIX
 */

const { stopProcess, isRunning } = require('../core/process-manager');
const { spawn } = require('child_process');

async function main() {
  if (isRunning()) {
    console.log('Stopping MAILIX…');
    stopProcess();
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('Starting MAILIX…');
  const child = spawn(process.execPath, [__filename.replace(/stop\.js$/, 'run.js')], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code || 0));
}

main();
