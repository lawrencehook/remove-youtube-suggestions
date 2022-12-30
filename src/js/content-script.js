
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
const videoRegex =       new RegExp('.*://.*youtube\.com/watch\\?v=.*',  'i');
const subsRegex =        new RegExp(/\/feed\/subscriptions$/, 'i');

// Dynamic settings variables
const cache = {};
let url;
let counter = 0, theaterClicked = false, hyper = false;
let onResultsPage = resultsPageRegex.test(location.href);
let frameRequested = false;
let dynamicIters = 0;


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
  onResultsPage = resultsPageRegex.test(location.href);

  handleNewPage();
});

// let lastRun = Date.now();
let isRunning = false;
function runDynamicSettings() {
  if (isRunning) return;
  isRunning = true;
  dynamicIters += 1;

  // console.log('runDynamicSettings', Date.now() - lastRun);
  // lastRun = Date.now();

  if ('global_enable' in cache && cache['global_enable'] !== true) {
    requestRunDynamicSettings()
    return;
  }

  // Check if the URL has changed (YouTube is a Single-Page Application)
  if (url !== location.href) {
    url = location.href;
    theaterClicked = false;
    hyper = false;
    onResultsPage = resultsPageRegex.test(location.href);
    handleNewPage();
  }

  // Mark the left nav bar sections
  const leftSections = document.querySelectorAll('ytd-guide-section-renderer');
  leftSections.forEach(section => {
    const title = section.querySelector('#guide-section-title');
    if (!title?.innerText) return;
    const titleText = title.innerText.toLowerCase();
    if (titleText.includes('subscriptions')) section.setAttribute('rys_sub_section', '');
    if (titleText.includes('explore'))       section.setAttribute('rys_explore_section', '');
    if (titleText.includes('more from'))     section.setAttribute('rys_more_section', '');
  });

  // Subscriptions page options
  if (subsRegex.test(url)) {
    const badgeSelector = 'ytd-badge-supported-renderer';
    const upcomingBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"]';
    const shortsBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]';
    const addBadgeTextToVideo = badge => {
      const badgeText = badge.innerText.trim().toLowerCase();
      if (badgeText) {
        const video = badge.closest('ytd-grid-video-renderer');
        video?.setAttribute('badge-text', badgeText);
      }
    };

    // Live / Premiere
    const badges = document.querySelectorAll(badgeSelector);
    badges.forEach(addBadgeTextToVideo);

    // Upcoming
    const upcomingBadges = document.querySelectorAll(upcomingBadgeSelector);
    upcomingBadges.forEach(addBadgeTextToVideo);

    // Shorts
    const shortBadges = document.querySelectorAll(shortsBadgeSelector);
    shortBadges.forEach(badge => {
      const video = badge.closest('ytd-grid-video-renderer');
      video?.setAttribute('is_sub_short', '');
    });
  }

  // Hide shorts on the results page
  if (onResultsPage) {
    const shortResults = Array.from(document.querySelectorAll('a[href^="/shorts/"]:not([marked_as_short])'));
    shortResults.forEach(sr => {
      sr.setAttribute('marked_as_short', true);
      const result = sr.closest('ytd-video-renderer');
      result?.setAttribute('is_short', true);
    })
  }

  // Click on "dismiss" buttons
  const dismissButtons = document.querySelectorAll('#dismiss-button');
  dismissButtons.forEach(dismissButton => {
    if (dismissButton && dismissButton.offsetParent) {
      dismissButton.click();
    }
  })

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

  // Disable ambient mode
  if (cache['disable_ambient_mode'] === true) {
    const ambientToggle = Array.from(document.querySelectorAll('.ytp-menuitem-label')).
                            filter(label => label.innerText.toLowerCase() === 'ambient mode').
                            map(n => n.parentNode).
                            filter(n => n.getAttribute('aria-checked') === 'true').
                            map(n => n.querySelector('.ytp-menuitem-toggle-checkbox')).
                            forEach(n => n.click());
  }

  // Disable annotations
  if (cache['disable_annotations'] === true) {
    const annotationsToggle = Array.from(document.querySelectorAll('.ytp-menuitem-label')).
                                filter(label => label.innerText.toLowerCase() === 'annotations').
                                map(n => n.parentNode).
                                filter(n => n.getAttribute('aria-checked') === 'true').
                                map(n => n.querySelector('.ytp-menuitem-toggle-checkbox')).
                                forEach(n => n.click());
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
    const skipButtons = Array.from(document.querySelectorAll('.ytp-ad-skip-button'));
    const skippableAd = skipButtons.some(button => button.offsetParent);
    if (skippableAd) {
      document.querySelectorAll('.ytp-ad-skip-button')?.forEach(e => {
        if (e && e.offsetParent) {
          e.click();
        }
      });
    } else {

      // Speed through ads that can't be skipped (yet).
      let adSelector = '.ytp-ad-player-overlay-instream-info';
      let adElement = document.querySelectorAll(adSelector)[0];
      const adActive = adElement && window.getComputedStyle(adElement).display !== 'none';
      const video = document.getElementsByTagName("video")[0];
      if (adActive) {
        if (!hyper) {
          hyper = true;
        }
        video.playbackRate = 10;
        video.muted = true;
      } else {
        if (hyper) {
          let playbackRate = 1;
          let muted = false;
          try {
            const playbackRateObject = window.sessionStorage['yt-player-playback-rate'];
            const volumeObject = window.sessionStorage['yt-player-volume'];
            playbackRate = Number(JSON.parse(playbackRateObject).data);
            muted = JSON.parse(JSON.parse(volumeObject).data).muted;
          } catch (error) {
            console.log(error);
          }
          video.playbackRate = playbackRate !== undefined ? playbackRate : 1;
          video.muted = muted !== undefined ? muted : false;
          hyper = false;
        }
      }
    }
  }

  // if (cache['change_playback_speed']) {
  //   document.getElementsByTagName("video")[0].playbackRate = Number(cache['change_playback_speed']);
  // }

  // Hide all but the timestamped comments
  if (cache['remove_non_timestamp_comments']) {
    const timestamps = document.querySelectorAll('yt-formatted-string:not(.published-time-text).ytd-comment-renderer > a.yt-simple-endpoint[href^="/watch"]');
    timestamps.forEach(timestamp => {
      const comment = timestamp.closest('ytd-comment-thread-renderer');
      comment?.setAttribute('timestamp_comment', '');
    });
  }

  frameRequested = false;
  isRunning = false;
  requestRunDynamicSettings();
}


