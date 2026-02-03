const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * Tests for URL regex patterns used in content-script/main.js
 * These patterns determine which YouTube page type the extension is on.
 *
 * Since the actual content script depends on DOM, we recreate the patterns here
 * to test their correctness independently.
 */

// Recreate the regex patterns from content-script/main.js
const resultsPageRegex = new RegExp('.*://.*youtube\\.com/results.*', 'i');
const homepageRegex = new RegExp('.*://(www|m)\\.youtube\\.com(/)?$', 'i');
const shortsRegex = new RegExp('.*://.*youtube\\.com/shorts.*', 'i');
const videoRegex = new RegExp('.*://.*youtube\\.com/watch\\?v=.*', 'i');
const channelRegex = new RegExp('.*://.*youtube\\.com/(@|channel)', 'i');
const subsRegex = new RegExp(/\/feed\/subscriptions$/, 'i');

describe('YouTube URL Pattern Matching', () => {
  describe('resultsPageRegex', () => {
    it('should match search results page', () => {
      assert.strictEqual(resultsPageRegex.test('https://www.youtube.com/results?search_query=test'), true);
      assert.strictEqual(resultsPageRegex.test('https://youtube.com/results?search_query=cats'), true);
      assert.strictEqual(resultsPageRegex.test('http://www.youtube.com/results'), true);
    });

    it('should not match other pages', () => {
      assert.strictEqual(resultsPageRegex.test('https://www.youtube.com/'), false);
      assert.strictEqual(resultsPageRegex.test('https://www.youtube.com/watch?v=abc'), false);
      assert.strictEqual(resultsPageRegex.test('https://www.youtube.com/shorts/abc'), false);
    });

    it('should match mobile results page', () => {
      assert.strictEqual(resultsPageRegex.test('https://m.youtube.com/results?search_query=test'), true);
    });
  });

  describe('homepageRegex', () => {
    it('should match desktop homepage', () => {
      assert.strictEqual(homepageRegex.test('https://www.youtube.com/'), true);
      assert.strictEqual(homepageRegex.test('https://www.youtube.com'), true);
      assert.strictEqual(homepageRegex.test('http://www.youtube.com/'), true);
    });

    it('should match mobile homepage', () => {
      assert.strictEqual(homepageRegex.test('https://m.youtube.com/'), true);
      assert.strictEqual(homepageRegex.test('https://m.youtube.com'), true);
    });

    it('should not match other pages', () => {
      assert.strictEqual(homepageRegex.test('https://www.youtube.com/feed/subscriptions'), false);
      assert.strictEqual(homepageRegex.test('https://www.youtube.com/watch?v=abc'), false);
      assert.strictEqual(homepageRegex.test('https://www.youtube.com/results?search_query=test'), false);
    });

    it('should not match youtube.com without subdomain prefix', () => {
      // The regex requires www or m subdomain
      assert.strictEqual(homepageRegex.test('https://youtube.com/'), false);
      assert.strictEqual(homepageRegex.test('https://youtube.com'), false);
    });
  });

  describe('shortsRegex', () => {
    it('should match shorts page', () => {
      assert.strictEqual(shortsRegex.test('https://www.youtube.com/shorts/abc123'), true);
      assert.strictEqual(shortsRegex.test('https://youtube.com/shorts/xyz'), true);
      assert.strictEqual(shortsRegex.test('https://m.youtube.com/shorts/video'), true);
    });

    it('should not match other pages', () => {
      assert.strictEqual(shortsRegex.test('https://www.youtube.com/'), false);
      assert.strictEqual(shortsRegex.test('https://www.youtube.com/watch?v=abc'), false);
    });

    it('should match shorts in URL path', () => {
      // Even if shorts is part of query string (edge case)
      assert.strictEqual(shortsRegex.test('https://www.youtube.com/shorts'), true);
    });
  });

  describe('videoRegex', () => {
    it('should match video watch page', () => {
      assert.strictEqual(videoRegex.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
      assert.strictEqual(videoRegex.test('https://youtube.com/watch?v=abc123'), true);
      assert.strictEqual(videoRegex.test('https://m.youtube.com/watch?v=xyz'), true);
    });

    it('should match video with additional parameters', () => {
      assert.strictEqual(videoRegex.test('https://www.youtube.com/watch?v=abc&t=120'), true);
      assert.strictEqual(videoRegex.test('https://www.youtube.com/watch?v=abc&list=PLxyz'), true);
    });

    it('should not match other pages', () => {
      assert.strictEqual(videoRegex.test('https://www.youtube.com/'), false);
      assert.strictEqual(videoRegex.test('https://www.youtube.com/shorts/abc'), false);
      assert.strictEqual(videoRegex.test('https://www.youtube.com/results?search_query=test'), false);
    });

    it('should not match watch without v parameter', () => {
      assert.strictEqual(videoRegex.test('https://www.youtube.com/watch'), false);
      assert.strictEqual(videoRegex.test('https://www.youtube.com/watch?list=abc'), false);
    });
  });

  describe('channelRegex', () => {
    it('should match @ handle channels', () => {
      assert.strictEqual(channelRegex.test('https://www.youtube.com/@username'), true);
      assert.strictEqual(channelRegex.test('https://youtube.com/@channel123'), true);
      assert.strictEqual(channelRegex.test('https://m.youtube.com/@creator'), true);
    });

    it('should match /channel/ URLs', () => {
      assert.strictEqual(channelRegex.test('https://www.youtube.com/channel/UCxyz123'), true);
      assert.strictEqual(channelRegex.test('https://youtube.com/channel/UC123abc'), true);
    });

    it('should not match other pages', () => {
      assert.strictEqual(channelRegex.test('https://www.youtube.com/'), false);
      assert.strictEqual(channelRegex.test('https://www.youtube.com/watch?v=abc'), false);
      assert.strictEqual(channelRegex.test('https://www.youtube.com/results?search_query=@user'), false);
    });
  });

  describe('subsRegex', () => {
    it('should match subscriptions feed', () => {
      assert.strictEqual(subsRegex.test('https://www.youtube.com/feed/subscriptions'), true);
      assert.strictEqual(subsRegex.test('https://youtube.com/feed/subscriptions'), true);
      assert.strictEqual(subsRegex.test('/feed/subscriptions'), true);
    });

    it('should not match with trailing path', () => {
      assert.strictEqual(subsRegex.test('https://www.youtube.com/feed/subscriptions/more'), false);
    });

    it('should not match other feeds', () => {
      assert.strictEqual(subsRegex.test('https://www.youtube.com/feed/library'), false);
      assert.strictEqual(subsRegex.test('https://www.youtube.com/feed/history'), false);
    });
  });

  // Edge cases and potential bugs
  describe('Edge Cases', () => {
    it('should be case insensitive', () => {
      assert.strictEqual(resultsPageRegex.test('HTTPS://WWW.YOUTUBE.COM/RESULTS'), true);
      assert.strictEqual(homepageRegex.test('HTTPS://WWW.YOUTUBE.COM/'), true);
      assert.strictEqual(videoRegex.test('HTTPS://WWW.YOUTUBE.COM/WATCH?V=ABC'), true);
    });

    it('should not match URLs with ports (regex limitation)', () => {
      // The current regex doesn't handle ports - they would fail to match
      // This is fine since YouTube doesn't use non-standard ports
      assert.strictEqual(videoRegex.test('https://www.youtube.com:443/watch?v=abc'), false);
    });

    it('should not match youtu.be short URLs (not youtube.com)', () => {
      assert.strictEqual(videoRegex.test('https://youtu.be/abc123'), false);
      assert.strictEqual(homepageRegex.test('https://youtu.be/'), false);
    });

    it('should not match fakeyoutube.com', () => {
      assert.strictEqual(homepageRegex.test('https://www.fakeyoutube.com/'), false);
    });

    it('should not match youtube.com.evil.com', () => {
      // The regex checks for youtube.com/ pattern, so evil.com after doesn't match
      assert.strictEqual(videoRegex.test('https://www.youtube.com.evil.com/watch?v=abc'), false);
    });

    it('homepage should handle www.youtube.com edge cases', () => {
      // No subdomain - should NOT match
      assert.strictEqual(homepageRegex.test('https://youtube.com/'), false);

      // music subdomain - should NOT match (not www or m)
      assert.strictEqual(homepageRegex.test('https://music.youtube.com/'), false);

      // tv subdomain - should NOT match
      assert.strictEqual(homepageRegex.test('https://tv.youtube.com/'), false);
    });
  });
});
