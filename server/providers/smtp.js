/**
 * SMTP Provider
 *
 * Uses nodemailer to dispatch real email via an SMTP server.
 * Requires SMTP_* environment variables to be configured.
 */

const { config } = require('../config');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.email.smtp.host) {
    throw Object.assign(new Error('SMTP not configured'), { code: 'SMTP_NOT_CONFIGURED', retryable: false });
  }
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    throw Object.assign(new Error('nodemailer not installed. Run npm install.'), {
      code: 'DEPENDENCY_MISSING',
      retryable: false,
    });
  }
  transporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth: config.email.smtp.user
      ? { user: config.email.smtp.user, pass: config.email.smtp.password }
      : undefined,
  });
  return transporter;
}

module.exports = {
  name: 'smtp',
  description: 'SMTP provider — dispatches real email via SMTP',

  async send(message) {
    const t = getTransporter();
    const info = await t.sendMail({
      from: message.from || config.email.smtp.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      headers: message.headers,
    });
    return {
      status: 'sent',
      providerMessageId: info.messageId,
    };
  },

  async verifyConnection() {
    try {
      const t = getTransporter();
      await t.verify();
      return { ok: true, host: config.email.smtp.host, port: config.email.smtp.port };
    } catch (err) {
      logger.error('SMTP verification failed', { error: err.message });
      return { ok: false, error: err.message };
    }
  },
};
