const { describe, it } = require('node:test');
const assert = require('node:assert');

// Setup must be required first
require('./setup');

const { generateSessionToken, generateLicenseToken, verifySessionToken } = require('../src/services/jwt');

describe('JWT Service', () => {
  describe('generateSessionToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateSessionToken('test@example.com');

      assert.ok(token);
      assert.strictEqual(typeof token, 'string');
      assert.ok(token.split('.').length === 3); // JWT format
    });

    it('should lowercase email in token', () => {
      const token = generateSessionToken('Test@EXAMPLE.com');
      const result = verifySessionToken(token);

      assert.strictEqual(result.email, 'test@example.com');
    });
  });

  describe('verifySessionToken', () => {
    it('should verify a valid token', () => {
      const token = generateSessionToken('verify@example.com');
      const result = verifySessionToken(token);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.email, 'verify@example.com');
    });

    it('should reject an invalid token', () => {
      const result = verifySessionToken('invalid-token');

      assert.strictEqual(result.valid, false);
      assert.ok(result.error);
    });

    it('should reject a token with wrong secret', () => {
      // Create a token with a different secret (simulated by tampering)
      const validToken = generateSessionToken('test@example.com');
      const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

      const result = verifySessionToken(tamperedToken);

      assert.strictEqual(result.valid, false);
    });
  });

  describe('generateLicenseToken', () => {
    it('should generate a valid license token with premium status', () => {
      const token = generateLicenseToken('test@example.com', true, false);

      assert.ok(token);
      assert.strictEqual(typeof token, 'string');
      assert.ok(token.split('.').length === 3);

      const result = verifySessionToken(token);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.email, 'test@example.com');
    });

    it('should include premium and grandfathered flags in payload', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const token = generateLicenseToken('test@example.com', true, true);
      const decoded = jwt.verify(token, config.JWT_SECRET);

      assert.strictEqual(decoded.email, 'test@example.com');
      assert.strictEqual(decoded.premium, true);
      assert.strictEqual(decoded.grandfathered, true);
    });

    it('should lowercase email in license token', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const token = generateLicenseToken('Test@EXAMPLE.com', true, false);
      const decoded = jwt.verify(token, config.JWT_SECRET);

      assert.strictEqual(decoded.email, 'test@example.com');
    });

    it('should set non-premium status correctly', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const token = generateLicenseToken('test@example.com', false, false);
      const decoded = jwt.verify(token, config.JWT_SECRET);

      assert.strictEqual(decoded.premium, false);
      assert.strictEqual(decoded.grandfathered, false);
    });
  });
});
