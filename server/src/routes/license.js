const express = require('express');
const { requireAuth, generateLicenseToken } = require('../services/jwt');
const { checkPremiumStatus } = require('../services/stripe');
const storage = require('../storage');

const router = express.Router();

// GET /license/check
router.get('/check', requireAuth, async (req, res) => {
  try {
    const email = req.userEmail;

    // First check if user is grandfathered (past donor)
    const isGrandfathered = storage.isGrandfathered(email);
    if (isGrandfathered) {
      console.log(`[license] ${email} -> premium (grandfathered)`);
      const licenseToken = generateLicenseToken(email, true, true);
      return res.json({ license_token: licenseToken });
    }

    // Check Stripe for active subscription
    const status = await checkPremiumStatus(email);

    console.log(`[license] ${email} -> ${status.premium ? 'premium' : 'free'}`);
    const licenseToken = generateLicenseToken(email, status.premium, false);
    res.json({ license_token: licenseToken });
  } catch (err) {
    console.error('Error checking license:', err);
    res.status(500).json({ error: 'Failed to check license status' });
  }
});

module.exports = router;
