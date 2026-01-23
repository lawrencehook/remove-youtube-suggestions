const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const storage = require('../storage');
const { sendMagicLinkEmail } = require('../services/email');
const { generateSessionToken } = require('../services/jwt');

const router = express.Router();

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
      await sendMagicLinkEmail(email, magicLinkUrl);
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
    console.log(`[auth] Email verified: ${authRequest.email}`);
  }

  res.send(renderSuccessPage());
});

// GET /auth/poll - Extension polls this to check verification status
router.get('/poll', async (req, res) => {
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

// HTML templates
function renderSuccessPage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed In - Remove YouTube Suggestions</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .checkmark {
      width: 64px;
      height: 64px;
      background: #4CAF50;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 20px;
    }
    .checkmark svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    h1 {
      color: #333;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #666;
      margin: 0;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1>You're signed in!</h1>
    <p>You can close this tab and return to the extension.</p>
  </div>
</body>
</html>
  `.trim();
}

function renderErrorPage(message) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Remove YouTube Suggestions</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      background: #f44336;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto 20px;
    }
    .error-icon svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    h1 {
      color: #333;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #666;
      margin: 0;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </div>
    <h1>Something went wrong</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>
  `.trim();
}

module.exports = router;
