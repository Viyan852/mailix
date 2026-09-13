const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function getDataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Analytics service
function getAnalytics(filters = {}) {
  ensureDataDir();
  
  // Get all logs
  const logData = getAllLogsInternal();
  let logs = logData.logs;
  
  if (!logs || logs.length === 0) {
    return {
      data: {
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0
      },
      period: filters.period || '30d'
    };
  }
  
  // Determine period
  const period = filters.period || '30d';
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  // Filter logs by period
  logs = logs.filter(log => new Date(log.timestamp) >= startDate);
  
  // Calculate metrics
  const sent = logs.filter(log => log.type === 'email' && log.status === 'sent').length;
  const delivered = logs.filter(log => log.type === 'email' && log.status === 'delivered').length;
  const bounced = logs.filter(log => log.type === 'email' && log.status === 'bounced').length;
  const opened = logs.filter(log => log.type === 'email' && log.details && log.details.opened).length;
  const clicked = logs.filter(log => log.type === 'email' && log.details && log.details.clicked).length;
  const unsubscribed = logs.filter(log => log.type === 'subscriber' && log.event === 'unsubscribe').length;
  
  return {
    data: {
      sent,
      delivered,
      bounced,
      opened,
      clicked,
      unsubscribed
    },
    period
  };
}

function getAllLogsInternal() {
  ensureDataDir();
  const data = readJSON(getDataPath('logs.json'));
  return data || { logs: [] };
}

module.exports = { getAnalytics, getAllLogsInternal };