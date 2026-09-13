#!/usr/bin/env node

/**
 * MAILIX — Unified CLI
 *
 * This is the single CLI entry point. It is invoked by:
 *   - mlx
 *   - mlx-install
 *   - mlx-run
 *
 * Subcommands: install, run, stop, restart, status, doctor, logs,
 *              update, uninstall, version, config
 */

const path = require('path');

const args = process.argv.slice(2);

// Convenience: when invoked as `mlx-install`, treat as `install`.
// When invoked as `mlx-run`, treat as `run`.
const invokedAs = (() => {
  const argv1 = process.argv[1] || '';
  if (argv1.endsWith('mlx-install') || argv1.endsWith('mlx-install.cmd')) return 'install';
  if (argv1.endsWith('mlx-run') || argv1.endsWith('mlx-run.cmd')) return 'run';
  return null;
})();

if (invokedAs && (args.length === 0 || !args[0].match(/^[a-z]/))) {
  args.unshift(invokedAs);
}

const command = args[0];
const rest = args.slice(1);

// Help & version shortcuts
if (args.includes('--version') || args.includes('-v')) {
  const { VERSION } = require('./core/installer');
  console.log(`MAILIX ${VERSION}`);
  console.log('MAILIX — by its_viyan');
  process.exit(0);
}
if (args.includes('--help') || args.includes('-h') || (!command && process.argv[1]?.endsWith('mlx.js'))) {
  printHelp();
  process.exit(0);
}

function printHelp() {
  console.log(`MAILIX — by its_viyan

Usage: mlx <command> [options]

Commands:
  install              Install MAILIX from official GitHub release
  run                  Start the MAILIX service and open the dashboard
  stop                 Stop the running MAILIX service
  restart              Stop and start MAILIX
  status               Show MAILIX status
  doctor               Diagnose the local environment
  logs                 View MAILIX logs
  update               Update MAILIX to the latest release
  uninstall            Remove MAILIX from this machine
  repair               Repair the MAILIX installation
  config               Show safe configuration
  version              Show version and runtime info

Options:
  --yes                Skip confirmation prompts
  --no-color           Disable color output
  --no-browser         Do not open the browser on run
  --json               Output machine-readable JSON
  --follow             Tail logs (for: mlx logs --follow)
  --port <port>        Override port (for: mlx run --port 8000)
  --help, -h           Show this help
  --version, -v        Show version

Examples:
  mlx-install
  mlx-run
  mlx status
  mlx doctor --json
  mlx logs --follow
  mlx repair
`);
}

// Map of command -> file
const COMMANDS = {
  install: 'install',
  run: 'run',
  stop: 'stop',
  restart: 'restart',
  status: 'status',
  doctor: 'doctor',
  logs: 'logs',
  update: 'update',
  uninstall: 'uninstall',
  config: 'config',
  version: 'version',
  repair: 'repair',
};

async function main() {
  if (!command) {
    printHelp();
    return;
  }
  const file = COMMANDS[command];
  if (!file) {
    console.error(`Unknown command: ${command}`);
    console.log('Run "mlx --help" for usage.');
    process.exit(1);
  }
  const commandPath = path.join(__dirname, 'commands', `${file}.js`);
  try {
    require(commandPath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error(`Command "${command}" is not yet implemented.`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error('MAILIX CLI error:', err.message);
  process.exit(1);
});
