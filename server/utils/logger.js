/**
 * MAILIX Structured Logger
 *
 * Provides leveled, structured logging with redaction of sensitive fields.
 * Never logs passwords, API secrets, or verification/reset tokens.
 */

const crypto = require('crypto');
const { config } = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logging.level] !== undefined ? LEVELS[config.logging.level] : LEVELS.info;

// Sensitive field names that must always be redacted
const SENSITIVE_FIELDS = [
  'password',
  'pass',
  'token',
  'secret',
  'apikey',
  'api_key',
  'apiKey',
  'authorization',
  'resetCode',
  'reset_code',
  'verificationCode',
  'verification_code',
  'resetToken',
  'reset_token',
  'verificationToken',
  'verification_token',
  'sessionId',
  'session_id',
  'cookie',
  'accessToken',
  'refreshToken',
  'hashed_key',     // API key hash — must never appear in logs
  'hashed_code',    // Reset/verification code hash
  'smtp_password',
  'private_key',
  'privateKey',
  'access_key',
  'accessKey',
  'secret_key',
  'secretKey',
  'code',           // Numeric verification/reset codes
];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(k)) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = redact(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function shouldLog(level) {
  return LEVELS[level] <= currentLevel;
}

function log(level, message, meta = {}) {
  if (!shouldLog(level)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(meta),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  redact,
  child(bindings) {
    return {
      error: (m, meta) => log('error', m, { ...bindings, ...meta }),
      warn: (m, meta) => log('warn', m, { ...bindings, ...meta }),
      info: (m, meta) => log('info', m, { ...bindings, ...meta }),
      debug: (m, meta) => log('debug', m, { ...bindings, ...meta }),
    };
  },
};

module.exports = logger;
