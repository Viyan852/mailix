/**
 * Template Routes
 *
 * Full CRUD for email templates.
 * All endpoints require authentication and project scoping.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateId, validateName, validateSubject, validateHtml, ValidationError, checkString, MAX_LENGTHS } = require('../utils/validation');
const { render } = require('../utils/template');
const logger = require('../utils/logger');

// All template endpoints require authentication
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));

function resolveProjectId(req) {
  return req.query.projectId || req.body?.projectId || req.user.project_id || null;
}

const VALID_TYPES = ['transactional', 'marketing', 'verification', 'password-reset', 'notification'];

// GET /api/v1/templates — List templates
router.get('/', async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const templates = await db.findMany('templates', t =>
      !projectId || t.project_id === projectId
    );
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates — Create template
router.post('/', requireRole(ROLES.DEVELOPER), async (req, res, next) => {
  try {
    const projectId = resolveProjectId(req);
    const { name, type, subject, html, text, variables } = req.body;

    const validatedName = validateName(name || '', 'name');
    const validatedType = type && VALID_TYPES.includes(type) ? type : 'transactional';
    const validatedSubject = validateSubject(subject);
    const validatedHtml = validateHtml(html);
    const validatedText = text ? checkString(text, 'text', MAX_LENGTHS.text) : null;

    if (!validatedSubject) throw new ValidationError('subject is required', 'REQUIRED', 'subject');
    if (!validatedHtml && !validatedText) throw new ValidationError('html or text is required', 'REQUIRED', 'body');

    const template = {
      id: 'tpl_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      name: validatedName,
      type: validatedType,
      subject: validatedSubject,
      html: validatedHtml,
      text: validatedText,
      variables: Array.isArray(variables) ? variables : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert('templates', template);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/templates/:id — Get template
router.get('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const template = await db.findById('templates', id);
    if (!template) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    const projectId = resolveProjectId(req);
    if (projectId && template.project_id && template.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ template });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/templates/:id — Update template
router.patch('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const template = await db.findById('templates', id);
    if (!template) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });

    const updates = {};
    if (req.body.name) updates.name = validateName(req.body.name, 'name');
    if (req.body.type && VALID_TYPES.includes(req.body.type)) updates.type = req.body.type;
    if (req.body.subject) updates.subject = validateSubject(req.body.subject);
    if (req.body.html !== undefined) updates.html = validateHtml(req.body.html);
    if (req.body.text !== undefined) updates.text = req.body.text ? checkString(req.body.text, 'text', MAX_LENGTHS.text) : null;
    if (Array.isArray(req.body.variables)) updates.variables = req.body.variables;

    const updated = await db.update('templates', id, updates);
    res.json({ template: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/templates/:id — Delete template
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const removed = await db.remove('templates', id);
    res.json({ success: removed });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates/:id/preview — Preview a rendered template
router.post('/:id/preview', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const template = await db.findById('templates', id);
    if (!template) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });

    const vars = req.body.variables || {};
    const renderedHtml = template.html ? render(template.html, vars, 'html') : null;
    const renderedText = template.text ? render(template.text, vars, 'text') : null;
    const renderedSubject = template.subject ? render(template.subject, vars, 'text') : null;

    res.json({
      subject: renderedSubject,
      html: renderedHtml,
      text: renderedText,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates/:id/duplicate — Duplicate a template
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const template = await db.findById('templates', id);
    if (!template) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    
    const projectId = resolveProjectId(req);
    if (projectId && template.project_id && template.project_id !== projectId) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const newTemplate = {
      id: 'tpl_' + crypto.randomBytes(8).toString('hex'),
      project_id: projectId,
      name: `${template.name} (Copy)`,
      type: template.type,
      subject: template.subject,
      html: template.html,
      text: template.text,
      variables: template.variables || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert('templates', newTemplate);
    res.status(201).json({ template: newTemplate });
  } catch (err) {
    next(err);
  }
});

module.exports = router;