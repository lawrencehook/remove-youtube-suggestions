// Chrome
if (typeof(chrome) !== 'undefined') {
  browser = chrome;

  try {
    browser.storage.local.get("sidebar", onGotSidebarSetting);
    browser.storage.local.get("videoEnd", onGotVideoEndSetting);
    browser.storage.local.get("comments", onGotCommentsSetting);
  } catch (e) {
    console.log(e);
  }

// Firefox
} else {

  try {
    const gettingSidebar = browser.storage.local.get("sidebar");
    gettingSidebar.then(onGotSidebarSetting, onError);

    const gettingVideoEnd = browser.storage.local.get("videoEnd");
    gettingVideoEnd.then(onGotVideoEndSetting, onError);

    const gettingComments = browser.storage.local.get("comments");
    gettingComments.then(onGotCommentsSetting, onError);
  } catch (e) {
    console.log(e);
  }

}


/**********
 * Sidebar
 **********/
function onGotSidebarSetting(result) {
  const sidebar = result.sidebar === undefined ? true : result.sidebar;
  browser.storage.local.set({ sidebar });

  if (sidebar) {
    removeSelectors([
      // video recommendations
      "#upnext",
      "ytd-compact-video-renderer.style-scope",
      "ytd-compact-radio-renderer.style-scope",

      // ads
      "#companion",
      "ytd-compact-promoted-video-renderer",
      "#container.ytd-iframe-companion-renderer",
      "#dismissable.ytd-compact-movie-renderer",  // movie recommendations
      "ytd-movie-offer-module-renderer",          // movie recommendations
      "ytd-image-companion-renderer.style-scope",
      "ytd-compact-playlist-renderer.style-scope",
      "a.ytd-action-companion-renderer",
      "#google_companion_ad_div",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-player-legacy-desktop-watch-ads-renderer",

      "paper-button.yt-next-continuation", // show more button

      // disable_polymer=true
      "li.video-list-item.related-list-item",
      "h4.watch-sidebar-head",
      "hr.watch-sidebar-separation-line",
      "button#watch-more-related-button",
    ]);
  }
}

/***************
 * End of Video
 ***************/
function onGotVideoEndSetting(result) {
  const videoEnd = result.videoEnd === undefined ? true : result.videoEnd;
  browser.storage.local.set({ videoEnd });
  if (videoEnd) {
    removeSelectors([
      ".html5-endscreen"
    ]);
  }
}

/***********
 * Comments
 ***********/
function onGotCommentsSetting(result) {
  const comments = result.comments === undefined ? false : result.comments;
  browser.storage.local.set({ comments });
  if (comments) {
    removeSelectors([
      // standard
      "ytd-comment-thread-renderer",

      // for disable_polymer=true
      "#comment-secyoutubetion-renderer-items"
    ]);
  }
}

function removeSelectors(selectors) {
  const cssSheet = document.styleSheets.length > 0 && document.styleSheets[0];
  const displayNoneRule = " { display: none !important; }";
  const compoundSelector = selectors.join(", ");
  cssSheet && cssSheet.insertRule(compoundSelector + displayNoneRule);
}

function onError(error) {
  console.log(`Error: ${error}`);
}
