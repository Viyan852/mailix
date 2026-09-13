/**
 * MAILIX Database Adapter
 *
 * Provides a unified interface over JSON (default local mode) and PostgreSQL.
 * All higher-level code should depend on this interface, not the underlying driver.
 *
 * JSON mode: uses atomic write (temp file → rename) to prevent corruption on crash.
 * PostgreSQL mode: JSONB storage, table-per-collection.
 */

const path = require('path');
const fs = require('fs');
const { config } = require('../config');
const logger = require('../utils/logger');

let pgPool = null;
let pgAvailable = false;

// Try to load pg
try {
  const { Pool } = require('pg');
  if (config.database.url) {
    pgPool = new Pool({ connectionString: config.database.url });
    pgAvailable = true;
    logger.info('PostgreSQL configured', { host: config.database.url.split('@')[1] || 'unknown' });
  }
} catch (err) {
  pgAvailable = false;
  logger.warn('PostgreSQL driver not available, using JSON storage', { error: err.message });
}

// JSON file store
const JSON_DATA_DIR = config.database.dataDir;
if (!fs.existsSync(JSON_DATA_DIR)) {
  fs.mkdirSync(JSON_DATA_DIR, { recursive: true });
}

function jsonPath(collection) {
  return path.join(JSON_DATA_DIR, `${collection}.json`);
}

function readJsonCollection(collection) {
  const file = jsonPath(collection);
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : (data[collection] || []);
  } catch (err) {
    logger.error('Failed to read collection', { collection, error: err.message });
    return [];
  }
}

/**
 * Atomic write: write to temp file then rename, preventing partial writes.
 */
function writeJsonCollection(collection, items) {
  const file = jsonPath(collection);
  const tmp = file + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    // Clean up temp file if rename failed
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
}

const SCHEMA = {
  projects: 'id, name, branding, created_at, updated_at',
  companies: 'id, name, branding, created_at, updated_at',
  users: 'id, email, password_hash, role, project_id, created_at, updated_at',
  sessions: 'id, user_id, token_hash, expires_at, created_at',
  domains: 'id, project_id, domain, status, spf_status, dkim_status, dmarc_status, last_checked, created_at',
  senders: 'id, project_id, domain_id, name, email, reply_to, verified, created_at',
  templates: 'id, project_id, name, type, subject, html, text, variables, created_at, updated_at',
  subscribers: 'id, project_id, name, email, status, last_activity, created_at',
  campaigns: 'id, project_id, name, subject, from_name, from_email, reply_to, template_id, status, scheduled_at, sent_at, stats, created_at, updated_at',
  emails: 'id, project_id, message_id, recipient, sender, subject, template_id, provider, status, attempts, last_attempt, next_retry, last_error, html, text, idempotency_key, reply_to, metadata, tags, provider_message_id, created_at, updated_at',
  delivery_events: 'id, message_id, type, payload, created_at',
  api_keys: 'id, project_id, name, key_prefix, hashed_key, scopes, expires_at, last_used, revoked, created_at, updated_at',
  verification_tokens: 'id, project_id, email, hashed_code, expires_at, attempts, used, created_at',
  password_reset_tokens: 'id, project_id, email, hashed_code, expires_at, attempts, used, created_at',
  logs: 'id, project_id, level, request_id, user_id, operation, message_id, provider, duration_ms, result, error_code, message, created_at',
  audit_logs: 'id, project_id, user_id, action, target, meta, created_at',
  suppressions: 'id, project_id, email, reason, source, created_at',
};

