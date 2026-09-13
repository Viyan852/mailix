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

// Company branding
function getCompany() {
  ensureDataDir();
  const data = readJSON(getDataPath('company.json'));
  
  if (!data.company) {
    // Return defaults
    return {
      name: '',
      website: '',
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      senderName: '',
      senderEmail: '',
      replyTo: ''
    };
  }
  
  return data.company;
}

function updateCompany(companyData) {
  ensureDataDir();
  writeJSON(getDataPath('company.json'), { company: companyData });
  return getCompany();
}

module.exports = { getCompany, updateCompany };