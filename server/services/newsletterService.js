/**
 * Newsletter Service
 * Thin wrapper — routes now use the db adapter directly.
 * This file exists for backwards compatibility.
 * @deprecated Use db adapter + routes/newsletter.js directly.
 */

const db = require('../db');

async function getAllCampaigns(projectId) {
  return db.findMany('campaigns', c => !projectId || c.project_id === projectId);
}

async function createCampaign(data) {
  const crypto = require('crypto');
  const campaign = {
    id: 'cmp_' + crypto.randomBytes(8).toString('hex'),
    project_id: data.projectId || null,
    name: data.name || 'Untitled Campaign',
    subject: data.subject || '',
    from_name: data.fromName || '',
    from_email: data.fromEmail || '',
    reply_to: data.replyTo || null,
    template_id: data.templateId || null,
    status: 'draft',
    scheduled_at: null,
    sent_at: null,
    stats: { queued: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, simulated: 0 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.insert('campaigns', campaign);
  return campaign;
}

module.exports = { getAllCampaigns, createCampaign };