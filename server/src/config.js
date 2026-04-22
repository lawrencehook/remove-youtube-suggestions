// Configuration constants
// All timing values in milliseconds unless noted

// Use getters for values that may change in tests
module.exports = {
  // Server
  get PORT() { return process.env.PORT || 3000; },
  get BASE_URL() { return process.env.BASE_URL || 'http://localhost:3000'; },

  // JWT
  get JWT_SECRET() { return process.env.JWT_SECRET; },
  SESSION_TOKEN_LIFETIME_DAYS: 30,
  LICENSE_TOKEN_LIFETIME_DAYS: 3,
  GRANDFATHERED_TOKEN_LIFETIME_DAYS: 730, // 2 years

  // Timing
  MAGIC_LINK_EXPIRY_MS: 15 * 60 * 1000,        // 15 minutes
  REQUEST_ID_EXPIRY_MS: 20 * 60 * 1000,        // 20 minutes
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,        // 1 hour
  RATE_LIMIT_MAX_REQUESTS: 5,                   // per email per window
  IP_RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,     // 1 hour
  IP_RATE_LIMIT_MAX_REQUESTS: 5,                // per IP per window

  // Stripe
  get STRIPE_SECRET_KEY() { return process.env.STRIPE_SECRET_KEY; },
  get STRIPE_PRICE_MONTHLY() { return process.env.STRIPE_PRICE_MONTHLY; },
  get STRIPE_PRICE_YEARLY() { return process.env.STRIPE_PRICE_YEARLY; },
  get STRIPE_WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET; },
  // Comma-separated list of Stripe product IDs this server is allowed to act on.
  // Webhook events whose products are not in this list are ignored. Guards against
  // cross-product event bleed when multiple apps share a Stripe account.
  get STRIPE_ALLOWED_PRODUCT_IDS() {
    return (process.env.STRIPE_ALLOWED_PRODUCT_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  },

  // AWS SES
  get AWS_REGION() { return process.env.AWS_REGION || 'us-east-1'; },
  get EMAIL_FROM() { return process.env.EMAIL_FROM; },

  // File paths
  get DATA_DIR() { return process.env.DATA_DIR || './data'; },
  GRANDFATHERED_FILE: 'grandfathered.txt',
};
