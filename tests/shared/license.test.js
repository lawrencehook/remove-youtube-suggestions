const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFiles, resetStorage, setStorageData, getStorageData } = require('../setup');

// Helper to create a mock JWT token
function createMockJWT(payload, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  // Note: signature is fake, but we don't verify it client-side
  return `${encode(header)}.${encode(fullPayload)}.fake-signature`;
}

describe('License', () => {
  let context;
  let fetchCalls;
  let fetchResponse;

  beforeEach(() => {
    resetStorage();
    fetchCalls = [];
    fetchResponse = { ok: true, status: 200, json: async () => ({}) };

    // Load config first, then license
    context = loadSourceFiles(['shared/config.js', 'shared/license.js'], {
      fetch: async (url, options) => {
        fetchCalls.push({ url, options });
        return fetchResponse;
      },
      Auth: {
        signOut: async () => {
          resetStorage();
        },
      },
      recordEvent: () => {}, // Mock analytics
    });
  });

  describe('_decodeToken', () => {
    it('should decode a valid JWT payload', () => {
      const token = createMockJWT({ email: 'test@example.com', premium: true });
      const decoded = context.License._decodeToken(token);

      assert.strictEqual(decoded.email, 'test@example.com');
      assert.strictEqual(decoded.premium, true);
      assert.ok(decoded.exp > 0);
    });

    it('should return null for invalid token', () => {
      assert.strictEqual(context.License._decodeToken('invalid'), null);
      assert.strictEqual(context.License._decodeToken(''), null);
      assert.strictEqual(context.License._decodeToken(null), null);
      assert.strictEqual(context.License._decodeToken(undefined), null);
    });

    it('should handle base64url encoding', () => {
      // Create token with characters that differ between base64 and base64url
      const token = createMockJWT({ email: 'test+special@example.com', data: '>>>' });
      const decoded = context.License._decodeToken(token);
      assert.strictEqual(decoded.email, 'test+special@example.com');
    });
  });

  describe('isPremium', () => {
    it('should return false when no license token exists', async () => {
      const result = await context.License.isPremium();
      assert.strictEqual(result, false);
    });

    it('should return true for valid premium token', async () => {
      const token = createMockJWT({ email: 'test@example.com', premium: true });
      setStorageData({ license_token: token });

      const result = await context.License.isPremium();
      assert.strictEqual(result, true);
    });

    it('should return false for non-premium token', async () => {
      const token = createMockJWT({ email: 'test@example.com', premium: false });
      setStorageData({ license_token: token });

      const result = await context.License.isPremium();
      assert.strictEqual(result, false);
    });

    it('should return false for expired token', async () => {
      const token = createMockJWT({ email: 'test@example.com', premium: true }, -3600); // expired 1hr ago
      setStorageData({ license_token: token });

      const result = await context.License.isPremium();
      assert.strictEqual(result, false);
    });
  });

  describe('checkLicense', () => {
    it('should return not premium when not signed in', async () => {
      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, false);
      assert.strictEqual(result.source, null);
      assert.strictEqual(fetchCalls.length, 0); // No fetch call made
    });

    it('should use cached token when valid and not expiring soon', async () => {
      const token = createMockJWT({
        email: 'test@example.com',
        premium: true,
        grandfathered: false,
      }, 3 * 24 * 3600); // 3 days from now

      setStorageData({
        session_token: 'session-token',
        license_token: token,
      });

      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, true);
      assert.strictEqual(result.cached, true);
      assert.strictEqual(fetchCalls.length, 0); // No fetch call made
    });

    it('should fetch new token when license token is expiring soon', async () => {
      const expiringToken = createMockJWT({
        email: 'test@example.com',
        premium: true,
      }, 12 * 3600); // 12 hours from now (within 24hr threshold)

      const newToken = createMockJWT({
        email: 'test@example.com',
        premium: true,
        grandfathered: false,
      }, 3 * 24 * 3600);

      setStorageData({
        session_token: 'session-token',
        license_token: expiringToken,
      });

      fetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({ license_token: newToken }),
      };

      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, true);
      assert.strictEqual(result.cached, undefined); // Not cached
      assert.strictEqual(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].url.includes('/license/check'));
    });

    it('should fetch new token when forceRefresh is true', async () => {
      const token = createMockJWT({
        email: 'test@example.com',
        premium: true,
      }, 3 * 24 * 3600);

      setStorageData({
        session_token: 'session-token',
        license_token: token,
      });

      fetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({ license_token: token }),
      };

      const result = await context.License.checkLicense(true);

      assert.strictEqual(fetchCalls.length, 1); // Force fetch even with valid token
    });

    it('should sign out on 401 response', async () => {
      setStorageData({
        session_token: 'expired-session',
        license_token: createMockJWT({ email: 'test@example.com', premium: true }, -3600),
      });

      fetchResponse = {
        ok: false,
        status: 401,
      };

      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, false);
      assert.strictEqual(result.signedOut, true);
    });

    it('should use existing valid token on network error', async () => {
      const token = createMockJWT({
        email: 'test@example.com',
        premium: true,
        grandfathered: true,
      }, 12 * 3600); // Within refresh threshold to trigger fetch

      setStorageData({
        session_token: 'session-token',
        license_token: token,
      });

      // Simulate network error
      context = loadSourceFiles(['shared/config.js', 'shared/license.js'], {
        fetch: async () => { throw new Error('Network error'); },
        Auth: { signOut: async () => {} },
        recordEvent: () => {},
      });

      // Re-set storage since we reloaded context
      setStorageData({
        session_token: 'session-token',
        license_token: token,
      });

      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, true);
      assert.strictEqual(result.offline, true);
      assert.strictEqual(result.source, 'grandfathered');
    });

    it('should return grandfathered source for grandfathered users', async () => {
      const token = createMockJWT({
        email: 'donor@example.com',
        premium: true,
        grandfathered: true,
      }, 3 * 24 * 3600);

      setStorageData({
        session_token: 'session-token',
        license_token: token,
      });

      const result = await context.License.checkLicense();

      assert.strictEqual(result.isPremium, true);
      assert.strictEqual(result.source, 'grandfathered');
    });
  });
});
