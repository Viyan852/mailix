/**
 * MAILIX Server (v2)
 *
 * Production-grade Express server:
 *   - Helmet for HTTP security headers
 *   - Configurable CORS (no wildcard in production)
 *   - Centralized error handling
 *   - Rate limiting
 *   - Health/monitoring endpoints
 *   - Static dashboard serving
 *   - API key authentication
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { config, validate: validateConfig } = require('./config');
const logger = require('./utils/logger');
const db = require('./db');
const { globalLimit, authLimit } = require('./utils/rateLimit');
const { apiKeyAuth } = require('./utils/apiKeys');
const { getActiveProvider, registry, verifyProvider } = require('./providers');

// Register providers
registry.register('local', require('./providers/local'));
registry.register('smtp', require('./providers/smtp'));
registry.register('ses', require('./providers/ses'));
registry.register('resend', require('./providers/resend'));

const MAILIX_DIR = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(MAILIX_DIR, 'apps', 'dashboard');
const DATA_DIR = path.join(MAILIX_DIR, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Validate config in production
const configErrors = validateConfig();
if (configErrors.length > 0) {
  logger.error('Configuration errors detected', { errors: configErrors });
  if (config.isProduction) {
    console.error('Cannot start in production with missing required config. See logs.');
    process.exit(1);
  }
}

const app = express();

// Trust proxy if configured
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// HTTP security headers (only when helmet is available)
try {
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: false, // dashboard is served from same origin
  }));
} catch (err) {
  logger.debug('helmet not available, skipping security headers');
}

// CORS — configurable, not wildcard in production
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (config.isProduction) {
    if (origin && config.server.allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  } else {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.header('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health' && req.path !== '/health/live') {
      logger.info('Request', {
        request_id: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
      });
    }
  });
  next();
});

// Global rate limiter
app.use('/api/', globalLimit.middleware());

// Health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive' });
});

app.get('/health/ready', async (req, res) => {
  const checks = {
    application: 'ok',
    database: 'ok',
    queue: 'ok',
    provider: 'unknown',
  };

  try {
    await db.all('projects');
  } catch (err) {
    checks.database = 'error';
  }

  try {
    const { queue } = require('./queue/emailQueue');
    await queue.getQueueDepth();
  } catch (err) {
    checks.queue = 'error';
  }

  try {
    const result = await verifyProvider(config.email.provider);
    checks.provider = result.ok ? 'ok' : `error: ${result.error}`;
  } catch (err) {
    checks.provider = `error: ${err.message}`;
  }

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'unknown');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// API key middleware
app.use('/api/v1', apiKeyAuth());

// Mount API routes
app.use('/api/v1', require('./routes'));

// Serve dashboard static files
app.use(express.static(DASHBOARD_DIR));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  const requestId = req.id || 'unknown';

  // Validation errors
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(err.statusCode || 400).json({
      error: {
        code: err.code || 'INVALID_REQUEST',
        message: err.message || 'Invalid request',
        field: err.field,
        requestId,
      },
    });
  }

  // Rate limit
  if (err.statusCode === 429) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: err.message, requestId },
    });
  }

  // Log full details server-side
  logger.error('Request failed', {
    request_id: requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  // In production, never expose internals
  if (config.isProduction) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        requestId,
      },
    });
  }

  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      requestId,
    },
  });
});

// Initialize database, then start server
async function start() {
  try {
    await db.init();
  } catch (err) {
    logger.error('Database init failed', { error: err.message });
    if (config.isProduction) {
      console.error('Cannot start without database');
      process.exit(1);
    }
  }
  app.listen(config.server.port, () => {
    logger.info('Mailix server started', {
      port: config.server.port,
      env: config.env,
      provider: config.email.provider,
      database: db.isPostgres() ? 'postgres' : 'json',
    });
    console.log(`\n✓ Mailix running at http://localhost:${config.server.port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
