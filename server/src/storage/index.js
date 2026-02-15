const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// Get paths dynamically to support test environment changes
function getDataDir() {
  return config.DATA_DIR;
}

function getAuthRequestsDir() {
  return path.join(getDataDir(), config.AUTH_REQUESTS_DIR);
}

function getRateLimitsDir() {
  return path.join(getDataDir(), config.RATE_LIMITS_DIR);
}

function ensureDirectories() {
  const dirs = [getDataDir(), getAuthRequestsDir(), getRateLimitsDir()];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Initialize on load
ensureDirectories();

// --- Grandfathered Emails (file-backed, no in-memory cache) ---

function readGrandfatheredEmails() {
  try {
    const filePath = path.join(getDataDir(), config.GRANDFATHERED_FILE);
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      return new Set(lines.map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#')));
    }
  } catch (err) {
    console.error('Failed to read grandfathered emails:', err.message);
  }
  return new Set();
}

function isGrandfathered(email) {
  return readGrandfatheredEmails().has(email.toLowerCase());
}

// --- Subscription Cache (email -> premium status, file-backed, no in-memory cache) ---

function getSubscriptionCachePath() {
  return path.join(getDataDir(), 'subscriptions.json');
}

function readSubscriptionFile() {
  try {
    const filePath = getSubscriptionCachePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read subscription cache:', err.message);
  }
  return {};
}

function setSubscriptionStatus(email, premium, customerId) {
  email = email.toLowerCase();
  const data = readSubscriptionFile();
  data[email] = { premium, customerId, updatedAt: Date.now() };
  try {
    fs.writeFileSync(getSubscriptionCachePath(), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save subscription cache:', err.message);
  }
}

function getSubscriptionStatus(email) {
  const data = readSubscriptionFile();
  return data[email.toLowerCase()] || null;
}


// --- Auth Requests (file per request) ---

function getAuthRequestFilename(requestId, timestamp) {
  return `${timestamp}-${requestId}.json`;
}

function parseAuthRequestFilename(filename) {
  const match = filename.match(/^(\d+)-(.+)\.json$/);
  if (!match) return null;
  return { timestamp: parseInt(match[1], 10), requestId: match[2] };
}

function createAuthRequest(requestId, email) {
  ensureDirectories(); // Ensure directory exists before write
  const timestamp = Date.now();
  const data = {
    request_id: requestId,
    email: email,
    status: 'pending',
    created_at: timestamp,
    session_token: null,
  };
  const filename = getAuthRequestFilename(requestId, timestamp);
  const filePath = path.join(getAuthRequestsDir(), filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

function findAuthRequestFile(requestId) {
  const dir = getAuthRequestsDir();
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const parsed = parseAuthRequestFilename(file);
    if (parsed && parsed.requestId === requestId) {
      return path.join(dir, file);
    }
  }
  return null;
}

function getAuthRequest(requestId) {
  const filePath = findAuthRequestFile(requestId);
  if (!filePath) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check if expired
    if (Date.now() - data.created_at > config.REQUEST_ID_EXPIRY_MS) {
      // Clean up expired request
      fs.unlinkSync(filePath);
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}

function updateAuthRequest(requestId, updates) {
  const filePath = findAuthRequestFile(requestId);
  if (!filePath) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const updated = { ...data, ...updates };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    return updated;
  } catch (err) {
    return null;
  }
}

function deleteAuthRequest(requestId) {
  const filePath = findAuthRequestFile(requestId);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function pruneExpiredAuthRequests() {
  const now = Date.now();
  const dir = getAuthRequestsDir();
  const files = fs.readdirSync(dir);
  let pruned = 0;

  for (const file of files) {
    const parsed = parseAuthRequestFilename(file);
    if (parsed && now - parsed.timestamp > config.REQUEST_ID_EXPIRY_MS) {
      fs.unlinkSync(path.join(dir, file));
      pruned++;
    }
  }

  if (pruned > 0) {
    console.log(`Pruned ${pruned} expired auth requests`);
  }
  return pruned;
}

// --- Rate Limiting (file per email hash) ---

function getEmailHash(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

function getRateLimitFilePath(email) {
  return path.join(getRateLimitsDir(), `${getEmailHash(email)}.json`);
}

function checkRateLimit(email) {
  ensureDirectories(); // Ensure directory exists before write
  const filePath = getRateLimitFilePath(email);
  const now = Date.now();

  let data = { count: 0, windowStart: now };

  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Reset if window expired
      if (now - data.windowStart > config.RATE_LIMIT_WINDOW_MS) {
        data = { count: 0, windowStart: now };
      }
    }
  } catch (err) {
    // Start fresh on error
    data = { count: 0, windowStart: now };
  }

  // Check if over limit
  if (data.count >= config.RATE_LIMIT_MAX_REQUESTS) {
    const resetTime = data.windowStart + config.RATE_LIMIT_WINDOW_MS;
    return { allowed: false, resetTime };
  }

  // Increment and save
  data.count++;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return { allowed: true, remaining: config.RATE_LIMIT_MAX_REQUESTS - data.count };
}

function decrementRateLimit(email) {
  const filePath = getRateLimitFilePath(email);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.count > 0) {
        data.count--;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
  } catch (err) {
    // Ignore errors
  }
}

function pruneExpiredRateLimits() {
  const now = Date.now();
  const dir = getRateLimitsDir();
  const files = fs.readdirSync(dir);
  let pruned = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (now - data.windowStart > config.RATE_LIMIT_WINDOW_MS) {
        fs.unlinkSync(filePath);
        pruned++;
      }
    } catch (err) {
      // Remove invalid files
      fs.unlinkSync(filePath);
      pruned++;
    }
  }

  if (pruned > 0) {
    console.log(`Pruned ${pruned} expired rate limit records`);
  }
  return pruned;
}

module.exports = {
  // Grandfathered
  readGrandfatheredEmails,
  isGrandfathered,

  // Auth requests
  createAuthRequest,
  getAuthRequest,
  updateAuthRequest,
  deleteAuthRequest,
  pruneExpiredAuthRequests,

  // Rate limiting
  checkRateLimit,
  decrementRateLimit,
  pruneExpiredRateLimits,

  // Subscription cache
  setSubscriptionStatus,
  getSubscriptionStatus,

  // Utils
  ensureDirectories,
};
