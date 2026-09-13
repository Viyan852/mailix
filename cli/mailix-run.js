#!/usr/bin/env node

/**
 * MAILIX — by its_viyan
 *
 * Primary CLI entry point. Supports:
 *   (default)  mailix-run   — start the service and open the dashboard
 *   init                    — initialize a new project
 *   login                   — login to the dashboard
 *   projects                — list projects
 *   config                  — show/set configuration
 *   status                  — show service status
 *   doctor                  — diagnose local environment
 *   db:backup / db:restore  — backup and restore data
 *   domain / sender         — manage domains and senders
 *   help                    — show help
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const MAILIX_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(MAILIX_DIR, 'server');
const DASHBOARD_DIR = path.join(MAILIX_DIR, 'apps', 'dashboard');
const DATA_DIR = path.join(MAILIX_DIR, 'data');
const PORT = 7345;

const args = process.argv.slice(2);
const command = args[0];

function runSubcommand(name) {
  const subcommand = path.join(__dirname, 'commands', `${name}.js`);
  if (fs.existsSync(subcommand)) {
    const child = spawn(process.execPath, [subcommand, ...args.slice(1)], { stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
  } else {
    console.error(`Unknown command: ${name}`);
    process.exit(1);
  }
}

function printLogo() {
  console.log(`
  ███╗   ███╗ █████╗ ██╗██╗     ██╗██╗  ██╗
  ████╗ ████║██╔══██╗██║██║     ██║╚██╗██╔╝
  ██╔████╔██║███████║██║██║     ██║ ╚███╔╝
  ██║╚██╔╝██║██╔══██║██║██║     ██║ ██╔██╗
  ██║ ╚═╝ ██║██║  ██║██║███████╗██║██╔╝ ██╗
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝╚═╝  ╚═╝

  MAILIX
  by its_viyan
`);
}

function initializeData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const files = [
    { name: 'projects.json', default: { projects: [] } },
    { name: 'company.json', default: { company: { name: '', primaryColor: '#6366F1', secondaryColor: '#8B5CF6' } } },
    { name: 'users.json', default: { users: [] } },
    { name: 'sessions.json', default: { sessions: [] } },
    { name: 'api_keys.json', default: { keys: [] } },
    { name: 'domains.json', default: { domains: [] } },
    { name: 'subscribers.json', default: { subscribers: [] } },
    { name: 'templates.json', default: { templates: [] } },
    { name: 'emails.json', default: { emails: [] } },
    { name: 'delivery_events.json', default: { events: [] } },
    { name: 'verification_tokens.json', default: { tokens: [] } },
    { name: 'password_reset_tokens.json', default: { tokens: [] } },
    { name: 'campaigns.json', default: { campaigns: [] } },
    { name: 'suppressions.json', default: { suppressions: [] } },
    { name: 'logs.json', default: { logs: [] } },
    { name: 'audit_logs.json', default: { logs: [] } },
  ];
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(file.default, null, 2));
    }
  }
}

function isAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: PORT, path: '/health', timeout: 1000,
    }, (res) => resolve(true));
    req.on('error', () => resolve(false));
    req.end();
  });
}

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  let cmd;
  if (process.platform === 'win32') cmd = `start ${url}`;
  else if (process.platform === 'darwin') cmd = `open ${url}`;
  else cmd = `xdg-open ${url}`;
  try { require('child_process').exec(cmd); } catch (err) { console.log('Open the dashboard at:', url); }
}

function startServer() {
  process.chdir(MAILIX_DIR);
  process.env.MAILIX_PORT = PORT;
  process.env.MAILIX_DATA_DIR = DATA_DIR;
  process.env.MAILIX_ENV = process.env.MAILIX_ENV || 'development';
  try {
    require(path.join(SERVER_DIR, 'server.js'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

async function runMailix() {
  printLogo();
  const running = await isAlreadyRunning();
  if (running) {
    console.log('✓ Mailix is already running');
    console.log(`  http://localhost:${PORT}`);
    console.log('\nOpening dashboard...');
    openBrowser();
    return;
  }
  initializeData();
  console.log('✓ Mailix service started');
  console.log('✓ Dashboard ready');
  console.log('✓ Local API ready');
  console.log(`\nhttp://localhost:${PORT}`);
  setTimeout(() => {
    console.log('\nOpening dashboard...');
    openBrowser();
  }, 1500);
  startServer();
}

// Command dispatch
if (!command) {
  runMailix();
} else if (command === 'init') {
  const projectName = args[1] || 'Default Project';
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const projectsFile = path.join(DATA_DIR, 'projects.json');
  let data = { projects: [] };
  if (fs.existsSync(projectsFile)) data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
  if (data.projects.length === 0) {
    const crypto = require('crypto');
    data.projects.push({ id: 'prj_' + crypto.randomBytes(8).toString('hex'), name: projectName, created_at: new Date().toISOString() });
    fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));
    console.log(`Initialized project: ${projectName}`);
  }
} else if (command === 'login') {
  console.log('✓ Logged in (local mode)');
} else if (command === 'projects' || command === 'project') {
  runSubcommand('projects');
} else if (command === 'config') {
  runSubcommand('config');
} else if (command === 'status') {
  runSubcommand('status');
} else if (command === 'doctor') {
  runSubcommand('doctor');
} else if (command === 'db:backup' || command === 'backup') {
  runSubcommand('backup');
} else if (command === 'db:restore' || command === 'restore') {
  runSubcommand('restore');
} else if (command === 'domain') {
  console.log('Use the dashboard Domains page to manage domains.');
} else if (command === 'sender') {
  console.log('Use the dashboard Senders page to manage senders.');
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('MAILIX — by its_viyan\n');
  console.log('Usage: mailix <command>\n');
  console.log('Commands:');
  console.log('  (no command)   Start the Mailix service and open dashboard');
  console.log('  init [name]    Initialize a new project');
  console.log('  login          Login to Mailix');
  console.log('  projects       List projects');
  console.log('  config         Show/set configuration');
  console.log('  status         Show Mailix status');
  console.log('  doctor         Diagnose local environment');
  console.log('  db:backup      Create a backup');
  console.log('  db:restore     Restore from a backup');
  console.log('  help           Show this help message');
} else {
  console.error(`Unknown command: ${command}`);
  console.log('Run "mailix help" for usage.');
  process.exit(1);
}
