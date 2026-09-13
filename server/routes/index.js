/**
 * MAILIX API v1 Routes
 */

const express = require('express');
const router = express.Router();

const projectRouter = require('./projects');
const companyRouter = require('./company');
const verificationRouter = require('./verification');
const passwordResetRouter = require('./password-reset');
const templateRouter = require('./templates');
const newsletterRouter = require('./newsletter');
const subscriberRouter = require('./subscribers');
const domainRouter = require('./domains');
const apiKeyRouter = require('./api-keys');
const logRouter = require('./logs');
const analyticsRouter = require('./analytics');
const settingsRouter = require('./settings');
const authRouter = require('./auth');
const messagesRouter = require('./messages');
const suppressionRouter = require('./suppressions');
const webhookRouter = require('./webhooks');
const inboxRouter = require('./inbox');
const dnsRouter = require('./dns');
const integrationsRouter = require('./integrations');
const usersRouter = require('./users');
const statsRouter = require('./stats');
const emailsRouter = require('./emails');
const studioRouter = require('./studio');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/projects', projectRouter);
router.use('/company', companyRouter);
router.use('/verification', verificationRouter);
router.use('/password-reset', passwordResetRouter);
router.use('/templates', templateRouter);
router.use('/newsletter', newsletterRouter);
router.use('/subscribers', subscriberRouter);
router.use('/domains', domainRouter);
router.use('/domains', dnsRouter); // /domains/:id/verify
router.use('/api-keys', apiKeyRouter);
router.use('/logs', logRouter);
router.use('/analytics', analyticsRouter);
router.use('/settings', settingsRouter);
router.use('/emails', emailsRouter); // POST /emails/send
router.use('/messages', messagesRouter);
router.use('/suppressions', suppressionRouter);
router.use('/webhooks', webhookRouter);
router.use('/inbox', inboxRouter);
router.use('/integrations', integrationsRouter);
router.use('/stats', statsRouter);
router.use('/studio', studioRouter);

module.exports = router;
