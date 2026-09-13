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

// Domain service
function getAllDomains() {
  ensureDataDir();
  const data = readJSON(getDataPath('domains.json'));
  return data.domains || [];
}

function addDomain(domainName) {
  ensureDataDir();
  const domains = getAllDomains();
  
  // Check for duplicate
  if (domains.some(d => d.domain.toLowerCase() === domainName.toLowerCase())) {
    throw new Error('Domain already exists');
  }
  
  const newDomain = {
    id: crypto.randomUUID(),
    domain: domainName,
    status: 'pending',
    spf: false,
    dkim: false,
    dmarc: false,
    createdAt: new Date().toISOString()
  };
  
  domains.push(newDomain);
  writeJSON(getDataPath('domains.json'), { domains });
  return newDomain;
}

module.exports = { getAllDomains, addDomain };