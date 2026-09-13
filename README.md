# MAILIX — by its_viyan

> **Simple email infrastructure for developers.**

MAILIX is a self-contained, zero-runtime-install email automation platform. Download, run `mlx-install`, and you have a complete email service with verification codes, password resets, transactional emails, and newsletters — with **no Node.js, npm, Python, or Docker required** on the user's machine.

The Node.js runtime is bundled inside MAILIX, and the **MAILIX icon** is the only icon used throughout the product. No placeholder. No Node default icon. No auto-generated substitutes.

---

## Icon / Branding

MAILIX uses a single, canonical icon at:

```
assets/icon.ico
```

This is the **only** icon in the project. It is used for:

| Where | How it's applied |
|---|---|
| `mlx.exe` (File Explorer / Start Menu / Taskbar) | Embedded into the PE with `rcedit` |
| `mlx-install.exe` | Embedded into the PE with `rcedit` |
| `mlx-run.exe` | Embedded into the PE with `rcedit` |
| Desktop shortcuts | Created via PowerShell `WScript.Shell` with the icon |
| Start Menu shortcuts | Same |
| Installer banner | References the same file |

**The build pipeline fails** if `assets/icon.ico` is missing or invalid — there is no fallback. The icon is never auto-generated.

### Replacing the icon

1. Place your `.ico` file at `assets/icon.ico` (must be a real ICO file with magic bytes `00 00 01 00`).
2. Run `npm run validate-icon` to verify it.
3. Run `npm run build:release` to produce a new branded release.

