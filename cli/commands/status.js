#!/usr/bin/env node

/**
 * mlx status — Show MAILIX status
 */

const { getStatus, isRunning } = require('../core/process-manager');
const { configFile, appDir, dataDir } = require('../core/paths');
const { VERSION } = require('../core/installer');
const fs = require('fs');

const args = process.argv.slice(2);
const useColor = !args.includes('--no-color') && process.stdout.isTTY;
const json = args.includes('--json');
const c = (color, t) => useColor ? `\x1b[${({red:31,green:32,cyan:36,gray:90}[color]||0)}m${t}\x1b[0m` : t;

async function checkDb() {
  const { appDir, dataDir } = require('../core/paths');
  const dbFile = require('path').join(dataDir(), 'projects.json');
  return fs.existsSync(dbFile) ? 'Connected' : 'Not initialized';
}

async function checkProvider() {
  const env = process.env.MAILIX_EMAIL_PROVIDER || 'local';
  if (env === 'local') return 'Local (simulated)';
  if (env === 'smtp') {
    if (process.env.MAILIX_SMTP_HOST) return `SMTP (${process.env.MAILIX_SMTP_HOST})`;
    return 'SMTP (not configured)';
  }
  if (env === 'ses') {
    if (process.env.MAILIX_SES_ACCESS_KEY) return 'SES (configured)';
    return 'SES (not configured)';
  }
  if (env === 'resend') {
    if (process.env.MAILIX_RESEND_API_KEY) return 'Resend (configured)';
    return 'Resend (not configured)';
  }
  return env;
}

async function main() {
  const status = getStatus();
  const installed = fs.existsSync(require('path').join(appDir(), 'package.json'));
  const provider = await checkProvider();
  const db = await checkDb();

  if (json) {
    console.log(JSON.stringify({
      version: VERSION,
      installed,
      running: status.running,
      pid: status.pid,
      port: status.port || 7345,
      database: db,
      provider,
    }, null, 2));
    return;
  }

  console.log('MAILIX STATUS\n');
  console.log(`  Version:      ${VERSION}`);
  console.log(`  Status:       ${status.running ? c('green', 'Running') : c('red', 'Stopped')}`);
  if (status.running) {
    console.log(`  PID:          ${status.pid}`);
    console.log(`  Port:         ${status.port || 7345}`);
    console.log(`  Started:      ${status.started_at || '—'}`);
  }
  console.log(`  Database:     ${db}`);
  console.log(`  Provider:     ${provider}`);
  console.log(`  Installed:    ${installed ? c('green', 'Yes') : c('yellow', 'No (development)')}`);
}

main();
