// Lawrence Hook

function onError(error) {
  console.log(`Error: ${error}`);
}

// remove homepage recommendations
function updateHomepageStyle(homepage) {
  // the homepage has pathname "/" which is length 1
  const thisIsHomepage = window.location.pathname.length <= 1;
  const hideSuggestions = homepage && thisIsHomepage;

  const propertyHide = "none";
  const propertyShow = "flex";
  const property = hideSuggestions ? propertyHide : propertyShow;

  const normalSuggestions = document.querySelectorAll("ytd-browse") || [];
  const disabledPolymerSuggestions = document.querySelectorAll("#feed") || [];

  // Hide homepage suggestions
  normalSuggestions.forEach(elt => elt.style.setProperty("display", property));
  disabledPolymerSuggestions.forEach(elt => elt.style.setProperty("display", property));
}

function onGotHomepageSetting(item) {
  const homepage = item.homepage === undefined ? true : item.homepage;
  browser.storage.local.set({ homepage });

  updateHomepageStyle(homepage);

  // watch for url changes
  const observer = new MutationObserver(mutations => updateHomepageStyle(homepage) );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

}

function onGotSidebarSetting(item) {
  const sidebar = item.sidebar === undefined ? true : item.sidebar;
  browser.storage.local.set({ sidebar });

  if (sidebar) {
    const sheets = document.styleSheets;
    const elementsToRemove = [
      "#container.ytd-iframe-companion-renderer", // ads
      "#dismissable.ytd-compact-movie-renderer",  // movie recommendations
      "ytd-movie-offer-module-renderer",          // movie recommendations
    
      // youtube video recommendations
      "ytd-compact-video-renderer.style-scope",
      "ytd-compact-radio-renderer.style-scope",

      // ads
      "ytd-image-companion-renderer.style-scope",
      "ytd-compact-playlist-renderer.style-scope",
      "a.ytd-action-companion-renderer",
      "#google_companion_ad_div",
      "ytd-promoted-sparkles-web-renderer",

      "#upnext",
      "paper-button.yt-next-continuation", // show more button

      // disable_polymer=true
      "li.video-list-item.related-list-item",
      "h4.watch-sidebar-head",
      "hr.watch-sidebar-separation-line",
      "button#watch-more-related-button",
    ];

    const displayNoneRule = " { display: none !important; }";

    elementsToRemove.forEach(rule => {
      sheets[0].insertRule(rule + displayNoneRule);
    });

  }
}

function onGotVideoEndSetting(item) {
  const videoEnd = item.videoEnd === undefined ? true : item.videoEnd;
  browser.storage.local.set({ videoEnd });
  if (videoEnd) {
    let sheets = document.styleSheets;
    sheets[0].insertRule(".html5-endscreen { display: none !important; }");
  }
}

function onGotCommentsSetting(item) {
  let removeComments = item.comments;

  if (removeComments === undefined) {
    removeComments = false;
    browser.storage.local.set({
      comments: false
    });
  }
  if (removeComments) {
    let sheets = document.styleSheets;
    sheets[0].insertRule("ytd-comment-thread-renderer { display: none !important; }");

    // for disable_polymer=true
    sheets[0].insertRule("#comment-secyoutubetion-renderer-items { display: none !important; }");
  }
}

// Ensures that suggestions won't blip while "removed"
updateHomepageStyle(true);

let gettingHomepage = browser.storage.local.get("homepage");
gettingHomepage.then(onGotHomepageSetting, onError);

let gettingSidebar = browser.storage.local.get("sidebar");
gettingSidebar.then(onGotSidebarSetting, onError);

let gettingVideoEnd = browser.storage.local.get("videoEnd");
gettingVideoEnd.then(onGotVideoEndSetting, onError);

let gettingComments = browser.storage.local.get("comments");
gettingComments.then(onGotCommentsSetting, onError);
