const jwt = require('jsonwebtoken');
const config = require('../config');

function generateSessionToken(email) {
  const payload = {
    email: email.toLowerCase(),
  };

  const options = {
    expiresIn: `${config.SESSION_TOKEN_LIFETIME_DAYS}d`,
  };

  return jwt.sign(payload, config.JWT_SECRET, options);
}

function generateLicenseToken(email, premium, grandfathered = false) {
  const payload = {
    email: email.toLowerCase(),
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
