/**
 * Local Inbox API
 *
 * When using the Local provider, captured emails are saved to disk.
 * This endpoint exposes them for the developer-facing Mail Preview UI.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const logger = require('../utils/logger');

const INBOX_DIR = path.join(config.database.dataDir, 'inbox');

function readInbox() {
  if (!fs.existsSync(INBOX_DIR)) return [];
  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(INBOX_DIR, f), 'utf8'));
      return data;
    } catch (err) {
      logger.warn('Failed to read inbox message', { file: f });
      return null;
    }
  }).filter(Boolean).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

router.get('/', requireAuth, requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const messages = readInbox();
    const summary = messages.map(m => ({
      id: m.id,
      to: m.to,
      from: m.from,
      subject: m.subject,
      receivedAt: m.receivedAt,
      status: m.status,
    }));
    res.json({ messages: summary, total: summary.length });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const messages = readInbox();
    const message = messages.find(m => m.id === req.params.id);
    if (!message) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    }
    res.json({ message });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const file = path.join(INBOX_DIR, `${req.params.id}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
