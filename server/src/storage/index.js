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

// --- Grandfathered Emails (cached in memory) ---

let grandfatheredEmails = new Set();

function loadGrandfatheredEmails() {
  const filePath = path.join(getDataDir(), config.GRANDFATHERED_FILE);
  grandfatheredEmails = new Set();
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(data)) {
        throw new Error('Grandfathered file must be a JSON array');
      }
      data.forEach(email => {
        if (typeof email === 'string') {
          grandfatheredEmails.add(email.toLowerCase());
        }
      });
      console.log(`Loaded ${grandfatheredEmails.size} grandfathered emails`);
    }
  } catch (err) {
    console.error('Failed to load grandfathered emails:', err.message);
  }
}

function isGrandfathered(email) {
  return grandfatheredEmails.has(email.toLowerCase());
}

// Load on startup
loadGrandfatheredEmails();

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
  isGrandfathered,
  loadGrandfatheredEmails,

  // Auth requests
  createAuthRequest,
  getAuthRequest,
  updateAuthRequest,
  deleteAuthRequest,
  pruneExpiredAuthRequests,

  // Rate limiting
  checkRateLimit,
  pruneExpiredRateLimits,

  // Utils
  ensureDirectories,
};
