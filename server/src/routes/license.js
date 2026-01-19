const express = require('express');
const { requireAuth } = require('../services/jwt');
const { checkPremiumStatus } = require('../services/stripe');
const storage = require('../storage');

const router = express.Router();

// GET /license/check
router.get('/check', requireAuth, async (req, res) => {
  try {
    const email = req.userEmail;

    // First check if user is grandfathered (past donor)
    if (storage.isGrandfathered(email)) {
      return res.json({
        premium: true,
        expires_at: null, // Lifetime access
        grandfathered: true,
      });
    }

    // Check Stripe for active subscription
    const status = await checkPremiumStatus(email);

    res.json({
      premium: status.premium,
      expires_at: status.expiresAt,
    });
  } catch (err) {
    console.error('Error checking license:', err);
    res.status(500).json({ error: 'Failed to check license status' });
  }
});

module.exports = router;
