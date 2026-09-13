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

// Verification code service
function sendVerification(email) {
  ensureDataDir();
  
  // Check if email already has pending verification
  const verificationRecordsPath = getDataPath('verification-records.json');
  let records = readJSON(verificationRecordsPath) || { records: [] };
  
  // Check for existing unverified code for this email
  const existingRecord = records.records.find(r => 
    r.email === email && !r.verified && !r.expired
  );
  
  let code;
  let expiresAt;
  
  if (existingRecord) {
    // Reuse existing code
    code = existingRecord.code;
    expiresAt = existingRecord.expiresAt;
  } else {
    // Generate new secure code
    code = crypto.randomInt(100000, 999999).toString();
    const expiryHours = 24; // default
    expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    
    records.records.push({
      email,
      code,
      verified: false,
      expiresAt,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 5
    });
  }
  
  // Hash the code before storage
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  
  // Update the record with hashed code
  const record = records.records.find(r => r.email === email && !r.verified && !r.expired);
  if (record) {
    record.hashedCode = hashedCode;
    record.code = code; // Keep plain code for sending
    record.attempts = 0;
  }
  
  writeJSON(verificationRecordsPath, records);
  
  return {
    code, // Plain code for sending in email (will be hashed before storage)
    hashedCode,
    expiresAt,
    expiresInHours: 24
  };
}

function verifyCode(email, inputCode) {
  ensureDataDir();
  
  const verificationRecordsPath = getDataPath('verification-records.json');
  const records = readJSON(verificationRecordsPath);
  
  if (!records || !records.records) {
    return { success: false, message: 'Verification system error' };
  }
  
  // Find the record for this email
  const record = records.records.find(r => r.email === email);
  
  if (!record) {
    return { success: false, message: 'No verification code found for this email' };
  }
  
  // Check if already verified
  if (record.verified) {
    return { success: false, message: 'Verification code already used' };
  }
  
  // Check if expired
  if (new Date(record.expiresAt) < new Date()) {
    record.expired = true;
    writeJSON(verificationRecordsPath, records);
    return { success: false, message: 'Verification code has expired' };
  }
  
  // Check max attempts
  if (record.attempts >= (record.maxAttempts || 5)) {
    record.locked = true;
    writeJSON(verificationRecordsPath, records);
    return { success: false, message: 'Maximum verification attempts exceeded' };
  }
  
  // Hash the input code and compare
  const hashedInput = crypto.createHash('sha256').update(inputCode).digest('hex');
  
  if (hashedInput === record.hashedCode) {
    // Mark as verified
    record.verified = true;
    writeJSON(verificationRecordsPath, records);
    return { success: true, message: 'Verification code is correct' };
  }
  
  // Increment attempts
  record.attempts++;
  writeJSON(verificationRecordsPath, records);
  
  return { success: false, message: 'Invalid verification code' };
}

function getConfig() {
  ensureDataDir();
  const data = readJSON(getDataPath('verification-config.json'));
  
  if (!data || !data.config) {
    return {
      enabled: true,
      maxAttempts: 5,
      expiryHours: 24
    };
  }
  
  return data.config;
}

function updateConfig(config) {
  ensureDataDir();
  writeJSON(getDataPath('verification-config.json'), { config });
  return getConfig();
}

// Send test verification email
function sendTestVerification() {
  // Generate a code and record it
  const result = sendVerification('test@example.com');
  return {
    success: true,
    message: 'Test verification email sent to test@example.com',
    code: result.code
  };
}

module.exports = { sendVerification, verifyCode, getConfig, updateConfig, sendTestVerification };