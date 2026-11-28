const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, resetStorage, setStorageData, getStorageData } = require('../setup');

/**
 * Regression tests for the intermittent settings-reset bug
 * (docs/settings-reset-investigation.md).
 *
 * Loads the real content script against the storage mock, seeded with the
 * exact state of an affected user, and asserts that initialization never
 * overwrites stored preferences. Entitlement enforcement must be in-memory
 * only (the effective view may be clamped; storage may not change).
 */

// Six premium preferences, listed in PREMIUM_FEATURE_IDS order so the
// buggy slot-budget write-back predictably keeps the first two and
// persists `false` over the last four.
const PREMIUM_PREFS = [
  'remove_video_thumbnails',
  'blur_video_thumbnails',
  'shrink_video_thumbnails',
  'disable_play_on_hover',
  'remove_header',
  'remove_chat',
];

// Expired JWT with premium: true. The client decodes without verifying the
// signature, so a fake signature is fine.
function expiredPremiumJWT() {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    email: 'repro@example.com',
    premium: true,
    grandfathered: false,
    iat: now - 4 * 24 * 60 * 60, // issued 4 days ago
    exp: now - 24 * 60 * 60,     // expired 1 day ago
  };
  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

function validPremiumJWT() {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    email: 'repro@example.com',
    type: 'license',
    premium: true,
    grandfathered: false,
    iat: now,
    exp: now + 14 * 24 * 60 * 60,
  };
  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

// Minimal DOM stubs for the content script. A watch-page URL keeps the
// homepage/redirect branches quiet, and document.hidden stops the dynamic
// settings polling loop after its first pass.
function domStubs() {
  const attrs = {};
  const documentElement = {
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: k => (k in attrs ? attrs[k] : null),
    removeAttribute: k => { delete attrs[k]; },
    hasAttribute: k => k in attrs,
    toggleAttribute: () => {},
  };
  return {
    document: {
      documentElement,
      hidden: true,
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    location: { href: 'https://www.youtube.com/watch?v=repro' },
    window: {},
  };
}

// Load the real content script and return its effective DOM settings.
// Dependencies are loaded individually and their globals passed through,
// because the content script references them at top level (loadSourceFiles
// only exposes cross-file globals after all files have run).
function runContentScriptInit() {
  const stubs = domStubs();
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
    effectiveSettings: stubs.document.documentElement,
    freePremiumSlots: config.PREMIUM_CONFIG.FREE_PREMIUM_SLOTS,
  };
}

describe('Settings persistence across content-script initialization', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('expired premium license + valid session: init must not overwrite stored premium preferences', () => {
    // Day-4 premium user: session still valid, license token expired,
    // more than two premium preferences enabled.
    const seed = { session_token: 'valid-session-token', license_token: expiredPremiumJWT() };
    PREMIUM_PREFS.forEach(id => { seed[id] = true; });
    setStorageData(seed);

    const { effectiveSettings, freePremiumSlots } = runContentScriptInit();

    PREMIUM_PREFS.forEach((id, index) => {
      assert.strictEqual(
        effectiveSettings.getAttribute(id), String(index < freePremiumSlots),
        `${id} did not reflect the signed-in free slot budget`
      );
    });

    const after = getStorageData();
    PREMIUM_PREFS.forEach(id => {
      assert.strictEqual(
        after[id], true,
        `${id} was overwritten in storage by tier enforcement — ` +
        'entitlement must clamp the effective view only, never stored preferences'
      );
    });
  });

  it('signed out (no tokens): init must not overwrite stored premium preferences', () => {
    // Free-tier user with premium preferences left over from a previous
    // subscription. clearAllPremium must stay in-memory only.
    const seed = {};
    PREMIUM_PREFS.forEach(id => { seed[id] = true; });
    setStorageData(seed);

    const { effectiveSettings } = runContentScriptInit();

    PREMIUM_PREFS.forEach(id => {
      assert.strictEqual(
        effectiveSettings.getAttribute(id), 'false',
        `${id} remained effectively enabled during free-tier init`
      );
    });

    const after = getStorageData();
    PREMIUM_PREFS.forEach(id => {
      assert.strictEqual(
        after[id], true,
        `${id} was overwritten in storage during free-tier init`
      );
    });
  });

  it('never leaks private auth or password keys onto YouTube documentElement attributes', () => {
    const seed = {
      session_token: 'secret-session-jwt',
      license_token: validPremiumJWT(),
      user_email: 'private@example.com',
      hashed_password: 'md5-password-hash',
    };
    setStorageData(seed);

    const { ctx, effectiveSettings } = runContentScriptInit();
    ctx.handleNewPage();

    for (const key of ['session_token', 'license_token', 'user_email', 'hashed_password', '_tier', '_sessionToken', '_licenseToken']) {
      assert.strictEqual(
        effectiveSettings.hasAttribute(key), false,
        `${key} should never be exposed on documentElement`
      );
    }
  });

  it('re-derives effective premium settings immediately when auth tokens change without writing storage', () => {
    const seed = { session_token: 'valid-session-token', license_token: expiredPremiumJWT() };
    PREMIUM_PREFS.forEach(id => { seed[id] = true; });
    setStorageData(seed);

    const { ctx, effectiveSettings } = runContentScriptInit();

    // Initially clamped to 2 slots
    assert.strictEqual(effectiveSettings.getAttribute(PREMIUM_PREFS[5]), 'false');

    // License refreshes to valid premium -> all 6 immediately activate
    const freshToken = validPremiumJWT();
    setStorageData({ ...getStorageData(), license_token: freshToken });
    ctx.logStorageChange({ license_token: { oldValue: seed.license_token, newValue: freshToken } }, 'local');
    PREMIUM_PREFS.forEach(id => {
      assert.strictEqual(effectiveSettings.getAttribute(id), 'true', `${id} should activate after license renewal`);
    });

    // User signs out -> all 6 immediately deactivate in memory, while storage stays intact
    const current = getStorageData();
    delete current.session_token;
    delete current.license_token;
    setStorageData(current);
    ctx.logStorageChange({
      session_token: { oldValue: 'valid-session-token', newValue: undefined },
      license_token: { oldValue: freshToken, newValue: undefined },
    }, 'local');

    PREMIUM_PREFS.forEach(id => {
      assert.strictEqual(effectiveSettings.getAttribute(id), 'false', `${id} should deactivate after sign-out`);
      assert.strictEqual(getStorageData()[id], true, `${id} must remain preserved in storage`);
    });
  });
});
