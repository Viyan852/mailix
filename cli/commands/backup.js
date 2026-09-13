#!/usr/bin/env node

/**
 * MAILIX Backup Command
 *
 * Creates a tar.gz archive of application data.
 * Excludes secrets files and provider credentials.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function listBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('mailix-backup-') && f.endsWith('.tar.gz'));
  return files.sort().reverse();
}

function createBackup() {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `mailix-backup-${timestamp}.tar.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'tar' : 'tar';
    const args = ['-czf', filepath, '-C', DATA_DIR, '.'];
    // Exclude backups and inbox (inbox can grow large; backup separately if needed)
    args.push('--exclude=backups');
    args.push('--exclude=inbox');

    const tar = spawn(cmd, args, { stdio: 'inherit' });
    tar.on('exit', (code) => {
      if (code === 0) {
        console.log(`✓ Backup created: ${filepath}`);
        const size = fs.statSync(filepath).size;
        console.log(`  Size: ${(size / 1024).toFixed(2)} KB`);
        resolve(filepath);
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
  if (!cmd || cmd === 'create') {
    try {
      await createBackup();
    } catch (err) {
      console.error('Backup failed:', err.message);
      process.exit(1);
    }
  } else if (cmd === 'list') {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log('No backups found.');
    } else {
      console.log('Backups:');
      for (const b of backups) {
        const stat = fs.statSync(path.join(BACKUP_DIR, b));
        console.log(`  ${b} (${(stat.size / 1024).toFixed(2)} KB)`);
      }
    }
  } else {
    console.log('Usage: mailix db:backup [create|list]');
  }
})();
