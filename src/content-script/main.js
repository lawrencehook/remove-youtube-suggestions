
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
const homepageRegex    = new RegExp('.*://(www|m)\.youtube\.com(/)?$',  'i');
const shortsRegex      = new RegExp('.*://.*youtube\.com/shorts.*',  'i');
const videoRegex       = new RegExp('.*://.*youtube\.com/watch\\?v=.*',  'i');
const channelRegex     = new RegExp('.*://.*youtube\.com/(@|channel)', 'i');
const subsRegex        = new RegExp(/\/feed\/subscriptions$/, 'i');

// Dynamic settings variables
const cache = {};
let url = location.href;
let theaterClicked = false, hyper = false;
let onResultsPage = resultsPageRegex.test(url);
let onHomepage = homepageRegex.test(url);
let onShorts = shortsRegex.test(url);
let onVideo = videoRegex.test(url);
let onChannel = channelRegex.test(url);
let onSubs = subsRegex.test(url);
let settingsInit = false

let dynamicIters = 0;
let frameRequested = false;
let isRunning = false;
// let lastRun = Date.now();
// let counter = 0;
let lastScheduleCheck;
const scheduleInterval = 2_000; // 2 seconds
let lastRedirect;
const redirectInterval = 1_000; // 1 second


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

  // Double check for redirects.
  if (onHomepage && !cache['redirect_off']) {
    handleNewPage();
  }

  // Dynamic settings
  try {

    // Pause autoplaying channel trailers
    if (cache['disable_channel_autoplay'] && dynamicIters <= 10) {
      qs('ytd-channel-video-player-renderer video')?.pause();
    }

    // Hide all shorts
    if (cache['remove_all_shorts']) {
      const shortsBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]';
      const shortBadges = qsa(shortsBadgeSelector);
      shortBadges?.forEach(badge => {
        const sidebarVid = badge.closest('ytd-compact-video-renderer');
        sidebarVid?.setAttribute('is_short', '');
        const gridVideo = badge.closest('ytd-grid-video-renderer');
        gridVideo?.setAttribute('is_short', '');
        const updatedGridVideo = badge.closest('ytd-rich-item-renderer');
        updatedGridVideo?.setAttribute('is_short', '');
      });

      const shortsShelfSelector = '*[is-shorts]';
      const shortsShelves = qsa(shortsShelfSelector);
      shortsShelves?.forEach(shelf => {
        const shelfContainer = shelf.closest('ytd-rich-section-renderer');
        shelfContainer?.setAttribute('is_short', '');
      });
    }

    // Channel page option
    if (onChannel) {
      if (cache['remove_channel_for_you']) {
        const forYouSection = qsa('ytd-item-section-renderer[page-subtype=channels]').find(node => {
          const title = qs('span#title', node);
          return title?.innerText.toLowerCase() === 'for you';
        });
        forYouSection?.setAttribute('is-channel-for-you-section', '');
      }
    }

    // Subscriptions page options
    if (onSubs) {
      const badgeSelector = 'ytd-badge-supported-renderer';
      const upcomingBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"]';
      const shortsBadgeSelector = 'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]';
      const addBadgeTextToVideo = badge => {
        const badgeText = badge.innerText.trim().split(' ')[0].trim().toLowerCase();
        if (badgeText) {
          const gridVideo = badge.closest('ytd-grid-video-renderer');
          const updatedGridVideo = badge.closest('ytd-rich-item-renderer');
          gridVideo?.setAttribute('badge-text', badgeText);
          updatedGridVideo?.setAttribute('badge-text', badgeText);
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
        const updatedGridVideo = badge.closest('ytd-rich-item-renderer');
        video?.setAttribute('is_sub_short', '');
        updatedGridVideo?.setAttribute('is_sub_short', '');
      });

      // VODs
      const vodSelector = '#metadata-line span';
      const vodSpans = qsa(vodSelector).filter(span => span.innerText.includes('Streamed'));
      vodSpans.forEach(span => {
        const video = span.closest('ytd-grid-video-renderer');
        const updatedGridVideo = span.closest('ytd-rich-item-renderer');
        video?.setAttribute('is_vod', '');
        updatedGridVideo?.setAttribute('is_vod', '');
      });

      // Reduce empty space.
      const subsRows = qsa('ytd-rich-grid-row');
      subsRows.forEach(row => {
        const contents = qs('#contents', row);
        if (!contents) return;
        const items = qsa('ytd-rich-item-renderer', contents);
        if (!items) return;
        const activeItems = items.filter(item => item.offsetParent);
        activeItems.forEach(item => item.style.setProperty('--ytd-rich-grid-items-per-row', activeItems.length));
        row.setAttribute('empty', activeItems.length === 0);
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

    // Disable ambient mode and annotations
    if (onVideo) {

      // Check if the video player is visible
      const video = qs('ytd-player');
      if (video && video.offsetParent && !settingsInit) {

        // Initialize the settings menu -- creates toggles for ambient mode and annotations.
        const checkMenuItems = qsa('.ytp-settings-menu .ytp-panel .ytp-panel-menu > div');
        if (checkMenuItems?.length === 0) {
          const settingsButton = qsa('#ytd-player button.ytp-settings-button');
          settingsButton.forEach(b => {
            if (b && b.offsetParent) {
              b.click();
              b.click();
              settingsInit = true;
            }
          });
        }
      }

      const menuItems = qsa('.ytp-settings-menu .ytp-panel .ytp-panel-menu > div');
      const checkBoxes = menuItems.filter(n => n.getAttribute('aria-checked'));
      const [ stableVolumeToggle, ambientToggle, annotationsToggle ] = checkBoxes;

      // Disable ambient mode
      if (cache['disable_ambient_mode'] === true) {
        if (ambientToggle?.getAttribute('aria-checked') === 'true') {
          qs('.ytp-menuitem-toggle-checkbox', ambientToggle)?.click();
        }
      }

      // Disable annotations
      //    Note: I don't see a toggle for "annotations" anymore
      if (cache['disable_annotations'] === true) {
        if (annotationsToggle?.getAttribute('aria-checked') === 'true') {
          qs('.ytp-menuitem-toggle-checkbox', annotationsToggle)?.click();
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
      const skipButtons = qsa('.ytp-ad-skip-button').
                   concat(qsa('.ytp-ad-skip-button-modern')).
                   concat(qsa('.ytp-skip-ad-button')).
                   concat(qsa(CSS.escape("button#skip-button:2")));

      const skippableAd = skipButtons?.some(button => button.offsetParent);
      if (skippableAd) {
        skipButtons?.forEach(e => {
          if (e && e.offsetParent) {
            e.click();
          }
        });
      } else {

        // Speed through ads that can't be skipped (yet).
        let adSelectors = [
          '.ytp-ad-player-overlay-instream-info',
          '.ytp-ad-button-icon'
        ];
        let adElements = adSelectors.flatMap(selector => qsa(selector));
        const adActive = adElements.some(elt => elt && window.getComputedStyle(elt).display !== 'none');
        const video = qs('video');
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

    // // Disable play on hover
    // if (dynamicIters % 10 === 0) {
    //   const prefCookie = getCookie('PREF');
    //   const prefObj = prefCookie?.split('&')?.reduce((acc, x) => {
    //     const [ key, value ] = x.split('=');
    //     acc[key] = value;
    //     return acc;
    //   }, {});
    //   if (prefObj) {
    //     const f7 = prefObj['f7'] || '0';
    //     const playOnHoverEnabled = f7[f7.length-1] === '0';

    //     if (cache['disable_play_on_hover'] && playOnHoverEnabled) {
    //       prefObj['f7'] = f7.substring(0, f7.length-1) + '1';
    //       const newPref = Object.entries(prefObj).map(([key, value]) => `${key}=${value}`).join('&');
    //       setCookie('PREF', newPref);
    //     } else if (!cache['disable_play_on_hover'] && !playOnHoverEnabled) {
    //       prefObj['f7'] = f7.substring(0, f7.length-1) + '0';
    //       const newPref = Object.entries(prefObj).map(([key, value]) => `${key}=${value}`).join('&');
    //       setCookie('PREF', newPref);
    //     }
    //   }
    // }

    // Show description
    if (cache['expand_description'] || cache['remove_comments']) {
      const expandButton = qsa('#description #expand.button');
      expandButton.forEach(b => {
        if (b && b.offsetParent) {
          b.click();
        }
      });
    }

    // Hide playlist suggestions
    if (cache['remove_playlist_suggestions']) {
      const identifier = qs('ytd-item-section-header-renderer[title-style="ITEM_SECTION_HEADER_TITLE_STYLE_PLAYLIST_RECOMMENDATIONS"]');
      if (identifier) {
        const section = identifier.closest('ytd-item-section-renderer');
        section?.setAttribute('is-playlist-suggestions', '');
      }
    }

    // Show video length when thumbnails are hidden
    if (cache['search_engine_mode'] || cache['remove_video_thumbnails']) {
      const thumbnails = qsa('ytd-thumbnail');
      thumbnails.forEach(thumbnail => {
        const videoRow = thumbnail.closest('ytd-video-renderer');
        if (!videoRow) return;
        const exists = qs('.inline-metadata-item[metadata-time]', videoRow);
        if (exists) return;

        const timeNode = qs('ytd-thumbnail-overlay-time-status-renderer #text', thumbnail);
        const time = timeNode?.innerText?.trim();
        if (!time) return;

        const metadata = qs('#metadata-line', videoRow);
        if (!metadata) return;
        const lastMetadataLine = qs('.inline-metadata-item:last-of-type', metadata);
        if (!lastMetadataLine) return;

        // length metadata goes between views and age.
        const metadataLine = lastMetadataLine.cloneNode(true);
        metadataLine.setAttribute('metadata-time', '');
        metadataLine.innerText = time;
        metadata.insertBefore(metadataLine, lastMetadataLine);
      });
    }

    // Hide all but the related tag in the sidebar
    if (onVideo && cache['remove_extra_sidebar_tags']) {
      const getChip = name => {
        const text = qs(`yt-chip-cloud-chip-renderer yt-formatted-string[title="${name}"]`);
        const chip = text?.closest('yt-chip-cloud-chip-renderer');
        return chip;
      }
      const allChip = getChip('All');
      const relatedChip = getChip('Related');

      const chips = qsa('yt-chip-cloud-chip-renderer');
      chips.forEach(chip => {
        const hideChip = (chip !== relatedChip) && (chip !== allChip);
        chip.toggleAttribute('hide-chip', hideChip);
      });
    }

    // Reveal suggestions button
    const revealButtons = [
      {
        containerSelector: 'ytd-page-manager', buttonId: 'rys_homepage_reveal_button',
        innerText: 'Show homepage suggestions',
        clickListener: e => HTML.setAttribute('remove_homepage', false),
      },
      {
        containerSelector: '#secondary-inner', buttonId: 'rys_sidebar_reveal_button',
        innerText: 'Show sidebar suggestions',
        clickListener: e => HTML.setAttribute('remove_sidebar', false),
      },
      {
        containerSelector: '#movie_player', buttonId: 'rys_end_of_video_reveal_button',
        innerText: 'Show end-of-video suggestions',
        clickListener: e => HTML.setAttribute('remove_end_of_video', false),
      },
    ];
    revealButtons.forEach(obj => {
      const { containerSelector, buttonId, innerText, clickListener } = obj;

      const existingButton = qs(`#${buttonId}`);
      if (existingButton) return;

      const container = qs(containerSelector);
      const buttonContainer = document.createElement('div');
      buttonContainer.classList.add('rys_reveal_button_container');

      const newButton = document.createElement('button');
      newButton.setAttribute('id', buttonId);
      newButton.classList.add('rys_reveal_button');
      newButton.innerText = innerText;
      newButton.addEventListener('click', clickListener);

      const closeButton = document.createElement('div');
      closeButton.setAttribute('id', 'close_reveal_button');
      closeButton.innerHTML = "&#10006;";
      closeButton.addEventListener('click', e => {
        e.stopPropagation();
        updateSetting('add_reveal_button', false);
      });
      newButton.appendChild(closeButton);

      buttonContainer.appendChild(newButton);
      container?.appendChild(buttonContainer);
    });

    // Expand the "You" section in the left sidebar
    if (cache['only_show_playlists']) {
      const showMoreButton = qs('#section-items > ytd-guide-collapsible-entry-renderer yt-interaction');
      if (showMoreButton && showMoreButton.offsetParent) {
        showMoreButton.click();
      }
    }

    // Video Player: hide the 'clip' button.
    //   The path[d=...] selector selects scissor SVGs.
    qsa('path[d^="M8 7c0 .55-.45 1-1 1s-1-.45-1-1"]').
      map(path => path.closest('#menu button')).
      forEach(b => b.setAttribute('scissor_button', ''));

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
  onChannel = channelRegex.test(url);
  onSubs = subsRegex.test(url);
  settingsInit = false;

  // Mark whether or not we're on the search results page
  HTML.setAttribute('on_results_page', onResultsPage);

  // Mark whether or not we're on the homepage
  HTML.setAttribute('on_homepage', onHomepage);

  // Mark whether or not we're on a video page
  HTML.setAttribute('on_video', onVideo);

  // Refresh HTML attributes
  Object.entries(cache).forEach(([key, value]) => HTML.setAttribute(key, value));

  // Homepage redirects
  if (
    on &&
    onHomepage &&
    !cache['redirect_off'] &&
    (!lastRedirect || Date.now() - lastRedirect > redirectInterval)
  ) {
    if (cache['redirect_to_subs']) {
      const button = qs('a#endpoint[href="/feed/subscriptions"]');
      button?.click();
      lastRedirect = Date.now();
    }
    if (cache['redirect_to_wl']) {
      location.replace(REDIRECT_URLS['redirect_to_wl']);
      lastRedirect = Date.now();
    }
    if (cache['redirect_to_library']) {
      const button = qs('a#endpoint[href="/feed/library"]');
      button?.click();
      lastRedirect = Date.now();
    }
  }

  // Redirect the shorts player
  if (on && onShorts && cache['normalize_shorts']) {
    const newUrl = url.replace('shorts', 'watch');
    location.replace(newUrl);
  }

  // Autofocus the search bar
  if (on && !onVideo && (cache['autofocus_search'] || cache['search_engine_mode'])) {
    const searchBar = qs('input#search');
    if (searchBar && !searchBar.value) {
      searchBar?.focus();
    }
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
