
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;
const SETTINGS_LIST = {
  "dark_mode":                         { defaultValue: false, eventType: 'click'  },
  "global_enable":                     { defaultValue: true,  eventType: 'click'  },

  "remove_homepage":                   { defaultValue: true,  eventType: 'change' },
  "remove_sidebar":                    { defaultValue: true,  eventType: 'change' },
  "remove_end_of_video":               { defaultValue: true,  eventType: 'change' },

  "remove_all_but_one":                { defaultValue: false, eventType: 'change' },
  "remove_infinite_scroll":            { defaultValue: false, eventType: 'change' },
  "remove_extra_rows":                 { defaultValue: false, eventType: 'change' },

  "remove_logo_link":                  { defaultValue: false, eventType: 'change' },
  "remove_home_link":                  { defaultValue: false, eventType: 'change' },
  "remove_explore_link":               { defaultValue: false, eventType: 'change' },
  "remove_shorts_link":                { defaultValue: false, eventType: 'change' },

  "normalize_shorts":                   { defaultValue: false, eventType: 'change' },
  "auto_skip_ads":                     { defaultValue: false, eventType: 'change' },
  "remove_entire_sidebar":             { defaultValue: false, eventType: 'change' },
  "disable_autoplay":                  { defaultValue: false, eventType: 'change' },
  "remove_info_cards":                 { defaultValue: false, eventType: 'change' },
  "remove_play_next_button":           { defaultValue: false, eventType: 'change' },
  "remove_comments":                   { defaultValue: false, eventType: 'change' },
  "remove_chat":                       { defaultValue: false, eventType: 'change' },
  "remove_menu_buttons":               { defaultValue: false, eventType: 'change' },

  "remove_extra_results":              { defaultValue: false, eventType: 'change' },
  "remove_shorts_results":             { defaultValue: false, eventType: 'change' },
  "remove_thumbnail_mouseover_effect": { defaultValue: false, eventType: 'change' },

  "redirect_off":                      { defaultValue: true,  eventType: 'change' },
  "redirect_to_subs":                  { defaultValue: false, eventType: 'change' },
  "redirect_to_wl":                    { defaultValue: false, eventType: 'change' },
};

// Redirect setting constants.
const REDIRECT_URLS = {
  "redirect_off":     false,
  "redirect_to_subs": 'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl":   'https://www.youtube.com/playlist/?list=WL',
};

const resultsPageRegex = new RegExp('.*://.*youtube\.com/results.*', 'i');
const homepageRegex =    new RegExp('.*://.*youtube\.com/$',         'i');
const shortsRegex =      new RegExp('.*://.*youtube\.com/shorts.*',  'i');


// Initialize HTML attributes with local settings, or default.
const cache = {};
try {
  browser.storage.local.get(localSettings => {
    Object.entries(SETTINGS_LIST).forEach(([key, { defaultValue }]) => {
      HTML.setAttribute(key, localSettings[key] ?? defaultValue);
      cache[key] = localSettings[key] ?? defaultValue;
    });
  });
} catch (e) {
  console.log(e);
}

// Update HTML attributes in real time.
//   receive messages from options.js
browser.runtime.onMessage.addListener((data, sender) => {
  const { settingChanges, urlChange } = data;
  if (settingChanges) {
    settingChanges.forEach(({ key, value }) => {
      // console.log(`Updating ${key} to ${value}`);
      HTML.setAttribute(key, value);
      cache[key] = value;
    });
  }

  return true;
});

function handleRedirects() {
  if (cache['global_enable'] !== true) return;

  const currentUrl = location.href;

  // Mark whether or not we're on the "results" page
  const onResultsPage = resultsPageRegex.test(currentUrl);
  HTML.setAttribute('on_results_page', onResultsPage);

  // Redirect homepage
  const onHomepage = homepageRegex.test(currentUrl);
  if (onHomepage && !cache['redirect_off']) {
    if (cache['redirect_to_subs']) location.replace(REDIRECT_URLS['redirect_to_subs']);
    if (cache['redirect_to_wl'])   location.replace(REDIRECT_URLS['redirect_to_wl']);
  }

  // Redirect shorts
  const onShorts = shortsRegex.test(currentUrl);
  if (onShorts && cache['normalize_shorts']) {
    const newUrl = currentUrl.replace('shorts', 'watch');
    location.replace(newUrl);
  }
}


// Dynamic settings (i.e. js instead of css)
let counter = 0, hyper = false, originalPlayback;
let onResultsPage = resultsPageRegex.test(location.href);
document.addEventListener("DOMContentLoaded", event => {
  handleRedirects();

  let url = location.href;
  const observer = new MutationObserver(mutations => {
    if (cache['global_enable'] !== true) return;

    // Give the browser time to breathe
    if (counter++ % 2 === 0) return;

    if (url !== location.href) {
      url = location.href;
      onResultsPage = resultsPageRegex.test(location.href);
      handleRedirects();
    }

    // Hide shorts on the results page
    if (onResultsPage) {
      const shortResults = Array.from(document.querySelectorAll('a[href^="/shorts/"]:not([marked_as_short])'));
      shortResults.forEach(sr => {
        sr.setAttribute('marked_as_short', true);
        const result = sr.closest('ytd-video-renderer');
        result.setAttribute('is_short', true);
      })
    }

    // Disable autoplay
    if (cache['disable_autoplay'] === true) {
      document.querySelectorAll('.ytp-autonav-toggle-button[aria-checked=true]')?.[0]?.click();
    }

    // Skip through ads
    if (cache['auto_skip_ads'] === true) {

      // Close overlay ads.
      Array.from(document.querySelectorAll('.ytp-ad-overlay-close-button'))?.forEach(e => e?.click());

      // Click on "Skip ad" button
      const skippableAd = document.querySelectorAll('.ytp-ad-skip-button').length;
      if (skippableAd) {
        document.querySelectorAll('.ytp-ad-skip-button')?.[0]?.click();
        return;
      }

      // Speed through ads that can't be skipped (yet).
      const adElement = document.querySelectorAll('.video-ads.ytp-ad-module')[0];
      const adActive = adElement && window.getComputedStyle(adElement).display !== 'none';
      if (adActive) {
        if (!hyper) {
          originalPlayback = document.getElementsByTagName("video")[0].playbackRate;
          hyper = true;
        }
        document.getElementsByTagName("video")[0].playbackRate = 5;
      } else {
        if (hyper) {
          document.getElementsByTagName("video")[0].playbackRate = originalPlayback;
          hyper = false;
        }
      }
    }

    // if (cache['change_playback_speed']) {
    //   document.getElementsByTagName("video")[0].playbackRate = Number(cache['change_playback_speed']);
    // }
  });
  observer.observe(document.body, { subtree: true, childList: true });
});
