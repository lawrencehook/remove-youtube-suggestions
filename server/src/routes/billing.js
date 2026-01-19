const express = require('express');
const { requireAuth } = require('../services/jwt');
const { createBillingPortalSession } = require('../services/stripe');

const router = express.Router();

// POST /billing/portal - Create Stripe billing portal session
router.post('/portal', requireAuth, async (req, res) => {
  try {
    const session = await createBillingPortalSession(req.userEmail);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating billing portal session:', err);

    if (err.message === 'No customer found for this email') {
      return res.status(404).json({ error: 'No subscription found for this account' });
    }

    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// GET /billing/return - Return page from billing portal
router.get('/return', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Billing - Remove YouTube Suggestions</title>
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
    <h1>Billing updated</h1>
    <p>You can close this tab and return to the extension.</p>
  </div>
</body>
</html>
  `.trim());
});

module.exports = router;
