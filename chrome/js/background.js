/*
 * Redirect logic
 */
let redirectUrl;
chrome.storage.local.get('redirectUrl', setting => {
  redirectUrl = setting['redirectUrl'];
});

chrome.webRequest.onBeforeRequest.addListener(details => {
    if (redirectUrl) return { redirectUrl };
  },
  { urls: [
      "*://youtube.com/",
      "*://www.youtube.com/",
    ] },
  ["blocking"]
);

/*
 * Message Handlers
 */
chrome.extension.onMessage.addListener((request, sender, sendResponse) => {

  // Options with 'page action'
  // https://stackoverflow.com/questions/35882089/popup-is-not-appearing-when-used-page-action
  if (request.message === 'activate_icon') {
    chrome.pageAction.show(sender.tab.id);
  }

  // Reload button
  if (request.message === 'reload_page') {
    const activeTab = { active: true, currentWindow: true };
    chrome.tabs.query(activeTab, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.update(tab.id, { url: tab.url });
      });
    });
  }

  // Listen for changes to redirectUrl
  if (request.message === 'change_redirect') {
    redirectUrl = request.redirectUrl;
  }
});
