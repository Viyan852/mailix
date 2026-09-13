const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;