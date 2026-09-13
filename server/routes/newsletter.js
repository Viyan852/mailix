/**
 * Newsletter / Campaign Routes
 *
 * All endpoints require authentication.
 * Campaigns are scoped to a project.
 * Sending is done asynchronously via the email queue.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole, ROLES, canAccessProject } = require('../utils/auth');
const { validateName, validateEmail, validateId, ValidationError, checkString, MAX_LENGTHS } = require('../utils/validation');
const { newsletterLimit } = require('../utils/rateLimit');
const { queue } = require('../queue/emailQueue');
const logger = require('../utils/logger');

// All newsletter endpoints require authentication
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));

function resolveProjectId(req) {
  return req.query.projectId || req.body?.projectId || req.user.project_id || null;
}

// GET /api/v1/newsletter — List campaigns
router.get('/', async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const campaigns = await db.findMany('campaigns', c =>
      !projectId || c.project_id === projectId
    );
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/newsletter — Create campaign
router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const { name, subject, fromName, fromEmail, replyTo, templateId } = req.body;

    if (!name) throw new ValidationError('name is required', 'REQUIRED', 'name');
    if (!subject) throw new ValidationError('subject is required', 'REQUIRED', 'subject');
    if (!fromEmail) throw new ValidationError('fromEmail is required', 'REQUIRED', 'fromEmail');

    const validatedFrom = validateEmail(fromEmail, 'fromEmail');

    const campaign = {
      id: 'cmp_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      name: checkString(name, 'name', MAX_LENGTHS.campaignName),
      subject: checkString(subject, 'subject', MAX_LENGTHS.subject),
      from_name: fromName || '',
      from_email: validatedFrom,
      reply_to: replyTo ? validateEmail(replyTo, 'replyTo') : null,
      template_id: templateId || null,
      status: 'draft',
      scheduled_at: null,
      sent_at: null,
      stats: { queued: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, simulated: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert('campaigns', campaign);
    res.status(201).json({ campaign });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/newsletter/:id — Get campaign
router.get('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const campaign = await db.findById('campaigns', id);
    if (!campaign) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    const projectId = resolveProjectId(req);
    if (projectId && campaign.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ campaign });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/newsletter/:id — Update campaign (draft only)
router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const campaign = await db.findById('campaigns', id);
    if (!campaign) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    if (campaign.status !== 'draft') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Only draft campaigns can be edited' } });
    }

    const updates = {};
    if (req.body.name) updates.name = checkString(req.body.name, 'name', MAX_LENGTHS.campaignName);
    if (req.body.subject) updates.subject = checkString(req.body.subject, 'subject', MAX_LENGTHS.subject);
    if (req.body.fromName !== undefined) updates.from_name = req.body.fromName;
    if (req.body.fromEmail) updates.from_email = validateEmail(req.body.fromEmail, 'fromEmail');
    if (req.body.replyTo !== undefined) updates.reply_to = req.body.replyTo ? validateEmail(req.body.replyTo, 'replyTo') : null;
    if (req.body.templateId !== undefined) updates.template_id = req.body.templateId;

    const updated = await db.update('campaigns', id, updates);
    res.json({ campaign: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/newsletter/:id — Delete draft campaign
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const campaign = await db.findById('campaigns', id);
    if (!campaign) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Only draft or cancelled campaigns can be deleted' } });
    }
    await db.remove('campaigns', id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/newsletter/:id/send — Send/dispatch campaign
router.post('/:id/send', requireRole(ROLES.ADMIN), newsletterLimit.middleware(), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const campaign = await db.findById('campaigns', id);
    if (!campaign) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Campaign has already been sent or is not in a sendable state' } });
    }

    // Get subscribers for this project
    const subscribers = await db.findMany('subscribers', s =>
      s.project_id === campaign.project_id && s.status === 'active'
    );

    if (subscribers.length === 0) {
      return res.status(400).json({ error: { code: 'NO_SUBSCRIBERS', message: 'No active subscribers found for this project' } });
    }

    // Mark as sending
    await db.update('campaigns', id, { status: 'sending', sent_at: new Date().toISOString() });

    // Get template content
    let html = '';
    let text = '';
    if (campaign.template_id) {
      const template = await db.findById('templates', campaign.template_id);
      if (template) {
        html = template.html || '';
        text = template.text || '';
      }
    }

    // Queue all subscriber messages (non-blocking)
    let queued = 0;
    const unsubscribeBase = req.protocol + '://' + req.get('host') + '/unsubscribe';
    for (const sub of subscribers) {
      // Add unsubscribe token to each email
      const unsubToken = crypto.createHash('sha256').update(`${sub.id}:${id}`).digest('hex').substring(0, 16);
      const unsubLink = `${unsubscribeBase}?token=${unsubToken}&campaign=${id}&email=${encodeURIComponent(sub.email)}`;
      const emailHtml = html
        ? html + `\n<p style="font-size:12px;color:#999;text-align:center;"><a href="${unsubLink}">Unsubscribe</a></p>`
        : '';
      const emailText = text
        ? text + `\n\nUnsubscribe: ${unsubLink}`
        : '';

      queue.enqueue({
        projectId: campaign.project_id,
        to: sub.email,
        from: campaign.from_email,
        replyTo: campaign.reply_to || undefined,
        subject: campaign.subject,
        html: emailHtml,
        text: emailText,
        templateId: campaign.template_id || undefined,
        tags: ['campaign', id],
        metadata: { campaign_id: id, subscriber_id: sub.id },
      }).catch(err => logger.error('Campaign email enqueue failed', { campaignId: id, subscriberId: sub.id, error: err.message }));
      queued++;
    }

    // Update stats
    await db.update('campaigns', id, {
      status: 'sent',
      stats: { ...campaign.stats, queued },
    });

    logger.info('Campaign dispatched', { campaignId: id, recipients: queued });
    res.json({ success: true, queued, message: `Campaign dispatched to ${queued} subscribers` });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/newsletter/:id/cancel — Cancel a sending campaign
router.post('/:id/cancel', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const campaign = await db.findById('campaigns', id);
    if (!campaign) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    await db.update('campaigns', id, { status: 'cancelled' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;