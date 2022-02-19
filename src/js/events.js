if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}


browser.runtime.onInstalled.addListener(function (object) {
  const installUrl = "http://lawrencehook.com/rys/welcome";
  const uninstallUrl = "http://lawrencehook.com/rys/👋";

  if (object.reason === browser.runtime.OnInstalledReason.INSTALL) {
    browser.runtime.setUninstallURL(uninstallUrl);
    browser.tabs.create({ url: installUrl }, tab => {});
  }

});
