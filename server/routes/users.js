/**
 * Users API
 *
 * Manage user accounts. Only Owners and Admins can create users.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { createUser, requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateEmail, validateId, ValidationError } = require('../utils/validation');

router.get('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const all = await db.all('users');
    res.json({
      users: all.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        project_id: u.project_id,
        created_at: u.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const password = req.body.password;
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters', 'WEAK_PASSWORD', 'password');
    }
    const user = await createUser({
      email,
      password,
      role: req.body.role || ROLES.VIEWER,
      projectId: req.body.projectId,
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 'USER_EXISTS') {
      return res.status(409).json({ error: { code: err.code, message: err.message } });
    }
    next(err);
  }
});

module.exports = router;
