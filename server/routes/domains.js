/**
 * Domain Management Routes
 *
 * Domain verification for sender authorization.
 * All endpoints require authentication and project scoping.
 * Prevents cross-project domain usage.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateDomain, validateId, ValidationError } = require('../utils/validation');
const logger = require('../utils/logger');

// All domain endpoints require authentication
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));

function resolveProjectId(req) {
  return req.query.projectId || req.body?.projectId || req.user.project_id || null;
}

// GET /api/v1/domains — List domains for project
router.get('/', async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const domains = await db.findMany('domains', d => !projectId || d.project_id === projectId);
    res.json({ domains });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/domains — Add domain for verification
router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    if (!projectId) throw new ValidationError('projectId is required', 'REQUIRED', 'projectId');

    const domain = validateDomain(req.body.domain);

    // Check if domain already exists for this project
    const existing = await db.findOne('domains', d => d.domain === domain && d.project_id === projectId);
    if (existing) {
      return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Domain already added to this project' } });
    }

    // Check if domain is claimed by another project (prevent cross-project domain abuse)
    const otherProject = await db.findOne('domains', d => d.domain === domain && d.project_id !== projectId && d.status === 'verified');
    if (otherProject) {
      return res.status(409).json({ error: { code: 'DOMAIN_CLAIMED', message: 'Domain is verified under another project' } });
    }

    // Generate DNS verification token
    const verificationToken = 'mailix-verify=' + crypto.randomBytes(16).toString('hex');

    const record = {
      id: 'dom_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      domain,
      status: 'pending',
      spf_status: 'pending',
      dkim_status: 'pending',
      dmarc_status: 'pending',
      verification_token: verificationToken,
      last_checked: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert('domains', record);

    res.status(201).json({
      domain: record,
      dns_instructions: {
        txt_record: {
          host: `_mailix.${domain}`,
          type: 'TXT',
          value: verificationToken,
          description: 'Add this TXT record to verify domain ownership',
        },
        spf: {
          host: domain,
          type: 'TXT',
          value: 'v=spf1 include:mailix.local ~all',
          description: 'SPF record to authorize MAILIX to send on your behalf',
        },
        dmarc: {
          host: `_dmarc.${domain}`,
          type: 'TXT',
          value: 'v=DMARC1; p=none; rua=mailto:dmarc@mailix.local',
          description: 'DMARC policy (start with p=none, change to p=reject when ready)',
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/domains/:id — Get domain
router.get('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const domain = await db.findById('domains', id);
    if (!domain) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });

    const projectId = resolveProjectId(req);
    if (projectId && domain.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ domain });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/domains/:id — Remove domain
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const domain = await db.findById('domains', id);
    if (!domain) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });

    const projectId = resolveProjectId(req);
    if (projectId && domain.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    await db.remove('domains', id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/domains/:id/senders — Add an approved sender for a domain
router.post('/:id/senders', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const domainId = validateId(req.params.id);
    const domain = await db.findById('domains', domainId);
    if (!domain) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });
    if (domain.status !== 'verified') {
      return res.status(400).json({ error: { code: 'DOMAIN_NOT_VERIFIED', message: 'Domain must be verified before adding senders' } });
    }

    const { name, email, replyTo } = req.body;
    if (!email) throw new ValidationError('email is required', 'REQUIRED', 'email');

    const { validateEmail: ve } = require('../utils/validation');
    const senderEmail = ve(email, 'email');

    // Validate sender email belongs to the domain
    const senderDomain = senderEmail.split('@')[1];
    if (senderDomain !== domain.domain) {
      return res.status(400).json({
        error: { code: 'DOMAIN_MISMATCH', message: `Sender email must use domain ${domain.domain}` }
      });
    }

    const sender = {
      id: 'snd_' + crypto.randomBytes(8).toString('hex'),
      project_id: domain.project_id,
      domain_id: domainId,
      name: name || '',
      email: senderEmail,
      reply_to: replyTo || null,
      verified: true, // Sender inherits domain verification
      created_at: new Date().toISOString(),
    };

    await db.insert('senders', sender);
    res.status(201).json({ sender });
  } catch (err) {
    next(err);
  }
});

module.exports = router;