const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Setup must be required first
const { cleanTestData } = require('./setup');

// Mock email service
const emailService = require('../src/services/email');
emailService.sendMagicLinkEmail = async () => ({ MessageId: 'test' });

const { app } = require('../src/index');
const storage = require('../src/storage');

describe('Health Check', () => {
  beforeEach(() => {
    cleanTestData();
    storage.ensureDirectories();
  });

  after(() => {
    cleanTestData();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.ok(res.body.timestamp);
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown-route');

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Not found');
    });
  });
});
