/**
 * API Key Routes
 *
 * Uses the secure API key system from utils/apiKeys.js:
 *   - Cryptographically secure generation
 *   - SHA-256 hashed storage (never plaintext after creation)
 *   - Project-scoped
 *   - Requires authentication + developer role
 *
 * The legacy apiKeyService.js (plaintext storage) is no longer used.
 */

const express = require('express');
const router = express.Router();
const { createApiKey, listApiKeys, revokeApiKey, rotateApiKey, renameApiKey } = require('../utils/apiKeys');
const { requireAuth, requireRole, ROLES, canAccessProject } = require('../utils/auth');
const { validateId, validateName, validateScopes, ValidationError } = require('../utils/validation');
const { apiKeyLimit } = require('../utils/rateLimit');

// All API key endpoints require at least developer role
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));
router.use(apiKeyLimit.middleware());

// GET /api/v1/api-keys?projectId=...
// List API keys for a project. Never returns the key hash or plaintext.
router.get('/', async (req, res, next) => {
  try {
    const projectId = req.query.projectId || req.user.project_id;
    if (!projectId) {
      throw new ValidationError('projectId is required', 'REQUIRED', 'projectId');
    }
    if (!canAccessProject(req.user, projectId)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this project' } });
    }
    const keys = await listApiKeys(projectId);
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/api-keys
// Create a new API key. Returns the plaintext key ONLY in this response.
router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { name, projectId, scopes, expiresAt, env } = req.body;
    const resolvedProjectId = projectId || req.user.project_id;
    if (!resolvedProjectId) {
      throw new ValidationError('projectId is required', 'REQUIRED', 'projectId');
    }
    if (!canAccessProject(req.user, resolvedProjectId)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this project' } });
    }
    const validatedName = validateName(name || 'API Key', 'name');
    const validatedScopes = validateScopes(scopes || ['email:send', 'email:read']);
    const result = await createApiKey({
      projectId: resolvedProjectId,
      name: validatedName,
      scopes: validatedScopes,
      expiresAt: expiresAt || null,
      env: env === 'test' ? 'test' : 'live',
    });
    // key field (plaintext) is ONLY present here at creation time
    res.status(201).json({
      key: result,
      warning: 'Save this key now. It will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/api-keys/:id/revoke
router.post('/:id/revoke', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    await revokeApiKey(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/api-keys/:id/rotate
router.post('/:id/rotate', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    const result = await rotateApiKey(id);
    res.json({
      key: result,
      warning: 'Save this key now. It will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/api-keys/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (req.body.name) {
      const name = validateName(req.body.name, 'name');
      const updated = await renameApiKey(id, name);
      res.json({ key: updated });
    } else {
      throw new ValidationError('No updatable fields provided', 'REQUIRED');
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;