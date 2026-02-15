const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, assertDeepEqual } = require('../setup');

// Load utils.js - it has pure functions that don't need DOM
const utils = loadSourceFile('shared/utils.js');

describe('Utils', () => {
  describe('uniq', () => {
    it('should remove duplicate values from array', () => {
      assert.deepStrictEqual(utils.uniq([1, 2, 2, 3, 3, 3]), [1, 2, 3]);
    });

    it('should handle empty array', () => {
      assert.deepStrictEqual(utils.uniq([]), []);
    });

    it('should handle array with no duplicates', () => {
      assert.deepStrictEqual(utils.uniq([1, 2, 3]), [1, 2, 3]);
    });

    it('should work with strings', () => {
      assert.deepStrictEqual(utils.uniq(['a', 'b', 'a', 'c']), ['a', 'b', 'c']);
    });

    it('should preserve order (first occurrence)', () => {
      assert.deepStrictEqual(utils.uniq([3, 1, 2, 1, 3]), [3, 1, 2]);
    });

    it('should handle null/undefined values in array', () => {
      assert.deepStrictEqual(utils.uniq([null, 1, null, undefined, 1]), [null, 1, undefined]);
    });
  });

  describe('timeIsValid', () => {
    it('should validate correct time format', () => {
      assert.strictEqual(utils.timeIsValid('9:00a-5:00p'), true);
      assert.strictEqual(utils.timeIsValid('12:30p-1:30p'), true);
      assert.strictEqual(utils.timeIsValid('1:00a-2:00a'), true);
    });

    it('should validate multiple time ranges', () => {
      assert.strictEqual(utils.timeIsValid('9:00a-12:00p,1:00p-5:00p'), true);
    });

    it('should reject invalid time format', () => {
      assert.strictEqual(utils.timeIsValid('25:00a-5:00p'), false);
      assert.strictEqual(utils.timeIsValid('9:00-5:00'), false); // missing am/pm
      assert.strictEqual(utils.timeIsValid('9:00a5:00p'), false); // missing dash
      assert.strictEqual(utils.timeIsValid('13:00a-5:00p'), false); // 13 is invalid for 12hr
    });

    it('should handle case insensitivity', () => {
      assert.strictEqual(utils.timeIsValid('9:00A-5:00P'), true);
      assert.strictEqual(utils.timeIsValid('9:00a-5:00P'), true);
    });
  });

  describe('parseScheduleTime', () => {
    it('should parse morning times correctly', () => {
      const now = new Date('2024-01-15T12:00:00');
      const result = utils.parseScheduleTime('9:30a', now);
      const expected = new Date('2024-01-15T09:30:00').getTime();
      assert.strictEqual(result, expected);
    });

    it('should parse afternoon times correctly', () => {
      const now = new Date('2024-01-15T12:00:00');
      const result = utils.parseScheduleTime('2:30p', now);
      const expected = new Date('2024-01-15T14:30:00').getTime();
      assert.strictEqual(result, expected);
    });

    it('should handle 12:00a (midnight) correctly', () => {
      const now = new Date('2024-01-15T12:00:00');
      const result = utils.parseScheduleTime('12:00a', now);
      const expected = new Date('2024-01-15T00:00:00').getTime();
      assert.strictEqual(result, expected);
    });

    it('should handle 12:00p (noon) correctly', () => {
      const now = new Date('2024-01-15T12:00:00');
      const result = utils.parseScheduleTime('12:00p', now);
      const expected = new Date('2024-01-15T12:00:00').getTime();
      assert.strictEqual(result, expected);
    });

    it('should return undefined for invalid input', () => {
      assert.strictEqual(utils.parseScheduleTime(null, new Date()), undefined);
      assert.strictEqual(utils.parseScheduleTime('9:00a', null), undefined);
    });
  });

  describe('checkSchedule', () => {
    it('should return true when within scheduled time and day', () => {
      // Monday at 10am
      const now = new Date('2024-01-15T10:00:00'); // Monday
      const result = utils.checkSchedule('9:00a-5:00p', 'mo,tu,we,th,fr', now);
      assert.strictEqual(result, true);
    });

    it('should return false when outside scheduled time', () => {
      // Monday at 6pm (after 5pm)
      const now = new Date('2024-01-15T18:00:00'); // Monday
      const result = utils.checkSchedule('9:00a-5:00p', 'mo,tu,we,th,fr', now);
      assert.strictEqual(result, false);
    });

    it('should return false when on wrong day', () => {
      // Saturday at 10am
      const now = new Date('2024-01-13T10:00:00'); // Saturday
      const result = utils.checkSchedule('9:00a-5:00p', 'mo,tu,we,th,fr', now);
      assert.strictEqual(result, false);
    });

    it('should return false for null/undefined inputs', () => {
      const now = new Date('2024-01-15T10:00:00');
      assert.strictEqual(utils.checkSchedule(null, 'mo', now), false);
      assert.strictEqual(utils.checkSchedule('9:00a-5:00p', null, now), false);
    });

    it('should handle multiple time ranges', () => {
      // Monday at 2pm (in second time range)
      const now = new Date('2024-01-15T14:00:00'); // Monday
      const result = utils.checkSchedule('9:00a-12:00p,1:00p-5:00p', 'mo', now);
      assert.strictEqual(result, true);
    });

    it('should handle case insensitive days', () => {
      const now = new Date('2024-01-15T10:00:00'); // Monday
      assert.strictEqual(utils.checkSchedule('9:00a-5:00p', 'MO', now), true);
      assert.strictEqual(utils.checkSchedule('9:00a-5:00p', 'Mo', now), true);
    });
  });

  describe('parseTimeRemaining', () => {
    it('should parse milliseconds into time components', () => {
      // 1 day, 2 hours, 30 minutes, 45 seconds
      const ms = (1 * 24 * 60 * 60 * 1000) + (2 * 60 * 60 * 1000) + (30 * 60 * 1000) + (45 * 1000);
      const result = utils.parseTimeRemaining(ms);
      assertDeepEqual(result, { days: 1, hours: 2, minutes: 30, seconds: 45 });
    });

    it('should handle zero', () => {
      const result = utils.parseTimeRemaining(0);
      assertDeepEqual(result, { days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it('should handle partial values', () => {
      // 90 seconds = 1 minute 30 seconds
      const result = utils.parseTimeRemaining(90 * 1000);
      assertDeepEqual(result, { days: 0, hours: 0, minutes: 1, seconds: 30 });
    });
  });

  describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
      const result = utils.generateRandomString(10);
      assert.strictEqual(result.length, 10);
    });

    it('should only contain allowed characters', () => {
      const allowed = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const result = utils.generateRandomString(100);
      for (const char of result) {
        assert.ok(allowed.includes(char), `Unexpected character: ${char}`);
      }
    });

    it('should generate different strings', () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(utils.generateRandomString(20));
      }
      // All 10 should be unique
      assert.strictEqual(results.size, 10);
    });

    it('should handle length 0', () => {
      const result = utils.generateRandomString(0);
      assert.strictEqual(result, '');
    });

    it('should handle length 1', () => {
      const result = utils.generateRandomString(1);
      assert.strictEqual(result.length, 1);
    });

    it('should exclude ambiguous characters (0, O, l, I, 1)', () => {
      // Generate many strings and check none contain ambiguous chars
      const ambiguous = '0OlI1';
      for (let i = 0; i < 100; i++) {
        const result = utils.generateRandomString(50);
        for (const char of ambiguous) {
          assert.ok(!result.includes(char), `Found ambiguous character ${char} in ${result}`);
        }
      }
    });
  });

  // RED TEAM: Edge cases and potential bug discovery
  describe('Edge Cases and Potential Bugs', () => {
    describe('timeIsValid edge cases', () => {
      it('should reject time with invalid minutes (60+)', () => {
        assert.strictEqual(utils.timeIsValid('9:60a-5:00p'), false);
      });

      it('should reject time with hour 0', () => {
        // 12-hour format doesn't have hour 0
        assert.strictEqual(utils.timeIsValid('0:00a-5:00p'), false);
      });

      it('should accept 12:59', () => {
        assert.strictEqual(utils.timeIsValid('12:59a-12:59p'), true);
      });

      it('should handle whitespace in comma-separated times', () => {
        assert.strictEqual(utils.timeIsValid('9:00a-12:00p, 1:00p-5:00p'), true);
        assert.strictEqual(utils.timeIsValid('  9:00a-12:00p  ,  1:00p-5:00p  '), true);
      });

      it('should reject empty string', () => {
        // Empty string split by comma gives [''], which should fail regex
        assert.strictEqual(utils.timeIsValid(''), false);
      });
    });

    describe('checkSchedule boundary conditions', () => {
      it('should handle exact start time (exclusive)', () => {
        // At exactly 9:00a, should we be in schedule?
        // Current impl uses now > startTime, so exactly at start = false
        const now = new Date('2024-01-15T09:00:00'); // Monday at exactly 9am
        const result = utils.checkSchedule('9:00a-5:00p', 'mo', now);
        // This tests whether boundary is inclusive or exclusive
        assert.strictEqual(result, false, 'Exactly at start time should be false (exclusive)');
      });

      it('should handle exact end time (exclusive)', () => {
        // At exactly 5:00p, should we be in schedule?
        const now = new Date('2024-01-15T17:00:00'); // Monday at exactly 5pm
        const result = utils.checkSchedule('9:00a-5:00p', 'mo', now);
        assert.strictEqual(result, false, 'Exactly at end time should be false (exclusive)');
      });

      it('should handle one second after start', () => {
        const now = new Date('2024-01-15T09:00:01');
        const result = utils.checkSchedule('9:00a-5:00p', 'mo', now);
        assert.strictEqual(result, true);
      });

      it('should handle one second before end', () => {
        const now = new Date('2024-01-15T16:59:59');
        const result = utils.checkSchedule('9:00a-5:00p', 'mo', now);
        assert.strictEqual(result, true);
      });

      it('should handle all days of week', () => {
        const days = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
        // 2024-01-14 is Sunday, 15 is Monday, etc.
        for (let i = 0; i < 7; i++) {
          const date = new Date(2024, 0, 14 + i, 12, 0, 0); // Noon on each day
          const result = utils.checkSchedule('9:00a-5:00p', days[i], date);
          assert.strictEqual(result, true, `Failed for ${days[i]}`);
        }
      });

      it.todo('should handle midnight crossing');
    });

    describe('parseScheduleTime edge cases', () => {
      it('should handle 11:59p correctly', () => {
        const now = new Date('2024-01-15T12:00:00');
        const result = utils.parseScheduleTime('11:59p', now);
        const expected = new Date('2024-01-15T23:59:00').getTime();
        assert.strictEqual(result, expected);
      });

      it('should handle 12:01a correctly', () => {
        const now = new Date('2024-01-15T12:00:00');
        const result = utils.parseScheduleTime('12:01a', now);
        const expected = new Date('2024-01-15T00:01:00').getTime();
        assert.strictEqual(result, expected);
      });

      it('should handle 12:01p correctly', () => {
        const now = new Date('2024-01-15T12:00:00');
        const result = utils.parseScheduleTime('12:01p', now);
        const expected = new Date('2024-01-15T12:01:00').getTime();
        assert.strictEqual(result, expected);
      });

      it('should handle 1:00a correctly (1am)', () => {
        const now = new Date('2024-01-15T12:00:00');
        const result = utils.parseScheduleTime('1:00a', now);
        const expected = new Date('2024-01-15T01:00:00').getTime();
        assert.strictEqual(result, expected);
      });

      it('should handle 1:00p correctly (1pm = 13:00)', () => {
        const now = new Date('2024-01-15T12:00:00');
        const result = utils.parseScheduleTime('1:00p', now);
        const expected = new Date('2024-01-15T13:00:00').getTime();
        assert.strictEqual(result, expected);
      });
    });

    describe('parseTimeRemaining edge cases', () => {
      it('should handle exactly 1 week', () => {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const result = utils.parseTimeRemaining(oneWeek);
        // Note: The function uses % 7 for days, so 7 days = 0 days
        assertDeepEqual(result, { days: 0, hours: 0, minutes: 0, seconds: 0 });
      });

      it('should handle 6 days 23 hours 59 minutes 59 seconds', () => {
        const ms = (6 * 24 * 60 * 60 * 1000) + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
        const result = utils.parseTimeRemaining(ms);
        assertDeepEqual(result, { days: 6, hours: 23, minutes: 59, seconds: 59 });
      });

      it('should handle fractional milliseconds (rounds down)', () => {
        const result = utils.parseTimeRemaining(1500); // 1.5 seconds
        assert.strictEqual(result.seconds, 1);
      });

      it.todo('should handle negative values');
    });

    describe('DAYS constant', () => {
      it('should have exactly 7 days', () => {
        assert.strictEqual(utils.DAYS.length, 7);
      });

      it('should start with Sunday (index 0 = Sunday)', () => {
        // JavaScript's Date.getDay() returns 0 for Sunday
        assert.strictEqual(utils.DAYS[0], 'su');
        assert.strictEqual(utils.DAYS[6], 'sa');
      });

      it('should have all unique values', () => {
        const unique = new Set(utils.DAYS);
        assert.strictEqual(unique.size, 7);
      });
    });
  });
});
