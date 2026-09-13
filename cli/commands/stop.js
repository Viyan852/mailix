#!/usr/bin/env node

/**
 * mlx stop — Stop the running MAILIX service
 */

const { stopProcess, isRunning, getStatus } = require('../core/process-manager');

const useColor = !process.argv.includes('--no-color') && process.stdout.isTTY;
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32}[color]||0)}m${t}\x1b[0m` : t;

async function main() {
  if (!isRunning()) {
    console.log('MAILIX is not running.');
    return;
  }
  const status = getStatus();
  console.log(`Stopping MAILIX (PID ${status.pid})…`);
  const result = stopProcess();
  if (result.stopped) {
    console.log(c('green', '✓') + ' MAILIX stopped.');
  } else {
    console.error(c('red', '✗') + ' Failed to stop MAILIX: ' + (result.error || 'unknown'));
    process.exit(1);
  }
}

main();
