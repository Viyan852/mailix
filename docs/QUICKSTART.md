# MAILIX Quick Start

Get MAILIX running and send your first transactional email.

---

# 1. Install MAILIX

Install the latest packaged release for your operating system.

For developers running from source:

```bash
git clone https://github.com/Viyan852/mailix.git
cd mailix
npm install
npm start
```

---

# 2. Open the Dashboard

Once MAILIX starts, open the dashboard address shown by the application.

A typical local installation uses:

```text
http://localhost:7345
```

The exact address may vary depending on your configuration or release.

---

# 3. Create Your Account

Use the MAILIX dashboard to create or configure your account.

After authentication, you can access your MAILIX workspace.

---

# 4. Create a Project

Create a project for your application.

For example:

```text
Project: My Application
```

A project keeps your email infrastructure separated from other applications.

---

# 5. Configure a Provider

Open your project's provider configuration.

Choose one of the supported providers:

```text
Local
SMTP
AWS SES
Resend
```

### For testing

Use the Local provider if you want to test MAILIX without sending real email.

### For real email

Configure an appropriate production provider.

Make sure all required credentials are correct.

---

# 6. Create an API Key

Open the project's API key section.

Create a new API key.

Store the key securely.

For example:

```text
MAILIX_API_KEY=your_api_key_here
```

Do not put production API keys directly into frontend/browser code.

---

# 7. Create a Template

Open:

```text
Templates
```

You can use an existing MAILIX template or create your own.

Templates can contain your email HTML and associated content.

For advanced editing, use:

```text
MAILIX Studio
```

---

# 8. Send an Email

Your application can communicate with the MAILIX API.

Example request:

```bash
curl -X POST http://localhost:7345/api/v1/emails/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MAILIX_API_KEY" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello from MAILIX",
    "html": "<h1>Hello!</h1><p>Your first MAILIX email.</p>"
  }'
```

Replace:

```text
YOUR_MAILIX_API_KEY
```

with your project's API key.

Use the API format documented by the version of MAILIX you are running if your release exposes additional required fields.

---

# 9. Check the Email Queue

After submitting an email, MAILIX processes it through the email queue.

The queue handles background processing and provider delivery.

Depending on the provider and configuration, an email may move through states such as:

```text
Queued
Processing
Sent
Failed
```

---

# 10. Check Logs

Open the project's:

```text
Logs
```

section.

Use logs to investigate:

* Requests
* Email processing
* Delivery attempts
* Provider errors
* Failed emails
* Other application events

---

# 11. Check Analytics

Open:

```text
Analytics
```

to view available email activity and delivery information.

---

# 12. Configure a Domain

For production email, configure your sending domain.

You may need to add DNS records required by your selected email provider.

Follow your provider's current DNS requirements.

Do not assume that configuring a domain inside MAILIX alone is sufficient for production delivery.

---

# 13. Production Checklist

Before using MAILIX for production email:

* [ ] Strong administrative credentials configured
* [ ] Production provider configured
* [ ] Sending domain configured
* [ ] Required DNS records configured
* [ ] API keys securely stored
* [ ] Test email successfully delivered
* [ ] Logs verified
* [ ] Templates tested
* [ ] Rate limits reviewed
* [ ] Persistent data backed up
* [ ] Secrets excluded from Git
* [ ] Correct MAILIX release installed

---

# 14. Developer Quick Start

Clone:

```bash
git clone https://github.com/Viyan852/mailix.git
cd mailix
```

Install:

```bash
npm install
```

Test:

```bash
npm test
```

Start:

```bash
npm start
```

Build release:

```bash
npm run release
```

---

## You're Ready

You now have the basic MAILIX workflow:

```text
Application
     │
     ▼
MAILIX API
     │
     ▼
Project
     │
     ▼
Email Queue
     │
     ▼
Provider
     │
     ▼
Recipient
```

For deeper configuration, see the other files in `docs/`.
