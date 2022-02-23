if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

const uninstallUrl = "http://lawrencehook.com/rys/👋";
browser.runtime.setUninstallURL(uninstallUrl);

browser.runtime.onInstalled.addListener(object => {
  const url = "http://lawrencehook.com/rys/welcome";
  if (object.reason === browser.runtime.OnInstalledReason.INSTALL) {
    browser.tabs.create({ url }, tab => {});
  }
});
