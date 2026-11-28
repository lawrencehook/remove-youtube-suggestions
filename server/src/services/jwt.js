const jwt = require('jsonwebtoken');
const config = require('../config');

function generateSessionToken(email) {
  const payload = {
    email: email.toLowerCase(),
    type: 'session',
  };

  const options = {
    expiresIn: `${config.SESSION_TOKEN_LIFETIME_DAYS}d`,
  };

  return jwt.sign(payload, config.JWT_SECRET, options);
}

function generateLicenseToken(email, premium, grandfathered = false) {
  const payload = {
    email: email.toLowerCase(),
    type: 'license',
    premium: !!premium,
    grandfathered: !!grandfathered,
  };

  const lifetimeDays = grandfathered
    ? config.GRANDFATHERED_TOKEN_LIFETIME_DAYS
    : config.LICENSE_TOKEN_LIFETIME_DAYS;

  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: `${lifetimeDays}d` });
}

function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    // Reject license tokens (both typed and legacy payloads carrying `premium`),
    // while remaining compatible with previously issued session tokens that only
    // carry `{ email }`.
    if (decoded.type !== undefined && decoded.type !== 'session') {
      return { valid: false, error: 'Invalid token type' };
    }
    if ('premium' in decoded) {
      return { valid: false, error: 'Invalid token type' };
    }
    if (!decoded.email) {
      return { valid: false, error: 'Missing email claim' };
    }
    return { valid: true, email: decoded.email };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Express middleware to require authentication
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const result = verifySessionToken(token);

  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userEmail = result.email;
  next();
}

module.exports = {
  generateSessionToken,
  generateLicenseToken,
  verifySessionToken,
  requireAuth,
};
