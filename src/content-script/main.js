
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
const homepageRegex =    new RegExp('.*://(www|m)\.youtube\.com(/)?$',  'i');
const shortsRegex =      new RegExp('.*://.*youtube\.com/shorts.*',  'i');
const videoRegex =       new RegExp('.*://.*youtube\.com/watch\\?v=.*',  'i');
const subsRegex =        new RegExp(/\/feed\/subscriptions$/, 'i');

// Dynamic settings variables
const cache = {};
let url = location.href;
let theaterClicked = false, hyper = false;
let onResultsPage = resultsPageRegex.test(url);
let onHomepage = homepageRegex.test(url);
let onShorts = shortsRegex.test(url);
let onVideo = videoRegex.test(url);
let onSubs = subsRegex.test(url);

let dynamicIters = 0;
let frameRequested = false;
let isRunning = false;
// let lastRun = Date.now();
// let counter = 0;
let lastScheduleCheck;
const scheduleInterval = 2_000; // 2 seconds


// Respond to changes in settings
function logStorageChange(changes, area) {
  if (area !== 'local') return;

  Object.entries(changes).forEach(([id, { oldValue, newValue }]) => {
    if (oldValue === newValue) return;

    HTML.setAttribute(id, newValue);
    cache[id] = newValue;

    if (id.includes('schedule')) {
      lastScheduleCheck = null;
    }
  });
}
browser.storage.onChanged.addListener(logStorageChange);


// Get settings
browser.storage.local.get(settings => {
  if (!settings) return;

  Object.entries({ ...DEFAULT_SETTINGS, ...settings}).forEach(([ id, value ]) => {
    HTML.setAttribute(id, value);
    cache[id] = value;
  });

  const init = {};
  Object.entries(DEFAULT_SETTINGS).forEach(([ id, value]) => {
    if (!(id in settings)) init[id] = value;
  });
  browser.storage.local.set(init);

  runDynamicSettings();
});


document.addEventListener("DOMContentLoaded", e => handleNewPage());


