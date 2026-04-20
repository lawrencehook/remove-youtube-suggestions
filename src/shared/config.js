// Premium server configuration
const PREMIUM_CONFIG = {
  // Server URL - update for production
  SERVER_URL: 'https://server.lawrencehook.com/rys',

  // Polling configuration
  POLL_INTERVAL_MS: 2000,
  POLL_TIMEOUT_MS: 16 * 60 * 1000, // 16 minutes

  // License token refresh threshold (refresh if expiring within this window)
  LICENSE_REFRESH_THRESHOLD_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Number of premium features a signed-in non-premium user can activate for free
  FREE_PREMIUM_SLOTS: 2,

  // Storage keys
  STORAGE_KEYS: {
    SESSION_TOKEN: 'session_token',
    LICENSE_TOKEN: 'license_token',
    USER_EMAIL: 'user_email',
  },
};

// Tier enum for License.getTierSync() and the html[tier] attribute.
const TIER = Object.freeze({
  PREMIUM: 'premium',
  FREE_SIGNED_IN: 'free_signed_in',
  FREE: 'free',
});
