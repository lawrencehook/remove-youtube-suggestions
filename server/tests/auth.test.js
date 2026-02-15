const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Setup must be required first
const { cleanTestData } = require('./setup');

// Mock the email service before requiring app
const emailService = require('../src/services/email');
let lastSentEmail = null;
emailService.sendMagicLinkEmail = async (email, url) => {
  lastSentEmail = { email, url };
  return { MessageId: 'test-message-id' };
};

// Mock Stripe service
const stripeService = require('../src/services/stripe');
stripeService.checkPremiumStatus = async () => ({ premium: false, expiresAt: null });

const { app } = require('../src/index');
const storage = require('../src/storage');

describe('Auth Routes', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
    lastSentEmail = null;
  });

  after(() => {
    cleanTestData();
  });

  describe('POST /auth/send-magic-link', () => {
    it('should send magic link for valid email', async () => {
      const res = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'test@example.com' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.request_id);
      assert.strictEqual(lastSentEmail.email, 'test@example.com');
      assert.ok(lastSentEmail.url.includes(res.body.request_id));
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'not-an-email' });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('Invalid email'));
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/send-magic-link')
        .send({});

      assert.strictEqual(res.status, 400);
    });

    it('should rate limit after too many requests', async () => {
      const email = 'ratelimit@example.com';

      // Make max allowed requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/send-magic-link')
          .send({ email });
      }

      // Next should be rate limited
      const res = await request(app)
        .post('/auth/send-magic-link')
        .send({ email });

      assert.strictEqual(res.status, 429);
      assert.ok(res.headers['retry-after']);
    });
  });

  describe('GET /auth/verify', () => {
    it('should verify valid magic link and show success page', async () => {
      // Create auth request first
      const sendRes = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'verify@example.com' });

      const requestId = sendRes.body.request_id;

      const res = await request(app)
        .get(`/auth/verify?token=${requestId}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes("You're signed in"));

      // Auth request should now be verified
      const authRequest = storage.getAuthRequest(requestId);
      assert.strictEqual(authRequest.status, 'verified');
      assert.ok(authRequest.session_token);
    });

    it('should reject missing token', async () => {
      const res = await request(app).get('/auth/verify');

      assert.strictEqual(res.status, 400);
      assert.ok(res.text.includes('Missing token'));
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/auth/verify?token=invalid-token');

      assert.strictEqual(res.status, 404);
      assert.ok(res.text.includes('expired or invalid'));
    });
  });

  describe('GET /auth/poll', () => {
    it('should return pending for unverified request', async () => {
      const sendRes = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'poll@example.com' });

      const requestId = sendRes.body.request_id;

      const res = await request(app)
        .get(`/auth/poll?request_id=${requestId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'pending');
    });

    it('should return verified with token after magic link clicked', async () => {
      // Create and verify request
      const sendRes = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'poll2@example.com' });

      const requestId = sendRes.body.request_id;

      // Click magic link
      await request(app).get(`/auth/verify?token=${requestId}`);

      // Poll should return verified
      const res = await request(app)
        .get(`/auth/poll?request_id=${requestId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'verified');
      assert.ok(res.body.session_token);
      assert.strictEqual(res.body.email, 'poll2@example.com');
    });

    it('should delete auth request after returning verified', async () => {
      const sendRes = await request(app)
        .post('/auth/send-magic-link')
        .send({ email: 'poll3@example.com' });

      const requestId = sendRes.body.request_id;

      await request(app).get(`/auth/verify?token=${requestId}`);
      await request(app).get(`/auth/poll?request_id=${requestId}`);

      // Second poll should return 404
      const res = await request(app)
        .get(`/auth/poll?request_id=${requestId}`);

      assert.strictEqual(res.status, 404);
    });

    it('should reject invalid request_id', async () => {
      const res = await request(app)
        .get('/auth/poll?request_id=invalid');

      assert.strictEqual(res.status, 404);
    });
  });
});
