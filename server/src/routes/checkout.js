const express = require('express');
const { requireAuth } = require('../services/jwt');
const { createCheckoutSession, createBillingPortalSession } = require('../services/stripe');

const router = express.Router();

// POST /checkout/create
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "monthly" or "yearly"' });
    }

    const session = await createCheckoutSession(req.userEmail, plan);

    console.log(`[checkout] Session created for ${req.userEmail}, plan: ${plan}`);
    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /checkout/success - Success page after payment
router.get('/success', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - Remove YouTube Suggestions</title>
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
    <h1>Payment successful!</h1>
    <p>You can close this tab and return to the extension. Your premium features are now active.</p>
  </div>
</body>
</html>
  `.trim());
});

// GET /checkout/cancel - Cancel page
router.get('/cancel', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Canceled - Remove YouTube Suggestions</title>
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
    <h1>Payment canceled</h1>
    <p>You can close this tab and try again from the extension whenever you're ready.</p>
  </div>
</body>
</html>
  `.trim());
});

module.exports = router;
