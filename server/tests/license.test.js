const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Setup must be required first
const { cleanTestData, testDataDir } = require('./setup');

// Mock the email service
const emailService = require('../src/services/email');
emailService.sendMagicLinkEmail = async () => ({ MessageId: 'test' });

// Mock Stripe service
const stripeService = require('../src/services/stripe');
let mockPremiumStatus = { premium: false, expiresAt: null };
stripeService.checkPremiumStatus = async () => mockPremiumStatus;

const { app } = require('../src/index');
const storage = require('../src/storage');
const config = require('../src/config');
const { generateSessionToken } = require('../src/services/jwt');
const jwt = require('jsonwebtoken');

// Helper to decode license token from response
function decodeLicenseToken(response) {
  const token = response.body.license_token;
  if (!token) return null;
  return jwt.verify(token, config.JWT_SECRET);
}

describe('License Routes', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
    mockPremiumStatus = { premium: false, expiresAt: null };
  });

  after(() => {
    cleanTestData();
  });

  describe('GET /license/check', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/license/check');

      assert.strictEqual(res.status, 401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/license/check')
        .set('Authorization', 'Bearer invalid-token');

      assert.strictEqual(res.status, 401);
    });

    it('should return license token with non-premium for user without subscription', async () => {
      const token = generateSessionToken('free@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.license_token);

      const decoded = decodeLicenseToken(res);
      assert.strictEqual(decoded.premium, false);
      assert.strictEqual(decoded.grandfathered, false);
      assert.strictEqual(decoded.email, 'free@example.com');
    });

    it('should return license token with premium for user with active subscription', async () => {
      mockPremiumStatus = {
        premium: true,
        expiresAt: '2025-12-31T00:00:00Z',
      };

      const token = generateSessionToken('premium@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.license_token);

      const decoded = decodeLicenseToken(res);
      assert.strictEqual(decoded.premium, true);
      assert.strictEqual(decoded.grandfathered, false);
      assert.strictEqual(decoded.email, 'premium@example.com');
    });

    it('should return license token with premium and grandfathered for grandfathered user', async () => {
      // Set up grandfathered file
      const grandfatheredFile = path.join(testDataDir, config.GRANDFATHERED_FILE);
      fs.writeFileSync(grandfatheredFile, 'donor@example.com\n');


      const token = generateSessionToken('donor@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.license_token);

      const decoded = decodeLicenseToken(res);
      assert.strictEqual(decoded.premium, true);
      assert.strictEqual(decoded.grandfathered, true);
      assert.strictEqual(decoded.email, 'donor@example.com');
    });

    it('should handle grandfathered check case-insensitively', async () => {
      const grandfatheredFile = path.join(testDataDir, config.GRANDFATHERED_FILE);
      fs.writeFileSync(grandfatheredFile, 'Donor@Example.com\n');


      // Token with lowercase email
      const token = generateSessionToken('donor@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      const decoded = decodeLicenseToken(res);
      assert.strictEqual(decoded.premium, true);
      assert.strictEqual(decoded.grandfathered, true);
    });
  });
});
