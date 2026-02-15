const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile } = require('../setup');

// Load banners.js
const bannersContext = loadSourceFile('shared/banners.js');

describe('Banners', () => {
  describe('BANNERS constant', () => {
    it('should be an array', () => {
      assert.ok(Array.isArray(bannersContext.BANNERS));
    });

    it('should have required properties on each banner', () => {
      for (const banner of bannersContext.BANNERS) {
        assert.ok(banner.id, 'Banner should have id');
        assert.ok(banner.storageKey, 'Banner should have storageKey');
        assert.ok(banner.message, 'Banner should have message');
        assert.ok(banner.linkText, 'Banner should have linkText');
        assert.ok(banner.linkUrl, 'Banner should have linkUrl');
        assert.ok(banner.dismissText, 'Banner should have dismissText');
        assert.ok(Array.isArray(banner.showOn), 'Banner showOn should be array');
      }
    });

    it('should have valid showOn locations', () => {
      const validLocations = ['options', 'youtube_homepage'];
      for (const banner of bannersContext.BANNERS) {
        for (const location of banner.showOn) {
          assert.ok(
            validLocations.includes(location),
            `Invalid location "${location}" in banner ${banner.id}`
          );
        }
      }
    });
  });

  describe('getActiveBanners', () => {
    it('should return banners for options page', () => {
      const result = bannersContext.getActiveBanners('options');
      assert.ok(Array.isArray(result));
      // All returned banners should include 'options' in showOn
      for (const banner of result) {
        assert.ok(banner.showOn.includes('options'));
      }
    });

    it('should return banners for youtube_homepage', () => {
      const result = bannersContext.getActiveBanners('youtube_homepage');
      assert.ok(Array.isArray(result));
      for (const banner of result) {
        assert.ok(banner.showOn.includes('youtube_homepage'));
      }
    });

    it('should return empty array for unknown location', () => {
      const result = bannersContext.getActiveBanners('unknown_location');
      assert.ok(Array.isArray(result));
      assert.strictEqual(result.length, 0);
    });

    it('should return empty array for null/undefined location', () => {
      const nullResult = bannersContext.getActiveBanners(null);
      const undefinedResult = bannersContext.getActiveBanners(undefined);
      assert.ok(Array.isArray(nullResult));
      assert.strictEqual(nullResult.length, 0);
      assert.ok(Array.isArray(undefinedResult));
      assert.strictEqual(undefinedResult.length, 0);
    });

    it('should filter correctly when banner has multiple locations', () => {
      // Find any banner that shows on both options and youtube_homepage
      const multiLocationBanner = bannersContext.BANNERS.find(
        b => b.showOn.includes('options') && b.showOn.includes('youtube_homepage')
      );

      if (multiLocationBanner) {
        const optionsResult = bannersContext.getActiveBanners('options');
        const homepageResult = bannersContext.getActiveBanners('youtube_homepage');

        const inOptions = optionsResult.find(b => b.id === multiLocationBanner.id);
        const inHomepage = homepageResult.find(b => b.id === multiLocationBanner.id);

        assert.ok(inOptions, `${multiLocationBanner.id} should appear in options`);
        assert.ok(inHomepage, `${multiLocationBanner.id} should appear in youtube_homepage`);
      } else {
        // No multi-location banners currently configured - test passes trivially
        assert.ok(true, 'No multi-location banners to test');
      }
    });
  });

  describe('Banner IDs', () => {
    it('should have unique IDs', () => {
      const ids = bannersContext.BANNERS.map(b => b.id);
      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, ids.length, 'Banner IDs should be unique');
    });

    it('should have unique storage keys', () => {
      const keys = bannersContext.BANNERS.map(b => b.storageKey);
      const uniqueKeys = new Set(keys);
      assert.strictEqual(uniqueKeys.size, keys.length, 'Storage keys should be unique');
    });
  });

  describe('Banner URLs', () => {
    it('should have valid HTTPS URLs', () => {
      for (const banner of bannersContext.BANNERS) {
        assert.ok(
          banner.linkUrl.startsWith('https://'),
          `Banner ${banner.id} should have HTTPS URL`
        );
      }
    });
  });
});
