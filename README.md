# MAILIX

**Developer-focused email infrastructure for transactional email, templates, verification, and delivery management.**

MAILIX is a self-hostable email infrastructure platform designed for developers and teams that need a simple way to build, manage, and monitor transactional email.

> **Powered by MAILIX-by its_viyan**

---

## What is MAILIX?

MAILIX provides the infrastructure needed to integrate email into your applications without building an entire email delivery system from scratch.

It includes:

* Transactional email API
* Projects
* API keys
* Email templates
* MAILIX Studio
* Email verification
* Verification codes / OTP emails
* Password-reset emails
* Subscribers
* Email logs
* Delivery analytics
* Domains
* Multiple email providers
* Background email queue
* Retry handling
* Dashboard
* CLI
* Local development/testing provider
* Production release packaging

MAILIX can be self-hosted and used as the email layer for your applications.

---

## Features

### Email API

Send transactional emails through the MAILIX API.

Example:

```http
POST /api/v1/emails/send
```

Your application can communicate with MAILIX using an API key.

---

### Projects

Keep applications and their email infrastructure separated using projects.

Each project can have its own:

* API keys
* Templates
* Domains
* Email activity
* Configuration
* Logs

---

### API Keys

MAILIX supports project-scoped API keys.

Keys are securely hashed before storage and can be revoked when necessary.

Never expose a production API key in client-side code.

---

### Templates

MAILIX includes a template system for reusable transactional emails.

Templates can be used for:

* Welcome emails
* Verification emails
* Verification codes
* Password resets
* Invoices
* Order confirmations
* Lifecycle emails
* Custom application emails

---

### MAILIX Studio

MAILIX Studio provides an interface for working with email templates.

You can:

* Browse templates
* Preview templates
* Duplicate templates
* Edit templates
* Work with HTML
* Create custom templates
* Manage template content

---

### Email Queue

MAILIX processes email through a background queue.

The queue provides:

* Background processing
* Concurrent processing
* Retry handling
* Duplicate protection
* Graceful shutdown
* Provider integration

---

### Providers

MAILIX supports multiple delivery providers.

Current provider types include:

* Local / Mock
* SMTP
* AWS SES
* Resend

The local provider can be used for development and testing without sending real email.

---

### Domains

MAILIX provides domain management for projects and email infrastructure.

Domain configuration can be used to prepare MAILIX for production email delivery.

---

### Security

MAILIX includes security features such as:

* Password hashing with scrypt
* Authentication tokens
* Role-based access control
* Project isolation
* Hashed API keys
* Rate limiting
* Request IDs
* Input validation
* Helmet security headers
* Sanitized API errors
* Redacted sensitive information in logs

---

## Architecture

MAILIX is built around a Node.js and Express application.

High-level structure:

```text
MAILIX
│
├── API
│   ├── Authentication
│   ├── Projects
│   ├── Emails
│   ├── Templates
│   ├── Domains
│   ├── API Keys
│   ├── Logs
│   └── Analytics
│
├── Dashboard
│
├── MAILIX Studio
│
├── Email Queue
│
├── Providers
│   ├── Local
│   ├── SMTP
│   ├── AWS SES
│   └── Resend
│
├── JSON Database
│
├── CLI
│
└── Release / Distribution System
```

---

## Requirements

### End users

Official packaged releases are designed to run without separately installing:

* Node.js
* npm
* Python
* Git
* Docker

The packaged application includes the required Node.js runtime.

See:

**[Requirements to Run MAILIX](docs/REQUIREMENTS.md)**

---

### Developers

For running MAILIX directly from source, you need:

* Node.js 20 LTS or compatible supported Node.js version
* npm
* Git
* A supported operating system
* Internet access for installing dependencies and configuring external email providers when required

See:

**[Installation Guide](docs/INSTALL.md)**

---

## Quick Start

For a packaged release:

1. Install MAILIX.
2. Start MAILIX using the provided launcher.
3. Open the dashboard.
4. Create or configure your project.
5. Configure an email provider.
6. Create an API key.
7. Create or select a template.
8. Send your first transactional email.

For source installation:

```bash
git clone https://github.com/Viyan852/mailix.git
cd mailix
npm install
npm start
```

See the complete:

**[Quick Start Guide](docs/QUICKSTART.md)**

---

## Development

Clone the repository:

```bash
git clone https://github.com/Viyan852/mailix.git
cd mailix
```

Install dependencies:

```bash
npm install
```

Start MAILIX:

```bash
npm start
```

Run tests:

```bash
npm test
```

---

## Release

MAILIX includes a release system for building production distributions.

The normal developer release command is:

```bash
npm run release
```

Release builds can include:

* Windows x64 installer
* Windows portable package
* macOS universal application
* macOS DMG
* macOS ZIP
* SHA-256 checksums

Packaged releases include the required runtime so end users do not need to install Node.js separately.

---

## Project Structure

```text
mailix/
├── apps/
│   ├── dashboard/
│   └── landing/
│
├── assets/
│
├── cli/
│   ├── bin/
│   ├── commands/
│   └── core/
│
├── data/
│
├── docs/
│
├── scripts/
│
├── server/
│   ├── db/
│   ├── middleware/
│   ├── providers/
│   ├── queue/
│   ├── routes/
│   ├── services/
│   └── utils/
│
├── templates/
│
├── tests/
│
├── package.json
└── README.md
```

---

## Security

If you discover a security vulnerability, please do not publicly disclose it in an issue before it can be investigated.

See:

**[SECURITY.md](SECURITY.md)**

---

## Contributing

Contributions, bug reports, improvements, and suggestions are welcome.

Before contributing, please read:

**[CONTRIBUTING.md](CONTRIBUTING.md)**

---

## License

MAILIX is licensed under the:

**GNU Affero General Public License v3.0 (AGPL-3.0)**

See:

**[LICENSE](LICENSE)**

Third-party dependencies remain subject to their respective licenses.

---

## Copyright

Copyright © 2026 Viyan Solanki.

MAILIX is developed and maintained by **its_viyan**.

---

## Status

MAILIX is actively developed and intended for production-oriented self-hosting and developer use.

Always review the documentation and release notes for the version you are installing.

---

## Links

* Repository: https://github.com/Viyan852/mailix
* Documentation: `docs/`
* Quick Start: `docs/QUICKSTART.md`
* Installation: `docs/INSTALL.md`
* Requirements: `docs/REQUIREMENTS.md`
* Security: `SECURITY.md`
* Contributing: `CONTRIBUTING.md`

---

**MAILIX — Email infrastructure, built for developers.**
