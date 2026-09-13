# MAILIX — Usage Guide

A complete walkthrough of MAILIX — from the first `mlx-install` to running a production-grade email workflow.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First-time setup](#first-time-setup)
3. [Starting & stopping](#starting--stopping)
4. [The dashboard](#the-dashboard)
5. [Creating your first project](#creating-your-first-project)
6. [Configuring company branding](#configuring-company-branding)
7. [Email verification (with code)](#email-verification-with-code)
8. [Password reset (with code)](#password-reset-with-code)
9. [Generating integration code](#generating-integration-code)
10. [Creating API keys](#creating-api-keys)
11. [Sending a transactional email](#sending-a-transactional-email)
12. [Newsletters & subscribers](#newsletters--subscribers)
13. [Domain verification](#domain-verification)
14. [Production: real email provider](#production-real-email-provider)
15. [Switching the database to PostgreSQL](#switching-the-database-to-postgresql)
16. [Suppression management](#suppression-management)
17. [Inspecting a message in detail](#inspecting-a-message-in-detail)
18. [Logs, analytics, and stats](#logs-analytics-and-stats)
19. [Backups & restore](#backups--restore)
20. [Updating MAILIX](#updating-mailix)
21. [Uninstalling](#uninstalling)
22. [Daily CLI reference](#daily-cli-reference)
23. [Troubleshooting](#troubleshooting)

---

## Prerequisites

**Normal users:** None. MAILIX bundles its own Node.js runtime. You do not need Node.js, npm, Python, or any other runtime on your machine.

**Developers (working from source):**

- **Node.js 18+** — `node -v` to check
- **npm 9+** — comes with Node.js
- One of: Windows 10/11, macOS 11+, or a modern Linux
- An internet connection for the first install (downloads the release)

The first install pulls the official release from GitHub. After that, MAILIX runs entirely on your machine.

---

## First-time setup

Open a terminal (CMD or PowerShell on Windows, Terminal on macOS/Linux) and run:

```bash
mlx-install
```

What happens:

1. **Platform detection** — Windows x64 / Windows ARM64 / Linux x64 / Linux ARM64 / macOS Intel / macOS Apple Silicon
2. **Release download** — fetches the latest official release from the `mailix` GitHub repository
3. **SHA-256 verification** — refuses to install if the checksum doesn't match
4. **Extraction** — installs to a platform-appropriate directory (see below)
5. **Directory creation** — separate `app/`, `config/`, `data/`, `logs/`, `backups/`, `runtime/` directories
6. **CLI registration** — `mlx`, `mlx-install`, `mlx-run` registered on your PATH
7. **Doctor** — runs `mlx doctor` to verify the install
8. **Summary** — prints a success message

Install location (per OS):

| OS | Where MAILIX lives |
|---|---|
| Windows | `%LOCALAPPDATA%\Mailix` |
| macOS | `~/Applications/Mailix.app` |
| Linux | `~/.local/share/mailix` |

If the installer cannot reach GitHub, it falls back to installing from the current source tree (development mode) — this only happens if you ran `mlx-install` from inside a clone.

For unattended installs (CI, scripts):

```bash
mlx-install --yes
```

---

## Starting & stopping

### Start MAILIX

```bash
mlx-run
```

Output:

```
MAILIX
────────────────────────────

✓ Installation found
✓ Configuration loaded
✓ Database connected
✓ Migrations verified
✓ Email worker started
✓ API server started
✓ Dashboard ready

Dashboard:
http://localhost:7345

API:
http://localhost:7345/api

Press Ctrl+C to stop.
```

Your browser will open automatically. To skip the browser:

```bash
mlx-run --no-browser
```

If port 7345 is in use, you'll be asked to choose another port. The choice is persisted.

### Stop MAILIX

```bash
mlx stop
```

Graceful — sends SIGTERM, waits up to 5 seconds, then SIGKILL if needed. Only kills the MAILIX process (tracked by PID file); it will never kill unrelated processes.

### Restart

```bash
mlx restart
```

### Check status

```bash
mlx status
```

Example output:

```
MAILIX STATUS

  Version:      2.0.0
  Status:       Running
  PID:          12345
  Port:         7345
  Database:     Connected
  Provider:     Local (simulated)
  Installed:    Yes
```

For automation: `mlx status --json`.

---

## The dashboard

When you open `http://localhost:7345`, the first time you visit you'll be asked to log in. The default MAILIX installation ships with no users — log in is via the **Login** button at the top of the dashboard.

> **Note:** For the very first run, you may need to create an initial admin user via the API. A typical pattern is to send a `POST /api/v1/auth/register` request (or use a one-time CLI helper). If your installation supports it, the dashboard will guide you through creating the first admin.

The dashboard has a left sidebar with these sections:

- **Dashboard** — totals, sent/delivered/bounced, recent activity, system health
- **Emails** — transactional email history, with detail pages
- **Automation** — verification and password-reset flows, configurable
- **Templates** — email template builder
- **Domains** — verified senders and DNS instructions
- **Subscribers** — newsletter subscribers
- **Logs** — full event history with search/filter
- **Analytics** — sent/delivered/opened/clicked over time
- **Settings** — company, branding, security, API, defaults

The top bar shows your current email-provider health (green = OK, red = down) and quick stats.

---

## Creating your first project

In the dashboard, go to **Settings → Projects** (or click the project switcher in the top bar). Click **Create Project**, give it a name, and confirm.

A project is a container for:

- Its own **branding** (colors, sender, reply-to)
- Its own **API keys** (the keys are scoped to one project)
- Its own **subscribers**, **domains**, and **templates**
- Its own **email logs** and **analytics**

The CLI is the same — but everything you do is in the context of a project.

---

## Configuring company branding

Go to **Settings → Branding** (or click the project and choose **Branding**). Fill in:

- **Company name**
- **Website**
- **Primary color** (used in email headers)
- **Secondary color**
- **Sender name** (e.g. `Acme`)
- **Sender email** (e.g. `hello@acme.com`)
- **Reply-To** (e.g. `reply@acme.com`)

The right side of the page shows a **live preview** of a verification email. Every change updates the preview immediately. The preview is rendered through the same template engine that produces real emails, so what you see is what your users get.

Click **Save**. The branding is stored in the database and used for every email from this project.

---

## Email verification (with code)

### The flow

1. Your application calls MAILIX: `POST /api/v1/verification/send` with `{ "email": "user@example.com" }`
2. MAILIX generates a secure 6-digit code, hashes it, stores it with an expiration (default 24 hours)
3. MAILIX renders the verification email using your branding
4. MAILIX enqueues the email and the worker sends it
5. The user receives the email and types the code into your app
6. Your app calls `POST /api/v1/verification/verify` with `{ "email", "code" }`
7. MAILIX hashes the input and compares; returns success/failure
8. The code is consumed (one-time use); failed attempts increment a counter

### Generate integration code

In the dashboard, go to **API & Integrations** (or **Automation → Verification**). Choose:

- **Language**: JavaScript, TypeScript, Python, PHP, Java, C#, Go, Ruby, cURL
- **Type**: Email Verification
- **Project**: your project

The code is generated for your specific project and base URL. Click **Copy** or **Download**.

Example output (JavaScript):

```js
async function sendVerification(email) {
  const res = await fetch('http://localhost:7345/api/v1/verification/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MAILIX_API_KEY}` },
    body: JSON.stringify({ email, projectId: 'prj_abc123' }),
  });
  return res.json();
}
```

### Configure behavior

**Settings → Automation → Verification** lets you set:

- Enable/disable verification
- Max attempts (default 5)
- Expiration in hours (default 24)
- Code length

### Test it

From the dashboard, **Automation → Verification → Send Test**. This sends a real test email — when the provider is set to `local` (the default), the email is captured to your **local inbox** instead of being delivered. Click the inbox to render the actual HTML.

---

## Password reset (with code)

### The flow

1. User clicks "Forgot password" in your app
2. Your app calls `POST /api/v1/password-reset/request` with `{ "email": "user@example.com" }`
3. MAILIX **always** returns the same response — even if the email doesn't exist. This prevents account enumeration:

   ```json
   { "success": true, "message": "If the account exists, a reset email has been sent." }
   ```

4. The email contains a 6-digit code, valid for 12 hours
5. Your app calls `POST /api/v1/password-reset/verify` with `{ "email", "code" }`
6. The code is hashed and compared; one-time use, max 3 attempts

### Generate integration code

Same flow as verification: **API & Integrations → Password Reset → choose language → copy**.

### Configure behavior

**Settings → Automation → Password Reset** — set expiration, max attempts, and template.

---

## Generating integration code

Go to **API & Integrations**. Pick:

- **Language** — 9 options
- **Type** — Send Email, Email Verification, Password Reset, Newsletter
- **Project** — your project

The generated code uses your real project ID and base URL. Frontend-targeted languages (JavaScript, TypeScript) get a `pk_live_…` publishable-key placeholder, never a secret. Server-side languages (Python, PHP, Go, etc.) use a server-only `Bearer` token from `MAILIX_API_KEY`.

The same flow exists for: **Send Email**, **Verification**, **Password Reset**, **Newsletter**.

---

## Creating API keys

API keys let you call MAILIX from your backend. Go to **Settings → API Keys**.

Click **Create Key**, give it a name, choose scopes, and confirm.

Scopes (a key can have any combination):

| Scope | Allows |
|---|---|
| `email:send` | Send transactional emails |
| `email:read` | List/inspect sent emails |
| `templates:read` | List templates |
| `templates:write` | Create/edit templates |
| `subscribers:read` | List subscribers |
| `subscribers:write` | Add/remove subscribers |
| `newsletters:send` | Create/send campaigns |
| `newsletters:read` | List campaigns |
| `analytics:read` | Read analytics |
| `projects:read` | List projects |
| `projects:write` | Create/edit projects |

The plaintext key is **shown only once** — copy it immediately. The dashboard stores only the SHA-256 hash. Treat the plaintext like a password.

Click **Revoke** at any time to invalidate a key. **Rotate** issues a new key with the same scopes and expires the old one.

---

## Sending a transactional email

Use the **Emails** page or call the API:

```http
POST /api/v1/emails/send
Authorization: Bearer mx_live_...
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Welcome to Acme",
  "html": "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
  "templateId": "tpl_welcome"
}
```

What happens:

1. The request is validated (size, format, scopes)
2. A message is created in the database with status `queued`
3. The message is added to the queue
4. The queue worker picks it up
5. The configured provider sends it (Local / SMTP / SES / Resend)
6. The status updates: `sent` (or `delivered`, `failed`, `bounced`)
7. A delivery event is recorded
8. The dashboard's **Logs** page reflects everything

The API responds immediately — slow provider operations don't block the request.

---

## Newsletters & subscribers

### Add subscribers

**Subscribers → Add Subscriber** in the dashboard, or:

```http
POST /api/v1/subscribers
{
  "name": "Jane",
  "email": "jane@example.com",
  "status": "subscribed"
}
```

Subscriber statuses: `subscribed`, `unsubscribed`, `bounced`, `suppressed`.

### Create a campaign

**Newsletters → Create Campaign**:

- Campaign name
- Subject
- From name / From email / Reply-To
- Template

Save the campaign as a draft, send a test, schedule it, or send immediately.

Campaigns are processed via the queue — not synchronously. A campaign with 10,000 subscribers doesn't block the API.

### Unsubscribe

Every email includes an unsubscribe link. Clicking it calls `POST /api/v1/subscribers/:id/unsubscribe`. The subscriber's status changes to `unsubscribed`; future campaigns skip them automatically.

If a recipient **bounces** repeatedly, MAILIX auto-suppresses them (see [Suppression management](#suppression-management)).

---

## Domain verification

To send from your own domain (`@acme.com`), MAILIX needs to verify it owns the domain.

**Domains → Add Domain** → enter `acme.com`.

MAILIX shows the exact DNS records you need to add at your DNS provider:

| Type | Host | Value |
|---|---|---|
| TXT | `_mailix-verify.acme.com` | `mailix-verify=<token>` |
| TXT | `acme.com` | `v=spf1 include:mailix.app ~all` |
| TXT | `mailix._domainkey.acme.com` | `v=DKIM1; k=rsa; p=...` |
| TXT | `_dmarc.acme.com` | `v=DMARC1; p=quarantine; rua=mailto:...` |

Once the records are in place, click **Verify**. MAILIX queries DNS and only marks the domain **verified** if **all four** records are present (ownership + SPF + DKIM + DMARC).

A partial state (`ownership ✓, SPF ✓, DKIM ✗, DMARC ✗`) is also tracked so you can see what's still missing.

---

## Production: real email provider

In local development, MAILIX uses the **Local** provider — outgoing messages are captured to a built-in inbox, not delivered. Status is `simulated`.

For production, set the provider in `.env` (located in your config dir — see `mlx config`):

```bash
# Edit the .env file
nano "$(mlx config | grep .env | awk '{print $2}')"
```

For **SMTP**:

```env
MAILIX_EMAIL_PROVIDER=smtp
MAILIX_SMTP_HOST=smtp.postmarkapp.com
MAILIX_SMTP_PORT=587
MAILIX_SMTP_USER=...
MAILIX_SMTP_PASSWORD=...
MAILIX_SMTP_FROM=hello@yourdomain.com
```

For **Resend**:

```env
MAILIX_EMAIL_PROVIDER=resend
MAILIX_RESEND_API_KEY=re_...
MAILIX_RESEND_FROM=hello@yourdomain.com
```

For **Amazon SES**:

```env
MAILIX_EMAIL_PROVIDER=ses
MAILIX_SES_REGION=us-east-1
MAILIX_SES_ACCESS_KEY=...
MAILIX_SES_SECRET_KEY=...
MAILIX_SES_FROM=hello@yourdomain.com
```

Restart MAILIX:

```bash
mlx restart
```

Run `mlx doctor` to confirm the provider is configured correctly.

**Important:** Real providers will reject mail from unverified senders. Always configure **Domains** first.

---

## Switching the database to PostgreSQL

Local mode uses JSON files. For multi-instance or production, use PostgreSQL.

1. Create a database: `createdb mailix`
2. Set `MAILIX_DATABASE_URL` in `.env`:

   ```env
   MAILIX_DB_TYPE=postgres
   MAILIX_DATABASE_URL=postgres://mailix:password@localhost:5432/mailix
   ```

3. Install the optional dependency: `npm install pg` (or include in your build)
4. Restart: `mlx restart`

The schema is auto-created on first start. Existing JSON data is preserved — use `mlx db:backup` to capture it before switching.

For multi-instance setups, also configure Redis:

```env
MAILIX_REDIS_URL=redis://localhost:6379
```

`npm install ioredis` — the queue then uses Redis as a shared backend, and multiple MAILIX instances can safely process messages in parallel.

---

## Suppression management

Some recipients should never receive mail again:

- **Hard bounces** — invalid mailbox
- **Complaints** — user marked as spam
- **Manual suppression** — operator removed them
- **Unsubscribed** — user clicked unsubscribe

MAILIX automatically:

- Suppresses addresses after a hard bounce
- Suppresses on complaint
- Suppresses on unsubscribe
- Skips suppressed addresses when sending

You can view and manage the suppression list:

**Settings → Suppressions** in the dashboard, or:

```http
GET /api/v1/suppressions
POST /api/v1/suppressions
DELETE /api/v1/suppressions/:id
```

The dashboard's **Subscribers** view also shows status (`subscribed`, `unsubscribed`, `bounced`, `suppressed`).

---

## Inspecting a message in detail

Click any entry in **Logs** to see the message detail page:

- **Message ID**, recipient, sender, subject
- **Provider** used (Local, SMTP, SES, Resend)
- **Status** with history (queued → processing → sent → delivered)
- **Created**, **Queued**, **Sent**, **Delivered** timestamps
- **Bounce/failure reason** if any
- **Retry count** and last error
- **Events** timeline — every state transition with payload

This is invaluable for debugging delivery issues.

Sensitive fields (idempotency key, hashed codes) are never shown.

---

## Logs, analytics, and stats

### Logs

**Logs** page — full event history with filters:

- Type (email, verification, password-reset, newsletter)
- Project
- Recipient
- Status
- Date range
- Free-text search

CLI equivalent: `mlx logs --follow` (tails in real time), `mlx logs --error` (only errors), `mlx logs --lines 500`.

### Analytics

**Analytics** page — time-series charts:

- Sent / Delivered / Bounced
- Opened / Clicked
- Unsubscribed

Time filters: 24h, 7d, 30d, 90d, custom range.

CLI equivalent: `GET /api/v1/analytics?period=30d`.

### Stats

The dashboard's home page shows real-time stats from `GET /api/v1/stats/summary`:

- Total emails sent, delivered, bounced, failed
- Queue depth
- Subscribers, domains, templates
- Provider health
- Average processing time

These are real numbers from the database — never fabricated. When there's no data, the dashboard shows an **Empty** state, not `0` dressed up as success.

---

## Backups & restore

### Create a backup

```bash
mlx db:backup
```

Creates a timestamped `mailix-backup-<timestamp>.tar.gz` in the backups directory. Excludes the `inbox/` (which can be large) — back that up separately if needed.

List backups:

```bash
mlx db:backup list
```

### Restore from a backup

```bash
mlx db:restore
```

You'll see the list of available backups. Pick one and confirm. The restore **overwrites** existing data — there's a confirmation prompt for safety.

CLI options:

```bash
mlx db:restore <backup-filename>  # Restore without listing
```

---

## Updating MAILIX

```bash
mlx update
```

Process:

1. Fetches the latest release from GitHub
2. Compares versions
3. Stops the running service
4. **Backs up the current application** to `data/backups/app-<timestamp>/`
5. Downloads the new release
6. Verifies the SHA-256 checksum
7. Extracts over the application directory
8. Preserves data, configuration, and backups
9. Restarts

If verification fails, the previous version is restored. **MAILIX never deletes your data, database, or configuration during an update.**

---

## Uninstalling

```bash
mlx uninstall
```

Interactive menu:

```
What would you like to remove?
  [1] Remove MAILIX application
  [2] Keep configuration
  [3] Keep database
  [4] Keep backups
  [5] Delete all MAILIX data
```

Pick a number. MAILIX never silently deletes your data.

For non-interactive:

```bash
mlx uninstall --yes
```

(removes the application; data is preserved by default)

---

## Daily CLI reference

| Command | What it does |
|---|---|
| `mlx-install` | Install MAILIX |
| `mlx-run` | Start MAILIX |
| `mlx stop` | Stop MAILIX |
| `mlx restart` | Stop and start |
| `mlx status` | Show service status |
| `mlx status --json` | Machine-readable status |
| `mlx doctor` | Diagnose environment |
| `mlx doctor --json` | Machine-readable diagnostics |
| `mlx logs` | Show recent logs |
| `mlx logs --follow` | Tail logs |
| `mlx logs --error` | Only errors |
| `mlx update` | Update to latest release |
| `mlx uninstall` | Remove MAILIX |
| `mlx config` | Show safe config (secrets masked) |
| `mlx config get port` | Get a value |
| `mlx config set port 8000` | Set a value (non-secret only) |
| `mlx version` | Show version |
| `mlx db:backup` | Create backup |
| `mlx db:backup list` | List backups |
| `mlx db:restore` | Restore from a backup |

Universal flags (most commands):

- `--no-color` — disable color
- `--yes` / `-y` — skip prompts
- `--json` — machine-readable output

---

## Troubleshooting

### `mlx-run` says "port in use"

```bash
mlx stop         # If a previous instance is still running
mlx doctor       # Check for orphan processes
```

If a different process holds the port, use:

```bash
mlx-run --port 8000
```

This persists for the session. To make it permanent, set `port` in the config file:

```bash
mlx config set port 8000
```

### Emails not arriving

1. `mlx doctor` — check the provider is configured
2. **Dashboard → Logs → click the failed message** — read the failure reason
3. Check the suppression list — the recipient may be suppressed
4. If using SMTP, verify credentials with `mlx doctor`
5. If using a custom domain, ensure **Domains** shows `verified`

### "MAILIX is not installed"

You're running `mlx-run` from a directory where the CLI was registered but the application files are missing.

Reinstall:

```bash
mlx-install
```

### `mlx-install` cannot reach GitHub

The installer falls back to a local source install (development mode) if the network is unavailable. This requires you to run from inside a clone.

### Dashboard shows "Offline"

MAILIX is not running. Start it:

```bash
mlx-run
```

Or check:

```bash
mlx status
mlx logs --error
mlx doctor
```

### Forgot your password

1. Stop MAILIX: `mlx stop`
2. Locate the data directory: `mlx config | grep -i data`
3. Edit `users.json` — find your user, replace the `password_hash` with:

   ```bash
   node -e "console.log(require('./server/utils/auth').hashPassword('NewPassword123'))"
   ```

4. Restart: `mlx-run`

### "Checksum mismatch" during install

The download is corrupted. The installer **refuses** to install unverified artifacts (this is intentional — it's a security feature).

Re-run `mlx-install` to download again. If it persists, check your network or try a different mirror.

### Webhooks not delivering

1. **Settings → Webhooks** — check the URL is publicly reachable
2. Confirm the signing secret matches the provider's settings
3. Test with a simulated webhook from the provider's dashboard
4. Check `mlx logs --worker` for signature verification errors

---

## Where data lives

| What | Where (Linux) | Where (macOS) | Where (Windows) |
|---|---|---|---|
| App | `~/.local/share/mailix` | `~/Applications/Mailix.app` | `%LOCALAPPDATA%\Mailix` |
| Config | `~/.config/mailix` | `~/Library/Application Support/Mailix` | `%APPDATA%\Mailix` |
| Data | `~/.local/share/mailix/data` | `~/Library/Application Support/Mailix/Data` | `%LOCALAPPDATA%\Mailix\Data` |
| Logs | `~/.local/share/mailix/logs` | `~/Library/Logs/Mailix` | `%LOCALAPPDATA%\Mailix\Logs` |
| Backups | `~/.local/share/mailix/data/backups` | same | same |
| Runtime (PID) | `~/.local/share/mailix/data/runtime` | same | same |

To find your config dir: `mlx config`.

---

## What's next?

- **Production**: switch to PostgreSQL, configure a real provider, set up a reverse proxy with HTTPS.
- **Scale**: add Redis for distributed queue, run multiple MAILIX instances behind a load balancer.
- **Custom domain**: add a domain in the dashboard, set up DNS, then enable sending.
- **Webhooks**: configure your provider to send delivery events to `/api/v1/webhooks/<provider>` for real-time status updates.

---

**MAILIX — by its_viyan**
