/**
 * Resend Provider
 *
 * Dispatches via Resend's HTTP API (https://resend.com).
 *   MAILIX_RESEND_API_KEY required
 */

const https = require('https');
const { config } = require('../config');
const logger = require('../utils/logger');

function callResend(pathname, method, body, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.resend.com',
      port: 443,
      path: pathname,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(Object.assign(new Error(parsed.message || 'Resend API error'), {
              code: parsed.code || 'RESEND_ERROR',
              statusCode: res.statusCode,
              retryable: res.statusCode >= 500,
            }));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', err => reject(Object.assign(err, { retryable: true })));
    req.write(data);
    req.end();
  });
}

module.exports = {
  name: 'resend',
  description: 'Resend provider — dispatches real email via Resend',

  async send(message) {
    if (!config.email.resend.apiKey) {
      throw Object.assign(new Error('Resend not configured'), {
        code: 'RESEND_NOT_CONFIGURED',
        retryable: false,
      });
    }
    const result = await callResend('/emails', 'POST', {
      from: message.from || config.email.resend.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo,
      headers: message.headers,
    }, config.email.resend.apiKey);
    return {
      status: 'sent',
      providerMessageId: result.id,
    };
  },

  async verifyConnection() {
    try {
      if (!config.email.resend.apiKey) {
        return { ok: false, error: 'Resend not configured' };
      }
      return { ok: true };
    } catch (err) {
      logger.error('Resend verification failed', { error: err.message });
      return { ok: false, error: err.message };
    }
  },
};
