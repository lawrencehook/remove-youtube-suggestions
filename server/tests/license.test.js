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

    it('should return non-premium for user without subscription', async () => {
      const token = generateSessionToken('free@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.premium, false);
      assert.strictEqual(res.body.expires_at, null);
    });

    it('should return premium for user with active subscription', async () => {
      mockPremiumStatus = {
        premium: true,
        expiresAt: '2025-12-31T00:00:00Z',
      };

      const token = generateSessionToken('premium@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.premium, true);
      assert.strictEqual(res.body.expires_at, '2025-12-31T00:00:00Z');
    });

    it('should return premium for grandfathered user', async () => {
      // Set up grandfathered file
      const grandfatheredFile = path.join(testDataDir, config.GRANDFATHERED_FILE);
      fs.writeFileSync(grandfatheredFile, JSON.stringify(['donor@example.com']));
      storage.loadGrandfatheredEmails();

      const token = generateSessionToken('donor@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.premium, true);
      assert.strictEqual(res.body.grandfathered, true);
      assert.strictEqual(res.body.expires_at, null); // Lifetime
    });

    it('should handle grandfathered check case-insensitively', async () => {
      const grandfatheredFile = path.join(testDataDir, config.GRANDFATHERED_FILE);
      fs.writeFileSync(grandfatheredFile, JSON.stringify(['Donor@Example.com']));
      storage.loadGrandfatheredEmails();

      // Token with lowercase email
      const token = generateSessionToken('donor@example.com');

      const res = await request(app)
        .get('/license/check')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.body.premium, true);
      assert.strictEqual(res.body.grandfathered, true);
    });
  });
});
