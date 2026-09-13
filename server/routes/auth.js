/**
 * Authentication Routes
 *
 * Login, logout, current user.
 */

const express = require('express');
const router = express.Router();
const { login, logout, getUserByToken, requireAuth, ROLES } = require('../utils/auth');
const { authLimit } = require('../utils/rateLimit');
const { validateEmail, ValidationError } = require('../utils/validation');
const logger = require('../utils/logger');

router.post('/login', authLimit.middleware(), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const password = req.body.password;
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required', 'REQUIRED', 'password');
    }
    const result = await login(email, password);
    if (!result) {
      // Don't reveal whether the user exists
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }
    res.json({
      token: result.token,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    await logout(token);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
