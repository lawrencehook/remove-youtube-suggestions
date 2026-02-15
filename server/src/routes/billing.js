const express = require('express');
const { requireAuth } = require('../services/jwt');
const { createBillingPortalSession } = require('../services/stripe');
const { renderPage } = require('../templates');

const router = express.Router();

// POST /billing/portal - Create Stripe billing portal session
router.post('/portal', requireAuth, async (req, res) => {
  try {
    const session = await createBillingPortalSession(req.userEmail);
    console.log(`[billing] Portal session created for ${req.userEmail}`);
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
  res.send(renderPage({
    title: 'Billing Updated',
    heading: 'Billing updated',
    message: 'You can close this tab and return to the extension.',
    icon: 'check',
  }));
});

module.exports = router;
