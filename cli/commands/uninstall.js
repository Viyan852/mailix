#!/usr/bin/env node

/**
 * mlx uninstall — Remove MAILIX
 *
 * Asks before deleting persistent data.
 * Never silently deletes user data.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { appDir, configDir, dataDir, backupsDir, binDir } = require('../core/paths');
const { isRunning, stopProcess } = require('../core/process-manager');
const { isWindows } = require('../core/platform');

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const e of fs.readdirSync(p)) rmrf(path.join(p, e));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');

  console.log('MAILIX Uninstaller\n');
  console.log('What would you like to remove?');
  console.log('  [1] Remove MAILIX application');
  console.log('  [2] Keep configuration');
  console.log('  [3] Keep database');
  console.log('  [4] Keep backups');
  console.log('  [5] Delete all MAILIX data\n');

  if (!yes) {
    const answer = await prompt('Choose [1-5, default 1]: ');
    const choice = answer.trim() || '1';

    if (isRunning()) {
      console.log('Stopping MAILIX…');
      stopProcess();
    }

    if (choice === '1') {
      rmrf(appDir());
      console.log('✓ Application removed');
    } else if (choice === '2') {
      rmrf(appDir());
      console.log('✓ Application removed (configuration kept)');
    } else if (choice === '3') {
      rmrf(appDir());
      rmrf(dataDir());
      console.log('✓ Application and database removed (configuration & backups kept)');
    } else if (choice === '4') {
      rmrf(appDir());
      rmrf(dataDir());
      rmrf(configDir());
      console.log('✓ Application, database, and configuration removed (backups kept)');
    } else if (choice === '5') {
      rmrf(appDir());
      rmrf(dataDir());
      rmrf(configDir());
      rmrf(backupsDir());
      // Remove CLI symlinks/scripts
      for (const name of ['mlx', 'mlx-install', 'mlx-run']) {
        const ext = isWindows() ? '.cmd' : '';
        const target = path.join(binDir(), name + ext);
        try { fs.unlinkSync(target); } catch (err) {}
      }
      console.log('✓ All MAILIX data removed');
    } else {
      console.log('Cancelled.');
      return;
    }
  } else {
    rmrf(appDir());
    console.log('✓ Application removed (use --yes-all to also remove data)');
  }
  console.log('\nMAILIX has been uninstalled.');
}

main();
