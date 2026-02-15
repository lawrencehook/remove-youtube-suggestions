require('dotenv').config();

// Add timestamps to all console output
const originalLog = console.log;
const originalError = console.error;
const timestamp = () => new Date().toISOString();
console.log = (...args) => originalLog(timestamp(), ...args);
console.error = (...args) => originalError(timestamp(), ...args);

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const storage = require('./storage');

// Route imports
const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/license');
const checkoutRoutes = require('./routes/checkout');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhook');

const app = express();

function isAllowedOrigin(origin) {
  // Allow requests with no origin (like mobile apps or curl)
  if (!origin) return true;

  // Allow Chrome and Firefox extension origins
  if (origin.startsWith('chrome-extension://') ||
      origin.startsWith('moz-extension://')) {
    return true;
  }

  // Allow same-origin requests (for testing)
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch (err) {
    return false;
  }
}

// CORS configuration for extension origins
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Stripe webhook needs raw body - must be before express.json()
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json());

// Request logging
app.use(morgan(':method :url :status :response-time ms', {
  stream: { write: msg => console.log(msg.trimEnd()) },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/license', licenseRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/billing', billingRoutes);
app.use('/webhook', webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS origin denied' });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Periodic cleanup of expired data (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function runCleanup() {
  try {
    storage.pruneExpiredAuthRequests();
    storage.pruneExpiredRateLimits();
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

// Start server
function start() {
  // Validate required config
  const required = [
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_YEARLY',
    'EMAIL_FROM',
  ];
  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('See .env.example for required configuration');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (config.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  // Ensure data directories exist
  storage.ensureDirectories();

  // Start cleanup interval
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  // Start listening
  const grandfathered = storage.readGrandfatheredEmails();
  console.log(`Loaded ${grandfathered.size} grandfathered emails`);

  app.listen(config.PORT, () => {
    console.log(`RYS Premium Server running on port ${config.PORT}`);
    console.log(`Base URL: ${config.BASE_URL}`);
  });
}

// Export for testing
module.exports = { app, start };

// Start server if run directly
if (require.main === module) {
  start();
}
