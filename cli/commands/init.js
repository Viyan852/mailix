#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const MAILIX_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(MAILIX_DIR, 'server');
const DASHBOARD_DIR = path.join(MAILIX_DIR, 'apps', 'dashboard');
const DATA_DIR = path.join(MAILIX_DIR, 'data');
const PORT = 7345;

// Detect if running inside npm bin (mailix-run) or directly
const isPrimary = process.argv[1] && process.argv[1].endsWith('mailix-run.js');

// Print colorful ASCII logo
function printLogo() {
  const logo = `
  ███╗   ███╗ █████╗ ██╗██╗     ██╗██╗  ██╗
  ████╗ ████║██╔══██╗██║██║     ██║╚██╗██╔╝
  ██╔████╔██║███████║██║██║     ██║ ╚███╔╝
  ██║╚██╔╝██║██╔══██║██║██║     ██║ ██╔██╗
  ██║ ╚═╝ ██║██║  ██║██║███████╗██║██╔╝ ██╗
  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝╚═╝  ╚═╝

  MAILIX
  by its_viyan
`;
  console.log(logo);
}

// Initialize local database files
function initializeData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Create empty state files
  const files = [
    { name: 'projects.json', default: { projects: [] } },
    { name: 'company.json', default: { company: {
      name: '',
      website: '',
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      senderName: '',
      senderEmail: '',
      replyTo: ''
    }}},
    { name: 'templates.json', default: { templates: [] } },
    { name: 'subscribers.json', default: { subscribers: [] } },
    { name: 'domains.json', default: { domains: [] } },
    { name: 'api-keys.json', default: { keys: [] } },
    { name: 'logs.json', default: { logs: [] } },
    { name: 'verification-records.json', default: { records: [] } },
    { name: 'password-reset-records.json', default: { records: [] } },
    { name: 'verification-config.json', default: { config: {
      enabled: true,
      maxAttempts: 5,
      expiryHours: 24
    }}},
    { name: 'password-reset-config.json', default: { config: {
      enabled: true,
      maxAttempts: 3,
      expiryHours: 12
    }}},
    { name: 'newsletter-campaigns.json', default: { campaigns: [] } },
  ];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(file.default, null, 2));
    }
  }
}

// Detect if Mailix is already running
function isAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/v1/health',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Open browser to dashboard
function openBrowser() {
  const url = `http://localhost:${PORT}`;
  const platform = process.platform;
  let cmd;

  if (platform === 'win32') {
    cmd = `start ${url}`;
  } else if (platform === 'darwin') {
    cmd = `open ${url}`;
  } else {
    cmd = `xdg-open ${url}`;
  }

  try {
    require('child_process').exec(cmd);
  } catch (err) {
    console.log('Open the dashboard manually at:', url);
  }
}

// Start the server
function startServer() {
  // Use require to start the server
  const serverPath = path.join(SERVER_DIR, 'server.js');

  // Spawn the server
  const server = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    detached: false
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  return server;
}

// Main function
async function main() {
  printLogo();

  // Check if already running
  const running = await isAlreadyRunning();

  if (running) {
    console.log('✓ Mailix is already running');
    console.log(`  http://localhost:${PORT}`);
    console.log('\nOpening dashboard...');
    openBrowser();
    return;
  }

  // Initialize data
  console.log('✓ Initializing Mailix data...');
  initializeData();

  // Start server
  console.log('▶️  Starting Mailix service...');
  console.log('✓ Dashboard ready');
  console.log('✓ Local API ready');
  console.log(`\nhttp://localhost:${PORT}`);

  // Wait a moment then open browser
  setTimeout(() => {
    console.log('\nOpening dashboard...');
    openBrowser();
  }, 1500);

  // Start the server (this will keep the process alive)
  startServer();
}

// Run main
main().catch((err) => {
  console.error('Failed to start Mailix:', err);
  process.exit(1);
});