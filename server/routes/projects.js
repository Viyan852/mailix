/**
 * Project Management API
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole, ROLES, canAccessProject } = require('../utils/auth');
const { validateName, validateId, ValidationError } = require('../utils/validation');
const logger = require('../utils/logger');

router.get('/', requireAuth, requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const all = await db.all('projects');
    // Filter by user access
    const accessible = all.filter(p => canAccessProject(req.user, p.id));
    res.json({ projects: accessible });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const name = validateName(req.body.name, 'name');
    const all = await db.all('projects');
    if (all.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      throw new ValidationError('Project with this name already exists', 'DUPLICATE', 'name');
    }
    const project = {
      id: 'prj_' + crypto.randomBytes(8).toString('hex'),
      name,
      branding: {
        primaryColor: '#6366F1',
        secondaryColor: '#8B5CF6',
        senderName: '',
        senderEmail: '',
        replyTo: '',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insert('projects', project);
    logger.info('Project created', { projectId: project.id, name });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const project = await db.findById('projects', id);
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    if (!canAccessProject(req.user, project.id)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const removed = await db.remove('projects', id);
    res.json({ success: removed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
