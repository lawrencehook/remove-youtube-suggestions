const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Setup must be required first
const { cleanTestData } = require('./setup');

// Mock the email service
const emailService = require('../src/services/email');
emailService.sendMagicLinkEmail = async () => ({ MessageId: 'test' });

// Mock Stripe service
const stripeService = require('../src/services/stripe');
stripeService.createCheckoutSession = async (email, plan) => ({
  url: `https://checkout.stripe.com/test?plan=${plan}&email=${email}`,
});
stripeService.createBillingPortalSession = async (email) => {
  if (email === 'nocustomer@example.com') {
    throw new Error('No customer found for this email');
  }
  return { url: 'https://billing.stripe.com/test' };
};

const { app } = require('../src/index');
const storage = require('../src/storage');
const { generateSessionToken } = require('../src/services/jwt');

describe('Checkout Routes', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
  });

  after(() => {
    cleanTestData();
  });

  describe('POST /checkout/create', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/checkout/create')
        .send({ plan: 'monthly' });

      assert.strictEqual(res.status, 401);
    });

    it('should create checkout session for monthly plan', async () => {
      const token = generateSessionToken('checkout@example.com');

      const res = await request(app)
        .post('/checkout/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'monthly' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.checkout_url);
      assert.ok(res.body.checkout_url.includes('monthly'));
    });

    it('should create checkout session for yearly plan', async () => {
      const token = generateSessionToken('checkout@example.com');

      const res = await request(app)
        .post('/checkout/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'yearly' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.checkout_url.includes('yearly'));
    });

    it('should reject invalid plan', async () => {
      const token = generateSessionToken('checkout@example.com');

      const res = await request(app)
        .post('/checkout/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'invalid' });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('Invalid plan'));
    });

    it('should reject missing plan', async () => {
      const token = generateSessionToken('checkout@example.com');

      const res = await request(app)
        .post('/checkout/create')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      assert.strictEqual(res.status, 400);
    });
  });

  describe('GET /checkout/success', () => {
    it('should return success page', async () => {
      const res = await request(app).get('/checkout/success');

      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Payment successful'));
    });
  });

  describe('GET /checkout/cancel', () => {
    it('should return cancel page', async () => {
      const res = await request(app).get('/checkout/cancel');

      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Payment canceled'));
    });
  });
});

describe('Billing Routes', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
  });

  describe('POST /billing/portal', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/billing/portal');

      assert.strictEqual(res.status, 401);
    });

    it('should return billing portal URL', async () => {
      const token = generateSessionToken('billing@example.com');

      const res = await request(app)
        .post('/billing/portal')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.url);
      assert.ok(res.body.url.includes('billing.stripe.com'));
    });

    it('should return 404 for user without subscription', async () => {
      const token = generateSessionToken('nocustomer@example.com');

      const res = await request(app)
        .post('/billing/portal')
        .set('Authorization', `Bearer ${token}`);

      assert.strictEqual(res.status, 404);
    });
  });

  describe('GET /billing/return', () => {
    it('should return billing return page', async () => {
      const res = await request(app).get('/billing/return');

      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes('Billing updated'));
    });
  });
});
