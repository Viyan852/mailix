/**
 * MAILIX API Key Management
 *
 * Production-grade API keys:
 *   - Cryptographically secure random generation
 *   - Secret shown only once at creation
 *   - Stored as a SHA-256 hash (never the plaintext)
 *   - Identifiable prefix (e.g. mx_live_xxxxxx)
 *   - Optional expiration
 *   - Revoke / rotate
 *   - Last-used timestamp
 *   - Project association
 *   - Scoped permissions
 *
 * Plaintext keys are NEVER logged or returned through the API.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { validateScopes } = require('./validation');

const PREFIX = 'mx_live_';
const TEST_PREFIX = 'mx_test_';
const KEY_BYTES = 32; // 64 hex chars

function generateKey(env = 'live') {
  const prefix = env === 'test' ? TEST_PREFIX : PREFIX;
  const random = crypto.randomBytes(KEY_BYTES).toString('hex');
  return {
    full: `${prefix}${random}`,
    prefix: prefix + random.substring(0, 8),
  };
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function createApiKey({ projectId, name, scopes = [], expiresAt = null, env = 'live' }) {
  if (!projectId) {
    throw new Error('projectId is required');
  }
  if (!name) {
    throw new Error('name is required');
  }
  const validatedScopes = validateScopes(scopes);
  const { full, prefix } = generateKey(env);

  const record = {
    id: 'key_' + crypto.randomBytes(8).toString('hex'),
    project_id: projectId,
    name,
    key_prefix: prefix,
    hashed_key: hashKey(full),
    scopes: validatedScopes,
    expires_at: expiresAt,
    last_used: null,
    revoked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.insert('api_keys', record);
  logger.info('API key created', { keyId: record.id, projectId });
  // Return plaintext key ONLY on creation
  return {
    id: record.id,
    name,
    key: full, // plaintext shown once
    prefix,
    scopes: validatedScopes,
    expires_at: expiresAt,
    created_at: record.created_at,
  };
}

async function listApiKeys(projectId) {
  const all = await db.findMany('api_keys', k => k.project_id === projectId);
  // Strip sensitive fields; never return hashed key
  return all.map(k => ({
    id: k.id,
    name: k.name,
    key_prefix: k.key_prefix,
    scopes: k.scopes,
    expires_at: k.expires_at,
    last_used: k.last_used,
    revoked: k.revoked,
    created_at: k.created_at,
  }));
}

async function revokeApiKey(id) {
  const key = await db.findById('api_keys', id);
  if (!key) throw new Error('Key not found');
  await db.update('api_keys', id, { revoked: true, updated_at: new Date().toISOString() });
  logger.info('API key revoked', { keyId: id });
  return true;
}

async function rotateApiKey(id) {
  const existing = await db.findById('api_keys', id);
  if (!existing) throw new Error('Key not found');
  return createApiKey({
    projectId: existing.project_id,
    name: existing.name,
    scopes: existing.scopes,
    expiresAt: existing.expires_at,
  });
}

async function renameApiKey(id, name) {
  const key = await db.findById('api_keys', id);
  if (!key) throw new Error('Key not found');
  return db.update('api_keys', id, { name, updated_at: new Date().toISOString() });
}

/**
 * Authenticate an API key from the Authorization header.
 * Returns the API key record (without the hashed_key) if valid.
 */
async function authenticateApiKey(plaintextKey) {
  if (!plaintextKey) return null;
  const hashed = hashKey(plaintextKey);
  const key = await db.findOne('api_keys', k => k.hashed_key === hashed && !k.revoked);
  if (!key) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return null;
  }
  // Update last_used (async, no need to await)
  db.update('api_keys', key.id, { last_used: new Date().toISOString() }).catch(() => {});
  return {
    id: key.id,
    project_id: key.project_id,
    scopes: key.scopes || [],
    name: key.name,
  };
}

function hasScope(apiKey, scope) {
  if (!apiKey) return false;
  return (apiKey.scopes || []).includes(scope);
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key required' } });
    }
    if (!hasScope(req.apiKey, scope)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: `Missing scope: ${scope}` } });
    }
    next();
  };
}

function apiKeyAuth() {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    let key = null;
    if (authHeader?.startsWith('Bearer ')) {
      key = authHeader.substring(7);
    } else if (authHeader?.startsWith('Mailix ')) {
      key = authHeader.substring(7);
    } else if (req.headers['x-mailix-key']) {
      key = req.headers['x-mailix-key'];
    }
    if (!key) return next();
    try {
      const apiKey = await authenticateApiKey(key);
      if (apiKey) req.apiKey = apiKey;
    } catch (err) {
      logger.error('API key auth error', { error: err.message });
    }
    next();
  };
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  renameApiKey,
  authenticateApiKey,
  hasScope,
  requireScope,
  apiKeyAuth,
  hashKey,
  PREFIX,
  TEST_PREFIX,
};
