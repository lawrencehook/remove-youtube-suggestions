const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const config = require('../config');

// --- Database setup ---

let db = null;

function getDb() {
  if (db) return db;

  const dataDir = config.DATA_DIR;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'storage.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_requests (
      request_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      session_token TEXT,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS email_rate_limits (
      key_hash TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ip_rate_limits (
      key_hash TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_cache (
      email TEXT PRIMARY KEY,
      premium INTEGER NOT NULL,
      customer_id TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  return db;
}

function ensureDirectories() {
  getDb();
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// --- Grandfathered Emails (loaded once at startup) ---

let grandfatheredSet = null;

function readGrandfatheredEmails() {
  try {
    const filePath = path.join(config.DATA_DIR, config.GRANDFATHERED_FILE);
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      return new Set(lines.map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#')));
    }
  } catch (err) {
    console.error('Failed to read grandfathered emails:', err.message);
  }
  return new Set();
}

function loadGrandfatheredEmails() {
  grandfatheredSet = readGrandfatheredEmails();
  return grandfatheredSet;
}

function isGrandfathered(email) {
  if (!grandfatheredSet) loadGrandfatheredEmails();
  return grandfatheredSet.has(email.toLowerCase());
}

// --- Subscription Cache ---

function setSubscriptionStatus(email, premium, customerId) {
  email = email.toLowerCase();
  const stmt = getDb().prepare(`
    INSERT INTO subscription_cache (email, premium, customer_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET premium=excluded.premium, customer_id=excluded.customer_id, updated_at=excluded.updated_at
  `);
  stmt.run(email, premium ? 1 : 0, customerId, Date.now());
}

function getSubscriptionStatus(email) {
  const row = getDb().prepare('SELECT * FROM subscription_cache WHERE email = ?').get(email.toLowerCase());
  if (!row) return null;
  if (Date.now() - row.updated_at > 10000) return null;
  return { premium: row.premium === 1, customerId: row.customer_id, updatedAt: row.updated_at };
}

// --- Auth Requests ---

function createAuthRequest(requestId, email, { ip } = {}) {
  const timestamp = Date.now();
  const data = {
    request_id: requestId,
    email: email,
    status: 'pending',
    created_at: timestamp,
    session_token: null,
  };
  if (ip) data.ip = ip;

  const stmt = getDb().prepare(`
    INSERT INTO auth_requests (request_id, email, status, created_at, session_token, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(requestId, email, 'pending', timestamp, null, ip || null);
  return data;
}

function getAuthRequest(requestId) {
  const row = getDb().prepare('SELECT * FROM auth_requests WHERE request_id = ?').get(requestId);
  if (!row) return null;

  if (Date.now() - row.created_at > config.REQUEST_ID_EXPIRY_MS) {
    getDb().prepare('DELETE FROM auth_requests WHERE request_id = ?').run(requestId);
    return null;
  }

  return {
    request_id: row.request_id,
    email: row.email,
    status: row.status,
    created_at: row.created_at,
    session_token: row.session_token,
    ...(row.ip ? { ip: row.ip } : {}),
  };
}

function updateAuthRequest(requestId, updates) {
  const row = getDb().prepare('SELECT * FROM auth_requests WHERE request_id = ?').get(requestId);
  if (!row) return null;

  const merged = { ...row, ...updates };
  getDb().prepare(`
    UPDATE auth_requests SET email=?, status=?, created_at=?, session_token=?, ip=?
    WHERE request_id=?
  `).run(merged.email, merged.status, merged.created_at, merged.session_token, merged.ip, requestId);

  return {
    request_id: merged.request_id,
    email: merged.email,
    status: merged.status,
    created_at: merged.created_at,
    session_token: merged.session_token,
    ...(merged.ip ? { ip: merged.ip } : {}),
  };
}

function deleteAuthRequest(requestId) {
  const result = getDb().prepare('DELETE FROM auth_requests WHERE request_id = ?').run(requestId);
  return result.changes > 0;
}

function pruneExpiredAuthRequests() {
  const cutoff = Date.now() - config.REQUEST_ID_EXPIRY_MS;
  const result = getDb().prepare('DELETE FROM auth_requests WHERE created_at < ?').run(cutoff);
  if (result.changes > 0) {
    console.log(`Pruned ${result.changes} expired auth requests`);
  }
  return result.changes;
}

// --- Rate Limiting ---

function getEmailHash(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

function getIpHash(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function _checkRateLimit(table, keyHash, windowMs, maxRequests) {
  const now = Date.now();
  const d = getDb();

  let row = d.prepare(`SELECT * FROM ${table} WHERE key_hash = ?`).get(keyHash);

  if (row && now - row.window_start > windowMs) {
    d.prepare(`DELETE FROM ${table} WHERE key_hash = ?`).run(keyHash);
    row = null;
  }

  if (!row) {
    row = { key_hash: keyHash, count: 0, window_start: now };
  }

  if (row.count >= maxRequests) {
    const resetTime = row.window_start + windowMs;
    return { allowed: false, resetTime };
  }

  row.count++;
  d.prepare(`
    INSERT INTO ${table} (key_hash, count, window_start)
    VALUES (?, ?, ?)
    ON CONFLICT(key_hash) DO UPDATE SET count=excluded.count, window_start=excluded.window_start
  `).run(keyHash, row.count, row.window_start);

  return { allowed: true, remaining: maxRequests - row.count };
}

function _decrementRateLimit(table, keyHash) {
  const d = getDb();
  const row = d.prepare(`SELECT * FROM ${table} WHERE key_hash = ?`).get(keyHash);
  if (row && row.count > 0) {
    d.prepare(`UPDATE ${table} SET count = ? WHERE key_hash = ?`).run(row.count - 1, keyHash);
  }
}

function _pruneExpiredRateLimits(table, windowMs, label) {
  const cutoff = Date.now() - windowMs;
  const result = getDb().prepare(`DELETE FROM ${table} WHERE window_start < ?`).run(cutoff);
  if (result.changes > 0) {
    console.log(`Pruned ${result.changes} expired ${label} records`);
  }
  return result.changes;
}

function checkRateLimit(email) {
  return _checkRateLimit('email_rate_limits', getEmailHash(email), config.RATE_LIMIT_WINDOW_MS, config.RATE_LIMIT_MAX_REQUESTS);
}

function decrementRateLimit(email) {
  _decrementRateLimit('email_rate_limits', getEmailHash(email));
}

function pruneExpiredRateLimits() {
  return _pruneExpiredRateLimits('email_rate_limits', config.RATE_LIMIT_WINDOW_MS, 'rate limit');
}

function checkIpRateLimit(ip) {
  return _checkRateLimit('ip_rate_limits', getIpHash(ip), config.IP_RATE_LIMIT_WINDOW_MS, config.IP_RATE_LIMIT_MAX_REQUESTS);
}

function decrementIpRateLimit(ip) {
  _decrementRateLimit('ip_rate_limits', getIpHash(ip));
}

function pruneExpiredIpRateLimits() {
  return _pruneExpiredRateLimits('ip_rate_limits', config.IP_RATE_LIMIT_WINDOW_MS, 'IP rate limit');
}

module.exports = {
  // Grandfathered
  readGrandfatheredEmails,
  loadGrandfatheredEmails,
  isGrandfathered,

  // Auth requests
  createAuthRequest,
  getAuthRequest,
  updateAuthRequest,
  deleteAuthRequest,
  pruneExpiredAuthRequests,

  // Rate limiting (per-email)
  checkRateLimit,
  decrementRateLimit,
  pruneExpiredRateLimits,

  // Rate limiting (per-IP)
  checkIpRateLimit,
  decrementIpRateLimit,
  pruneExpiredIpRateLimits,

  // Subscription cache
  setSubscriptionStatus,
  getSubscriptionStatus,

  // Utils
  ensureDirectories,
  closeDatabase,

  // DB access for tests
  getDb,
};
