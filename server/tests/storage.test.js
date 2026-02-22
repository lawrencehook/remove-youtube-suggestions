const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Setup must be required first
const { cleanTestData, testDataDir } = require('./setup');

// Now require storage (after env vars are set)
const storage = require('../src/storage');
const config = require('../src/config');

describe('Storage', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
  });

  after(() => {
    cleanTestData();
  });

  describe('Auth Requests', () => {
    it('should create and retrieve an auth request', () => {
      const requestId = 'test-request-123';
      const email = 'test@example.com';

      const created = storage.createAuthRequest(requestId, email);

      assert.strictEqual(created.request_id, requestId);
      assert.strictEqual(created.email, email);
      assert.strictEqual(created.status, 'pending');
      assert.strictEqual(created.session_token, null);

      const retrieved = storage.getAuthRequest(requestId);

      assert.strictEqual(retrieved.request_id, requestId);
      assert.strictEqual(retrieved.email, email);
    });

    it('should update an auth request', () => {
      const requestId = 'test-request-456';
      storage.createAuthRequest(requestId, 'test@example.com');

      const updated = storage.updateAuthRequest(requestId, {
        status: 'verified',
        session_token: 'fake-token',
      });

      assert.strictEqual(updated.status, 'verified');
      assert.strictEqual(updated.session_token, 'fake-token');

      const retrieved = storage.getAuthRequest(requestId);
      assert.strictEqual(retrieved.status, 'verified');
    });

    it('should delete an auth request', () => {
      const requestId = 'test-request-789';
      storage.createAuthRequest(requestId, 'test@example.com');

      const deleted = storage.deleteAuthRequest(requestId);
      assert.strictEqual(deleted, true);

      const retrieved = storage.getAuthRequest(requestId);
      assert.strictEqual(retrieved, null);
    });

    it('should return null for non-existent request', () => {
      const retrieved = storage.getAuthRequest('non-existent');
      assert.strictEqual(retrieved, null);
    });

    it('should return null for expired request', () => {
      const requestId = 'expired-request';
      const email = 'test@example.com';

      // Create request with old timestamp
      const oldTimestamp = Date.now() - config.REQUEST_ID_EXPIRY_MS - 1000;
      const filename = `${oldTimestamp}-${requestId}.json`;
      const filePath = path.join(testDataDir, config.AUTH_REQUESTS_DIR, filename);

      fs.writeFileSync(filePath, JSON.stringify({
        request_id: requestId,
        email: email,
        status: 'pending',
        created_at: oldTimestamp,
        session_token: null,
      }));

      const retrieved = storage.getAuthRequest(requestId);
      assert.strictEqual(retrieved, null);

      // File should be deleted
      assert.strictEqual(fs.existsSync(filePath), false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under limit', () => {
      const email = 'ratelimit@example.com';

      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        const result = storage.checkRateLimit(email);
        assert.strictEqual(result.allowed, true);
      }
    });

    it('should block requests over limit', () => {
      const email = 'overlimit@example.com';

      // Use up all allowed requests
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        storage.checkRateLimit(email);
      }

      // Next should be blocked
      const result = storage.checkRateLimit(email);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.resetTime > Date.now());
    });

    it('should track remaining requests', () => {
      const email = 'remaining@example.com';

      const first = storage.checkRateLimit(email);
      assert.strictEqual(first.remaining, config.RATE_LIMIT_MAX_REQUESTS - 1);

      const second = storage.checkRateLimit(email);
      assert.strictEqual(second.remaining, config.RATE_LIMIT_MAX_REQUESTS - 2);
    });
  });

  describe('Grandfathered Emails', () => {
    it('should read grandfathered emails from file', () => {
      const grandfatheredFile = path.join(testDataDir, config.GRANDFATHERED_FILE);
      fs.writeFileSync(grandfatheredFile, 'donor1@example.com\nDonor2@Example.com\n');

      assert.strictEqual(storage.isGrandfathered('donor1@example.com'), true);
      assert.strictEqual(storage.isGrandfathered('DONOR1@EXAMPLE.COM'), true);
      assert.strictEqual(storage.isGrandfathered('donor2@example.com'), true);
      assert.strictEqual(storage.isGrandfathered('notadonor@example.com'), false);
    });

    it('should handle missing grandfathered file gracefully', () => {
      // File doesn't exist, should not throw
      assert.strictEqual(storage.isGrandfathered('anyone@example.com'), false);
    });
  });

  describe('Subscription Cache', () => {
    it('should store and retrieve subscription status', () => {
      storage.setSubscriptionStatus('sub@example.com', true, 'cus_123');

      const status = storage.getSubscriptionStatus('sub@example.com');
      assert.strictEqual(status.premium, true);
      assert.strictEqual(status.customerId, 'cus_123');
    });

    it('should return null for unknown email', () => {
      const status = storage.getSubscriptionStatus('unknown@example.com');
      assert.strictEqual(status, null);
    });

    it('should expire cache entries after 10 seconds', () => {
      storage.setSubscriptionStatus('ttl@example.com', false, null);

      // Manually backdate the entry
      const cachePath = path.join(testDataDir, 'subscriptions.json');
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      data['ttl@example.com'].updatedAt = Date.now() - 11000;
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));

      const status = storage.getSubscriptionStatus('ttl@example.com');
      assert.strictEqual(status, null);
    });

    it('should return fresh cache entries within 10 seconds', () => {
      storage.setSubscriptionStatus('fresh@example.com', false, null);

      const status = storage.getSubscriptionStatus('fresh@example.com');
      assert.strictEqual(status.premium, false);
    });
  });

  describe('Pruning', () => {
    it('should prune expired auth requests', () => {
      // Create an expired request
      const oldTimestamp = Date.now() - config.REQUEST_ID_EXPIRY_MS - 1000;
      const filename = `${oldTimestamp}-old-request.json`;
      const filePath = path.join(testDataDir, config.AUTH_REQUESTS_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify({ created_at: oldTimestamp }));

      // Create a valid request
      storage.createAuthRequest('valid-request', 'test@example.com');

      const pruned = storage.pruneExpiredAuthRequests();

      assert.strictEqual(pruned, 1);
      assert.strictEqual(fs.existsSync(filePath), false);
      assert.notStrictEqual(storage.getAuthRequest('valid-request'), null);
    });
  });
});
