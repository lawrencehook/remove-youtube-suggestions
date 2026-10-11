const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, resetStorage, setStorageData } = require('../setup');

/**
 * "Hide the notification bell" strips the "(3) " count from the tab title.
 * It must only write the title when the count is present: every write is a
 * DOM mutation, and other extensions (PocketTube, issue #203) treat title
 * mutations as navigations.
 */

function premiumJWT() {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = { email: 't@example.com', premium: true, iat: now, exp: now + 86400 };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`;
}

// Loads the real content script with a document whose title counts writes.
// document.hidden stops the polling loop after its first pass.
function loadWithTitle(initialTitle) {
  const state = { title: initialTitle, writes: 0 };
  const documentElement = {
    setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {},
    hasAttribute: () => false, toggleAttribute: () => {},
  };
  const document = {
    documentElement,
    hidden: true,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    get title() { return state.title; },
    set title(value) { state.title = value; state.writes += 1; },
  };
  const stubs = { document, location: { href: 'https://www.youtube.com/watch?v=x' }, window: {} };
  const utils = loadSourceFile('shared/utils.js', stubs);
  const config = loadSourceFile('shared/config.js');
  const shared = loadSourceFile('shared/main.js');
  const cs = loadSourceFile('content-script/main.js', {
    ...stubs,
    qs: utils.qs, qsa: utils.qsa,
    resultsPageRegex: utils.resultsPageRegex, homepageRegex: utils.homepageRegex,
    shortsRegex: utils.shortsRegex, videoPageRegex: utils.videoPageRegex,
    channelRegex: utils.channelRegex, subsRegex: utils.subsRegex,
    checkSchedule: utils.checkSchedule,
    PREMIUM_CONFIG: config.PREMIUM_CONFIG, TIER: config.TIER,
    DEFAULT_SETTINGS: shared.DEFAULT_SETTINGS,
    migrateRevealSettings: shared.migrateRevealSettings,
    clearAllPremium: shared.clearAllPremium,
    enforceSlotBudget: shared.enforceSlotBudget,
    countActivePremium: shared.countActivePremium,
    PREMIUM_FEATURE_ID_SET: shared.PREMIUM_FEATURE_ID_SET,
    PREMIUM_FEATURE_IDS: shared.PREMIUM_FEATURE_IDS,
  });
  return { state, cs };
}

describe('remove_notif_bell tab title', () => {
  beforeEach(() => {
    resetStorage();
    setStorageData({
      remove_notif_bell: true,
      redirect_off: true,
      license_token: premiumJWT(),
      session_token: 'session',
    });
  });

  it('strips the notification count from the title', () => {
    const { state } = loadWithTitle('(3) Some video - YouTube');
    assert.strictEqual(state.title, ' Some video - YouTube');
    assert.strictEqual(state.writes, 1);
  });

  it('does not write the title when there is no count', () => {
    const { state, cs } = loadWithTitle('Some video - YouTube');
    assert.strictEqual(state.writes, 0);

    // Later polling passes must not write either.
    cs.runDynamicSettings();
    cs.runDynamicSettings();
    assert.strictEqual(state.writes, 0);
    assert.strictEqual(state.title, 'Some video - YouTube');
  });
});
