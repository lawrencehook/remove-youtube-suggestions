// Get local settings
const gettingHomepage = browser.storage.local.get("homepage");
gettingHomepage.then(onGotHomepageSetting, onError);

/***********
 * Homepage
 ***********/
const homepageSelectors = [
  "ytd-page-manager",
  "ytd-browse",
  "#feed",
  "ytd-rich-grid-renderer.style-scope",
  "#masthead-ad",
  "#spinner-container",
  "#home-container-skeleton",
  "#rich-shelves",
  ".shelf-skeleton",
  ".rich-shelf-videos"
];
const hompageSuggestionsSelector = homepageSelectors.join(', ');
const hideHomepageNodes = node => {
  if (node.matches(hompageSuggestionsSelector)) {
    node.style.setProperty("display", "none");
  }
};
const removeHomepageObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    hideHomepageNodes(mutation.target);
  });
});
removeHomepageObserver.observe(document, {
  childList: true,
  subtree: true,
});
function onGotHomepageSetting(item) {
  const homepage = item.homepage === undefined ? true : item.homepage;
  browser.storage.local.set({ homepage });
  updateHomepageStyle(homepage);

  // watch for url changes
  const updateHomepageObserver = new MutationObserver(mutations => updateHomepageStyle(homepage));
  updateHomepageObserver.observe(document, {
    childList: true,
    subtree: true,
  });

  removeHomepageObserver.disconnect();
}

function updateHomepageStyle(homepage) {
  updateHomepage(homepage && onHomepage() ? "none" : "flex");
}

function onHomepage() {
  // Test using path
  const pathIsHomepage = window.location.pathname.length <= 1;

  // Test using right-sidebar icons
  const iconSelector = "span.title.style-scope.ytd-mini-guide-entry-renderer";
  const icons = document.querySelectorAll(iconSelector);
  const homeIcon = icons.length > 0 && icons[0];
  const homeIconColor = homeIcon && window.getComputedStyle(homeIcon, null).getPropertyValue("color");
  const inactiveColor = "rgb(96, 96, 96)";
  const iconColorIsHomepage = homeIconColor && homeIconColor !== inactiveColor;

  return pathIsHomepage || iconColorIsHomepage;
}

function updateHomepage(property) {
  const updateDisplay = elt => elt.style.setProperty("display", property);
  const suggestions = document.querySelectorAll(hompageSuggestionsSelector) || [];
  suggestions.forEach(updateDisplay);
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
