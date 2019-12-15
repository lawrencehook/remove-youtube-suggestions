// Lawrence Hook

function onError(error) {
  console.log(`Error: ${error}`);
}

// remove homepage recommendations
function updateHomepageStyle(hideHomepage) {
  // the homepage has pathname "/" which is length 1
  const thisIsHomepage = window.location.pathname.length <= 1;
  const hideSuggestions = hideHomepage && thisIsHomepage;

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
  let hideHomepage = item.homepage;

  if (hideHomepage === undefined) {
    hideHomepage = true;
  }

  updateHomepageStyle(hideHomepage);

  // watch for url changes
  const observer = new MutationObserver(mutations => updateHomepageStyle(hideHomepage) );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  browser.storage.local.set({ homepage: hideHomepage });
}

function onGotSidebarSetting(item) {
  let removeSidebar = item.sidebar;
  if (removeSidebar === undefined) {
    removeSidebar = true;
    browser.storage.local.set({
      sidebar: true
    });
  }

  if (removeSidebar) {
    const sheets = document.styleSheets;
    const display_none = " { display: none !important; }";

    // youtube video recommendations
    sheets[0].insertRule("ytd-compact-video-renderer.style-scope" + display_none);
    sheets[0].insertRule("ytd-compact-radio-renderer.style-scope" + display_none);
    
    // movie recommendations
    sheets[0].insertRule("#dismissable.ytd-compact-movie-renderer" + display_none);
    sheets[0].insertRule("ytd-movie-offer-module-renderer" + display_none);

    // ads
    sheets[0].insertRule("#container.ytd-iframe-companion-renderer" + display_none);

    sheets[0].insertRule("ytd-image-companion-renderer.style-scope" + display_none);
    sheets[0].insertRule("ytd-compact-playlist-renderer.style-scope" + display_none);
    sheets[0].insertRule("a.ytd-action-companion-renderer" + display_none);
    sheets[0].insertRule("#google_companion_ad_div" + display_none);

    sheets[0].insertRule("#upnext" + display_none);
    // sheets[0].insertRule("paper-button.yt-next-continuation" + display_none); // show more button

    // disable_polymer=true
    sheets[0].insertRule("li.video-list-item.related-list-item" + display_none); 
    sheets[0].insertRule("h4.watch-sidebar-head" + display_none); 
    sheets[0].insertRule("hr.watch-sidebar-separation-line" + display_none); 
    sheets[0].insertRule("button#watch-more-related-button" + display_none); 


  }
}

function onGotVideoEndSetting(item) {
  let removeVideoEnd = item.videoEnd;
  if (removeVideoEnd === undefined) {
    removeVideoEnd = true;
    browser.storage.local.set({
      videoEnd: true
    });
  }
  if (removeVideoEnd) {
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
