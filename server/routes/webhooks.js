/**
 * Webhook Endpoints
 *
 * Receive delivery events from email providers.
 * Validates webhook authenticity where supported.
 * Prevents duplicate event processing.
 *
 * Production security:
 *   - Resend webhooks REQUIRE signature verification in production
 *   - Missing webhook secret in production returns 401
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { queue } = require('../queue/emailQueue');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Verify Resend webhook signature.
 * https://resend.com/docs/dashboard/webhooks/signatures
 */
function verifyResendSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '');
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch (err) {
    return false;
  }
}

/**
 * Generic webhook receiver.
 * Provider identified by path: /webhooks/:provider
 */
router.post('/:provider', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const rawBody = req.body?.toString() || '';
    const signature = req.headers['x-webhook-signature'] || req.headers['svix-signature'] || req.headers['x-resend-signature'];

    // Validate signature where supported
    if (provider === 'resend') {
      const secret = config.security.webhookSecret.resend;
      if (config.isProduction && !secret) {
        logger.error('Resend webhook secret not configured in production');
        return res.status(401).json({
          error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook secret not configured' }
        });
      }
      if (secret && !verifyResendSignature(rawBody, signature, secret)) {
        logger.warn('Resend webhook signature invalid', { provider });
        return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } });
      }
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'Invalid JSON' } });
    }

    // Normalize event types across providers
    const typeMap = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.deferred': 'deferred',
      'email.failed': 'failed',
    };
    const eventType = typeMap[event.type] || event.type;
    // Provider message ID is how we correlate to our internal message
    const providerMessageId = event.data?.message_id || event.data?.id || event.message_id;

    if (!providerMessageId || !eventType) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'message_id and type required' } });
    }

    // Look up our internal message by provider_message_id
    const db = require('../db');
    const internalMessage = await db.findOne('emails', m => m.provider_message_id === providerMessageId);
    if (!internalMessage) {
      // Accept but log — provider might send events for messages not in our DB yet
      logger.warn('Webhook event for unknown provider message ID', { providerMessageId, eventType });
      return res.json({ received: true, correlated: false });
    }

    await queue.recordDeliveryEvent(internalMessage.id, eventType, {
      ...event.data,
      event_id: event.id || event.data?.event_id,
      provider_message_id: providerMessageId,
      provider,
    });

    res.json({ received: true, correlated: true, messageId: internalMessage.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
