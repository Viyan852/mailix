#!/usr/bin/env node

/**
 * mlx install — Install MAILIX from official GitHub release
 */

const { Installer } = require('../core/installer');

const args = process.argv.slice(2);
const opts = {
  noColor: args.includes('--no-color'),
  yes: args.includes('--yes') || args.includes('-y'),
  dryRun: args.includes('--dry-run'),
};

const installer = new Installer(opts);
installer.run().catch((err) => {
  console.error('Installation failed:', err.message);
  process.exit(1);
});
