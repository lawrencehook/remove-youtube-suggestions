/*
 * Used for redirects.
 */


if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

//  Cache values needed for redirect
const cache = {
  globalEnable: true,
  redirectUrl: false,
};
browser.storage.local.get(cache, setting => {
  Object.entries(setting).forEach(([key, val]) => {
    cache[key] = val;
  })
});

// Listen for changes to cached values.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  request && Object.entries(cache).forEach(([key, val]) => {
    cache[key] = request[key] ?? val;
  });
});

// Redirect
browser.webRequest.onBeforeRequest.addListener(details => {
  const { globalEnable, redirectUrl } = cache;
  if (globalEnable === false) return;
  if (redirectUrl) return { redirectUrl };
}, { urls: [
      "*://youtube.com/",
      "*://www.youtube.com/",
    ] },
  ["blocking"]
);
