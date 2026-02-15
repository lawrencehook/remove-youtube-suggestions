const express = require('express');
const { requireAuth } = require('../services/jwt');
const { createCheckoutSession, createBillingPortalSession } = require('../services/stripe');
const { renderPage } = require('../templates');

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
  res.send(renderPage({
    title: 'Payment Successful',
    heading: 'Payment successful!',
    message: 'You can close this tab and return to the extension. Your premium features are now active.',
    icon: 'check',
  }));
});

// GET /checkout/cancel - Cancel page
router.get('/cancel', (req, res) => {
  res.send(renderPage({
    title: 'Payment Canceled',
    heading: 'Payment canceled',
    message: "You can close this tab and try again from the extension whenever you're ready.",
  }));
});

module.exports = router;
