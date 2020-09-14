// https://stackoverflow.com/questions/35882089/popup-is-not-appearing-when-used-page-action
const activatePageAction = (request, sender, sendResponse) => {
  if (request.message === "activate_icon") {
  	chrome.pageAction.show(sender.tab.id);
  }
}

chrome.extension.onMessage.addListener(activatePageAction);