function injectScripts() {

  // Disable playlist autoplay
  if (cache['disable_playlist_autoplay']) {
    const existingScript = document.querySelector('script[id="disable_playlist_autoplay"]')
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = 'disable_playlist_autoplay';
    script.type = "text/javascript";
    script.innerText = `
(function() {
let pm;
function f() {
  if (!pm) pm = document.querySelector('yt-playlist-manager');
  if (pm) pm.canAutoAdvance_ = false;
}
f();
setInterval(f, 100);
})()
`;
    document.body?.appendChild(script);
  }

}


function handleNewPage() {
  if (cache['global_enable'] !== true) return;

  dynamicIters = 0;

  const currentUrl = location.href;
  const onHomepage = homepageRegex.test(currentUrl);
  const onResultsPage = resultsPageRegex.test(currentUrl);
  const onShorts = shortsRegex.test(currentUrl);

  // Mark whether or not we're on the search results page
  HTML.setAttribute('on_results_page', onResultsPage);

  // Mark whether or not we're on the homepage
  HTML.setAttribute('on_homepage', onHomepage);

  // Homepage redirects
  if (onHomepage && !cache['redirect_off']) {
    if (cache['redirect_to_subs'])    location.replace(REDIRECT_URLS['redirect_to_subs']);
    if (cache['redirect_to_wl'])      location.replace(REDIRECT_URLS['redirect_to_wl']);
    if (cache['redirect_to_library']) location.replace(REDIRECT_URLS['redirect_to_library']);
  }

  // Redirect the shorts player
  if (onShorts && cache['normalize_shorts']) {
    const newUrl = currentUrl.replace('shorts', 'watch');
    location.replace(newUrl);
  }

  injectScripts();
  requestRunDynamicSettings();
}


function requestRunDynamicSettings() {
  if (frameRequested || isRunning) return;
  frameRequested = true;
  // setTimeout(() => runDynamicSettings(), 50);
  setTimeout(() => runDynamicSettings(), Math.min(100, 50 + 10 * dynamicIters));
}
