// Handles message receives

chrome.extension.onMessage.addListener((request, sender, sendResponse) => {

  // Options with "page action"
  // https://stackoverflow.com/questions/35882089/popup-is-not-appearing-when-used-page-action
  if (request.message === "activate_icon") {
    chrome.pageAction.show(sender.tab.id);
  }

  // Reload button
  if (request.message === "reload_page") {
    const activeTab = { active: true, currentWindow: true };
    chrome.tabs.query(activeTab, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.update(tab.id, { url: tab.url });
      });
    });
  }

});
