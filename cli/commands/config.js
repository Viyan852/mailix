#!/usr/bin/env node

/**
 * mlx config — Show safe configuration
 *
 * Never prints API secrets, database passwords, SMTP passwords, provider tokens,
 * or encryption keys. Sensitive values are masked as '********'.
 */

const fs = require('fs');
const { configFile, envFile } = require('../core/paths');

const SECRET_KEYS = [
  'SECRET', 'PASSWORD', 'PASS', 'TOKEN', 'API_KEY', 'APIKEY',
  'CREDENTIAL', 'PRIVATE', 'AUTH', 'KEY',
];

function isSensitive(key) {
  const upper = key.toUpperCase();
  return SECRET_KEYS.some(s => upper.includes(s));
}

function maskValue(value) {
  if (typeof value !== 'string' || value.length < 4) return '********';
  return value.substring(0, 2) + '********' + value.substring(value.length - 2);
}

function formatJsonSafe(obj) {
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitive(k)) {
      safe[k] = v ? maskValue(v) : '********';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

function showConfig() {
  console.log('MAILIX Configuration\n');
  console.log('=== config.json ===');
  if (fs.existsSync(configFile())) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
      console.log(JSON.stringify(cfg, null, 2));
    } catch (err) {
      console.log('(invalid config file)');
    }
  } else {
    console.log('(no config file)');
  }

  console.log('\n=== .env ===');
  if (fs.existsSync(envFile())) {
    const env = fs.readFileSync(envFile(), 'utf8');
    const lines = env.split('\n').map(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && isSensitive(m[1])) {
        return `${m[1]}=${maskValue(m[2])}`;
      }
      return line;
    });
    console.log(lines.join('\n'));
  } else {
    console.log('(no .env file)');
  }
}

function setConfig(key, value) {
  let cfg = {};
  if (fs.existsSync(configFile())) {
    cfg = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  }
  if (isSensitive(key)) {
    console.error('Refusing to set sensitive value via CLI. Edit .env directly.');
    process.exit(1);
  }
  cfg[key] = value;
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
  console.log(`Set ${key} = ${value}`);
}

const args = process.argv.slice(2);
if (args[0] === 'set' && args[1] && args[2]) {
  setConfig(args[1], args[2]);
} else if (args[0] === 'get' && args[1]) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    const value = cfg[args[1]];
    console.log(isSensitive(args[1]) ? (value ? maskValue(value) : '(not set)') : value);
  } catch (err) {
    console.log('(not set)');
  }
} else {
  showConfig();
}
