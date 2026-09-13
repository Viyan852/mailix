/**
 * MAILIX Configuration
 *
 * Centralized environment-based configuration.
 * Validates required production values at startup.
 *
 * NOTE: .env is loaded from the project root (one directory above server/).
 */

const path = require('path');
const fs = require('fs');

// Determine the project root: one level above server/
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env BEFORE reading process.env so env vars are available
// Try to load dotenv if installed
try {
  const dotenv = require('dotenv');
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (err) {
  // dotenv not installed — rely on process.env being set externally
}

const env = process.env.MAILIX_ENV || 'development';
const isProduction = env === 'production';
const isTest = env === 'test';

function int(value, fallback) {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const config = {
  env,
  isProduction,
  isTest,
  isDevelopment: !isProduction && !isTest,

  server: {
    port: int(process.env.MAILIX_PORT, 7345),
    baseUrl: process.env.MAILIX_BASE_URL || 'http://localhost:7345',
    allowedOrigins: (process.env.MAILIX_ALLOWED_ORIGINS || 'http://localhost:7345,http://127.0.0.1:7345')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    trustProxy: bool(process.env.MAILIX_TRUST_PROXY, false),
  },

  database: {
    type: process.env.MAILIX_DB_TYPE || 'json',
    url: process.env.MAILIX_DATABASE_URL || '',
    dataDir: process.env.MAILIX_DATA_DIR || path.join(PROJECT_ROOT, 'data'),
  },

  redis: {
    url: process.env.MAILIX_REDIS_URL || '',
  },

  email: {
    provider: process.env.MAILIX_EMAIL_PROVIDER || 'local',
    smtp: {
      host: process.env.MAILIX_SMTP_HOST || '',
      port: int(process.env.MAILIX_SMTP_PORT, 587),
      secure: bool(process.env.MAILIX_SMTP_SECURE, false),
      user: process.env.MAILIX_SMTP_USER || '',
      password: process.env.MAILIX_SMTP_PASSWORD || '',
      from: process.env.MAILIX_SMTP_FROM || 'hello@mailix.local',
    },
    ses: {
      region: process.env.MAILIX_SES_REGION || 'us-east-1',
      accessKey: process.env.MAILIX_SES_ACCESS_KEY || '',
      secretKey: process.env.MAILIX_SES_SECRET_KEY || '',
      from: process.env.MAILIX_SES_FROM || '',
    },
    resend: {
      apiKey: process.env.MAILIX_RESEND_API_KEY || '',
      from: process.env.MAILIX_RESEND_FROM || '',
    },
  },

  security: {
    secret: process.env.MAILIX_SECRET || 'mailix-dev-secret-do-not-use-in-production',
    rateLimit: {
      windowMs: int(process.env.MAILIX_RATE_LIMIT_WINDOW_MS, 60000),
      max: int(process.env.MAILIX_RATE_LIMIT_MAX, 100),
    },
    webhookSecret: {
      resend: process.env.MAILIX_RESEND_WEBHOOK_SECRET || '',
    },
  },

  logging: {
    level: process.env.MAILIX_LOG_LEVEL || 'info',
  },
};

/**
 * Validate required config in production.
 * Fails safely when critical config is missing.
 */
function validate() {
  const errors = [];

  if (isProduction) {
    if (config.security.secret === 'mailix-dev-secret-do-not-use-in-production') {
      errors.push('MAILIX_SECRET must be set in production');
    }
    if (config.email.provider === 'smtp' && !config.email.smtp.host) {
      errors.push('MAILIX_SMTP_HOST required when provider is smtp');
    }
    if (config.email.provider === 'ses' && (!config.email.ses.accessKey || !config.email.ses.secretKey)) {
      errors.push('MAILIX_SES_ACCESS_KEY and MAILIX_SES_SECRET_KEY required when provider is ses');
    }
    if (config.email.provider === 'resend' && !config.email.resend.apiKey) {
      errors.push('MAILIX_RESEND_API_KEY required when provider is resend');
    }
    if (config.email.provider === 'resend' && !config.security.webhookSecret.resend) {
      errors.push('MAILIX_RESEND_WEBHOOK_SECRET required in production with resend provider');
    }
  }

  return errors;
}

/**
 * Safe config diagnostic — reports missing variable NAMES, never values.
 */
function diagnose() {
  const missing = [];
  const warnings = [];

  if (config.security.secret === 'mailix-dev-secret-do-not-use-in-production') {
    warnings.push('MAILIX_SECRET is using the insecure default — set a real secret in production');
  }
  if (config.email.provider !== 'local') {
    if (config.email.provider === 'smtp' && !config.email.smtp.host) {
      missing.push('MAILIX_SMTP_HOST');
    }
    if (config.email.provider === 'ses' && !config.email.ses.accessKey) {
      missing.push('MAILIX_SES_ACCESS_KEY');
    }
    if (config.email.provider === 'ses' && !config.email.ses.secretKey) {
      missing.push('MAILIX_SES_SECRET_KEY');
    }
    if (config.email.provider === 'resend' && !config.email.resend.apiKey) {
      missing.push('MAILIX_RESEND_API_KEY');
    }
  }

  return {
    env: config.env,
    provider: config.email.provider,
    database: config.database.type,
    missingVariables: missing,
    warnings,
  };
}

module.exports = { config, validate, diagnose };
