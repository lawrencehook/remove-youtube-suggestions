
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

browser.webNavigation.onHistoryStateUpdated.addListener(sendUrlChangeMessage);

function sendUrlChangeMessage(details) {
  console.log('url changed', details.url);
  browser.tabs.query({}, tabs => {
    tabs.filter(tab => tab.id === details.tabId).forEach(tab => {
      browser.tabs.sendMessage(tab.id, { urlChange: true });
    });
  });
}