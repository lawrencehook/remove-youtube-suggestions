const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadSourceFile, resetStorage } = require('../setup');

/**
 * remove_keyword_videos: tag each video whose title has a blocked keyword
 * (rys_keyword_blocked) and let the CSS hide the tag. Items are re-checked when
 * YouTube reuses them for a new video or when the keyword list changes.
 */

const BLOCKED = 'rys_keyword_blocked';

// Fake feed item: the parts of the DOM hideKeywordBlockedVideos touches.
function fakeItem({ tag = 'ytd-video-renderer', title = '', inRichItem = false } = {}) {
  const item = {
    tag,
    title,
    attrs: new Set(),
    matches: selector => selector === tag,
    closest: selector => (inRichItem && selector === 'ytd-rich-item-renderer' ? {} : null),
    querySelector: () => (item.title === null ? null : { textContent: item.title }),
    toggleAttribute(name, force) {
      if (force) this.attrs.add(name); else this.attrs.delete(name);
    },
  };
  return item;
}

function loadContentScript(items) {
  const stubs = {
    document: {
      documentElement: {
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {},
        toggleAttribute: () => {},
      },
      hidden: true,
      addEventListener: () => {},
      querySelector: () => null,
      // Only the feed-item query returns anything.
      querySelectorAll: q => (q.includes('yt-lockup-view-model') ? items : []),
    },
    location: { href: 'https://www.youtube.com/results?search_query=x' },
    window: {},
  };
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
    compileBlockedKeywords: shared.compileBlockedKeywords,
    titleHasBlockedKeyword: shared.titleHasBlockedKeyword,
  });
}

describe('remove_keyword_videos', () => {
  let items, cs;

  beforeEach(() => {
    resetStorage();
    items = [];
    cs = loadContentScript(items);
  });

  const run = keywords => {
    cs.cache['blocked_keywords'] = keywords;
    cs.hideKeywordBlockedVideos();
  };

  it('tags only the videos whose title has a keyword', () => {
    const hit = fakeItem({ title: 'Resumo da POLÍTICA hoje' });
    const miss = fakeItem({ title: 'Receita de bolo' });
    items.push(hit, miss);
    run('politica');
    assert.ok(hit.attrs.has(BLOCKED));
    assert.ok(!miss.attrs.has(BLOCKED));
  });

  it('tags nothing when the list is empty', () => {
    const item = fakeItem({ title: 'Qualquer título' });
    items.push(item);
    run('');
    assert.ok(!item.attrs.has(BLOCKED));
  });

  it('never tags an item that has no title yet', () => {
    const noTitle = fakeItem({ title: null });
    const emptyTitle = fakeItem({ title: '' });
    items.push(noTitle, emptyTitle);
    run('politica');
    assert.ok(!noTitle.attrs.has(BLOCKED));
    assert.ok(!emptyTitle.attrs.has(BLOCKED));
  });

  it('skips a lockup inside a rich grid item so the grid hides the whole item', () => {
    const richItem = fakeItem({ tag: 'ytd-rich-item-renderer', title: 'Política' });
    const lockup = fakeItem({ tag: 'yt-lockup-view-model', title: 'Política', inRichItem: true });
    const sidebarLockup = fakeItem({ tag: 'yt-lockup-view-model', title: 'Política' });
    items.push(richItem, lockup, sidebarLockup);
    run('politica');
    assert.ok(richItem.attrs.has(BLOCKED));
    assert.ok(!lockup.attrs.has(BLOCKED));
    assert.ok(sidebarLockup.attrs.has(BLOCKED));
  });

  it('re-checks an item YouTube reuses for a different video', () => {
    const item = fakeItem({ title: 'Política hoje' });
    items.push(item);
    run('politica');
    assert.ok(item.attrs.has(BLOCKED));

    item.title = 'Receita de bolo';
    run('politica');
    assert.ok(!item.attrs.has(BLOCKED));

    item.title = 'Mais política';
    run('politica');
    assert.ok(item.attrs.has(BLOCKED));
  });

  it('re-checks every item when the keyword list changes', () => {
    const item = fakeItem({ title: 'Jogo de futebol' });
    items.push(item);
    run('politica');
    assert.ok(!item.attrs.has(BLOCKED));

    run('politica, futebol');
    assert.ok(item.attrs.has(BLOCKED));

    run('politica');
    assert.ok(!item.attrs.has(BLOCKED));
  });
});

describe('keyword blocking stylesheet', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../src/content-script/main.css'), 'utf-8');

  it('hides the tagged items only while the setting and the extension are on', () => {
    assert.ok(css.includes('html[global_enable="true"][remove_keyword_videos="true"] [rys_keyword_blocked]'));
  });
});
