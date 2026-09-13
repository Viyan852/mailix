# MAILIX Installation Guide

This guide explains how to install MAILIX from a packaged release or directly from source.

---

## 1. Choose Your Installation Method

There are two main ways to install MAILIX.

### Option A — Packaged Release

Recommended for normal users.

Packaged releases include the required runtime and do not require a separate Node.js installation.

Use this method if you simply want to run MAILIX.

### Option B — From Source

Recommended for:

* Developers
* Contributors
* Custom builds
* Development environments

Source installation requires Node.js and npm.

---

# 2. Packaged Installation

## Windows

Download the latest Windows release from the GitHub Releases page.

The release may contain:

```text
MAILIX-Setup-x64.exe
```

and/or:

```text
mailix-windows-x64.zip
```

### Installer

Run:

```text
MAILIX-Setup-x64.exe
```

Follow the installer instructions.

After installation, launch MAILIX using the installed MAILIX launcher.

The packaged application contains its required Node.js runtime.

You do not need to install:

* Node.js
* npm
* Python
* Git
* Docker

---

## Windows Portable Version

If using:

```text
mailix-windows-x64.zip
```

extract the archive to a directory of your choice.

Then launch MAILIX using the included launcher.

Keep the extracted application directory together. Do not move individual runtime files out of the package.

---

# 3. macOS

Download the macOS release from GitHub Releases.

Typical artifacts include:

```text
mailix-macos-universal.dmg
```

and:

```text
mailix-macos-universal.zip
```

The universal build is intended to support both:

* Apple Silicon
* Intel Macs

Open the DMG and install the MAILIX application.

If macOS displays a security confirmation for an application downloaded from the internet, use the normal macOS application security controls to allow the application if you trust the release source.

---

# 4. Installing From Source

## Requirements

You need:

* Git
* Node.js 20 LTS
* npm
* Internet access

Check Node.js:

```bash
node --version
```

Check npm:

```bash
npm --version
```

Check Git:

```bash
git --version
```

---

## Clone the Repository

```bash
git clone https://github.com/Viyan852/mailix.git
```

Enter the project:

```bash
cd mailix
```

---

## Install Dependencies

Run:

```bash
npm install
```

Wait for npm to finish installing all dependencies.

---

## Start MAILIX

Run:

```bash
npm start
```

If your local project version provides a development command, use the command documented by that version's `package.json`.

---

# 5. Running Tests

Before using a source build, you can run:

```bash
npm test
```

A successful test run indicates that the current project test suites completed successfully.

---

# 6. Building a Release

To build a production distribution:

```bash
npm run release
```

The release system performs project validation and builds the appropriate distribution artifacts supported by the current platform and release configuration.

---

# 7. Configuration

MAILIX configuration depends on the provider and deployment environment.

Before sending real email, configure the appropriate provider.

Supported provider types include:

* Local / Mock
* SMTP
* AWS SES
* Resend

Do not commit secrets, API keys, SMTP passwords, provider credentials, or private configuration files to Git.

---

# 8. Production Installation

For production use:

1. Install a supported MAILIX release.
2. Create your project.
3. Configure authentication.
4. Configure your email provider.
5. Configure your sending domain.
6. Configure required DNS records.
7. Create an API key.
8. Create or import your templates.
9. Test delivery.
10. Monitor logs and analytics.

Never expose private administrative credentials or production API keys publicly.

---

# 9. Updating MAILIX

Before updating:

1. Back up your MAILIX data.
2. Review the release notes.
3. Stop the current MAILIX process.
4. Install the new version.
5. Restore or preserve required data/configuration.
6. Start MAILIX.
7. Verify the dashboard.
8. Test email delivery.

Do not blindly replace persistent data directories during an upgrade.

---

# 10. Uninstallation

For packaged installations, use the operating system's normal application uninstall process.

For a portable installation, stop MAILIX and remove the extracted application directory after backing up any data you want to keep.

For a source installation, remove the cloned repository after backing up any persistent MAILIX data.

---

## Troubleshooting

### MAILIX does not start

Check:

* The application is not already running.
* The installation is complete.
* Required files were not deleted.
* Your operating system is supported.
* You are using a compatible release.

For source installations, run:

```bash
npm test
```

and inspect the terminal output.

### Email is not being delivered

Check:

* Provider configuration
* SMTP credentials if applicable
* AWS SES configuration if applicable
* Resend configuration if applicable
* Sending domain configuration
* DNS records
* API key
* MAILIX logs
* Provider-side delivery status

---

## Important

Do not upload:

```text
.env
```

or other secret configuration files to GitHub.

Do not publish:

* API keys
* SMTP passwords
* AWS credentials
* Resend credentials
* JWT secrets
* Private production configuration

---

For the fastest first-time setup, continue with:

**[Quick Start](QUICKSTART.md)**
