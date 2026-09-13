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

// Subscriber service
function getAllSubscribers() {
  ensureDataDir();
  const data = readJSON(getDataPath('subscribers.json'));
  return data.subscribers || [];
}

function addSubscriber(subscriberData) {
  ensureDataDir();
  const subscribers = getAllSubscribers();
  
  // Check for duplicate email
  if (subscribers.some(s => s.email.toLowerCase() === subscriberData.email.toLowerCase())) {
    throw new Error('Subscriber with this email already exists');
  }
  
  const newSubscriber = {
    id: crypto.randomUUID(),
    name: subscriberData.name,
    email: subscriberData.email,
    status: subscriberData.status || 'subscribed',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
  
  subscribers.push(newSubscriber);
  writeJSON(getDataPath('subscribers.json'), { subscribers });
  return newSubscriber;
}

function unsubscribeSubscriber(subscriberId) {
  ensureDataDir();
  const subscribers = getAllSubscribers();
  
  const index = subscribers.findIndex(s => s.id === subscriberId);
  
  if (index === -1) {
    throw new Error('Subscriber not found');
  }
  
  const unsubscribed = subscribers[index];
  unsubscribed.status = 'unsubscribed';
  unsubscribed.lastActivity = new Date().toISOString();
  
  writeJSON(getDataPath('subscribers.json'), { subscribers });
  return { ...unsubscribed, wasUnsubscribed: true };
}

module.exports = { getAllSubscribers, addSubscriber, unsubscribeSubscriber };