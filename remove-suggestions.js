// Lawrence Hook

// remove sidebar recommendations
let sheets = document.styleSheets;
sheets[0].insertRule(".ytd-watch-next-secondary-results-renderer { display: none !important; }");



// remove homepage recommendations
function updateStyle() {
  // the homepage has pathname "/" which is length 1
  let property = window.location.pathname.length > 1 ? "flex" : "none";
  for (let elt of document.querySelectorAll("ytd-browse")) {
    if (elt) elt.style.setProperty("display", property);
  }
}
updateStyle();

// watch for url changes
let observer = new MutationObserver(function(mutations) {
  updateStyle();
  return;
});

observer.observe(document.body, {
    childList: true
  , subtree: true
  , attributes: false
  , characterData: false
})
