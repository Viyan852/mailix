const express = require('express');
const router = express.Router();
const logService = require('../services/logService');

// Get all logs
router.get('/', async (req, res) => {
  try {
    const logs = await logService.getAllLogs({
      type: req.query.type,
      project: req.query.project,
      search: req.query.search
    });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get log by ID
router.get('/:logId', async (req, res) => {
  try {
    const log = await logService.getLogById(req.params.logId);
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;