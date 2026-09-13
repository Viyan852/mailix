/**
 * Subscriber Management Routes
 *
 * All endpoints require authentication and project scoping.
 * Supports unsubscribe via token (public endpoint for email links).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateEmail, validateId, ValidationError, checkString, MAX_LENGTHS } = require('../utils/validation');
const logger = require('../utils/logger');

// GET /unsubscribe — Public unsubscribe link handler (from email campaign links)
router.get('/unsubscribe', async (req, res, next) => {
  try {
    const { token, campaign, email } = req.query;
    if (!email) {
      return res.status(400).send('<html><body><h2>Invalid unsubscribe link</h2></body></html>');
    }
    const validEmail = email.toLowerCase();
    const sub = await db.findOne('subscribers', s => s.email === validEmail);
    if (sub) {
      await db.update('subscribers', sub.id, { status: 'unsubscribed', unsubscribed_at: new Date().toISOString() });
      // Add to suppressions
      const existing = await db.findOne('suppressions', s => s.email === validEmail);
      if (!existing) {
        await db.insert('suppressions', {
          id: 'sup_' + crypto.randomBytes(8).toString('hex'),
          project_id: sub.project_id,
          email: validEmail,
          reason: 'unsubscribe',
          source: 'subscriber',
          created_at: new Date().toISOString(),
        });
      }
    }
    logger.info('Subscriber unsubscribed', { email: validEmail });
    res.send('<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px"><h2>You have been unsubscribed</h2><p>You will no longer receive emails from this list.</p></body></html>');
  } catch (err) {
    next(err);
  }
});

// All management endpoints require authentication
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));

function resolveProjectId(req) {
  return req.query.projectId || req.body?.projectId || req.user.project_id || null;
}

// GET /api/v1/subscribers — List subscribers
router.get('/', async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    let subs = await db.findMany('subscribers', s => !projectId || s.project_id === projectId);
    if (req.query.status) {
      subs = subs.filter(s => s.status === req.query.status);
    }
    res.json({ subscribers: subs, total: subs.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/subscribers — Add subscriber
router.post('/', async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const email = validateEmail(req.body.email);
    const name = req.body.name ? checkString(req.body.name, 'name', MAX_LENGTHS.name) : '';

    // Check for existing subscriber
    const existing = await db.findOne('subscribers', s =>
      s.email === email && s.project_id === projectId
    );
    if (existing) {
      // If previously unsubscribed, re-subscribe
      if (existing.status === 'unsubscribed') {
        const updated = await db.update('subscribers', existing.id, {
          status: 'active',
          unsubscribed_at: null,
          name: name || existing.name,
        });
        return res.json({ subscriber: updated, resubscribed: true });
      }
      return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Subscriber already exists' } });
    }

    // Check if suppressed
    const suppressed = await db.findOne('suppressions', s =>
      s.email === email && (!projectId || s.project_id === projectId)
    );
    if (suppressed) {
      return res.status(409).json({ error: { code: 'SUPPRESSED', message: 'This email address is suppressed' } });
    }

    const subscriber = {
      id: 'sub_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      email,
      name,
      status: 'active',
      last_activity: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insert('subscribers', subscriber);
    res.status(201).json({ subscriber });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/subscribers/:id — Get subscriber
router.get('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const sub = await db.findById('subscribers', id);
    if (!sub) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscriber not found' } });
    const projectId = resolveProjectId(req);
    if (projectId && sub.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ subscriber: sub });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/subscribers/:id — Update subscriber
router.patch('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const sub = await db.findById('subscribers', id);
    if (!sub) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscriber not found' } });

    const updates = {};
    if (req.body.name !== undefined) updates.name = checkString(req.body.name, 'name', MAX_LENGTHS.name) || '';
    if (req.body.status !== undefined) {
      if (!['active', 'unsubscribed', 'bounced'].includes(req.body.status)) {
        throw new ValidationError('Invalid status', 'INVALID_STATUS', 'status');
      }
      updates.status = req.body.status;
    }

    const updated = await db.update('subscribers', id, updates);
    res.json({ subscriber: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/subscribers/:id — Delete subscriber
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const removed = await db.remove('subscribers', id);
    res.json({ success: removed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;