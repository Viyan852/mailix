/**
 * Suppression Management
 *
 * Manages a list of recipients who should never be emailed again.
 * Includes hard bounces, complaints, manual suppressions, and unsubscribes.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireScope } = require('../utils/apiKeys');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateEmail, validateId } = require('../utils/validation');

router.get('/', requireAuth, requireRole(ROLES.DEVELOPER), async (req, res, next) => {
  try {
    const all = await db.all('suppressions');
    res.json({ suppressions: all });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const email = validateEmail(req.body.email);
    const reason = req.body.reason || 'manual';
    const projectId = req.body.projectId || req.user.project_id || null;
    const existing = await db.findOne('suppressions', s => s.email === email && s.project_id === projectId);
    if (existing) {
      return res.status(409).json({ error: { code: 'ALREADY_SUPPRESSED', message: 'Email already suppressed' } });
    }
    const record = {
      id: 'sup_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      email,
      reason,
      source: 'manual',
      created_at: new Date().toISOString(),
    };
    await db.insert('suppressions', record);
    res.status(201).json({ suppression: record });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const removed = await db.remove('suppressions', id);
    res.json({ success: removed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
