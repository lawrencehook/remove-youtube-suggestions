const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, assertDeepEqual } = require('../setup');

// Load main.js
const main = loadSourceFile('shared/main.js');

describe('Main Settings', () => {
  describe('migrateRevealSettings', () => {
    it('should return empty object when no legacy setting exists', () => {
      const settings = { remove_homepage: true };
      const updates = main.migrateRevealSettings(settings);
      assertDeepEqual(updates, {});
    });

    it('should return empty object for null/undefined settings', () => {
      assertDeepEqual(main.migrateRevealSettings(null), {});
      assertDeepEqual(main.migrateRevealSettings(undefined), {});
    });

    it('should migrate add_reveal_button to all three reveal settings', () => {
      const settings = { add_reveal_button: true };
      const updates = main.migrateRevealSettings(settings);

      assert.strictEqual(updates.add_reveal_homepage, true);
      assert.strictEqual(updates.add_reveal_sidebar, true);
      assert.strictEqual(updates.add_reveal_end_of_video, true);
    });

    it('should migrate false value correctly', () => {
      const settings = { add_reveal_button: false };
      const updates = main.migrateRevealSettings(settings);

      assert.strictEqual(updates.add_reveal_homepage, false);
      assert.strictEqual(updates.add_reveal_sidebar, false);
      assert.strictEqual(updates.add_reveal_end_of_video, false);
    });

    it('should not overwrite existing reveal settings', () => {
      const settings = {
        add_reveal_button: true,
        add_reveal_homepage: false, // Already set - should not be overwritten
      };
      const updates = main.migrateRevealSettings(settings);

      // Should not include homepage since it already exists
      assert.strictEqual('add_reveal_homepage' in updates, false);
      assert.strictEqual(updates.add_reveal_sidebar, true);
      assert.strictEqual(updates.add_reveal_end_of_video, true);
    });

    it('should also update the settings object in place', () => {
      const settings = { add_reveal_button: true };
      main.migrateRevealSettings(settings);

      // The function mutates settings object too
      assert.strictEqual(settings.add_reveal_homepage, true);
      assert.strictEqual(settings.add_reveal_sidebar, true);
      assert.strictEqual(settings.add_reveal_end_of_video, true);
    });
  });

  describe('sectionNameToUrl', () => {
    it('should convert simple section name to URL', () => {
      const url = main.sectionNameToUrl('General');
      assert.strictEqual(url, 'https://lawrencehook.com/rys/features/general/');
    });

    it('should handle spaces by converting to underscores', () => {
      const url = main.sectionNameToUrl('Video Player');
      assert.strictEqual(url, 'https://lawrencehook.com/rys/features/video_player/');
    });

    it('should handle " - " by converting to underscore', () => {
      const url = main.sectionNameToUrl('Video Player - UX');
      assert.strictEqual(url, 'https://lawrencehook.com/rys/features/video_player_ux/');
    });

    it('should handle complex names', () => {
      const url = main.sectionNameToUrl('Left Navigation Bar Sections');
      assert.strictEqual(url, 'https://lawrencehook.com/rys/features/left_navigation_bar_sections/');
    });
  });

  describe('idToShortId and shortIdToId', () => {
    it('should have bidirectional mapping for all entries', () => {
      const ids = Object.keys(main.idToShortId);
      const shortIds = Object.keys(main.shortIdToId);

      // Every id should map to a shortId and back
      for (const id of ids) {
        const shortId = main.idToShortId[id];
        const backToId = main.shortIdToId[shortId];
        assert.strictEqual(backToId, id, `Mapping broken for ${id} -> ${shortId} -> ${backToId}`);
      }

      // Every shortId should map to an id and back
      for (const shortId of shortIds) {
        const id = main.shortIdToId[shortId];
        const backToShortId = main.idToShortId[id];
        assert.strictEqual(backToShortId, shortId, `Reverse mapping broken for ${shortId} -> ${id} -> ${backToShortId}`);
      }
    });

    it('should have same number of entries in both directions', () => {
      const idCount = Object.keys(main.idToShortId).length;
      const shortIdCount = Object.keys(main.shortIdToId).length;
      assert.strictEqual(idCount, shortIdCount, `Mismatch: ${idCount} ids vs ${shortIdCount} shortIds`);
    });

    it('should have unique shortIds (no collisions)', () => {
      const shortIds = Object.values(main.idToShortId);
      const uniqueShortIds = new Set(shortIds);
      assert.strictEqual(shortIds.length, uniqueShortIds.size, 'Duplicate shortIds found');
    });

    it('should include all settings from SECTIONS', () => {
      const allOptionIds = main.SECTIONS.flatMap(section =>
        section.options.map(opt => opt.id)
      );

      const missingIds = allOptionIds.filter(id => !(id in main.idToShortId));
      assert.strictEqual(missingIds.length, 0, `Missing from idToShortId: ${missingIds.join(', ')}`);
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should include all options from SECTIONS', () => {
      const allOptionIds = main.SECTIONS.flatMap(section =>
        section.options.map(opt => opt.id)
      );

      for (const id of allOptionIds) {
        assert.ok(id in main.DEFAULT_SETTINGS, `Missing default for: ${id}`);
      }
    });

    it('should have correct default values from SECTIONS', () => {
      for (const section of main.SECTIONS) {
        for (const option of section.options) {
          assert.strictEqual(
            main.DEFAULT_SETTINGS[option.id],
            option.defaultValue,
            `Wrong default for ${option.id}: expected ${option.defaultValue}, got ${main.DEFAULT_SETTINGS[option.id]}`
          );
        }
      }
    });

    it('should include OTHER_SETTINGS', () => {
      assert.ok('global_enable' in main.DEFAULT_SETTINGS);
      assert.ok('dark_mode' in main.DEFAULT_SETTINGS);
      assert.ok('schedule' in main.DEFAULT_SETTINGS);
      assert.ok('password' in main.DEFAULT_SETTINGS);
    });
  });

  describe('SECTIONS structure validation', () => {
    it('should have unique option ids across all sections', () => {
      const allIds = main.SECTIONS.flatMap(section =>
        section.options.map(opt => opt.id)
      );
      const uniqueIds = new Set(allIds);

      if (allIds.length !== uniqueIds.size) {
        // Find duplicates
        const seen = new Set();
        const duplicates = [];
        for (const id of allIds) {
          if (seen.has(id)) duplicates.push(id);
          seen.add(id);
        }
        assert.fail(`Duplicate option ids found: ${duplicates.join(', ')}`);
      }
    });

    it('should have valid effect references (effects point to existing options)', () => {
      const allIds = new Set(main.SECTIONS.flatMap(section =>
        section.options.map(opt => opt.id)
      ));

      for (const section of main.SECTIONS) {
        for (const option of section.options) {
          if (option.effects) {
            for (const [triggerValue, effectMap] of Object.entries(option.effects)) {
              for (const targetId of Object.keys(effectMap)) {
                assert.ok(
                  allIds.has(targetId),
                  `Option ${option.id} has effect targeting non-existent option: ${targetId}`
                );
              }
            }
          }
        }
      }
    });

    it('should have boolean defaultValues for all options', () => {
      for (const section of main.SECTIONS) {
        for (const option of section.options) {
          assert.strictEqual(
            typeof option.defaultValue,
            'boolean',
            `Option ${option.id} has non-boolean defaultValue: ${option.defaultValue}`
          );
        }
      }
    });

    it('premium options should be marked consistently', () => {
      for (const section of main.SECTIONS) {
        for (const option of section.options) {
          // premium should be either true or undefined (not false)
          if ('premium' in option) {
            assert.strictEqual(
              option.premium,
              true,
              `Option ${option.id} has premium: ${option.premium} (should be true or omitted)`
            );
          }
        }
      }
    });
  });
});
