/**
 * MAILIX Authentication & Authorization
 *
 * Provides:
 *   - User accounts with bcrypt password hashing
 *   - Session-based authentication via secure tokens
 *   - Role-based authorization (Owner, Admin, Developer, Viewer)
 *   - Project-level access control
 *
 * Tokens are stored hashed. Sessions are server-tracked.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const { validateEmail } = require('./validation');

const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
};

const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  developer: 2,
  viewer: 1,
};

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch (err) {
  logger.warn('bcryptjs not available, using scrypt fallback', { error: err.message });
}

function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (bcrypt) {
    return bcrypt.hashSync(password, 10);
  }
  // Fallback: scrypt
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, hashed) {
  if (!password || !hashed) return false;
  if (bcrypt && !hashed.startsWith('scrypt:')) {
    return bcrypt.compareSync(password, hashed);
  }
  if (hashed.startsWith('scrypt:')) {
    const [, salt, hash] = hashed.split(':');
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  }
  return false;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a user account.
 */
async function createUser({ email, password, role = ROLES.VIEWER, projectId = null }) {
  const normalizedEmail = validateEmail(email);
  const existing = await db.findOne('users', u => u.email === normalizedEmail);
  if (existing) {
    throw Object.assign(new Error('User already exists'), { code: 'USER_EXISTS', statusCode: 409 });
  }
  const user = {
    id: 'usr_' + crypto.randomBytes(8).toString('hex'),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    role,
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.insert('users', user);
  logger.info('User created', { userId: user.id, email: normalizedEmail });
  return { id: user.id, email: user.email, role: user.role };
}

/**
 * Authenticate a user and return a session token.
 */
async function login(email, password) {
  const normalizedEmail = validateEmail(email);
  const user = await db.findOne('users', u => u.email === normalizedEmail);
  if (!user) {
    // Constant-time-ish: still run a hash to avoid timing leak
    hashPassword('dummy');
    return null;
  }
  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }
  const token = generateToken();
  const session = {
    id: 'ses_' + crypto.randomBytes(8).toString('hex'),
    user_id: user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SESSION_TTL).toISOString(),
    created_at: new Date().toISOString(),
  };
  await db.insert('sessions', session);
  logger.info('User logged in', { userId: user.id });
  return { token, user: { id: user.id, email: user.email, role: user.role, project_id: user.project_id } };
}

/**
 * Logout — invalidates the session.
 */
async function logout(token) {
  if (!token) return false;
  const tokenHash = hashToken(token);
  const sessions = await db.findMany('sessions', s => s.token_hash === tokenHash);
  for (const s of sessions) {
    await db.remove('sessions', s.id);
  }
  return sessions.length > 0;
}

/**
 * Resolve a session token to the current user.
 */
async function getUserByToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await db.findOne('sessions', s => s.token_hash === tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await db.remove('sessions', session.id);
    return null;
  }
  const user = await db.findById('users', session.user_id);
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role, project_id: user.project_id };
}

function hasRole(user, requiredRole) {
  if (!user) return false;
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
}

function canAccessProject(user, projectId) {
  if (!user) return false;
  if (user.role === ROLES.OWNER) return true;
  return user.project_id === projectId || user.project_id === null;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  getUserByToken(token).then(user => {
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    req.user = user;
    next();
  }).catch(next);
}

function requireRole(role) {
  return (req, res, next) => {
    if (!hasRole(req.user, role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  };
}

function requireProjectAccess(getProjectId) {
  return async (req, res, next) => {
    const projectId = await getProjectId(req);
    if (!projectId) return next();
    if (!canAccessProject(req.user, projectId)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied to this project' },
      });
    }
    next();
  };
}

module.exports = {
  ROLES,
  createUser,
  login,
  logout,
  getUserByToken,
  hasRole,
  canAccessProject,
  requireAuth,
  requireRole,
  requireProjectAccess,
  hashPassword,
  verifyPassword,
};
