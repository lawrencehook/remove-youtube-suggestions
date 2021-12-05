
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

//  Cache values needed for redirect
let cachedGlobalEnable, cachedRedirectUrl;
const defaultCache = {
  globalEnable: true,
  redirect: false
}
browser.storage.local.get(defaultCache, setting => {
  cachedGlobalEnable = setting['globalEnable'];
  cachedRedirectUrl = setting['redirect'];
});

// Listen for changes to cached values.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { globalEnable, redirectUrl } = request;
  cachedGlobalEnable = globalEnable ?? cachedGlobalEnable;
  cachedRedirectUrl = redirectUrl ?? cachedRedirectUrl;
  return true;
});

// Redirect
browser.webRequest.onBeforeRequest.addListener(details => {
  if (cachedGlobalEnable === false) return;
  if (cachedRedirectUrl) return { redirectUrl: cachedRedirectUrl };
}, { urls: [
      "*://youtube.com/",
      "*://www.youtube.com/",
    ] },
  ["blocking"]
);
