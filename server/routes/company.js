/**
 * Company Branding API
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');
const { validateName, ValidationError } = require('../utils/validation');
const { render } = require('../utils/template');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const all = await db.all('companies');
    const company = all[0] || {
      name: '',
      website: '',
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      senderName: '',
      senderEmail: '',
      replyTo: '',
    };
    res.json({ company });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const name = req.body.name ? validateName(req.body.name, 'name') : '';
    const website = typeof req.body.website === 'string' ? req.body.website.substring(0, 200) : '';
    const company = {
      id: 'company_main',
      name,
      website,
      primaryColor: req.body.primaryColor || '#6366F1',
      secondaryColor: req.body.secondaryColor || '#8B5CF6',
      senderName: req.body.senderName || '',
      senderEmail: req.body.senderEmail || '',
      replyTo: req.body.replyTo || '',
      updated_at: new Date().toISOString(),
    };
    const all = await db.all('companies');
    if (all.length > 0) {
      await db.update('companies', all[0].id, company);
    } else {
      await db.insert('companies', { ...company, created_at: new Date().toISOString() });
    }
    res.json({ company });
  } catch (err) {
    next(err);
  }
});

// Live preview endpoint — renders a sample email with the company's branding
router.post('/preview', requireAuth, async (req, res, next) => {
  try {
    const all = await db.all('companies');
    const company = all[0] || { name: 'Acme' };
    const html = render(
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="color:{{primaryColor}}">{{company_name}}</h1>
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">{{verification_code}}</div>
        <p>This code expires shortly.</p>
        <p>If you didn't request this, you can ignore this email.</p>
        <hr><small>Powered by MAILIX — by its_viyan</small>
      </div>`,
      {
        company_name: company.name || 'Acme',
        primaryColor: company.primaryColor || '#6366F1',
        verification_code: '583921',
      },
      'html'
    );
    res.json({ html });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
