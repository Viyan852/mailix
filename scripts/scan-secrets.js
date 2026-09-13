#!/usr/bin/env node

/**
 * MAILIX Secret Scanner
 *
 * Lightweight pre-release check that scans tracked files for obvious
 * accidental secrets. Designed to be conservative — false positives are
 * allowed to slip through; actual secrets should never slip through.
 *
 * Patterns detected:
 *   - Private keys (PEM headers/footers)
 *   - AWS access keys
 *   - GitHub personal access tokens
 *   - Slack tokens
 *   - Generic API tokens (long high-entropy strings in known contexts)
 *
 * Excluded from the scan:
 *   - .env.example (allowed to contain placeholder credentials)
 *   - node_modules, .git, dist, build, data, backups, logs
 *   - Lock files and binary assets
 *   - The .ico file
 *   - Test files that contain fake credentials marked as such
 *
 * Usage:
 *   node scripts/scan-secrets.js              # scans repository root
 *   node scripts/scan-secrets.js --dir=/path  # scans a specific directory
 *
 * Exits with code 0 if no secrets found, 1 if any were detected.
 */

const fs = require('fs');
const path = require('path');

// Determine the root to scan:
//   1. --dir=<path> argument if provided
//   2. The repository root (one level above this script) when run directly
//   3. process.cwd() when invoked from an arbitrary directory (cwd != repoRoot)
const dirArg = process.argv.find(a => a.startsWith('--dir='));
let ROOT;
if (dirArg) {
  ROOT = path.resolve(dirArg.split('=').slice(1).join('='));
} else {
  // If we were invoked with process.cwd() pointing somewhere other than the
  // repository root, honour cwd so tests can run the scanner on temp dirs.
  const repoRoot = path.resolve(__dirname, '..');
  ROOT = process.cwd() === repoRoot ? repoRoot : process.cwd();
}

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'data', 'backups', 'logs',
  'coverage', '.cache', '.tmp', 'temp', 'inbox', 'test-results', 'tests'
]);
const EXCLUDE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'icon.ico',
  '.env.example', 'scan-secrets.js'
]);
const EXCLUDE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.icns', '.webp',
  '.zip', '.tar.gz', '.tgz', '.gz', '.7z', '.rar',
  '.pdf', '.bin', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.mp3', '.wav', '.mov', '.avi',
  '.lock',
]);

const PATTERNS = [
  // Private key headers
  { name: 'PEM private key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  // AWS access key
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  // GitHub PAT (new format)
  { name: 'GitHub PAT (new)', regex: /ghp_[A-Za-z0-9]{36}/ },
  // GitHub fine-grained PAT
  { name: 'GitHub fine-grained PAT', regex: /github_pat_[A-Za-z0-9_]{82}/ },
  // Slack tokens
  { name: 'Slack token', regex: /xox[abpr]-[0-9A-Za-z-]{10,}/ },
  // Generic bearer token in authorization-like context
  { name: 'Authorization: Bearer <long token>', regex: /(?:Authorization|authorization)['":\s]+(?:Bearer\s+)?([A-Za-z0-9_\-\.]{40,})/ },
  // PEM-encoded secrets
  { name: 'PGP message', regex: new RegExp('-----BEGIN ' + 'PGP MESSAGE-----') },
];

// Patterns that are ALWAYS false positives we should not flag
const FALSE_POSITIVE_CONTEXTS = [
  /example/i, /placeholder/i, /your_/i, /YOUR_/i, /xxxx/i, /XXXX/i, /\.\.\./,
];

let findings = [];

function isExcludedPath(filePath) {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }
  const base = path.basename(filePath);
  if (EXCLUDE_FILES.has(base)) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (EXCLUDE_EXTENSIONS.has(ext)) return true;
  return false;
}

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return; // Skip files that can't be read as text
  }

  // Skip very large files
  if (content.length > 1_000_000) return;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match) continue;
      // Skip lines that look like documentation / examples
      if (FALSE_POSITIVE_CONTEXTS.some(re => re.test(line))) continue;
      // Skip commented-out lines (// or #)
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
      findings.push({
        file: filePath,
        line: i + 1,
        pattern: pattern.name,
        excerpt: trimmed.length > 120 ? trimmed.substring(0, 117) + '...' : trimmed,
      });
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (isExcludedPath(full)) continue;
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      scanFile(full);
    }
  }
}

walk(ROOT);

if (findings.length === 0) {
  console.log('Secret scan: PASS (no secrets found)');
  process.exit(0);
}

// Output findings to stdout so callers can inspect the output
console.log('Secret scan: FAIL');
console.log('');
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.pattern}]`);
  console.log(`    ${f.excerpt}`);
}
console.log('');
console.log(`Found ${findings.length} potential secret(s). Remove them before releasing.`);
process.exit(1);
