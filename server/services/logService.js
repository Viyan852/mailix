const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Log service
function getAllLogs(filters = {}) {
  ensureDataDir();
  const data = readJSON(getDataPath('logs.json'));
  
  if (!data || !data.logs) return { logs: [], total: 0 };
  
  let logs = data.logs;
  
  // Filter by type
  if (filters.type && filters.type !== 'all') {
    logs = logs.filter(log => log.type === filters.type);
  }
  
  // Filter by project
  if (filters.project && filters.project !== 'all') {
    logs = logs.filter(log => log.project === filters.project);
  }
  
  // Search
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    logs = logs.filter(log => 
      (log.event && log.event.toLowerCase().includes(searchLower)) ||
      (log.recipient && log.recipient.toLowerCase().includes(searchLower)) ||
      (log.template && log.template.toLowerCase().includes(searchLower))
    );
  }
  
  // Sort by timestamp descending
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return { logs, total: logs.length };
}

function getLogById(logId) {
  ensureDataDir();
  const data = readJSON(getDataPath('logs.json'));
  
  if (!data || !data.logs) return null;
  
  return data.logs.find(log => log.id === logId) || null;
}

function addLog(logData) {
  ensureDataDir();
  const data = readJSON(getDataPath('logs.json')) || { logs: [] };
  
  const newLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...logData
  };
  
  data.logs.push(newLog);
  
  // Keep only last 1000 logs
  if (data.logs.length > 1000) {
    data.logs = data.logs.slice(-1000);
  }
  
  writeJSON(getDataPath('logs.json'), data);
  return newLog;
}

module.exports = { getAllLogs, getLogById, addLog };