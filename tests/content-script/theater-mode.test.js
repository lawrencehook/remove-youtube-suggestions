const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, resetStorage, setStorageData } = require('../setup');

function validPremiumJWT() {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    email: 'theater@example.com',
    type: 'license',
    premium: true,
    grandfathered: false,
    iat: now,
    exp: now + 3600,
  })}.sig`;
}

function loadWatchPage({ initialTheater = false, readyAfterClicks = 1 } = {}) {
  let theater = initialTheater;
  let clicks = 0;

  const flexy = {
    hasAttribute: name => name === 'theater' && theater,
  };
  const sizeButton = {
    click: () => {
      clicks += 1;
      if (clicks >= readyAfterClicks) {
        theater = !theater;
      }
    },
  };

  const attrs = {};
  const documentElement = {
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: k => (k in attrs ? attrs[k] : null),
    removeAttribute: k => { delete attrs[k]; },
    hasAttribute: k => k in attrs,
    toggleAttribute: () => {},
  };

  const stubs = {
    document: {
      documentElement,
      hidden: true,
      addEventListener: () => {},
      querySelector: selector => {
        if (selector === 'ytd-watch-flexy') return flexy;
        if (selector === '.ytp-size-button') return sizeButton;
        return null;
      },
      querySelectorAll: () => [],
    },
    location: { href: 'https://www.youtube.com/watch?v=first' },
    window: {},
  };

  const utils = loadSourceFile('shared/utils.js', stubs);
  const config = loadSourceFile('shared/config.js');
  const shared = loadSourceFile('shared/main.js');

  const ctx = loadSourceFile('content-script/main.js', {
    ...stubs,
    qs: utils.qs,
    qsa: utils.qsa,
    resultsPageRegex: utils.resultsPageRegex,
    homepageRegex: utils.homepageRegex,
    shortsRegex: utils.shortsRegex,
    videoPageRegex: utils.videoPageRegex,
    channelRegex: utils.channelRegex,
    subsRegex: utils.subsRegex,
    checkSchedule: utils.checkSchedule,
    getActiveBanners: () => [],
    PREMIUM_CONFIG: config.PREMIUM_CONFIG,
    TIER: config.TIER,
    DEFAULT_SETTINGS: shared.DEFAULT_SETTINGS,
    migrateRevealSettings: shared.migrateRevealSettings,
    clearAllPremium: shared.clearAllPremium,
    enforceSlotBudget: shared.enforceSlotBudget,
    countActivePremium: shared.countActivePremium,
    PREMIUM_FEATURE_ID_SET: shared.PREMIUM_FEATURE_ID_SET,
    PREMIUM_FEATURE_IDS: shared.PREMIUM_FEATURE_IDS,
  });

  return {
    ctx,
    stubs,
    getClicks: () => clicks,
    isTheater: () => theater,
    exitTheater: () => { theater = false; },
  };
}

describe('enable_theater', () => {
  beforeEach(() => {
    resetStorage();
    setStorageData({
      global_enable: true,
      enable_theater: true,
      session_token: 'sess',
      license_token: validPremiumJWT(),
    });
  });

  it('enables theater mode once per video and respects manual exit until navigation', () => {
    const page = loadWatchPage({ initialTheater: false });
    assert.strictEqual(page.getClicks(), 1);
    assert.strictEqual(page.isTheater(), true);

    // User manually exits theater mode; subsequent ticks must not re-enable it.
    page.exitTheater();
    page.ctx.runDynamicSettings();
    page.ctx.runDynamicSettings();
    assert.strictEqual(page.getClicks(), 1);
    assert.strictEqual(page.isTheater(), false);

    // Navigating to a new video resets the per-video guard.
    page.stubs.location.href = 'https://www.youtube.com/watch?v=second';
    page.ctx.runDynamicSettings();
    page.ctx.runDynamicSettings();
    assert.strictEqual(page.getClicks(), 2);
    assert.strictEqual(page.isTheater(), true);
  });

  it('retries clicking until YouTube actually applies the theater attribute', () => {
    // Simulate early page load where the first two clicks are ignored before player init.
    const page = loadWatchPage({ initialTheater: false, readyAfterClicks: 3 });
    assert.strictEqual(page.getClicks(), 1);
    assert.strictEqual(page.isTheater(), false);

    page.ctx.runDynamicSettings();
    assert.strictEqual(page.getClicks(), 2);
    assert.strictEqual(page.isTheater(), false);

    page.ctx.runDynamicSettings();
    assert.strictEqual(page.getClicks(), 3);
    assert.strictEqual(page.isTheater(), true);

    // Once active, a manual exit is respected.
    page.exitTheater();
    page.ctx.runDynamicSettings();
    assert.strictEqual(page.getClicks(), 3);
    assert.strictEqual(page.isTheater(), false);
  });
});
