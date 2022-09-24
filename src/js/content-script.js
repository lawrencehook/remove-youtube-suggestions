
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;

// Redirect setting constants.
const REDIRECT_URLS = {
  "redirect_off":        false,
  "redirect_to_subs":    'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl":      'https://www.youtube.com/playlist/?list=WL',
  "redirect_to_library": 'https://www.youtube.com/feed/library',
};

const resultsPageRegex = new RegExp('.*://.*youtube\.com/results.*', 'i');
const homepageRegex =    new RegExp('.*://(www|m)\.youtube\.com/$',  'i');
const shortsRegex =      new RegExp('.*://.*youtube\.com/shorts.*',  'i');

// Dynamic settings variables
const cache = {};
let url;
let counter = 0, theaterClicked = false, hyper = false;
let originalPlayback, originalMuted;
let onResultsPage = resultsPageRegex.test(location.href);
let frameRequested = false;


// Send a "get settings" message to the background script.
browser.runtime.sendMessage({ getSettings: true });


// Update HTML attributes in real time.
//   receive messages from options.js
browser.runtime.onMessage.addListener((data, sender) => {
  const { settings } = data;

  if (!settings) return;
  Object.entries(settings).forEach(([ id, value ]) => {
    HTML.setAttribute(id, value);
    cache[id] = value;
  });

  runDynamicSettings();

  return true;
});


// Dynamic settings (i.e. js instead of css)
document.addEventListener("DOMContentLoaded", event => {
  url = undefined;
  counter = 0;
  theaterClicked = false;
  hyper = false;
  originalPlayback = undefined;
  originalMuted = undefined;
  onResultsPage = resultsPageRegex.test(location.href);

  requestRunDynamicSettings()
});


function runDynamicSettings() {
  frameRequested = false;

  if ('global_enable' in cache && cache['global_enable'] !== true) {
    requestRunDynamicSettings()
    return;
  }

  // Check if the URL has changed (YouTube is a Single-Page Application)
  if (url !== location.href) {
    url = location.href;
    theaterClicked = false;
    hyper = false;
    originalPlayback = undefined;
    originalMuted = undefined;
    onResultsPage = resultsPageRegex.test(location.href);
    handleUrlChange();
  }

  // Mark the left nav bar sections
  // const leftSections = document.querySelectorAll('ytd-guide-section-renderer');
  // leftSections.forEach(section => {
  //   const title = section.querySelector('#guide-section-title');
  //   console.log('title', title.innerText);
  // });

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
    const autoplayButton = document.querySelectorAll('.ytp-autonav-toggle-button[aria-checked=true]');
    autoplayButton?.forEach(e => {
      if (e && e.offsetParent) {
        e.click();
      }
    });

    // mobile
    const mAutoplayButton = document.querySelectorAll('.ytm-autonav-toggle-button-container[aria-pressed=true]');
    mAutoplayButton?.forEach(e => {
      if (e && e.offsetParent) {
        e.click();
      }
    });
  }

  // // Enable theater mode
  // if (cache['enable_theater'] === true && !theaterClicked) {
  //   const theaterButton = document.querySelectorAll('button[title="Theater mode (t)"]')?.[0];
  //   if (theaterButton && theaterButton.display !== 'none') {
  //     console.log('theaterButton.click();')
  //     theaterButton.click();
  //     theaterClicked = true;
  //   }
  // }

  // Skip through ads
  if (cache['auto_skip_ads'] === true) {

    // Close overlay ads.
    Array.from(document.querySelectorAll('.ytp-ad-overlay-close-button'))?.forEach(e => {
      if (e && e.offsetParent) {
        e.click();
      }
    });

    // Click on "Skip ad" button
    const skippableAd = document.querySelectorAll('.ytp-ad-skip-button').length;
    if (skippableAd) {
      document.querySelectorAll('.ytp-ad-skip-button')?.forEach(e => {
        if (e && e.offsetParent) {
          e.click();
        }
      });
    } else {

      // Speed through ads that can't be skipped (yet).
      const adSelector = '.ytp-ad-player-overlay-instream-info';
      const adElement = document.querySelectorAll(adSelector)[0];
      const adActive = adElement && window.getComputedStyle(adElement).display !== 'none';
      if (adActive) {
        if (!hyper) {
          originalPlayback = document.getElementsByTagName("video")[0].playbackRate;
          originalMuted = document.getElementsByTagName("video")[0].muted;
          hyper = true;
        }
        document.getElementsByTagName("video")[0].playbackRate = 10;
        document.getElementsByTagName("video")[0].muted = true;
      } else {
        if (hyper) {
          document.getElementsByTagName("video")[0].playbackRate = originalPlayback;
          document.getElementsByTagName("video")[0].muted = originalMuted;
          hyper = false;
        }
      }

    }
  }

  // if (cache['change_playback_speed']) {
  //   document.getElementsByTagName("video")[0].playbackRate = Number(cache['change_playback_speed']);
  // }

  requestRunDynamicSettings()
}


function handleUrlChange() {
  if (cache['global_enable'] !== true) return;

  const currentUrl = location.href;

  // Mark whether or not we're on the "results" page
  const onResultsPage = resultsPageRegex.test(currentUrl);
  HTML.setAttribute('on_results_page', onResultsPage);

  // Redirect the homepage
  const onHomepage = homepageRegex.test(currentUrl);
  if (onHomepage && !cache['redirect_off']) {
    if (cache['redirect_to_subs'])    location.replace(REDIRECT_URLS['redirect_to_subs']);
    if (cache['redirect_to_wl'])      location.replace(REDIRECT_URLS['redirect_to_wl']);
    if (cache['redirect_to_library']) location.replace(REDIRECT_URLS['redirect_to_library']);
  }

  // Redirect the shorts player
  const onShorts = shortsRegex.test(currentUrl);
  if (onShorts && cache['normalize_shorts']) {
    const newUrl = currentUrl.replace('shorts', 'watch');
    location.replace(newUrl);
  }
}


function requestRunDynamicSettings() {
  if (frameRequested) return;
  frameRequested = true;
  setTimeout(() => runDynamicSettings(), 50);
}
