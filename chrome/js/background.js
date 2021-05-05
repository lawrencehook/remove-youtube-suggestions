/*
 * Homepage Redirect to Subscriptions
 */
const subscriptionsUrl = 'https://www.youtube.com/feed/subscriptions';
let redirect_home_to_subs = false;
chrome.storage.local.get('redirect_home_to_subs', result => {
  redirect_home_to_subs = result['redirect_home_to_subs'];
});

chrome.webRequest.onBeforeRequest.addListener(details => {
    if (redirect_home_to_subs) {
      return { redirectUrl: subscriptionsUrl };
    }
  },
  { urls: [ '*://*.youtube.com/' ] },
  ['blocking']
);

function loadRedirectSetting() {
  return new Promise(resolve => {
  });
}


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

  // Listen for changes to the redirect_home_to_subs option
  if (request.message === 'key_change') {
    if (request.key === 'redirect_home_to_subs') {
      redirect_home_to_subs = request.value;
    }
  }
});
