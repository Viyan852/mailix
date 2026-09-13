# MAILIX Requirements

This document explains what is required to run MAILIX.

---

# 1. Packaged Release Requirements

The official packaged releases are designed to provide a self-contained MAILIX installation.

The user does **not** need to separately install:

```text
Node.js
npm
Python
Git
Docker
```

The packaged application includes the required Node.js runtime.

---

# 2. Windows

For the Windows x64 packaged release:

### Required

* 64-bit Windows
* Sufficient disk space for the application and persistent data
* Network access when using external email providers

### Not required separately

* Node.js
* npm
* Python
* Git
* Docker

Typical release artifacts:

```text
MAILIX-Setup-x64.exe
mailix-windows-x64.zip
```

---

# 3. macOS

MAILIX provides a macOS universal distribution when available in the current release.

The universal application is designed for:

* Apple Silicon Macs
* Intel Macs

Typical artifacts:

```text
mailix-macos-universal.dmg
mailix-macos-universal.zip
```

The packaged application includes its required runtime.

---

# 4. Source Installation Requirements

Developers running MAILIX directly from the repository need:

### Required software

```text
Git
Node.js 20 LTS
npm
```

Check your installation:

```bash
git --version
node --version
npm --version
```

---

# 5. Hardware Requirements

MAILIX is primarily a server/application workload and does not require specialized hardware.

A normal modern computer or server is sufficient for development and small deployments.

Actual production requirements depend on:

* Email volume
* Queue concurrency
* Provider
* Number of projects
* Number of templates
* Log volume
* Analytics data
* Database size
* Number of concurrent API requests

---

# 6. Network Requirements

A network connection is required when MAILIX needs to communicate with external services.

Examples include:

* SMTP servers
* AWS SES
* Resend
* DNS services
* Other external provider infrastructure

A local-only installation using the Local/Mock provider can be used for development and testing without delivering real email.

---

# 7. Email Provider Requirements

MAILIX can work with multiple provider types.

Supported provider integrations include:

```text
Local / Mock
SMTP
AWS SES
Resend
```

External providers may require their own:

* Account
* API credentials
* SMTP credentials
* Verified domain
* DNS records
* Sending permissions
* Provider-specific configuration

These requirements are controlled by the provider and may change independently of MAILIX.

---

# 8. Production Domain Requirements

For production email delivery, you should use a properly configured sending domain.

Depending on the provider, DNS configuration may include records for:

* Domain verification
* SPF
* DKIM
* DMARC
* Provider-specific records

Follow the current documentation of your selected email provider.

---

# 9. Storage

MAILIX uses a JSON-based document storage system.

Storage requirements depend on:

* Number of projects
* Number of emails
* Logs
* Templates
* Analytics data
* Application configuration

Make regular backups of persistent MAILIX data before upgrades or major configuration changes.

---

# 10. Security Requirements

Production deployments should use:

* Strong administrator credentials
* Secure API keys
* Proper provider credentials
* HTTPS when exposed beyond a trusted local environment
* Correct domain/DNS configuration
* Appropriate firewall/network controls
* Regular backups
* Updated MAILIX releases

Never commit secrets to Git.

Do not publish:

```text
.env
```

or provider credentials.

---

# 11. Developer Requirements

Developers contributing to MAILIX should have:

```text
Git
Node.js 20 LTS
npm
Code editor
Terminal
```

Recommended workflow:

```bash
git clone https://github.com/Viyan852/mailix.git
cd mailix
npm install
npm test
npm start
```

---

# 12. Release Build Requirements

Building MAILIX from source may require additional platform-specific build tools depending on the target platform and release configuration.

The packaged releases are recommended for end users.

For release development:

```bash
npm run release
```

Review the release output for the exact artifacts and platform-specific requirements.

---

# 13. Quick Requirement Summary

| Requirement                      |                Packaged Release |                          Source |
| -------------------------------- | ------------------------------: | ------------------------------: |
| Windows/macOS supported platform |                             Yes |                             Yes |
| Node.js installation             |                              No |                             Yes |
| npm installation                 |                              No |                             Yes |
| Git                              |                              No |                             Yes |
| Python                           |                              No |                              No |
| Docker                           |                              No |                              No |
| Internet for external providers  |                   When required |                   When required |
| Email provider account           | Only for real external delivery | Only for real external delivery |
| Sending domain                   |      Recommended for production |      Recommended for production |

---

## Minimum Developer Setup

```text
Node.js 20 LTS
npm
Git
```

## Minimum End-User Setup

```text
Supported operating system
MAILIX packaged release
```

MAILIX's packaged distribution is designed to make installation as simple as possible without requiring developers or end users to manually install the Node.js ecosystem.