The build pipeline uses **`rcedit`** to embed the icon into the bundled `node.exe` for each Windows launch target. On non-Windows hosts the release still succeeds — the launchers are `.cmd` shims that point at the bundled `node.exe`, and the icon is shipped alongside for later re-embedding on a Windows runner (or for use by the user's own installation if they choose to produce native `.exe` wrappers).

Validate at any time:

```bash
npm run validate-icon
```

Output:

```
✓ MAILIX icon OK: C:\path\to\mailix\assets\icon.ico (575.9 KB)
```

Or, if missing:

```
✗ MAILIX icon missing:
   C:\path\to\mailix\assets\icon.ico
```

---

## Quick Start

```bash
mlx-install    # Install MAILIX (downloads release, bundles Node, registers CLI)
mlx-run        # Start MAILIX and open the dashboard
```

That's it. The browser opens to **http://localhost:7345**. No `npm install`. No system Node. No PATH fiddling.

---

## Zero-runtime guarantee

MAILIX is built for users who do not have — and do not want to install — Node.js.

Each release contains:

```
mailix-windows-x64.zip/
├── bin/
│   ├── mlx.exe           ← branded PE executable (icon embedded)
│   ├── mlx-install.exe   ← branded PE executable
│   ├── mlx-run.exe       ← branded PE executable
├── app/                  ← application code (server, dashboard, cli)
├── runtime/
│   └── node.exe          ← bundled Node.js
├── assets/
│   └── icon.ico          ← MAILIX icon
├── config/
├── data/
├── logs/
├── backups/
└── SHA256SUMS
```

When the user runs `mlx.exe`, Windows loads the real PE, sees the MAILIX icon, and launches the bundled `runtime/node.exe` with the dispatcher script. The system PATH is **never** consulted for Node.

The bundled runtime is preferred over a system Node even when one exists. The only time MAILIX uses a system Node is when the user explicitly sets `MAILIX_DEV=1` (developer mode).

The `mlx doctor` command reports:

```
MAILIX DOCTOR
  ✓ Installation
  ✓ MAILIX runtime: bundled (node.exe)
  · System Node.js: Not installed (not required)
  ✓ CLI
  ✓ Configuration
  ...
```

System Node is shown for transparency only. Its absence is **not** an error.

---

## Releases

MAILIX has a single-command release system. The developer runs:

```bash
npm run release
```

That's it. The orchestrator handles everything: validates the working tree, runs the tests, builds the Windows x64 release (with the bundled Node.js runtime and production dependencies), builds the Windows installer, produces the portable ZIP, generates `SHA256SUMS`, creates the `vX.Y.Z` tag, and pushes it to GitHub. GitHub Actions picks up the tag and produces the official GitHub Release.

### What `npm run release` produces

```
dist/
├── MAILIX-Setup-x64.exe      ← primary artifact (Windows installer)
├── mailix-windows-x64.zip    ← portable ZIP
└── SHA256SUMS                ← checksums
```

The installer (`MAILIX-Setup-x64.exe`) is a single self-contained Windows executable. It:

- Per-user installation (no admin required)
- Installs to `%LOCALAPPDATA%\MAILIX\`
- Bundles a Node.js runtime — no system runtime required
- Creates Start Menu and Desktop shortcuts with the MAILIX icon
- Adds the install `bin\` directory to the user's PATH
- Registers an Add/Remove Programs entry
- Cleans up on uninstall

### The release flow

```
1. validate working tree        ← refuses to lose uncommitted changes
2. read version from package.json
3. validate assets/icon.ico     ← fails the build if missing
4. run npm test                 ← runs all unit + zero-node + icon + release tests
5. build windows-x64            ← bundles Node.js + dependencies + icon
6. build MAILIX-Setup-x64.exe   ← NSIS-based per-user installer
7. create mailix-windows-x64.zip
8. generate SHA256SUMS
9. create tag vX.Y.Z
10. push tag to origin
11. GitHub Actions builds the official release
```

### Pre-built releases on GitHub

Every tag produces a GitHub Release with:

| Platform | Artifact |
|---|---|
| Windows x64 (primary) | `MAILIX-Setup-x64.exe` |
| Windows x64 (portable) | `mailix-windows-x64.zip` |
| Windows ARM64 | `mailix-windows-arm64.zip` |
| Linux x64 | `mailix-linux-x64.tar.gz` |
| Linux ARM64 | `mailix-linux-arm64.tar.gz` |
| macOS Intel | `mailix-macos-x64.tar.gz` |
| macOS Apple Silicon | `mailix-macos-arm64.tar.gz` |
| Checksums | `SHA256SUMS` |

### Build technology

The release pipeline uses:

- **NSIS** (Nullsoft Scriptable Install System) for the Windows installer. It's the most modern, lightweight, and widely-supported free installer framework — produces a single self-contained `.exe` with no external dependencies.
- **rcedit** for embedding the icon into the bundled `node.exe` PE.
- **Node.js 20 LTS** (downloaded as a portable binary at build time, bundled into the release at runtime).
- **PowerShell `Compress-Archive`** for the portable ZIP (Windows host) and `tar`/`zip` on other platforms.

### Manual building (for developers who need a local build)

```bash
npm run build:release -- --platform=windows-x64
npm run build:installer  -- --platform=windows-x64
```

Both commands emit to `dist/`. To produce a single combined release:

```bash
npm run release
```

---

## CLI Reference

```bash
mlx install              # Install MAILIX from official GitHub release
mlx run                  # Start the MAILIX service and open the dashboard
mlx stop                 # Stop the running MAILIX service
mlx restart              # Stop and start MAILIX
mlx status               # Show MAILIX status
mlx status --json        # Machine-readable status
mlx doctor               # Diagnose the local environment
mlx doctor --json        # Machine-readable diagnostics
mlx logs                 # View MAILIX logs
mlx logs --follow        # Tail logs in real time
mlx logs --error         # Show only error lines
mlx update               # Update MAILIX to the latest release
mlx repair               # Repair a corrupted installation
mlx uninstall            # Remove MAILIX from this machine
mlx config               # Show safe configuration
mlx version              # Show version and runtime info
```

Convenience wrappers:

```bash
mlx-install    # alias for: mlx install
mlx-run        # alias for: mlx run
```

All commands support `--no-color`. Most support `--json` for automation.

---

## Installation

### Normal user (zero runtime)

1. Download the latest release archive for your platform from the GitHub Releases page.
2. Extract it anywhere.
3. Run `mlx-install` from the extracted directory (or add the `bin/` to your PATH first).

The installer:

- Detects OS and CPU architecture
- Downloads the appropriate release (or uses the extracted archive if local)
- Verifies the SHA-256 checksum
- Extracts to a platform-appropriate location
- Downloads and installs the **bundled Node.js runtime**
- Creates predictable platform-appropriate directories (separate `app/`, `runtime/`, `config/`, `data/`, `logs/`, `backups/`, `runtime-state/`)
- Initializes the database
- Registers `mlx`, `mlx-install`, and `mlx-run` on your PATH
- Runs `mlx doctor` automatically
- Prints a final summary

### Install location

| OS | App | Config | Data | Logs |
|---|---|---|---|---|
| Windows | `%LOCALAPPDATA%\Mailix` | `%APPDATA%\Mailix` | `%LOCALAPPDATA%\Mailix\Data` | `%LOCALAPPDATA%\Mailix\Logs` |
| macOS | `~/Applications/Mailix.app` | `~/Library/Application Support/Mailix` | `~/Library/Application Support/Mailix/Data` | `~/Library/Logs/Mailix` |
| Linux | `~/.local/share/mailix` | `~/.config/mailix` | `~/.local/share/mailix/data` | `~/.local/share/mailix/logs` |

Persistent data **survives updates and uninstalls** (when "Keep database" is chosen).

---

## Starting

```bash
mlx-run
```

Output:

```
MAILIX
────────────────────────────

✓ Installation found
✓ MAILIX runtime found (bundled)
✓ Configuration loaded
✓ Database connected
✓ Migrations verified
✓ Email worker started
✓ API server started
✓ Health check passed

Dashboard:
http://localhost:7345

API:
http://localhost:7345/api

Press Ctrl+C to stop.
```

If port 7345 is busy, you'll be asked to choose another port.

To skip the browser auto-open:

```bash
mlx-run --no-browser
```

---

## Stopping & Restarting

```bash
mlx stop      # Graceful shutdown — kills only MAILIX (PID file)
mlx restart   # Stop, then start
```

These never kill unrelated processes. They use a PID file and verify the process identity.

---

## Status

```bash
mlx status
```

Example:

```
MAILIX STATUS

  Version:      2.0.0
  Status:       Running
  PID:          12345
  Port:         7345
  Database:     Connected
  Provider:     SMTP (smtp.example.com)
  Installed:    Yes
```

For automation: `mlx status --json`.

---

## Diagnostics

```bash
mlx doctor
```

Checks: installation, **MAILIX runtime (bundled)**, system Node (informational), CLI, runtime, configuration, database, migrations, email provider, worker, port, file permissions, disk space, PATH.

Exit code 0 on success, 1 on failure.

---

## Repair

If the bundled runtime is missing or corrupted:

```bash
mlx repair
```

Re-downloads and re-verifies the application files and the Node.js runtime, then regenerates the launchers. **User data, configuration, and backups are preserved.**

---

## Logs

```bash
mlx logs                   # Last 100 lines
mlx logs --lines 500       # Last 500 lines
mlx logs --follow          # Tail in real time
mlx logs --error           # Only error-level lines
mlx logs --worker          # Worker log instead of API log
```

Logs are **redacted** — passwords, API keys, tokens, and other sensitive values are masked before display.

---

## Configuration

```bash
mlx config
```

Shows `config.json` and `.env` with sensitive values masked as `********`. To view or set a value:

```bash
mlx config get port
mlx config set port 8000
```

Sensitive values (anything matching `*PASSWORD*`, `*SECRET*`, `*TOKEN*`, `*KEY*`, etc.) cannot be set via the CLI. Edit `.env` directly.

---

## Updating

```bash
mlx update
```

Updates MAILIX to the latest release. **Never** deletes your data, database, configuration, or backups unless absolutely required. If verification fails, the previous version is restored.

---

## Uninstalling

```bash
mlx uninstall
```

Interactive: choose what to remove. User data is never silently deleted.

---

## Email Providers

MAILIX supports a provider abstraction. Set `MAILIX_EMAIL_PROVIDER` in `.env`:

| Provider | Configuration | Notes |
|---|---|---|
| `local` | (default) | Captures messages to local inbox. No external delivery. Always available. |
| `smtp` | `MAILIX_SMTP_HOST`, `MAILIX_SMTP_PORT`, `MAILIX_SMTP_USER`, `MAILIX_SMTP_PASSWORD` | Real SMTP delivery via nodemailer |
| `ses` | `MAILIX_SES_ACCESS_KEY`, `MAILIX_SES_SECRET_KEY`, `MAILIX_SES_REGION` | Amazon SES |
| `resend` | `MAILIX_RESEND_API_KEY` | Resend HTTP API |

Provider credentials are **never** exposed to the browser. Delivery status is clearly distinguished: `delivered`, `queued`, `simulated`, `failed`, `bounced`.

---

## Database

MAILIX supports two backends:

- **JSON** (default for local development) — no setup required
- **PostgreSQL** (recommended for production) — set `MAILIX_DATABASE_URL`

The higher-level code depends only on the database abstraction, so swapping backends requires no application changes.

Existing JSON data is preserved. Migration tooling is included (`mlx db:backup` / `mlx db:restore`).

---

## Security

- Bcrypt password hashing (with scrypt fallback)
- API keys stored as SHA-256 hashes — plaintext shown only once
- Cryptographically random API key generation with identifiable prefix (`mx_live_…`)
- API key scopes
- Rate limiting on auth, email, verification, password reset, and newsletter endpoints
- IP-based and per-project limits
- Configurable CORS (no `*` in production)
- HTTP security headers (helmet)
- Request size limits
- Centralized input validation
- Email-template XSS prevention (variable escaping)
- Sensitive value redaction in logs
- Webhook signature verification
- **Release verification**: every downloaded release is SHA-256-verified before execution; corrupted downloads are rejected

---

## Authentication & Authorization

User accounts with role-based access control:

| Role | Permissions |
|---|---|
| Owner | Full access, user management |
| Admin | All except user deletion |
| Developer | All operational actions |
| Viewer | Read-only |

Sessions are server-side, expire after 7 days, and are revocable. The CLI ships without a default user — create one in the dashboard.

---

## API

Base URL: `http://localhost:7345/api/v1`

Full reference: see [docs/API.md](docs/API.md).

Highlights:

- `POST /auth/login` — bearer-token authentication
- `POST /emails/send` — queue an email
- `POST /verification/send` — generate a code and queue an email
- `POST /password-reset/request` — always returns success (no account disclosure)
- `POST /api-keys` — create a key (plaintext shown once)
- `POST /webhooks/:provider` — receive delivery events
- `POST /integrations/snippet` — generate code in 9 languages

All errors return:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "...", "requestId": "..." } }
```

---

## Queue

All email operations go through a background queue with:

- Statuses: `queued`, `processing`, `sent`, `delivered`, `deferred`, `bounced`, `failed`, `cancelled`, `simulated`
- Exponential backoff with jitter
- Maximum 5 attempts
- Idempotency keys
- Failed-job handling
- Distribution-safe (no in-process state for critical data; ready for Redis backend)

---

## Templates

Templates use `{{variable}}` syntax. Variables are escaped by default to prevent XSS in HTML emails.

```js
const { render } = require('./server/utils/template');
const html = render('Hello {{name}}', { name: '<script>...</script>' }, 'html');
// => "Hello &lt;script&gt;...&lt;/script&gt;"
```

Text mode strips control characters. Arbitrary code execution paths are not present.

---

## Health Checks

```http
GET /health              # Liveness
GET /health/live         # Process alive
GET /health/ready        # DB + queue + provider
```

---

## CLI Architecture

```
cli/
├── mlx.js                  # Unified CLI dispatcher
├── bin/                    # Launcher scripts (re-exec under bundled Node)
│   ├── mlx.js
│   ├── mlx-install.js
│   └── mlx-run.js
├── core/
│   ├── runtime.js          # Resolves bundled Node, never uses system Node by default
│   ├── installer.js        # mlx-install logic, downloads Node runtime
│   ├── launcher.js         # Writes platform launchers (mlx, mlx-install, mlx-run)
│   ├── downloader.js       # GitHub release download
│   ├── verifier.js         # SHA-256 verification
│   ├── platform.js         # OS / arch detection
│   ├── paths.js            # Predictable install paths
│   └── process-manager.js  # PID tracking, start/stop
└── commands/
    ├── install.js
    ├── run.js
    ├── stop.js
    ├── restart.js
    ├── status.js
    ├── doctor.js
    ├── logs.js
    ├── update.js
    ├── repair.js
    ├── uninstall.js
    ├── config.js
    └── version.js
