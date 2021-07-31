const HTML = document.documentElement;
const SETTINGS_LIST = {
  "global_enable":        { default: true,  eventType: 'click'  },
  "remove_homepage":      { default: true,  eventType: 'change' },
  "remove_sidebar":       { default: true,  eventType: 'change' },
  "remove_end_of_video":  { default: true,  eventType: 'change' },
  "remove_info_cards":    { default: false, eventType: 'change' },
  "remove_trending":      { default: false, eventType: 'change' },
  "remove_comments":      { default: false, eventType: 'change' },
  "remove_chat":          { default: false, eventType: 'change' },
  "redirect_off":         { default: true,  eventType: 'change' },
  "redirect_to_subs":     { default: false, eventType: 'change' },
  "redirect_to_wl":       { default: false, eventType: 'change' },
};

// Initialize HTML attributes with local settings, or defaults.
try {
  browser.storage.local.get(localSettings => {
    Object.keys(SETTINGS_LIST).forEach(key => {
      const isLocal = localSettings.hasOwnProperty(key);
      const value = isLocal ? localSettings[key] : SETTINGS_LIST[key].default;
      if (!isLocal) browser.storage.local.set({ [key] : value });

      // Activate removal functionality.
      HTML.setAttribute(key, value);
    });
  });
} catch (e) {
  console.log(e);
}

// Update HTML attributes in real time.
//   receive messages from options.js
browser.runtime.onMessage.addListener((data, sender) => {
  data.forEach(({ key, value }) => HTML.setAttribute(key, value));
});
