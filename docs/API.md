# MAILIX API Reference

> Complete API documentation for MAILIX 2.0.

**Base URL:** `http://localhost:7345/api/v1`

## Authentication

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "secure-password"
}
```

**Response 200:**

```json
{
  "token": "abcdef...",
  "user": { "id": "usr_...", "email": "owner@example.com", "role": "owner" }
}
```

**Response 401:** `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password" } }`

### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

### Current user

```http
GET /auth/me
Authorization: Bearer <token>
```

---

## Health

```http
GET /health        # Liveness
GET /health/live
GET /health/ready  # DB + queue + provider
```

---

## Projects

```http
GET /projects                 # List (filtered by user access)
POST /projects                # Create (Admin+)
GET /projects/:id
DELETE /projects/:id          # (Admin+)
```

---

## Company

```http
GET /company
POST /company                 # Update (Admin+)
POST /company/preview         # Render live preview
```

---

## Verification

```http
POST /verification/send        # Send a verification code
POST /verification/verify      # Verify a code
GET /verification/config       # (Admin+)
```

```js
// JavaScript
const res = await fetch('http://localhost:7345/api/v1/verification/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ email: 'user@example.com' }),
});
```

```python
# Python
import requests
requests.post('http://localhost:7345/api/v1/verification/send',
  headers={'Authorization': f'Bearer {api_key}'},
  json={'email': 'user@example.com'})
```

```bash
# cURL
curl -X POST http://localhost:7345/api/v1/verification/send \
  -H "Authorization: Bearer mx_live_..." \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

---

## Password Reset

```http
POST /password-reset/request   # Always returns success (no account disclosure)
```

```js
await fetch('http://localhost:7345/api/v1/password-reset/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ email: 'user@example.com' }),
});
```

---

## Email

```http
POST /emails/send
GET /messages
GET /messages/:id
POST /messages/:id/cancel
```

---

## Templates

```http
GET /templates
POST /templates
```

---

## Subscribers

```http
GET /subscribers
POST /subscribers
POST /subscribers/:id/unsubscribe
```

---

## Newsletter

```http
GET /newsletter
POST /newsletter            # Create campaign
```

Campaigns are sent asynchronously via the queue. Statuses: `draft`, `scheduled`, `sending`, `sent`.

---

## Domains

```http
GET /domains
POST /domains
POST /domains/:id/verify    # Triggers DNS check
DELETE /domains/:id
```

Verified fields: `ownership_status`, `spf_status`, `dkim_status`, `dmarc_status`. A domain is only marked `verified` when all four pass.

---

## API Keys

```http
GET /api-keys                 # List (own project only)
POST /api-keys                # Create — returns plaintext ONCE
POST /api-keys/:id/revoke
POST /api-keys/:id/rename
POST /api-keys/:id/rotate     # Generate a new key with the same scopes
```

**Scopes:** `email:send`, `email:read`, `templates:read`, `templates:write`, `analytics:read`, `subscribers:read`, `subscribers:write`, `newsletters:send`, `newsletters:read`, `projects:read`, `projects:write`.

---

## Logs

```http
GET /logs?type=email&projectId=...&search=...
```

---

## Analytics

```http
GET /analytics?period=24h|7d|30d|90d
```

---

## Stats

```http
GET /stats/summary
```

Returns totals, resources, provider health, and performance metrics. Real data only — never fabricated.

---

## Suppressions

```http
GET /suppressions
POST /suppressions
DELETE /suppressions/:id
```

Reasons: `bounce`, `complaint`, `manual`, `unsubscribe`. Send operations automatically check this list.

---

## Webhooks

```http
POST /webhooks/:provider      # Provider-specific
```

Supported providers: `resend`, `sendgrid`, `mailgun` (extensible). Signatures are verified where supported.

---

## Integrations / Code Generator

```http
POST /integrations/snippet
Content-Type: application/json

{ "language": "javascript", "type": "verification", "projectId": "..." }
```

Supported languages: `javascript`, `typescript`, `python`, `php`, `java`, `csharp`, `go`, `ruby`, `curl`.
Supported types: `email-send`, `verification`, `password-reset`, `newsletter`.

Frontend-targeted languages (JS/TS) get a `pk_live_…` placeholder instead of a secret key.

---

## Errors

All errors return:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid email address",
    "field": "email",
    "requestId": "abc123"
  }
}
```

In production, stack traces, paths, and database errors are never exposed.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_REQUEST` | 400 | Malformed input |
| `REQUIRED` | 400 | Missing required field |
| `INVALID_EMAIL` | 400 | Bad email format |
| `INVALID_DOMAIN` | 400 | Bad domain |
| `INVALID_SCOPE` | 400 | Unknown scope |
| `TOO_LARGE` | 413 | Body too large |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource missing |
| `RATE_LIMITED` | 429 | Rate limit hit |
| `INVALID_CODE` | 400 | Wrong OTP / reset code |
| `CODE_EXPIRED` | 400 | OTP / reset code expired |
| `TOO_MANY_ATTEMPTS` | 429 | Exceeded max attempts |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| Global `/api/*` | 100 / min per IP |
| `email-send` | 60 / min per project |
| `verification` | 10 / min per email |
| `password-reset` | 5 / min per email |
| `api-key` | 30 / min per key |
| `newsletter` | 10 / min per project |
| `auth` | 20 / 5min per email |

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. When exceeded, `Retry-After` is also set.
