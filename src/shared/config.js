// Premium server configuration
const PREMIUM_CONFIG = {
  // Server URL - update for production
  SERVER_URL: 'https://rys.lawrencehook.com',

  // Polling configuration
  POLL_INTERVAL_MS: 2000,
  POLL_TIMEOUT_MS: 16 * 60 * 1000, // 16 minutes

  // License check configuration
  LICENSE_CHECK_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
  OFFLINE_GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Storage keys
  STORAGE_KEYS: {
    SESSION_TOKEN: 'session_token',
    USER_EMAIL: 'user_email',
    IS_PREMIUM: 'is_premium',
    PREMIUM_SOURCE: 'premium_source',
    LAST_LICENSE_CHECK: 'last_license_check',
  },
};
