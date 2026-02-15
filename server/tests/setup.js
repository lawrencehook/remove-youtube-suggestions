const fs = require('fs');
const path = require('path');

// Set up test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PRICE_MONTHLY = 'price_test_monthly';
process.env.STRIPE_PRICE_YEARLY = 'price_test_yearly';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.EMAIL_FROM = 'test@example.com';
process.env.BASE_URL = 'http://localhost:3000';
process.env.DATA_DIR = './tests/test-data';

// Clean up test data directory
const testDataDir = './tests/test-data';

function cleanTestData() {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Ignore ENOTEMPTY errors from race conditions in parallel tests
    if (err.code !== 'ENOTEMPTY' && err.code !== 'ENOENT') {
      throw err;
    }
  }
}

// Clean before tests
cleanTestData();

// Export for use in tests
module.exports = {
  cleanTestData,
  testDataDir,
};
