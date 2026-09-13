/**
 * Email Send API
 *
 * POST /api/v1/emails/send
 *
 * The primary transactional email endpoint.
 *
 * Security:
 *   - Requires a valid MAILIX API key with 'email:send' scope
 *   - Sender must be authorized for the project
 *   - Validates all fields strictly
 *   - Never silently reports simulated delivery as real
 *   - Returns stable MAILIX message ID
 *   - Provider message ID stored separately
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireScope } = require('../utils/apiKeys');
const { validateEmail, validateSubject, validateHtml, ValidationError, checkString, MAX_LENGTHS } = require('../utils/validation');
const { emailSendLimit } = require('../utils/rateLimit');
const { queue } = require('../queue/emailQueue');
const { render } = require('../utils/template');
const db = require('../db');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Resolve the sender for a given project + requested from address.
 *
 * Rules:
 *  - In local/demo mode: accept any syntactically valid "from" (simulated delivery)
 *  - In production mode: "from" must match a verified sender in the project
 *
 * Returns: { email, name } of the approved sender, or throws.
 */
async function resolveSender(projectId, requestedFrom) {
  const isLocal = config.email.provider === 'local';

  if (isLocal) {
    // Local/demo mode — accept any valid from, mark as simulated
    return { email: requestedFrom || config.email.smtp.from || 'noreply@mailix.local', name: '' };
  }

  // Production mode: must have a verified sender
  if (!requestedFrom) {
    throw new ValidationError('from is required in production mode', 'REQUIRED', 'from');
  }

  const senderEmail = requestedFrom.match(/<([^>]+)>/)
    ? requestedFrom.match(/<([^>]+)>/)[1]
    : requestedFrom;

  // Check approved senders for this project
  const sender = await db.findOne('senders', s =>
    s.project_id === projectId && s.email === senderEmail.toLowerCase() && s.verified
  );

  if (!sender) {
    // Check if domain is verified
    const domain = senderEmail.split('@')[1];
    const verifiedDomain = await db.findOne('domains', d =>
      d.project_id === projectId && d.domain === domain && d.status === 'verified'
    );

    if (!verifiedDomain) {
      throw Object.assign(
        new ValidationError(
          `Sender "${senderEmail}" is not authorized. Domain must be verified and sender must be approved.`,
          'SENDER_NOT_AUTHORIZED',
          'from'
        ),
        { statusCode: 403 }
      );
    }
  }

  return { email: senderEmail, name: sender?.name || '' };
}

// POST /api/v1/emails/send
router.post('/send', emailSendLimit.middleware(), requireScope('email:send'), async (req, res, next) => {
  try {
    const {
      to,
      from,
      replyTo,
      subject,
      text,
      html,
      templateId,
      variables,
      projectId: bodyProjectId,
      metadata,
      tags,
      idempotencyKey,
    } = req.body;

    // Project ID from API key (trusted) or body (only allowed if API key has access)
    const projectId = req.apiKey?.project_id || bodyProjectId || null;

    // If body supplies projectId but API key has a different one, reject
    if (bodyProjectId && req.apiKey?.project_id && bodyProjectId !== req.apiKey.project_id) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'projectId does not match API key project' },
      });
    }

    // Validate required fields
    const recipient = validateEmail(to, 'to');
    const senderFrom = from ? checkString(from, 'from', MAX_LENGTHS.fromEmail) : null;
    const emailSubject = validateSubject(subject);

    if (!emailSubject) {
      throw new ValidationError('subject is required', 'REQUIRED', 'subject');
    }

    // Must have body (html, text, or templateId)
    if (!html && !text && !templateId) {
      throw new ValidationError('One of html, text, or templateId is required', 'REQUIRED', 'body');
    }

    let finalHtml = null;
    let finalText = null;

    if (templateId) {
      // Resolve template
      const template = await db.findById('templates', templateId);
      if (!template) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Template "${templateId}" not found` } });
      }
      // Enforce template belongs to project
      if (template.project_id && template.project_id !== projectId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Template does not belong to this project' } });
      }
      const vars = variables || {};
      finalHtml = template.html ? render(template.html, vars, 'html') : null;
      finalText = template.text ? render(template.text, vars, 'text') : null;
    } else {
      finalHtml = validateHtml(html);
      finalText = text ? checkString(text, 'text', MAX_LENGTHS.text) : null;
    }

    // Resolve and authorize sender
    let resolvedSender;
    try {
      resolvedSender = await resolveSender(projectId, senderFrom);
    } catch (err) {
      return res.status(err.statusCode || 403).json({
        error: { code: err.code || 'SENDER_NOT_AUTHORIZED', message: err.message },
      });
    }

    // Validate optional fields
    const validatedReplyTo = replyTo ? validateEmail(replyTo, 'replyTo') : null;

    // Validate tags
    if (tags !== undefined && !Array.isArray(tags)) {
      throw new ValidationError('tags must be an array', 'INVALID_TYPE', 'tags');
    }

    // Validate idempotency key
    if (idempotencyKey !== undefined && typeof idempotencyKey !== 'string') {
      throw new ValidationError('idempotencyKey must be a string', 'INVALID_TYPE', 'idempotencyKey');
    }

    // Enqueue the email
    const message = await queue.enqueue({
      projectId,
      to: recipient,
      from: resolvedSender.email,
      replyTo: validatedReplyTo,
      subject: emailSubject,
      html: finalHtml,
      text: finalText,
      templateId: templateId || null,
      idempotencyKey: idempotencyKey || undefined,
      metadata: metadata || null,
      tags: tags || [],
    });

    // Determine if this is simulated
    const isSimulated = config.email.provider === 'local';

    logger.info('Email send request accepted', {
      messageId: message.id,
      projectId,
      recipient: recipient.replace(/(?<=.{2}).+(?=@)/, '***'),
      provider: config.email.provider,
      simulated: isSimulated,
    });

    res.status(202).json({
      success: true,
      messageId: message.id,
      status: 'queued',
      provider: config.email.provider,
      simulated: isSimulated,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
