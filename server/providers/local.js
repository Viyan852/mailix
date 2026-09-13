/**
 * Local / Demo Provider
 *
 * Always available. Captures outgoing messages into the local mail inbox
 * instead of dispatching them to an external service. Clearly identifies
 * delivery as 'simulated' so the dashboard never misleads the user.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

const INBOX_DIR = path.join(config.database.dataDir, 'inbox');

function ensureInbox() {
  if (!fs.existsSync(INBOX_DIR)) {
    fs.mkdirSync(INBOX_DIR, { recursive: true });
  }
}

module.exports = {
  name: 'local',
  description: 'Local/Demo provider — captures outgoing emails into a local inbox. No external delivery.',

  async send(message) {
    ensureInbox();
    const messageId = 'mx_local_' + crypto.randomBytes(8).toString('hex');
    const record = {
      id: messageId,
      to: message.to,
      from: message.from,
      subject: message.subject,
      html: message.html,
      text: message.text,
      receivedAt: new Date().toISOString(),
      status: 'simulated',
    };
    const file = path.join(INBOX_DIR, `${messageId}.json`);
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    return {
      status: 'simulated',
      providerMessageId: messageId,
      simulated: true,
    };
  },

  async verifyConnection() {
    return { ok: true, mode: 'simulated', message: 'Local provider is always available' };
  },
};
