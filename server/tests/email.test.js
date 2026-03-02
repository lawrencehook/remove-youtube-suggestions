const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

// Setup must be required first
require('./setup');

describe('Email Service - validateEmail', () => {
  let emailModule;
  let mockSend;

  beforeEach(() => {
    // Clear module cache so we get a fresh instance with mockable client
    delete require.cache[require.resolve('../src/services/email')];
    delete require.cache[require.resolve('@aws-sdk/client-sesv2')];

    // Mock the SESv2 client before requiring email module
    const sesv2 = require('@aws-sdk/client-sesv2');
    mockSend = mock.fn();
    const OriginalClient = sesv2.SESv2Client;
    sesv2.SESv2Client = class MockSESv2Client extends OriginalClient {
      constructor(...args) {
        super(...args);
        this.send = mockSend;
      }
    };

    emailModule = require('../src/services/email');
  });

  it('should return valid for HIGH confidence verdict', async () => {
    mockSend.mock.mockImplementation(async () => ({
      MailboxValidation: {
        IsValid: { ConfidenceVerdict: 'HIGH' },
      },
    }));

    const result = await emailModule.validateEmail('good@example.com');
    assert.deepStrictEqual(result, { valid: true });
  });

  it('should return invalid for LOW confidence verdict', async () => {
    mockSend.mock.mockImplementation(async () => ({
      MailboxValidation: {
        IsValid: { ConfidenceVerdict: 'LOW' },
      },
    }));

    const result = await emailModule.validateEmail('bad@disposable.com');
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('Low confidence'));
  });

  it('should return valid when MailboxValidation is missing', async () => {
    mockSend.mock.mockImplementation(async () => ({}));

    const result = await emailModule.validateEmail('unknown@example.com');
    assert.deepStrictEqual(result, { valid: true });
  });

  it('should fail open on SES error', async () => {
    mockSend.mock.mockImplementation(async () => {
      throw new Error('SES unavailable');
    });

    const result = await emailModule.validateEmail('error@example.com');
    assert.deepStrictEqual(result, { valid: true });
  });

  it('should fail open on timeout', async () => {
    mockSend.mock.mockImplementation(async () => {
      throw new DOMException('The operation was aborted', 'AbortError');
    });

    const result = await emailModule.validateEmail('slow@example.com');
    assert.deepStrictEqual(result, { valid: true });
  });
});