async function init() {
  if (config.database.type === 'postgres' && pgAvailable) {
    // Create tables if not exist
    for (const [table] of Object.entries(SCHEMA)) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS ${table} (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
      } catch (err) {
        logger.error('Failed to create table', { table, error: err.message });
      }
    }
    // Index frequently queried JSONB fields
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_emails_project ON emails ((data->>'project_id'))`,
      `CREATE INDEX IF NOT EXISTS idx_emails_status ON emails ((data->>'status'))`,
      `CREATE INDEX IF NOT EXISTS idx_emails_idempotency ON emails ((data->>'idempotency_key'))`,
      `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys ((data->>'hashed_key'))`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions ((data->>'token_hash'))`,
      `CREATE INDEX IF NOT EXISTS idx_suppressions_email ON suppressions ((data->>'email'))`,
      `CREATE INDEX IF NOT EXISTS idx_delivery_events_message ON delivery_events ((data->>'message_id'))`,
    ];
    for (const idx of indexes) {
      try {
        await pgPool.query(idx);
      } catch (err) {
        logger.warn('Index creation failed', { error: err.message });
      }
    }
    logger.info('PostgreSQL schema initialized');
  } else {
    logger.info('Using JSON file storage', { dataDir: JSON_DATA_DIR });
  }
}

async function all(collection) {
  if (config.database.type === 'postgres' && pgAvailable) {
    try {
      const result = await pgPool.query(`SELECT data FROM ${collection}`);
      return result.rows.map(r => r.data);
    } catch (err) {
      logger.error('DB read failed', { collection, error: err.message });
      return readJsonCollection(collection);
    }
  }
  return readJsonCollection(collection);
}

async function findById(collection, id) {
  const items = await all(collection);
  return items.find(i => i.id === id) || null;
}

async function findOne(collection, predicate) {
  const items = await all(collection);
  return items.find(predicate) || null;
}

async function findMany(collection, predicate) {
  const items = await all(collection);
  return items.filter(predicate);
}

async function insert(collection, item) {
  if (config.database.type === 'postgres' && pgAvailable) {
    try {
      await pgPool.query(
        `INSERT INTO ${collection} (id, data, created_at) VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = $2`,
        [item.id, item]
      );
      return item;
    } catch (err) {
      logger.error('DB insert failed', { collection, error: err.message });
      // Fall through to JSON
    }
  }
  const items = readJsonCollection(collection);
  items.push(item);
  writeJsonCollection(collection, items);
  return item;
}

async function update(collection, id, updates) {
  if (config.database.type === 'postgres' && pgAvailable) {
    try {
      const existing = await findById(collection, id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await pgPool.query(
        `UPDATE ${collection} SET data = $1 WHERE id = $2`,
        [updated, id]
      );
      return updated;
    } catch (err) {
      logger.error('DB update failed', { collection, id, error: err.message });
    }
  }
  const items = readJsonCollection(collection);
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
  writeJsonCollection(collection, items);
  return items[index];
}

async function remove(collection, id) {
  if (config.database.type === 'postgres' && pgAvailable) {
    try {
      await pgPool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
      return true;
    } catch (err) {
      logger.error('DB delete failed', { collection, id, error: err.message });
    }
  }
  const items = readJsonCollection(collection);
  const filtered = items.filter(i => i.id !== id);
  writeJsonCollection(collection, filtered);
  return items.length !== filtered.length;
}

/**
 * Count records matching a predicate. Efficient for pagination.
 */
async function count(collection, predicate) {
  const items = predicate ? await findMany(collection, predicate) : await all(collection);
  return items.length;
}

/**
 * Import existing JSON data into the database.
 * Used by the migration tooling.
 */
async function importJsonData() {
  const collections = Object.keys(SCHEMA);
  for (const collection of collections) {
    const file = jsonPath(collection);
    if (!fs.existsSync(file)) continue;
    try {
      const items = readJsonCollection(collection);
      logger.info('Importing collection', { collection, count: items.length });
    } catch (err) {
      logger.error('Import failed', { collection, error: err.message });
    }
  }
}

module.exports = {
  init,
  all,
  findById,
  findOne,
  findMany,
  insert,
  update,
  remove,
  count,
  importJsonData,
  isPostgres: () => config.database.type === 'postgres' && pgAvailable,
  SCHEMA,
};
