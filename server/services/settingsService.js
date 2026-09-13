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

// Settings service
function getAllSettings() {
  ensureDataDir();
  
  const companyData = readJSON(getDataPath('company.json'));
  const verificationData = readJSON(getDataPath('verification-config.json'));
  const passwordResetData = readJSON(getDataPath('password-reset-config.json'));
  const apiKeysData = readJSON(getDataPath('api-keys.json'));
  
  return {
    company: companyData ? companyData.company : {
      name: '',
      website: '',
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      senderName: '',
      senderEmail: '',
      replyTo: ''
    },
    verification: verificationData ? verificationData.config : {
      enabled: true,
      maxAttempts: 5,
      expiryHours: 24
    },
    passwordReset: passwordResetData ? passwordResetData.config : {
      enabled: true,
      maxAttempts: 3,
      expiryHours: 12
    },
    apiKeys: apiKeysData ? apiKeysData.keys : [],
    demoMode: false
  };
}

function updateSettings(settingsData) {
  ensureDataDir();
  
  // Update company
  if (settingsData.company) {
    writeJSON(getDataPath('company.json'), { company: settingsData.company });
  }
  
  // Update verification config
  if (settingsData.verification) {
    writeJSON(getDataPath('verification-config.json'), { config: settingsData.verification });
  }
  
  // Update password reset config
  if (settingsData.passwordReset) {
    writeJSON(getDataPath('password-reset-config.json'), { config: settingsData.passwordReset });
  }
  
  return getAllSettings();
}

module.exports = { getAllSettings, updateSettings };