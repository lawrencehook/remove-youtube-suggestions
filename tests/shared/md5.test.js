const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile } = require('../setup');

// Load md5.js
const { md5 } = loadSourceFile('shared/md5.js');

describe('MD5', () => {
  describe('known test vectors', () => {
    // Standard MD5 test vectors from RFC 1321
    it('should hash empty string correctly', () => {
      assert.strictEqual(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
    });

    it('should hash "a" correctly', () => {
      assert.strictEqual(md5('a'), '0cc175b9c0f1b6a831c399e269772661');
    });

    it('should hash "abc" correctly', () => {
      assert.strictEqual(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
    });

    it('should hash "message digest" correctly', () => {
      assert.strictEqual(md5('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0');
    });

    it('should hash "hello" correctly', () => {
      // This is used as a self-test in the source code
      assert.strictEqual(md5('hello'), '5d41402abc4b2a76b9719d911017c592');
    });

    it('should hash lowercase alphabet correctly', () => {
      assert.strictEqual(md5('abcdefghijklmnopqrstuvwxyz'), 'c3fcd3d76192e4007dfb496cca67e13b');
    });

    it('should hash digits correctly', () => {
      assert.strictEqual(md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
        '57edf4a22be3c955ac49da2e2107b67a');
    });
  });

  describe('password hashing scenarios', () => {
    it('should produce consistent hashes for same input', () => {
      const password = 'mySecretPassword123';
      const hash1 = md5(password);
      const hash2 = md5(password);
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = md5('password1');
      const hash2 = md5('password2');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should always return 32 character hex string', () => {
      const inputs = ['', 'a', 'abc', 'a very long string with many characters'];
      for (const input of inputs) {
        const hash = md5(input);
        assert.strictEqual(hash.length, 32, `Hash of "${input}" has length ${hash.length}`);
        assert.match(hash, /^[0-9a-f]{32}$/, `Hash contains invalid characters: ${hash}`);
      }
    });

    it('should handle special characters', () => {
      const hash = md5('!@#$%^&*()_+-=[]{}|;:,.<>?');
      assert.strictEqual(hash.length, 32);
      assert.match(hash, /^[0-9a-f]{32}$/);
    });

    it('should handle unicode (though results may vary)', () => {
      // MD5 on unicode is implementation-dependent
      // Just verify it doesn't crash and returns valid format
      const hash = md5('こんにちは');
      assert.strictEqual(hash.length, 32);
      assert.match(hash, /^[0-9a-f]{32}$/);
    });
  });

  describe('edge cases', () => {
    it('should handle strings with null bytes', () => {
      const hash = md5('hello\x00world');
      assert.strictEqual(hash.length, 32);
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = md5(longString);
      assert.strictEqual(hash.length, 32);
      assert.match(hash, /^[0-9a-f]{32}$/);
    });

    it('should handle strings at 64-byte boundary', () => {
      // MD5 processes in 64-byte blocks
      const exactly64 = 'a'.repeat(64);
      const hash = md5(exactly64);
      assert.strictEqual(hash.length, 32);
    });

    it('should handle strings just over 64-byte boundary', () => {
      const just65 = 'a'.repeat(65);
      const hash = md5(just65);
      assert.strictEqual(hash.length, 32);
    });
  });
});
