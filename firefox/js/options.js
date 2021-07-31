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

const REDIRECT_URLS = {
  "redirect_to_subs": 'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl": 'https://www.youtube.com/playlist/?list=WL',
};

// Sync options page with local settings.
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get(localSettings => {
    Object.keys(localSettings).forEach(key => {
      const value = localSettings[key];
      if (!Object.keys(SETTINGS_LIST).includes(key)) return;
      const settingButton = document.getElementById(key);
      settingButton.checked = value;

      if (key === 'global_enable') {
        settingButton.value = value ? 'Disable' : 'Enable';
        HTML.setAttribute(key, value);
      }
    });
  });
});

// Handle click/change events from the options menu.
//    1. Save changes to local storage.
//    2. Send messages to main.js which updates the HTML attributes.
//    3. (optional) Dynamically change options.html.
Object.keys(SETTINGS_LIST).forEach(key => {
  const settingButton = document.getElementById(key);
  const { eventType } = SETTINGS_LIST[key];
  settingButton.addEventListener(eventType, async e => {
    const key = e.target.id;
    const value = e.target.checked;

    // Handle changes to a standard option.
    if (key.includes('remove')) {
      const saveObj = { [key]: value };
      browser.storage.local.set(saveObj);

      // Update running tabs with the changed setting
      const messageObj = [{ key, value }];
      const tabs = await browser.tabs.query({});
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, messageObj);
      });
      return;
    }

    // Handle changes to a redirect option.
    if (key.includes('redirect')) {

      // Deactive the "other" redirect options.
      const redirectKeys = Object.keys(SETTINGS_LIST).
        filter(key => key.includes('redirect'));
      const saveObj = redirectKeys.reduce((acc, curr) => {
        acc[curr] = false;
        return acc;
      }, { redirect: false });
      saveObj[key] = true;

      // Set the redirect URL.
      if (REDIRECT_URLS[key]) saveObj['redirect'] = REDIRECT_URLS[key];

      browser.storage.local.set(saveObj);
      return;
    }

    // Handle changes to a global option.
    if (key === 'global_enable') {
      const value = settingButton.value === "Enable";

      const saveObj = { [key]: value };
      browser.storage.local.set(saveObj);

      // Update running tabs with the changed setting
      const messageObj = [{ key, value }];
      const tabs = await browser.tabs.query({});
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, messageObj);
      });

      // Update button text, and change option page's HTML attribute.
      settingButton.value = value ? "Disable" : "Enable";
      HTML.setAttribute(key, value);
      return;
    }
  });
});
