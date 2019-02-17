// Lawrence Hook

function onError(error) {
  console.log(`Error: ${error}`);
}

// remove homepage recommendations
function updateStyle(setting) {
  // the homepage has pathname "/" which is length 1
  let property = (!setting || window.location.pathname.length > 1) ? "flex" : "none";
  for (let elt of document.querySelectorAll("ytd-browse")) {
    if (elt) elt.style.setProperty("display", property);
  }

  // for disable_polymer=true
  for (let elt of document.querySelectorAll("#feed")) {
    if (elt) elt.style.setProperty("display", property);
  }
}

// After getting settings
function onGotHomepageSetting(item) {
  var removeHomepage = item.homepage;
  if (removeHomepage === undefined) {
    removeHomepage = true;
    browser.storage.local.set({
      homepage: true
    });
  }

  if (removeHomepage) {
    updateStyle(item.homepage);

    // watch for url changes
    let observer = new MutationObserver(function(mutations) {
      updateStyle(item.homepage);
      return;
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }

}

function onGotSidebarSetting(item) {
  var removeSidebar = item.sidebar;
  if (removeSidebar === undefined) {
    removeSidebar = true;
    browser.storage.local.set({
      sidebar: true
    });
  }

  if (removeSidebar) {
    let sheets = document.styleSheets;
    let display_none = " { display: none !important; }";

    sheets[0].insertRule("ytd-compact-video-renderer.style-scope" + display_none);
    sheets[0].insertRule("ytd-compact-radio-renderer.style-scope" + display_none);

    sheets[0].insertRule("ytd-image-companion-renderer.style-scope" + display_none);
    sheets[0].insertRule("ytd-compact-playlist-renderer.style-scope" + display_none);
    sheets[0].insertRule("a.ytd-action-companion-renderer" + display_none);
    sheets[0].insertRule("#google_companion_ad_div" + display_none);

    sheets[0].insertRule("#upnext" + display_none);
    sheets[0].insertRule("paper-button.yt-next-continuation" + display_none); // show more button

    // disable_polymer=true
    sheets[0].insertRule("li.video-list-item.related-list-item" + display_none); 
    sheets[0].insertRule("h4.watch-sidebar-head" + display_none); 
    sheets[0].insertRule("hr.watch-sidebar-separation-line" + display_none); 
    sheets[0].insertRule("button#watch-more-related-button" + display_none); 
    // sheets[0].insertRule("paper-button.yt-next-continuation" + display_none); 
    // sheets[0].insertRule("paper-button.yt-next-continuation" + display_none); 


  }
}

function onGotVideoEndSetting(item) {
  var removeVideoEnd = item.videoEnd;
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

var gettingHomepage = browser.storage.local.get("homepage");
gettingHomepage.then(onGotHomepageSetting, onError);

var gettingSidebar = browser.storage.local.get("sidebar");
gettingSidebar.then(onGotSidebarSetting, onError);

var gettingVideoEnd = browser.storage.local.get("videoEnd");
gettingVideoEnd.then(onGotVideoEndSetting, onError);
