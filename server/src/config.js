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

  // Stripe
  get STRIPE_SECRET_KEY() { return process.env.STRIPE_SECRET_KEY; },
  get STRIPE_PRICE_MONTHLY() { return process.env.STRIPE_PRICE_MONTHLY; },
  get STRIPE_PRICE_YEARLY() { return process.env.STRIPE_PRICE_YEARLY; },
  get STRIPE_WEBHOOK_SECRET() { return process.env.STRIPE_WEBHOOK_SECRET; },

  // AWS SES
  get AWS_REGION() { return process.env.AWS_REGION || 'us-east-1'; },
  get EMAIL_FROM() { return process.env.EMAIL_FROM; },

  // File paths
  get DATA_DIR() { return process.env.DATA_DIR || './data'; },
  AUTH_REQUESTS_DIR: 'auth-requests',
  RATE_LIMITS_DIR: 'rate-limits',
  GRANDFATHERED_FILE: 'grandfathered.txt',
};
