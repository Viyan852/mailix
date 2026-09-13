#!/usr/bin/env node

/**
 * mlx logs — View MAILIX logs
 *
 * Usage:
 *   mlx logs
 *   mlx logs --follow
 *   mlx logs --error
 *   mlx logs --worker
 *   mlx logs --lines 100
 */

const fs = require('fs');
const path = require('path');
const { logFile, workerLogFile, logsDir } = require('../core/paths');

const args = process.argv.slice(2);
const follow = args.includes('--follow') || args.includes('-f');
const errorOnly = args.includes('--error');
const worker = args.includes('--worker');
const linesArg = args.find(a => a.startsWith('--lines='));
const lines = linesArg ? parseInt(linesArg.split('=')[1], 10) : 100;

const file = worker ? workerLogFile() : logFile();
const fileExists = fs.existsSync(file);

// Redaction patterns
const REDACT = [
  [/(?:password|passwd|pwd)\s*[:=]\s*"?[^\s"&]+"?/gi, 'password=[REDACTED]'],
  [/(?:api[_-]?key|token|secret)\s*[:=]\s*"?[A-Za-z0-9_\-]+"?/gi, 'key=[REDACTED]'],
  [/Bearer\s+[A-Za-z0-9_\-\.=]+/g, 'Bearer [REDACTED]'],
];

function redact(line) {
  let out = line;
  for (const [pattern, replacement] of REDACT) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function readLastN(filePath, n) {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  const all = data.split('\n');
  return all.slice(-n);
}

function filterLevel(line, errorOnly) {
  if (!errorOnly) return true;
  return /\b(error|ERROR)\b/.test(line);
}

function main() {
  if (!fileExists) {
    if (fs.existsSync(logsDir())) {
      console.log(`Log file does not exist yet: ${file}`);
      console.log('It will be created when MAILIX starts.');
      return;
    }
    console.error(`Logs directory not found: ${logsDir()}`);
    console.error('Is MAILIX installed? Run: mlx install');
    process.exit(1);
  }

  if (follow) {
    let lastSize = fs.statSync(file).size;
    console.log(`Tailing ${file}… (Ctrl+C to exit)`);
    const interval = setInterval(() => {
      const size = fs.statSync(file).size;
      if (size > lastSize) {
        const stream = fs.createReadStream(file, {
          start: lastSize,
          end: size,
          encoding: 'utf8',
        });
        stream.on('data', (chunk) => {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line && filterLevel(line, errorOnly)) {
              process.stdout.write(redact(line) + '\n');
            }
          }
        });
        lastSize = size;
      }
    }, 500);
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
  } else {
    const out = readLastN(file, lines).filter(l => filterLevel(l, errorOnly)).map(redact);
    console.log(out.join('\n'));
  }
}

main();
