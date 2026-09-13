/**
 * Stats API
 *
 * Real-time system stats for the dashboard. Never fabricates numbers —
 * returns 0 when no data is available, and surfaces an explicit state
 * for the UI to render an Empty/Offline state.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { queue } = require('../queue/emailQueue');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { config } = require('../config');
const { verifyProvider } = require('../providers');

router.get('/summary', requireAuth, requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const allEmails = await db.all('emails');
    const allSubscribers = await db.all('subscribers');
    const allDomains = await db.all('domains');
    const allTemplates = await db.all('templates');
    const queueDepth = await queue.getQueueDepth();
    const providerCheck = await verifyProvider(config.email.provider);

    const sent = allEmails.filter(e => e.status === 'sent').length;
    const delivered = allEmails.filter(e => e.status === 'delivered').length;
    const bounced = allEmails.filter(e => e.status === 'bounced').length;
    const failed = allEmails.filter(e => e.status === 'failed').length;
    const simulated = allEmails.filter(e => e.status === 'simulated').length;

    // Average processing time from delivery_events
    const events = await db.all('delivery_events');
    const sentEvents = events.filter(e => e.type === 'sent' || e.type === 'simulated');
    const durations = sentEvents
      .map(e => e.payload?.duration_ms)
      .filter(d => typeof d === 'number');
    const avgProcessingMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    res.json({
      totals: {
        emails: allEmails.length,
        sent,
        delivered,
        bounced,
        failed,
        simulated,
        queued: queueDepth,
      },
      resources: {
        subscribers: allSubscribers.length,
        domains: allDomains.length,
        templates: allTemplates.length,
      },
      provider: {
        name: config.email.provider,
        healthy: providerCheck.ok,
        message: providerCheck.error || providerCheck.message,
      },
      performance: {
        average_processing_ms: avgProcessingMs,
      },
      state: {
        ready: providerCheck.ok,
        online: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
