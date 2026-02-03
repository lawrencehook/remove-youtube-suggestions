const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFiles, resetStorage, setStorageData, getStorageData } = require('../setup');

describe('Auth', () => {
  let context;

  beforeEach(() => {
    resetStorage();
    // Load config first, then auth
    context = loadSourceFiles(['shared/config.js', 'shared/auth.js']);
  });

  describe('isSignedIn', () => {
    it('should return false when no session token exists', async () => {
      const result = await context.Auth.isSignedIn();
      assert.strictEqual(result, false);
    });

    it('should return true when session token exists', async () => {
      setStorageData({ session_token: 'valid-token' });
      const result = await context.Auth.isSignedIn();
      assert.strictEqual(result, true);
    });

    it('should return true even if email is missing but token exists', async () => {
      setStorageData({ session_token: 'valid-token' });
      const result = await context.Auth.isSignedIn();
      assert.strictEqual(result, true);
    });

    it('should return false for empty string token', async () => {
      setStorageData({ session_token: '' });
      const result = await context.Auth.isSignedIn();
      assert.strictEqual(result, false);
    });

    it('should return false for null token', async () => {
      setStorageData({ session_token: null });
      const result = await context.Auth.isSignedIn();
      assert.strictEqual(result, false);
    });
  });

  describe('getUserEmail', () => {
    it('should return null when no email exists', async () => {
      const result = await context.Auth.getUserEmail();
      assert.strictEqual(result, null);
    });

    it('should return email when it exists', async () => {
      setStorageData({ user_email: 'test@example.com' });
      const result = await context.Auth.getUserEmail();
      assert.strictEqual(result, 'test@example.com');
    });

    it('should return null for empty string email', async () => {
      setStorageData({ user_email: '' });
      const result = await context.Auth.getUserEmail();
      // Note: empty string is falsy, so || null returns null
      assert.strictEqual(result, null);
    });
  });

  describe('getSessionToken', () => {
    it('should return null when no token exists', async () => {
      const result = await context.Auth.getSessionToken();
      assert.strictEqual(result, null);
    });

    it('should return token when it exists', async () => {
      setStorageData({ session_token: 'my-session-token' });
      const result = await context.Auth.getSessionToken();
      assert.strictEqual(result, 'my-session-token');
    });
  });

  describe('signOut', () => {
    it('should clear all auth-related storage', async () => {
      setStorageData({
        session_token: 'token',
        license_token: 'license',
        user_email: 'test@example.com',
        other_setting: 'should-remain', // Non-auth setting
      });

      await context.Auth.signOut();

      const data = getStorageData();
      assert.strictEqual(data.session_token, undefined);
      assert.strictEqual(data.license_token, undefined);
      assert.strictEqual(data.user_email, undefined);
      // Other settings should remain
      assert.strictEqual(data.other_setting, 'should-remain');
    });

    it('should not throw when storage is already empty', async () => {
      // Should complete without error
      await context.Auth.signOut();
      const data = getStorageData();
      assert.strictEqual(Object.keys(data).length, 0);
    });
  });

  describe('sendMagicLink', () => {
    it('should call fetch with correct URL and body', async () => {
      let capturedRequest;
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async (url, options) => {
          capturedRequest = { url, options };
          return {
            ok: true,
            json: async () => ({ request_id: 'test-request-id' }),
          };
        },
      });

      const result = await contextWithFetch.Auth.sendMagicLink('test@example.com');

      assert.strictEqual(result, 'test-request-id');
      assert.ok(capturedRequest.url.includes('/auth/send-magic-link'));
      assert.strictEqual(capturedRequest.options.method, 'POST');
      assert.strictEqual(capturedRequest.options.headers['Content-Type'], 'application/json');

      const body = JSON.parse(capturedRequest.options.body);
      assert.strictEqual(body.email, 'test@example.com');
    });

    it('should throw on rate limit (429)', async () => {
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => ({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limited' }),
        }),
      });

      await assert.rejects(
        contextWithFetch.Auth.sendMagicLink('test@example.com'),
        /Rate limited|Too many requests/
      );
    });

    it('should throw on other errors', async () => {
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => ({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        }),
      });

      await assert.rejects(
        contextWithFetch.Auth.sendMagicLink('test@example.com'),
        /Server error|Failed to send/
      );
    });

    it('should handle json parse failure gracefully', async () => {
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => ({
          ok: false,
          status: 500,
          json: async () => { throw new Error('Invalid JSON'); },
        }),
      });

      await assert.rejects(
        contextWithFetch.Auth.sendMagicLink('test@example.com'),
        /Failed to send magic link/
      );
    });
  });

  describe('pollForVerification', () => {
    it('should return success when verification succeeds', async () => {
      resetStorage();
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => ({
          ok: true,
          json: async () => ({
            status: 'verified',
            session_token: 'new-token',
            email: 'verified@example.com',
          }),
        }),
      });

      const result = await contextWithFetch.Auth.pollForVerification('request-id');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.email, 'verified@example.com');

      // Should have stored the token
      const data = getStorageData();
      assert.strictEqual(data.session_token, 'new-token');
      assert.strictEqual(data.user_email, 'verified@example.com');
    });

    it('should return canceled when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await context.Auth.pollForVerification('request-id', null, {
        signal: controller.signal,
      });

      assert.strictEqual(result.canceled, true);
    });

    it('should throw on 404 (request expired)', async () => {
      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => ({
          ok: false,
          status: 404,
        }),
      });

      await assert.rejects(
        contextWithFetch.Auth.pollForVerification('expired-request'),
        /expired|Please try again/
      );
    });

    it('should call status update callback while pending', async () => {
      let pollCount = 0;
      let statusUpdates = [];

      const contextWithFetch = loadSourceFiles(['shared/config.js', 'shared/auth.js'], {
        fetch: async () => {
          pollCount++;
          if (pollCount < 3) {
            return {
              ok: true,
              json: async () => ({ status: 'pending' }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              status: 'verified',
              session_token: 'token',
              email: 'test@example.com',
            }),
          };
        },
      });

      // Override POLL_INTERVAL_MS for faster test
      contextWithFetch.PREMIUM_CONFIG.POLL_INTERVAL_MS = 10;

      await contextWithFetch.Auth.pollForVerification('request-id', (status) => {
        statusUpdates.push(status);
      });

      assert.ok(statusUpdates.length >= 1, 'Should have called status update');
      assert.strictEqual(statusUpdates[0].status, 'pending');
    });
  });
});
