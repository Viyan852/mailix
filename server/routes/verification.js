/**
 * Email Verification API
 *
 * POST /api/v1/verification/send
 * POST /api/v1/verification/verify
 *
 * Backed by the queue + database.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { render } = require('../utils/template');
const { validateEmail, ValidationError } = require('../utils/validation');
const { verificationLimit } = require('../utils/rateLimit');
const { queue } = require('../queue/emailQueue');
const companyService = require('../services/companyService');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');

const DEFAULT_CONFIG = { enabled: true, maxAttempts: 5, expiryHours: 24, length: 6 };

async function getConfig(projectId) {
  const records = await db.findOne('verification_tokens', r => r.id === `_config_${projectId || 'default'}`);
  if (records) return records.config;
  return DEFAULT_CONFIG;
}

function generateCode(length = 6) {
  const max = Math.pow(10, length) - 1;
  const min = Math.pow(10, length - 1);
  return crypto.randomInt(min, max + 1).toString();
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function getCompanyVars(projectId) {
  const company = await companyService.getCompany();
  return {
    company_name: company.name || 'Mailix',
    support_email: company.replyTo || 'support@mailix.local',
  };
}

router.post('/send', verificationLimit.middleware(), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const projectId = req.body.projectId || req.apiKey?.project_id || null;
    const config = await getConfig(projectId);
    if (!config.enabled) {
      throw new ValidationError('Verification is disabled', 'DISABLED');
    }

    // Check existing valid token
    const existing = await db.findMany('verification_tokens', t =>
      t.email === email && t.project_id === projectId && !t.used && new Date(t.expires_at) > new Date()
    );
    let code;
    if (existing.length > 0) {
      // Reuse the most recent valid one (in production, may opt to always create a new one)
      code = existing[0].code; // Only used to recompute; not stored plaintext
    }
    code = generateCode(config.length);
    const expiresAt = new Date(Date.now() + config.expiryHours * 60 * 60 * 1000).toISOString();

    const record = {
      id: 'vt_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      email,
      hashed_code: hashCode(code),
      expires_at: expiresAt,
      attempts: 0,
      used: false,
      created_at: new Date().toISOString(),
    };
    await db.insert('verification_tokens', record);

    // Render email
    const companyVars = await getCompanyVars(projectId);
    const subject = render('Verify your email', {});
    const html = render(
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1>{{company_name}}</h1>
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">{{verification_code}}</div>
        <p>This code expires in {{expiry}}.</p>
        <p>If you didn't request this, you can ignore this email.</p>
        <hr><small>Powered by MAILIX — by its_viyan</small>
      </div>`,
      { ...companyVars, verification_code: code, expiry: `${config.expiryHours} hours` },
      'html'
    );

    // Enqueue via the queue
    await queue.enqueue({
      projectId,
      to: email,
      subject,
      html,
      text: `${companyVars.company_name} verification code: ${code}`,
    });

    logger.info('Verification code sent', { email, projectId });
    // Return a safe response — do not include the code in production responses
    res.json({
      success: true,
      message: 'If the email is valid, a verification code has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify', verificationLimit.middleware(), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const code = req.body.code;
    if (!code || typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
      throw new ValidationError('Invalid code', 'INVALID_CODE', 'code');
    }
    const projectId = req.body.projectId || req.apiKey?.project_id || null;
    const config = await getConfig(projectId);

    const record = await db.findOne('verification_tokens', t =>
      t.email === email && t.project_id === projectId && !t.used
    );
    if (!record) {
      return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'No valid verification code found' } });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: { code: 'CODE_EXPIRED', message: 'Code has expired' } });
    }
    if (record.attempts >= config.maxAttempts) {
      return res.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts' } });
    }
    if (record.hashed_code !== hashCode(code)) {
      await db.update('verification_tokens', record.id, { attempts: record.attempts + 1 });
      return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Invalid code' } });
    }
    await db.update('verification_tokens', record.id, { used: true });
    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    next(err);
  }
});

router.get('/config', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const projectId = req.query.projectId || req.user.project_id || null;
    res.json({ config: await getConfig(projectId) });
  } catch (err) {
    next(err);
  }
});

router.post('/send-test', async (req, res, next) => {
  try {
    const result = await fetch(`${req.protocol}://${req.get('host')}/api/v1/verification/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const data = await result.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