// Dynamic settings (i.e. js instead of css)
function runDynamicSettings() {
  if (isRunning) return;
  // console.log('runDynamicSettings', Date.now() - lastRun);
  // lastRun = Date.now();
  isRunning = true;
  dynamicIters += 1;
  const on = cache['global_enable'] === true;

  // Scheduling, timedChanges
  timeBlock: try {

    // Timed changes
    const { nextTimedChange, nextTimedValue } = cache;
    if (nextTimedChange) {
      if (Date.now() > Number(nextTimedChange)) {
        updateSetting('nextTimedChange', false);
        updateSetting('global_enable', nextTimedValue);
      }
      break timeBlock;
    }

    // Scheduling
    const scheduleEnabled = cache['schedule'];
    const scheduleCheckTimeElapsed = Date.now() - lastScheduleCheck > scheduleInterval;
    if (scheduleEnabled && (!lastScheduleCheck || scheduleCheckTimeElapsed)) {
      lastScheduleCheck = Date.now();
      const scheduleIsActive = checkSchedule(cache['scheduleTimes'], cache['scheduleDays']);
      const scheduleChange = (scheduleIsActive && !on) || (!scheduleIsActive && on);
      if (scheduleChange) {
        updateSetting('global_enable', !on);
      }
    }
  } catch (error) {
    console.log(error);
  }

  if (!on) {
    frameRequested = false;
    isRunning = false;
    requestRunDynamicSettings();
    return;
  }

  // Check if the URL has changed (YouTube is a Single-Page Application)
  if (url !== location.href) {
    handleNewPage();
  }

  // Dynamic settings
  try {

    // Hide all shorts
    if (cache['remove_all_shorts']) {
      const shortsBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]';
      const shortBadges = qsa(shortsBadgeSelector);
      shortBadges?.forEach(badge => {
        const sidebarVid = badge.closest('ytd-compact-video-renderer');
        sidebarVid?.setAttribute('is_short', '');
        const gridVideo = badge.closest('ytd-grid-video-renderer');
        gridVideo?.setAttribute('is_short', '');
      });

      const shortsShelfSelector = '*[is-shorts]';
      const shortsShelves = qsa(shortsShelfSelector);
      shortsShelves?.forEach(shelf => {
        const shelfContainer = shelf.closest('ytd-rich-section-renderer');
        shelfContainer?.setAttribute('is_short', '');
      });
    }

    // Subscriptions page options
    if (onSubs) {
      const badgeSelector = 'ytd-badge-supported-renderer';
      const upcomingBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"]';
      const shortsBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]';
      const addBadgeTextToVideo = badge => {
        const badgeText = badge.innerText.trim().toLowerCase();
        if (badgeText) {
          const gridVideo = badge.closest('ytd-grid-video-renderer');
          gridVideo?.setAttribute('badge-text', badgeText);
        }
      };

      // Live / Premiere
      const badges = qsa(badgeSelector);
      badges.forEach(addBadgeTextToVideo);

      // Upcoming
      const upcomingBadges = qsa(upcomingBadgeSelector);
      upcomingBadges.forEach(addBadgeTextToVideo);

      // Shorts
      const shortBadges = qsa(shortsBadgeSelector);
      shortBadges.forEach(badge => {
        const video = badge.closest('ytd-grid-video-renderer');
        video?.setAttribute('is_sub_short', '');
      });
    }

    // Hide shorts on the results page
    if (onResultsPage) {
      const shortResults = qsa('a[href^="/shorts/"]:not([marked_as_short])');
      shortResults.forEach(sr => {
        sr.setAttribute('marked_as_short', true);
        const result = sr.closest('ytd-video-renderer');
        result?.setAttribute('is_short', true);

        // Mobile
        const mobileResult = sr.closest('ytm-video-with-context-renderer');
        mobileResult?.setAttribute('is_short', true);
      });
    }

    // Click on "dismiss" buttons
    const dismissButtons = qsa('#dismiss-button');
    dismissButtons.forEach(dismissButton => {
      if (dismissButton && dismissButton.offsetParent) {
        dismissButton.click();
      }
    })

    // Disable autoplay
    if (cache['disable_autoplay'] === true) {
      const autoplayButton = qsa('.ytp-autonav-toggle-button[aria-checked=true]');
      autoplayButton?.forEach(e => {
        if (e && e.offsetParent) {
          e.click();
        }
      });

      // mobile
      const mAutoplayButton = qsa('.ytm-autonav-toggle-button-container[aria-pressed=true]');
      mAutoplayButton?.forEach(e => {
        if (e && e.offsetParent) {
          e.click();
        }
      });
    }

    if (onVideo) {

      // Check if the video player is visible
      const video = qs('ytd-player');
      if (video && video.offsetParent) {

        // Initialize the settings menu -- creates toggles for ambient mode and annotations.
        const checkMenuItems = qsa('.ytp-settings-menu .ytp-panel-menu > div');
        if (checkMenuItems?.length === 0) {
          const settingsButton = qsa('#ytd-player button.ytp-settings-button');
          settingsButton.forEach(b => {
            if (b && b.offsetParent) {
              b.click();
              b.click();
            }
          });
        }
      }

      const menuItems = qsa('.ytp-settings-menu .ytp-panel-menu > div');
      const checkBoxes = menuItems.filter(n => n.getAttribute('aria-checked'));
      const [ ambientToggle, annotationsToggle ] = checkBoxes;

      // Disable ambient mode
      if (cache['disable_ambient_mode'] === true) {
        if (ambientToggle?.getAttribute('aria-checked') === 'true') {
          ambientToggle.click();
        }
      }

      // Disable annotations
      if (cache['disable_annotations'] === true) {
        if (annotationsToggle?.getAttribute('aria-checked') === 'true') {
          annotationsToggle.click();
        }
      }
    }

    // // Enable theater mode
    // if (cache['enable_theater'] === true && !theaterClicked) {
    //   const theaterButton = qsa('button[title="Theater mode (t)"]')?.[0];
    //   if (theaterButton && theaterButton.display !== 'none') {
    //     console.log('theaterButton.click();')
    //     theaterButton.click();
    //     theaterClicked = true;
    //   }
    // }

    // Skip through ads
    if (cache['auto_skip_ads'] === true) {

      // Close overlay ads.
      qsa('.ytp-ad-overlay-close-button')?.forEach(e => {
        if (e && e.offsetParent) {
          e.click();
        }
      });

      // Click on "Skip ad" button
      const skipButtons = qsa('.ytp-ad-skip-button');
      const skippableAd = skipButtons.some(button => button.offsetParent);
      if (skippableAd) {
        qsa('.ytp-ad-skip-button')?.forEach(e => {
          if (e && e.offsetParent) {
            e.click();
          }
        });
      } else {

        // Speed through ads that can't be skipped (yet).
        let adSelector = '.ytp-ad-player-overlay-instream-info';
        let adElement = qsa(adSelector)[0];
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
      const timestamps = qsa('yt-formatted-string:not(.published-time-text).ytd-comment-renderer > a.yt-simple-endpoint[href^="/watch"]');
      timestamps.forEach(timestamp => {
        const comment = timestamp.closest('ytd-comment-thread-renderer');
        comment?.setAttribute('timestamp_comment', '');
      });
    }

    // Disable play on hover
    if (dynamicIters % 10 === 0) {
      const prefCookie = getCookie('PREF');
      const prefObj = prefCookie?.split('&')?.reduce((acc, x) => {
        const [ key, value ] = x.split('=');
        acc[key] = value;
        return acc;
      }, {});
      if (prefObj) {
        const f7 = prefObj['f7'] || '0';
        const playOnHoverEnabled = f7[f7.length-1] === '0';

        if (cache['disable_play_on_hover'] && playOnHoverEnabled) {
          prefObj['f7'] = f7.substring(0, f7.length-1) + '1';
          const newPref = Object.entries(prefObj).map(([key, value]) => `${key}=${value}`).join('&');
          setCookie('PREF', newPref);
        } else if (!cache['disable_play_on_hover'] && !playOnHoverEnabled) {
          prefObj['f7'] = f7.substring(0, f7.length-1) + '0';
          const newPref = Object.entries(prefObj).map(([key, value]) => `${key}=${value}`).join('&');
          setCookie('PREF', newPref);
        }
      }
    }

    // Show description if comments are hidden
    if (cache['remove_comments']) {
      const expandButton = qsa('#description #expand.button');
      expandButton.forEach(b => {
        if (b && b.offsetParent) {
          b.click();
        }
      });
    }

  } catch (error) {
    console.log(error);
  }

  frameRequested = false;
  isRunning = false;
  requestRunDynamicSettings();
}


