browser.runtime.openOptionsPage();

const uninstallUrl = "http://lawrencehook.com/rys/👋";
browser.runtime.setUninstallURL(uninstallUrl);

browser.runtime.onInstalled.addListener(object => {
  const url = "http://lawrencehook.com/rys/welcome";
  if (object.reason === browser.runtime.OnInstalledReason.INSTALL) {
    browser.tabs.create({ url }, tab => {});
  }
});

// Change the browserAction icon if the extension is disabled
const inactiveIcons = { path: {
  16: "/images/16_dark.png",
  32: "/images/32_dark.png",
  64: "/images/64_dark.png",
  128: "/images/128_dark.png",
}};
const activeIcons = { path: {
  16: "/images/16.png",
  32: "/images/32.png",
  64: "/images/64.png",
  128: "/images/128.png",
}};
browser.storage.onChanged.addListener((changes, area) => {
  const changedItems = Object.keys(changes);
  for (const item of changedItems) {

    if (item === 'global_enable') {
      let icons;
      if (changes[item].newValue === false) icons = inactiveIcons;
      if (changes[item].newValue === true)  icons = activeIcons;

      browser.browserAction.setIcon(icons);
    }

  }
});
