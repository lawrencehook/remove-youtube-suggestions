const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, resetStorage } = require('../setup');

/**
 * auto_skip_ads: mute the ad, click Skip when offered, and restore the
 * user's own mute state afterward. Never seek or change playback speed.
 */

// Fake player whose ad state the test controls.
function fakePlayer() {
  const player = {
    ad: false,
    skipOffered: false,
    skipClicks: 0,
    video: { muted: false, currentTime: 12, playbackRate: 1.5 },
  };
  const skipButton = { offsetParent: {}, click: () => { player.skipClicks += 1; } };
  const documentElement = {
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    hasAttribute: () => false,
    toggleAttribute: () => {},
  };
  player.stubs = {
    document: {
      documentElement,
      hidden: true,
      addEventListener: () => {},
      querySelector: q => {
        if (q === '#movie_player.ad-showing') return player.ad ? {} : null;
        if (q === 'video') return player.video;
        return null;
      },
      querySelectorAll: q => (
        q.includes('.ytp-skip-ad-button') && player.ad && player.skipOffered ? [skipButton] : []
      ),
    },
    location: { href: 'https://www.youtube.com/watch?v=ads' },
    window: {},
  };
  return player;
}

function loadContentScript(stubs) {
  const utils = loadSourceFile('shared/utils.js', stubs);
  const config = loadSourceFile('shared/config.js');
  const shared = loadSourceFile('shared/main.js');
  return loadSourceFile('content-script/main.js', {
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
}

describe('auto_skip_ads mute-and-Skip', () => {
  let player, cs;

  beforeEach(() => {
    resetStorage();
    player = fakePlayer();
    cs = loadContentScript(player.stubs);
  });

  it('mutes during the ad and unmutes afterward', () => {
    player.ad = true;
    cs.skipAds();
    assert.strictEqual(player.video.muted, true);

    player.ad = false;
    cs.skipAds();
    assert.strictEqual(player.video.muted, false);
  });

  it('leaves a user who was already muted muted', () => {
    player.video.muted = true;
    player.ad = true;
    cs.skipAds();
    player.ad = false;
    cs.skipAds();
    assert.strictEqual(player.video.muted, true);
  });

  it('clicks Skip when offered, without seeking or changing speed', () => {
    player.ad = true;
    cs.skipAds();
    assert.strictEqual(player.skipClicks, 0);

    player.skipOffered = true;
    cs.skipAds();
    assert.strictEqual(player.skipClicks, 1);
    assert.strictEqual(player.video.muted, true);
    assert.strictEqual(player.video.currentTime, 12);
    assert.strictEqual(player.video.playbackRate, 1.5);
  });

  it('restoreAdMute (setting turned off or navigation mid-ad) restores the pre-ad state', () => {
    player.ad = true;
    cs.skipAds();
    cs.restoreAdMute();
    assert.strictEqual(player.video.muted, false);

    // A later mute by the user is not undone by a second restore.
    player.video.muted = true;
    cs.restoreAdMute();
    assert.strictEqual(player.video.muted, true);
  });
});
