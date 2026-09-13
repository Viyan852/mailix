/**
 * Password Reset Routes
 *
 * Security requirements:
 *   - Never return reset codes in API responses
 *   - Rate-limit all reset requests
 *   - Use generic responses to prevent account enumeration
 *   - Admin-only endpoints require auth + admin role
 */

const express = require('express');
const router = express.Router();
const passwordResetService = require('../services/passwordResetService');
const { passwordResetLimit } = require('../utils/rateLimit');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateEmail, ValidationError } = require('../utils/validation');

// POST /api/v1/password-reset/request
// Public — rate-limited. Always returns generic response to prevent enumeration.
router.post('/request', passwordResetLimit.middleware(), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    // Fire-and-forget — never reveal whether account exists
    passwordResetService.requestReset(email).catch(() => {});
  } catch (err) {
    // Even validation errors return a generic response
  }
  // Always return the same generic response
  res.json({ success: true, message: 'If the account exists, a reset email has been sent.' });
});

// POST /api/v1/password-reset/verify
// Public — rate-limited. Validates a reset token and sets a new password.
router.post('/verify', passwordResetLimit.middleware(), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const { code, newPassword } = req.body;
    if (!code || typeof code !== 'string') {
      throw new ValidationError('code is required', 'REQUIRED', 'code');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new ValidationError('newPassword must be at least 8 characters', 'INVALID', 'newPassword');
    }
    const result = await passwordResetService.verifyAndReset(email, code, newPassword);
    if (!result.success) {
      // Generic failure — don't leak whether email/code exists
      return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Invalid or expired reset code' } });
    }
    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/password-reset/config
// Admin only — returns password reset configuration, no codes.
router.get('/config', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const config = await passwordResetService.getConfig();
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/password-reset/config
// Admin only — updates password reset configuration.
router.patch('/config', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const updated = await passwordResetService.updateConfig(req.body);
    res.json({ config: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;