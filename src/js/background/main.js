
// Respond to requests
browser.runtime.onMessage.addListener((data, sender) => {
  try {
    const {
      getSettings,
      getFieldsets,
    } = data;

    if (getSettings) {
      const { frameId, tab } = sender;
      browser.storage.local.get(localSettings => {
        const settings = { ...DEFAULT_SETTINGS, ...localSettings };

        browser.tabs.sendMessage(tab.id, { settings }, {});

        // Gray out browserAction
        if (settings['global_enable'] === false) {
          browser.browserAction.setIcon(inactiveIcons);
        }

      });
    }

    if (getFieldsets) {
      const { frameId, tab } = sender;
      browser.storage.local.get(localSettings => {
        const settings = { ...DEFAULT_SETTINGS, ...localSettings };
        const headerSettings = Object.entries(OTHER_SETTINGS).reduce((acc, [id, value]) => {
          acc[id] = id in localSettings ? localSettings[id] : value;
          return acc;
        }, {});
        if (tab)  browser.tabs.sendMessage(tab.id, { SECTIONS, headerSettings, settings }, { frameId });
        if (!tab) browser.runtime.sendMessage({ SECTIONS, headerSettings, settings });
      });
    }

  } catch (error) {
    console.log(`ERROR: ${error}`);
  }
});
