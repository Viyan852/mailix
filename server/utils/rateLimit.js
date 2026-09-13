/**
 * MAILIX Rate Limiting Middleware
 *
 * Production-grade rate limiting using in-memory store by default.
 * Can be backed by Redis when available.
 *
 * Per-route limits protect sensitive endpoints. Per-project and per-IP
 * limits are tracked separately.
 */

const { config } = require('../config');
const logger = require('./logger');

class RateLimiter {
  constructor(name, options = {}) {
    this.name = name;
    this.windowMs = options.windowMs || 60000;
    this.max = options.max || 100;
    this.buckets = new Map(); // key -> { count, resetAt }
    this.cleanupInterval = setInterval(() => this._cleanup(), this.windowMs * 2);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  _key(req) {
    if (this.keyFn) return this.keyFn(req);
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  middleware() {
    return (req, res, next) => {
      const key = this._key(req);
      const now = Date.now();
      let bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + this.windowMs };
        this.buckets.set(key, bucket);
      }
      bucket.count++;

      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - bucket.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

      if (bucket.count > this.max) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        logger.warn('Rate limit exceeded', {
          limiter: this.name,
          key,
          count: bucket.count,
          max: this.max,
        });
        return res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            retryAfter,
          },
        });
      }
      next();
    };
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

// Pre-configured limiters
const globalLimit = new RateLimiter('global', {
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
});

const emailSendLimit = new RateLimiter('email-send', {
  windowMs: 60000,
  max: 60,
  keyFn: (req) => req.body?.projectId || req.apiKey?.projectId || req.ip,
});

const verificationLimit = new RateLimiter('verification', {
  windowMs: 60000,
  max: 10,
  keyFn: (req) => req.body?.email || req.ip,
});

const passwordResetLimit = new RateLimiter('password-reset', {
  windowMs: 60000,
  max: 5,
  keyFn: (req) => req.body?.email || req.ip,
});

const apiKeyLimit = new RateLimiter('api-key', {
  windowMs: 60000,
  max: 30,
  keyFn: (req) => req.apiKey?.id || req.ip,
});

const newsletterLimit = new RateLimiter('newsletter', {
  windowMs: 60000,
  max: 10,
  keyFn: (req) => req.body?.projectId || req.ip,
});

const authLimit = new RateLimiter('auth', {
  windowMs: 60000 * 5,
  max: 20,
  keyFn: (req) => req.body?.email || req.ip,
});

module.exports = {
  RateLimiter,
  globalLimit,
  emailSendLimit,
  verificationLimit,
  passwordResetLimit,
  apiKeyLimit,
  newsletterLimit,
  authLimit,
};
