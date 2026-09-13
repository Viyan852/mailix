const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

// Get analytics data
router.get('/', async (req, res) => {
  try {
    const data = await analyticsService.getAnalytics({
      period: req.query.period || '30d'
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;