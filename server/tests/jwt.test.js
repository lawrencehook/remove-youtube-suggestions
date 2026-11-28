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
    it('should include session token type claim', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const token = generateSessionToken('typed@example.com');
      const decoded = jwt.verify(token, config.JWT_SECRET);

      assert.strictEqual(decoded.type, 'session');
    });
  });

  describe('verifySessionToken', () => {
    it('should verify a valid token', () => {
      const token = generateSessionToken('verify@example.com');
      const result = verifySessionToken(token);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.email, 'verify@example.com');
    });

    it('should remain compatible with legacy untyped session tokens', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const legacyToken = jwt.sign({ email: 'legacy@example.com' }, config.JWT_SECRET, { expiresIn: '1d' });
      const result = verifySessionToken(legacyToken);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.email, 'legacy@example.com');
    });

    it('should reject license tokens used as session tokens', () => {
      const licenseToken = generateLicenseToken('donor@example.com', true, true);
      const result = verifySessionToken(licenseToken);

      assert.strictEqual(result.valid, false);
    });

    it('should reject legacy untyped license tokens used as session tokens', () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const legacyLicense = jwt.sign(
        { email: 'donor@example.com', premium: true, grandfathered: true },
        config.JWT_SECRET,
        { expiresIn: '730d' }
      );
      const result = verifySessionToken(legacyLicense);

      assert.strictEqual(result.valid, false);
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
      const jwt = require('jsonwebtoken');
      const config = require('../src/config');

      const token = generateLicenseToken('test@example.com', true, false);

      assert.ok(token);
      assert.strictEqual(typeof token, 'string');
      assert.ok(token.split('.').length === 3);

      const decoded = jwt.verify(token, config.JWT_SECRET);
      assert.strictEqual(decoded.email, 'test@example.com');
      assert.strictEqual(decoded.type, 'license');
      assert.strictEqual(decoded.premium, true);
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