function requestRunDynamicSettings() {
  if (frameRequested || isRunning) return;
  frameRequested = true;
  // setTimeout(() => runDynamicSettings(), 50);
  setTimeout(() => runDynamicSettings(), Math.min(100, 50 + 10 * dynamicIters));
}


function injectScripts() {
  const on = cache['global_enable'] === true;
  if (!on) return;

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
  const on = cache['global_enable'] === true;

  dynamicIters = 0;
  url = location.href;
  theaterClicked = false;
  hyper = false;
  onResultsPage = resultsPageRegex.test(url);
  onHomepage = homepageRegex.test(url);
  onShorts = shortsRegex.test(url);
  onVideo = videoRegex.test(url);
  onSubs = subsRegex.test(url);

  // Mark whether or not we're on the search results page
  HTML.setAttribute('on_results_page', onResultsPage);

  // Mark whether or not we're on the homepage
  HTML.setAttribute('on_homepage', onHomepage);

  // Homepage redirects
  if (on && onHomepage && !cache['redirect_off']) {
    if (cache['redirect_to_subs'])    location.replace(REDIRECT_URLS['redirect_to_subs']);
    if (cache['redirect_to_wl'])      location.replace(REDIRECT_URLS['redirect_to_wl']);
    if (cache['redirect_to_library']) location.replace(REDIRECT_URLS['redirect_to_library']);
  }

  // Redirect the shorts player
  if (on && onShorts && cache['normalize_shorts']) {
    const newUrl = url.replace('shorts', 'watch');
    location.replace(newUrl);
  }

  injectScripts();
  requestRunDynamicSettings();
}

function setCookie(cname, cvalue, exdays=370) {
  const d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";domain=.youtube.com;path=/";
}

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function updateSetting(id, value) {
  HTML.setAttribute(id, value);
  cache[id] = value;
  browser.storage.local.set({ [id]: value });
}
