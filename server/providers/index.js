/**
 * MAILIX Email Provider Abstraction
 *
 * Provider-agnostic interface for sending emails. Concrete adapters live
 * in ./providers/. Local/Demo provider remains the default and is always
 * available.
 *
 * Providers are auto-registered on module load so the registry is usable
 * whether you import the module from the running server, from a test, or
 * from any CLI command.
 */

const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * @typedef {Object} EmailMessage
 * @property {string} to - Recipient email address
 * @property {string} from - Sender email (overrides default)
 * @property {string} subject - Email subject
 * @property {string} html - HTML body
 * @property {string} [text] - Plain-text body
 * @property {Object} [headers] - Additional headers
 * @property {string} [idempotencyKey] - Idempotency key for retries
 * @property {string} [replyTo] - Reply-To address
 */

/**
 * @typedef {Object} SendResult
 * @property {string} status - 'delivered' | 'queued' | 'simulated' | 'failed' | 'bounced'
 * @property {string} [providerMessageId] - Provider's message ID
 * @property {string} [error] - Error message if failed
 * @property {string} [errorCode] - Error code
 * @property {boolean} [retryable] - Whether the error is retryable
 * @property {string} [provider] - Provider name
 */

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(name, provider) {
    this.providers.set(name, provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  list() {
    return Array.from(this.providers.keys());
  }
}

const registry = new ProviderRegistry();

// Auto-register all built-in providers. This happens once at module load
// so the registry is always populated, even when imported in tests.
function _registerBuiltins() {
  try {
    registry.register('local', require('./local'));
  } catch (err) {
    logger.error('Failed to register local provider', { error: err.message });
  }
  try {
    registry.register('smtp', require('./smtp'));
  } catch (err) {
    // SMTP provider is optional — only required when MAILIX_EMAIL_PROVIDER=smtp
  }
  try {
    registry.register('ses', require('./ses'));
  } catch (err) { /* optional */ }
  try {
    registry.register('resend', require('./resend'));
  } catch (err) { /* optional */ }
}
_registerBuiltins();

/**
 * Get the active provider based on configuration.
 * In production, NEVER silently falls back to local — throw a clear error.
 * In development, falls back to local with a warning.
 */
function getActiveProvider() {
  const requested = config.email.provider;
  const provider = registry.get(requested);
  if (provider) {
    return { name: requested, provider };
  }
  // Provider requested but not available
  if (config.isProduction) {
    throw Object.assign(
      new Error(`Email provider "${requested}" is not available. Check your configuration and dependencies.`),
      { code: 'PROVIDER_UNAVAILABLE', retryable: false }
    );
  }
  // Development: fall back to local with a warning
  logger.warn('Requested provider not available, falling back to local (simulated) in development', { requested });
  const local = registry.get('local');
  if (!local) {
    throw new Error('Local provider not registered — this is a bug');
  }
  return { name: 'local', provider: local };
}

function getProvider(name) {
  return registry.get(name);
}

/**
 * Send an email using the active provider.
 * @param {EmailMessage} message
 * @returns {Promise<SendResult>}
 */
async function sendEmail(message) {
  const { name, provider } = getActiveProvider();
  const start = Date.now();
  try {
    const result = await provider.send(message);
    const duration = Date.now() - start;
    logger.info('Email sent', {
      provider: name,
      status: result.status,
      duration_ms: duration,
      recipient: redactEmail(message.to),
    });
    return { ...result, provider: name };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Email send failed', {
      provider: name,
      duration_ms: duration,
      error: err.message,
      recipient: redactEmail(message.to),
    });
    return {
      status: 'failed',
      error: err.message,
      errorCode: err.code || 'SEND_FAILED',
      retryable: err.retryable !== false,
      provider: name,
    };
  }
}

async function verifyProvider(name) {
  const provider = registry.get(name);
  if (!provider) {
    return { ok: false, error: `Provider "${name}" not registered` };
  }
  return provider.verifyConnection();
}

function redactEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const redactedLocal = local.length <= 2 ? '*' : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${redactedLocal}@${domain}`;
}

module.exports = {
  registry,
  getActiveProvider,
  getProvider,
  sendEmail,
  verifyProvider,
  redactEmail,
};
