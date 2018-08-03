// Lawrence Hook

function onError(error) {
  console.log(`Error: ${error}`);
}

// remove homepage recommendations
function updateStyle(setting) {
  // the homepage has pathname "/" which is length 1
  let property = !setting || window.location.pathname.length > 1 ? "flex" : "none";
  for (let elt of document.querySelectorAll("ytd-browse")) {
    if (elt) elt.style.setProperty("display", property);
  }
}

// After getting settings
function onGotHomepageSetting(item) {
  console.log(item);
  if (item.homepage) {
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
  console.log(item);
  if (item.sidebar) {
    let sheets = document.styleSheets;
    sheets[0].insertRule(".ytd-watch-next-secondary-results-renderer { display: none !important; }");
  }
}

console.log('hi');
var gettingHomepage = browser.storage.local.get("homepage");
gettingHomepage.then(onGotHomepageSetting, onError);

var gettingSidebar = browser.storage.local.get("sidebar");
gettingSidebar.then(onGotSidebarSetting, onError);
console.log('bye');

