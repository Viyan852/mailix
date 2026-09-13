/**
 * Amazon SES Provider
 *
 * Stub adapter — dispatches via SES HTTP API. To activate:
 *   npm install aws-sdk
 *   Set MAILIX_SES_ACCESS_KEY, MAILIX_SES_SECRET_KEY, MAILIX_SES_REGION
 */

const { config } = require('../config');
const logger = require('../utils/logger');

let client = null;

function getClient() {
  if (client) return client;
  if (!config.email.ses.accessKey || !config.email.ses.secretKey) {
    throw Object.assign(new Error('SES not configured'), {
      code: 'SES_NOT_CONFIGURED',
      retryable: false,
    });
  }
  try {
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: config.email.ses.accessKey,
      secretAccessKey: config.email.ses.secretKey,
      region: config.email.ses.region,
    });
    client = new AWS.SES({ apiVersion: '2010-12-01' });
    return client;
  } catch (err) {
    throw Object.assign(new Error('aws-sdk not installed. Run: npm install aws-sdk'), {
      code: 'DEPENDENCY_MISSING',
      retryable: false,
    });
  }
}

module.exports = {
  name: 'ses',
  description: 'Amazon SES provider — dispatches real email via AWS SES',

  async send(message) {
    const ses = getClient();
    const params = {
      Source: message.from || config.email.ses.from,
      Destination: { ToAddresses: [message.to] },
      Message: {
        Subject: { Data: message.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: message.html, Charset: 'UTF-8' },
          ...(message.text ? { Text: { Data: message.text, Charset: 'UTF-8' } } : {}),
        },
      },
      ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
    };
    const result = await ses.sendEmail(params).promise();
    return {
      status: 'sent',
      providerMessageId: result.MessageId,
    };
  },

  async verifyConnection() {
    try {
      getClient();
      return { ok: true, region: config.email.ses.region };
    } catch (err) {
      logger.error('SES verification failed', { error: err.message });
      return { ok: false, error: err.message };
    }
  },
};
