/**
 * Messages API
 *
 * Email message detail, history, and queue inspection.
 */

const express = require('express');
const router = express.Router();
const { queue } = require('../queue/emailQueue');
const { requireScope } = require('../utils/apiKeys');
const { validateId } = require('../utils/validation');

router.get('/:id', requireScope('email:read'), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const message = await queue.getMessage(id);
    if (!message) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    }
    // Project-level access check
    if (req.apiKey && req.apiKey.project_id && req.apiKey.project_id !== message.project_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    const events = await queue.getEvents(id);
    // Strip sensitive fields like idempotency_key
    const safe = {
      id: message.id,
      project_id: message.project_id,
      recipient: message.recipient,
      sender: message.sender,
      subject: message.subject,
      template_id: message.template_id,
      provider: message.provider,
      status: message.status,
      attempts: message.attempts,
      last_attempt: message.last_attempt,
      next_retry: message.next_retry,
      last_error: message.last_error,
      provider_message_id: message.provider_message_id,
      reply_to: message.reply_to,
      created_at: message.created_at,
      updated_at: message.updated_at,
    };
    res.json({ message: safe, events });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/events', requireScope('email:read'), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const events = await queue.getEvents(id);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireScope('email:send'), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const updated = await queue.cancel(id);
    res.json({ message: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireScope('email:read'), async (req, res, next) => {
  try {
    const { limit, offset } = require('../utils/validation').validatePagination(req.query);
    const { sort, order } = require('../utils/validation').validateSort(req.query, ['created_at', 'updated_at', 'status']);
    const db = require('../db');
    let messages = await db.findMany('emails', m => {
      if (req.apiKey?.project_id && m.project_id !== req.apiKey.project_id) return false;
      if (req.query.status && m.status !== req.query.status) return false;
      return true;
    });
    messages.sort((a, b) => {
      const av = a[sort] || '';
      const bv = b[sort] || '';
      return order === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    const total = messages.length;
    messages = messages.slice(offset, offset + limit);
    res.json({
      messages: messages.map(m => ({
        id: m.id,
        recipient: m.recipient,
        subject: m.subject,
        status: m.status,
        provider: m.provider,
        attempts: m.attempts,
        created_at: m.created_at,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
