/**
 * MAILIX Email Queue
 *
 * Background job queue with exponential backoff retries.
 * Uses an in-memory queue by default; can be backed by Redis when available.
 * Prevents duplicate processing via idempotency keys.
 *
 * Concurrency fix: uses a per-message Set of in-flight IDs instead of a
 * single boolean flag, so concurrent enqueues are all processed.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { sendEmail } = require('../providers');
const db = require('../db');
const logger = require('../utils/logger');
const { config } = require('../config');

const STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SENT: 'sent',
  DELIVERED: 'delivered',
  DEFERRED: 'deferred',
  BOUNCED: 'bounced',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SIMULATED: 'simulated',
};

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000; // 2s, 4s, 8s, 16s, 32s
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes cap

class EmailQueue extends EventEmitter {
  constructor() {
    super();
    // Per-message in-flight set (fixes concurrency bug: single boolean flag dropped concurrent messages)
    this._inFlight = new Set();
    this.timers = new Map();
    this._shuttingDown = false;
    this.metrics = {
      queued: 0,
      sent: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
      simulated: 0,
    };
  }

  /**
   * Enqueue an email for delivery.
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.to
   * @param {string} params.from
   * @param {string} params.subject
   * @param {string} params.html
   * @param {string} [params.text]
   * @param {string} [params.templateId]
   * @param {string} [params.idempotencyKey]
   * @param {string} [params.replyTo]
   * @param {Object} [params.metadata]
   * @param {string[]} [params.tags]
   * @returns {Promise<Object>} the email record
   */
  async enqueue(params) {
    if (this._shuttingDown) {
      throw new Error('Queue is shutting down — cannot accept new messages');
    }

    const idempotencyKey = params.idempotencyKey || crypto.randomBytes(16).toString('hex');

    // Check idempotency
    const existing = await db.findOne('emails', e => e.idempotency_key === idempotencyKey);
    if (existing) {
      logger.debug('Idempotent enqueue: returning existing message', { messageId: existing.id });
      return existing;
    }

    const message = {
      id: 'mx_' + crypto.randomBytes(8).toString('hex'),
      project_id: params.projectId || null,
      recipient: params.to,
      sender: params.from,
      subject: params.subject,
      html: params.html,
      text: params.text || '',
      template_id: params.templateId || null,
      provider: config.email.provider,
      status: STATUS.QUEUED,
      attempts: 0,
      last_attempt: null,
      next_retry: null,
      last_error: null,
      idempotency_key: idempotencyKey,
      reply_to: params.replyTo || null,
      metadata: params.metadata || null,
      tags: params.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert('emails', message);
    this.metrics.queued++;
    logger.info('Email enqueued', { messageId: message.id, recipient: this._redactEmail(message.recipient) });

    // Schedule processing — each message is independent
    this._scheduleProcessing(message.id);
    this.emit('enqueued', message);
    return message;
  }

  _scheduleProcessing(messageId) {
    // Process immediately in next tick — each message gets its own independent call
    setImmediate(() => this._processOne(messageId));
  }

  async _processOne(messageId) {
    // Per-message guard (not global) — allows concurrent processing of different messages
    if (this._inFlight.has(messageId)) return;
    this._inFlight.add(messageId);

    try {
      const message = await db.findById('emails', messageId);
      if (!message) return;
      if (message.status === STATUS.CANCELLED) return;
      // Skip if already in a terminal or currently processing state from another worker
      if ([STATUS.SENT, STATUS.DELIVERED, STATUS.FAILED, STATUS.BOUNCED, STATUS.SIMULATED].includes(message.status)) return;

      // Update status to processing
      await db.update('emails', messageId, {
        status: STATUS.PROCESSING,
        last_attempt: new Date().toISOString(),
        attempts: (message.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      });

      // Suppression check
      const suppressed = await this._isSuppressed(message.project_id, message.recipient);
      if (suppressed) {
        await db.update('emails', messageId, {
          status: STATUS.FAILED,
          last_error: `Suppressed: ${suppressed.reason}`,
          updated_at: new Date().toISOString(),
        });
        await this._recordEvent(messageId, 'failed', { reason: suppressed.reason });
        this.metrics.failed++;
        logger.info('Email suppressed', { messageId, reason: suppressed.reason });
        return;
      }

      // Send via provider
      const result = await sendEmail({
        to: message.recipient,
        from: message.sender,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.reply_to,
        idempotencyKey: message.idempotency_key,
      });

      // Update message with result
      const updates = {
        provider: result.provider,
        provider_message_id: result.providerMessageId || null,
        last_error: result.error || null,
        updated_at: new Date().toISOString(),
      };

      if (result.status === 'sent' || result.status === 'delivered') {
        updates.status = result.status;
        if (result.status === 'sent') this.metrics.sent++;
        if (result.status === 'delivered') this.metrics.delivered++;
        await db.update('emails', messageId, updates);
        await this._recordEvent(messageId, result.status, result);
        this.emit('sent', { ...message, ...updates });

      } else if (result.status === 'simulated') {
        updates.status = STATUS.SIMULATED;
        this.metrics.simulated++;
        await db.update('emails', messageId, updates);
        await this._recordEvent(messageId, 'simulated', result);

      } else if (result.status === 'bounced') {
        updates.status = STATUS.BOUNCED;
        this.metrics.bounced++;
        await db.update('emails', messageId, updates);
        await this._recordEvent(messageId, 'bounced', result);
        await this._autoSuppress(message.project_id, message.recipient, 'bounce');

      } else if (result.status === 'failed') {
        const attempts = (message.attempts || 0) + 1;
        if (result.retryable !== false && attempts < MAX_ATTEMPTS) {
          const backoff = this._backoffMs(attempts);
          updates.status = STATUS.DEFERRED;
          updates.next_retry = new Date(Date.now() + backoff).toISOString();
          await db.update('emails', messageId, updates);
          await this._recordEvent(messageId, 'deferred', { ...result, attempts, backoff });
          this._scheduleRetry(messageId, backoff);
          logger.warn('Email deferred for retry', { messageId, attempts, backoff });
        } else {
          updates.status = STATUS.FAILED;
          this.metrics.failed++;
          await db.update('emails', messageId, updates);
          await this._recordEvent(messageId, 'failed', result);
          this.emit('failed', { ...message, ...updates });
        }
      }
    } catch (err) {
      logger.error('Queue processing error', { messageId, error: err.message });
      // Mark as deferred so it can be retried
      try {
        const msg = await db.findById('emails', messageId);
        if (msg && msg.attempts < MAX_ATTEMPTS) {
          const backoff = this._backoffMs(msg.attempts || 1);
          await db.update('emails', messageId, {
            status: STATUS.DEFERRED,
            last_error: err.message,
            next_retry: new Date(Date.now() + backoff).toISOString(),
            updated_at: new Date().toISOString(),
          });
          this._scheduleRetry(messageId, backoff);
        } else if (msg) {
          await db.update('emails', messageId, {
            status: STATUS.FAILED,
            last_error: err.message,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (_) {}
    } finally {
      this._inFlight.delete(messageId);
    }
  }

  _scheduleRetry(messageId, delayMs) {
    if (this.timers.has(messageId)) {
      clearTimeout(this.timers.get(messageId));
    }
    const timer = setTimeout(() => {
      this.timers.delete(messageId);
      if (!this._shuttingDown) {
        this._processOne(messageId);
      }
    }, delayMs);
    if (timer.unref) timer.unref();
    this.timers.set(messageId, timer);
  }

  _backoffMs(attempts) {
    const exp = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
    // Add jitter to avoid thundering herd
    return exp + Math.floor(Math.random() * 1000);
  }

  async _isSuppressed(projectId, email) {
    const suppressions = await db.findMany('suppressions', s =>
      (!projectId || s.project_id === projectId) && s.email === email.toLowerCase()
    );
    return suppressions[0] || null;
  }

  async _autoSuppress(projectId, email, reason) {
    if (!email) return;
    const existing = await db.findOne('suppressions', s =>
      s.email === email.toLowerCase() && s.reason === reason
    );
    if (existing) return;
    await db.insert('suppressions', {
      id: 'sup_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      email: email.toLowerCase(),
      reason,
      source: 'auto',
      created_at: new Date().toISOString(),
    });
  }

  async _recordEvent(messageId, type, payload) {
    await db.insert('delivery_events', {
      id: 'evt_' + crypto.randomBytes(8).toString('hex'),
      message_id: messageId,
      type,
      payload,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Record an external delivery event (e.g., webhook from provider).
   * Prevents duplicate processing using provider event ID or type + message ID.
   */
  async recordDeliveryEvent(messageId, type, payload) {
    // Use provider event ID if available for stronger dedup
    const eventId = payload.event_id || payload.id;
    const existing = await db.findOne('delivery_events', e =>
      e.message_id === messageId && e.type === type &&
      (!eventId || e.payload?.event_id === eventId || e.payload?.id === eventId)
    );
    if (existing) {
      logger.debug('Duplicate delivery event ignored', { messageId, type });
      return null;
    }
    await this._recordEvent(messageId, type, { ...payload, event_id: eventId });

    if (type === 'delivered') {
      await db.update('emails', messageId, { status: STATUS.DELIVERED, updated_at: new Date().toISOString() });
    } else if (type === 'bounced') {
      await db.update('emails', messageId, { status: STATUS.BOUNCED, updated_at: new Date().toISOString() });
      const msg = await db.findById('emails', messageId);
      if (msg) await this._autoSuppress(msg.project_id, msg.recipient, 'bounce');
    } else if (type === 'complained') {
      const msg = await db.findById('emails', messageId);
      if (msg) await this._autoSuppress(msg.project_id, msg.recipient, 'complaint');
    } else if (type === 'failed') {
      await db.update('emails', messageId, { status: STATUS.FAILED, updated_at: new Date().toISOString() });
    }
    return { messageId, type };
  }

  async getMessage(id) {
    return db.findById('emails', id);
  }

  async getEvents(messageId) {
    return db.findMany('delivery_events', e => e.message_id === messageId);
  }

  async getQueueDepth() {
    const queued = await db.findMany('emails', e =>
      e.status === STATUS.QUEUED || e.status === STATUS.DEFERRED || e.status === STATUS.PROCESSING
    );
    return queued.length;
  }

  async cancel(messageId) {
    return db.update('emails', messageId, { status: STATUS.CANCELLED, updated_at: new Date().toISOString() });
  }

  /**
   * Graceful shutdown: wait for in-flight messages to finish, cancel pending timers.
   * @param {number} [timeoutMs=10000] - Max wait time in ms
   */
  async shutdown(timeoutMs = 10000) {
    this._shuttingDown = true;
    logger.info('Email queue shutting down', { inFlight: this._inFlight.size });

    // Clear scheduled retries
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Wait for in-flight messages
    const deadline = Date.now() + timeoutMs;
    while (this._inFlight.size > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this._inFlight.size > 0) {
      logger.warn('Queue shutdown timed out with in-flight messages', { count: this._inFlight.size });
    } else {
      logger.info('Email queue shutdown complete');
    }
  }

  _redactEmail(email) {
    if (!email || typeof email !== 'string') return email;
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const r = local.length <= 2 ? '*' : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${r}@${domain}`;
  }

  get metrics() {
    return this._metrics;
  }

  set metrics(v) {
    this._metrics = v;
  }
}

const queue = new EmailQueue();

// Graceful shutdown handlers
process.once('SIGTERM', () => queue.shutdown(15000).then(() => process.exit(0)));
process.once('SIGINT', () => queue.shutdown(5000).then(() => process.exit(0)));

module.exports = { queue, STATUS, MAX_ATTEMPTS };
