const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const storage = require('../storage');
const { sendMagicLinkEmail } = require('../services/email');
const { generateSessionToken } = require('../services/jwt');
const { checkPremiumStatus } = require('../services/stripe');
const { renderPage } = require('../templates');

const router = express.Router();

// Simple in-memory rate limiter for poll endpoint (by IP)
const pollRateLimits = new Map();
const POLL_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const POLL_RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function checkPollRateLimit(ip) {
  const now = Date.now();
  const record = pollRateLimits.get(ip);

  if (!record || now > record.resetTime) {
    pollRateLimits.set(ip, { count: 1, resetTime: now + POLL_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= POLL_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count++;
  return { allowed: true };
}

// Clean up old entries periodically (unref so it doesn't prevent process exit)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of pollRateLimits) {
    if (now > record.resetTime) {
      pollRateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
cleanupInterval.unref();

// Simple email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// POST /auth/send-magic-link
router.post('/send-magic-link', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check rate limit
    const rateLimit = storage.checkRateLimit(email);
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter,
      });
    }

    // Generate request ID and create auth request
    const requestId = uuidv4();
    storage.createAuthRequest(requestId, email);

    // Send magic link email
    const magicLinkUrl = `${config.BASE_URL}/auth/verify?token=${requestId}`;
    try {
      const status = await checkPremiumStatus(email);
      await sendMagicLinkEmail(email, magicLinkUrl, { isPremium: status.premium });
    } catch (err) {
      storage.deleteAuthRequest(requestId);
      throw err;
    }

    console.log(`[auth] Magic link sent to ${email}`);
    res.json({ request_id: requestId });
  } catch (err) {
    console.error('Error sending magic link:', err);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// GET /auth/verify - Magic link target (returns HTML)
router.get('/verify', async (req, res) => {
  const { token: requestId } = req.query;

  if (!requestId) {
    return res.status(400).send(renderErrorPage('Missing token'));
  }

  const authRequest = storage.getAuthRequest(requestId);

  if (!authRequest) {
    return res.status(404).send(renderErrorPage('Link expired or invalid. Please request a new sign-in link.'));
  }

  // Check if magic link itself is expired (stricter than request expiry)
  if (Date.now() - authRequest.created_at > config.MAGIC_LINK_EXPIRY_MS) {
    storage.deleteAuthRequest(requestId);
    return res.status(410).send(renderErrorPage('Link expired. Please request a new sign-in link.'));
  }

  if (authRequest.status === 'pending') {
    // Generate session token and mark as verified
    const sessionToken = generateSessionToken(authRequest.email);
    storage.updateAuthRequest(requestId, {
      status: 'verified',
      session_token: sessionToken,
    });
    storage.decrementRateLimit(authRequest.email);
    console.log(`[auth] Email verified: ${authRequest.email}`);
  }

  res.send(renderSuccessPage());
});

// GET /auth/poll - Extension polls this to check verification status
router.get('/poll', async (req, res) => {
  // Rate limit by IP
  const ip = req.ip || req.connection.remoteAddress;
  const rateLimit = checkPollRateLimit(ip);
  if (!rateLimit.allowed) {
    res.set('Retry-After', rateLimit.retryAfter);
    return res.status(429).json({ error: 'Too many requests', retryAfter: rateLimit.retryAfter });
  }

  const { request_id: requestId } = req.query;

  if (!requestId) {
    return res.status(400).json({ error: 'Missing request_id' });
  }

  const authRequest = storage.getAuthRequest(requestId);

  if (!authRequest) {
    return res.status(404).json({ error: 'Unknown or expired request_id' });
  }

  if (authRequest.status === 'pending') {
    return res.json({ status: 'pending' });
  }

  if (authRequest.status === 'verified') {
    // Return token and delete the request
    const response = {
      status: 'verified',
      session_token: authRequest.session_token,
      email: authRequest.email,
    };

    res.once('finish', () => {
      storage.deleteAuthRequest(requestId);
    });

    return res.json(response);
  }

  // Unknown status
  res.status(500).json({ error: 'Unknown auth request status' });
});

// HTML utilities
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function renderSuccessPage() {
  return renderPage({
    title: 'Signed In',
    heading: "You're signed in!",
    message: 'You can close this tab and return to the extension.',
    icon: 'check',
  });
}

function renderErrorPage(message) {
  return renderPage({
    title: 'Error',
    heading: 'Something went wrong',
    message: escapeHtml(message),
    icon: 'error',
  });
}

module.exports = router;
