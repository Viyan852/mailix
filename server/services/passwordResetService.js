/**
 * MAILIX Password Reset Service (Secure)
 *
 * Security requirements enforced:
 *   - Tokens stored only as SHA-256 hashes (no plaintext)
 *   - Codes never returned in function return values after generation
 *   - Tokens are single-use and expire
 *   - Previous tokens invalidated when a new request is made
 *   - Reset email sent via queue (uses configured provider)
 *   - Never logs codes or tokens
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

const TOKEN_EXPIRY_HOURS = 1; // 1 hour (not 12 — tighter window is safer)
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6; // 6-digit numeric code

function generateCode() {
  // Cryptographically secure random 6-digit code
  return crypto.randomInt(100000, 999999).toString();
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Request a password reset for the given email.
 * Sends a reset code via the email queue.
 * Returns nothing that identifies whether the account exists.
 */
async function requestReset(email) {
  // Invalidate all previous reset tokens for this email
  const existing = await db.findMany('password_reset_tokens', t =>
    t.email === email && !t.used
  );
  for (const t of existing) {
    await db.update('password_reset_tokens', t.id, { used: true });
  }

  // Generate a new secure code
  const code = generateCode();
  const hashed = hashCode(code);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const record = {
    id: 'prt_' + crypto.randomBytes(8).toString('hex'),
    project_id: null,
    email,
    hashed_code: hashed,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
    created_at: new Date().toISOString(),
  };
  await db.insert('password_reset_tokens', record);

  // Send reset email via queue (fire and forget — caller handles errors)
  try {
    const { queue } = require('../queue/emailQueue');
    const companyService = require('./companyService');
    const company = await companyService.getCompany();
    const companyName = company.name || 'MAILIX';

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1>${companyName}</h1>
        <h2>Password Reset</h2>
        <p>You requested a password reset. Your reset code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">${code}</div>
        <p>This code expires in ${TOKEN_EXPIRY_HOURS} hour(s). It can only be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <hr><small>Powered by MAILIX</small>
      </div>`;

    await queue.enqueue({
      projectId: null,
      to: email,
      from: company.senderEmail || 'noreply@mailix.local',
      subject: `${companyName} — Password Reset Code`,
      html,
      text: `${companyName} password reset code: ${code}. Expires in ${TOKEN_EXPIRY_HOURS} hour(s). Single use only.`,
    });

    // Code intentionally NOT logged or returned
    logger.info('Password reset email enqueued', { email });
  } catch (err) {
    logger.error('Failed to enqueue password reset email', { error: err.message });
    // Still do not reveal the code or failure to the caller
  }

  // Return no code, no token, nothing sensitive
  return { queued: true };
}

/**
 * Verify a reset code and update the user's password if valid.
 * @returns {{ success: boolean }}  — never contains the code or reason details
 */
async function verifyAndReset(email, code, newPassword) {
  const record = await db.findOne('password_reset_tokens', t =>
    t.email === email && !t.used
  );

  if (!record) return { success: false };

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    await db.update('password_reset_tokens', record.id, { used: true });
    return { success: false };
  }

  // Check attempt limit
  if (record.attempts >= MAX_ATTEMPTS) {
    return { success: false };
  }

  // Constant-time comparison
  const hashed = hashCode(code);
  let matches = false;
  try {
    matches = crypto.timingSafeEqual(
      Buffer.from(hashed, 'hex'),
      Buffer.from(record.hashed_code, 'hex')
    );
  } catch (_) {
    return { success: false };
  }

  if (!matches) {
    await db.update('password_reset_tokens', record.id, { attempts: record.attempts + 1 });
    return { success: false };
  }

  // Mark token as used immediately (single-use)
  await db.update('password_reset_tokens', record.id, { used: true });

  // Update user's password
  const { hashPassword } = require('../utils/auth');
  const user = await db.findOne('users', u => u.email === email);
  if (!user) return { success: false };

  const newHash = hashPassword(newPassword);
  await db.update('users', user.id, { password_hash: newHash });

  // Invalidate all user sessions
  const sessions = await db.findMany('sessions', s => s.user_id === user.id);
  for (const s of sessions) {
    await db.remove('sessions', s.id);
  }

  logger.info('Password reset successful', { userId: user.id });
  return { success: true };
}

function getConfig() {
  return {
    enabled: true,
    maxAttempts: MAX_ATTEMPTS,
    expiryHours: TOKEN_EXPIRY_HOURS,
  };
}

function updateConfig(update) {
  // Config is currently static in code — document this limitation
  return getConfig();
}

module.exports = { requestReset, verifyAndReset, getConfig, updateConfig };