/**
 * Studio Routes
 *
 * Exposes the bundled system templates to the MAILIX Studio.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');

// All studio endpoints require authentication
router.use(requireAuth);
router.use(requireRole(ROLES.DEVELOPER));

const MAILIX_DIR = path.resolve(__dirname, '../..');
const TEMPLATES_DIR = path.join(MAILIX_DIR, 'templates');
const CATALOG_PATH = path.join(TEMPLATES_DIR, 'template-catalog.json');
const HTML_DIR = path.join(TEMPLATES_DIR, 'templates');

function getCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return { templates: [] };
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    return { templates: [] };
  }
}

// GET /api/v1/studio/system-templates
router.get('/system-templates', (req, res, next) => {
  try {
    const catalog = getCatalog();
    res.json({ catalog });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/studio/system-templates/:id
router.get('/system-templates/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const catalog = getCatalog();
    const templateMeta = (catalog.templates || []).find(t => t.id === id || t.slug === id);

    if (!templateMeta) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'System template not found' } });
    }

    const category = templateMeta.category || 'misc';
    const slug = templateMeta.slug || id;
    const htmlPath = path.join(HTML_DIR, category, `${slug}.html`);

    // Prevent path traversal
    if (!htmlPath.startsWith(HTML_DIR)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid template path' } });
    }

    let html = '';
    if (fs.existsSync(htmlPath)) {
      html = fs.readFileSync(htmlPath, 'utf8');
    }

    res.json({
      template: {
        ...templateMeta,
        html,
        type: 'system',
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
