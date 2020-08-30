// Get local settings
const gettingSidebar = browser.storage.local.get("sidebar");
gettingSidebar.then(onGotSidebarSetting, onError);

const gettingVideoEnd = browser.storage.local.get("videoEnd");
gettingVideoEnd.then(onGotVideoEndSetting, onError);

const gettingComments = browser.storage.local.get("comments");
gettingComments.then(onGotCommentsSetting, onError);


/**********
 * Sidebar
 **********/
function onGotSidebarSetting(item) {
  const sidebar = item.sidebar === undefined ? true : item.sidebar;
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
function onGotVideoEndSetting(item) {
  const videoEnd = item.videoEnd === undefined ? true : item.videoEnd;
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
function onGotCommentsSetting(item) {
  const comments = item.comments === undefined ? true : item.comments;
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
