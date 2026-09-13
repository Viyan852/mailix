/**
 * DEPRECATED: Legacy API Key Service
 *
 * This file is kept only to prevent import errors from any code that
 * may still reference it. All functionality has been superseded by
 * server/utils/apiKeys.js, which uses proper cryptographic hashing
 * and never stores or returns plaintext keys.
 *
 * DO NOT USE THIS FILE. It will be removed in a future version.
 */

// Re-export the secure implementation so any remaining import still works
// but routes to the correct secure backend.
const { createApiKey, listApiKeys, revokeApiKey, renameApiKey } = require('../utils/apiKeys');

async function getAllKeys() {
  // Return empty array — legacy plaintext keys are no longer exposed
  return [];
}

async function createKey(permissions) {
  throw new Error('Use the /api/v1/api-keys endpoint with a valid project ID and proper authentication');
}

async function revokeKey(keyId) {
  return revokeApiKey(keyId);
}

async function renameKey(keyId, name) {
  return renameApiKey(keyId, name);
}

module.exports = { getAllKeys, createKey, revokeKey, renameKey };