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

// Template service
function getAllTemplates() {
  ensureDataDir();
  const data = readJSON(getDataPath('templates.json'));
  return data.templates || [];
}

function createTemplate(name, type) {
  ensureDataDir();
  const templates = getAllTemplates();
  
  // Check for duplicate
  if (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Template with this name already exists');
  }
  
  const newTemplate = {
    id: crypto.randomUUID(),
    name,
    type,
    createdAt: new Date().toISOString(),
    subject: '',
    fromName: '',
    fromEmail: '',
    content: '',
    variables: ['company_name', 'user_name', 'verification_code', 'reset_code', 'expiry', 'support_email']
  };
  
  templates.push(newTemplate);
  writeJSON(getDataPath('templates.json'), { templates });
  return newTemplate;
}

module.exports = { getAllTemplates, createTemplate };