const HTML = document.documentElement;
const DEFAULT_SETTINGS = {
  "remove_homepage": true,
  "remove_sidebar": true,
  "remove_end_of_video": true,
  "remove_trending": false,
  "remove_comments": false,
  "remove_chat": false,
  "redirect_off": true,
  "redirect_to_subs": false,
  "redirect_to_wl": false,
}

try {
  browser.storage.local.get(localSettings => {
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      const isLocal = localSettings.hasOwnProperty(key);
      const value = isLocal ? localSettings[key] : DEFAULT_SETTINGS[key];
      if (!isLocal) browser.storage.local.set({ [key] : value });
      HTML.setAttribute(key, value);
    });
  });
} catch (e) {
  console.log(e);
}

// Update in real time, by receiving change events from the options menu
browser.runtime.onMessage.addListener((data, sender) => {
  data.forEach(({ key, value }) => HTML.setAttribute(key, value));
});