```

The release pipeline:

```
.github/workflows/release.yml
  ↓ on tag push
build (matrix: 6 platforms)
  ↓
scripts/build-release.js
  ↓ downloads Node.js LTS, copies app, writes launchers
  ↓ npm ci --omit=dev
  ↓ generates SHA256SUMS
dist/mailix-<platform>-v<version>/
  ↓
GitHub Release
```

---

## Development

For contributors working on the source directly:

```bash
npm install          # Installs dev dependencies
npm start            # Starts the server (uses system Node)
npm test             # Runs unit + zero-node tests
npm run build        # Build check
npm run build:release  # Produces a self-contained release artifact
```

When you run `npm start` or `npm test` directly, MAILIX uses the system Node — that's the developer experience. When the user runs `mlx-run` from an installed release, the bundled Node is used.

---

## Tests

```bash
npm test
```

This runs two suites:

- **`tests/test.js`** — unit tests for validation, template rendering, API keys, authentication, providers, database, queue, rate limiting, CLI, logger
- **`tests/zero-node.test.js`** — verifies the bundled-runtime guarantee: launchers use the resolver, the installer places the runtime, the build script downloads Node, doctor reports bundled runtime, error messages never tell users to install Node

---

## Known limitations

- **No SSL auto-provisioning** for production HTTPS. Place MAILIX behind a reverse proxy.
- **No multi-region queue** by default. The current in-process queue works for single-instance deployments; Redis backend is included as an optional dependency.
- **No official mobile app**. The dashboard is web-only.
- **Local provider is for development only** — it does not deliver to real inboxes. Configure SMTP, SES, or Resend for production.

---

## License

MIT © its_viyan

---

**MAILIX — by its_viyan**
