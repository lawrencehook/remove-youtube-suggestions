const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFiles, resetStorage, setStorageData } = require('../setup');

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
  return `${encode(header)}.${encode(fullPayload)}.fake-signature`;
}

describe('License Billing Methods', () => {
  let context;
  let fetchCalls;
  let fetchResponse;

  beforeEach(() => {
    resetStorage();
    fetchCalls = [];
    fetchResponse = { ok: true, status: 200, json: async () => ({}) };

    context = loadSourceFiles(['shared/config.js', 'shared/auth.js', 'shared/license.js'], {
      fetch: async (url, options) => {
        fetchCalls.push({ url, options });
        return fetchResponse;
      },
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw when not signed in', async () => {
      await assert.rejects(
        context.License.createCheckoutSession('monthly'),
        /Not signed in/
      );
    });

    it('should call checkout endpoint with correct parameters', async () => {
      setStorageData({ session_token: 'valid-session' });
      fetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({ checkout_url: 'https://checkout.stripe.com/test' }),
      };

      const result = await context.License.createCheckoutSession('monthly');

      assert.strictEqual(result, 'https://checkout.stripe.com/test');
      assert.strictEqual(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].url.includes('/checkout/create'));
      assert.strictEqual(fetchCalls[0].options.method, 'POST');
      assert.strictEqual(fetchCalls[0].options.headers['Content-Type'], 'application/json');
      assert.ok(fetchCalls[0].options.headers['Authorization'].includes('Bearer valid-session'));

      const body = JSON.parse(fetchCalls[0].options.body);
      assert.strictEqual(body.plan, 'monthly');
    });

    it('should throw and sign out on 401', async () => {
      setStorageData({ session_token: 'expired-session' });
      fetchResponse = { ok: false, status: 401 };

      await assert.rejects(
        context.License.createCheckoutSession('yearly'),
        /Session expired/
      );
    });

    it('should throw on server error with message', async () => {
      setStorageData({ session_token: 'valid-session' });
      fetchResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Payment provider unavailable' }),
      };

      await assert.rejects(
        context.License.createCheckoutSession('monthly'),
        /Payment provider unavailable/
      );
    });

    it('should throw generic error when response has no error message', async () => {
      setStorageData({ session_token: 'valid-session' });
      fetchResponse = {
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); },
      };

      await assert.rejects(
        context.License.createCheckoutSession('monthly'),
        /Failed to create checkout session/
      );
    });
  });

  describe('createBillingPortalSession', () => {
    it('should throw when not signed in', async () => {
      await assert.rejects(
        context.License.createBillingPortalSession(),
        /Not signed in/
      );
    });

    it('should call billing portal endpoint correctly', async () => {
      setStorageData({ session_token: 'valid-session' });
      fetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://billing.stripe.com/portal' }),
      };

      const result = await context.License.createBillingPortalSession();

      assert.strictEqual(result, 'https://billing.stripe.com/portal');
      assert.strictEqual(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].url.includes('/billing/portal'));
      assert.strictEqual(fetchCalls[0].options.method, 'POST');
      assert.ok(fetchCalls[0].options.headers['Authorization'].includes('Bearer valid-session'));
    });

    it('should throw and sign out on 401', async () => {
      setStorageData({ session_token: 'expired-session' });
      fetchResponse = { ok: false, status: 401 };

      await assert.rejects(
        context.License.createBillingPortalSession(),
        /Session expired/
      );
    });

    it('should throw on server error', async () => {
      setStorageData({ session_token: 'valid-session' });
      fetchResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Customer not found' }),
      };

      await assert.rejects(
        context.License.createBillingPortalSession(),
        /Customer not found/
      );
    });
  });
});
