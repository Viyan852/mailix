#!/usr/bin/env node

/**
 * MAILIX Restore Command
 *
 * Restores from a backup archive. Prompts for confirmation before
 * overwriting existing data.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('mailix-backup-') && f.endsWith('.tar.gz'))
    .sort().reverse();
}

async function restoreBackup(filename) {
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`Backup not found: ${filepath}`);
    process.exit(1);
  }

  console.log(`This will OVERWRITE existing data with backup: ${filename}`);
  const answer = await prompt('Are you sure? (yes/no): ');
  if (answer.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    return;
  }

  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', filepath, '-C', DATA_DIR], { stdio: 'inherit' });
    tar.on('exit', (code) => {
      if (code === 0) {
        console.log('✓ Restore complete');
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });
    tar.on('error', reject);
  });
}

const args = process.argv.slice(2);
const cmd = args[0];

(async () => {
  if (cmd === 'list') {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log('No backups found.');
    } else {
      console.log('Available backups:');
      backups.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    }
  } else if (cmd && cmd !== 'list') {
    try {
      await restoreBackup(cmd);
    } catch (err) {
      console.error('Restore failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('Usage: mailix db:restore [list|<backup-filename>]');
  }
})();
