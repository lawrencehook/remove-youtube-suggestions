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
};

const REDIRECT_URLS = {
  "redirect_to_subs": 'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl": 'https://www.youtube.com/playlist/?list=WL',
};

// Make checkboxes reflect local settings
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get(localSettings => {
    Object.keys(localSettings).forEach(key => {
      if (!Object.keys(DEFAULT_SETTINGS).includes(key)) return;
      document.getElementById(key).checked = localSettings[key];
    });
  });
});

// Handle check/uncheck events
//    Save changes to local storage
Object.keys(DEFAULT_SETTINGS).forEach(key => {
  const settingCheckbox = document.getElementById(key);
  settingCheckbox.addEventListener("change", async e => {
    const key = e.target.id;
    const value = e.target.checked;

    // Handle "redirect" radio buttons
    //    Only one redirect can be active at a time.
    if (key.includes('redirect')) {
      const redirectKeys = Object.keys(DEFAULT_SETTINGS).
        filter(key => key.includes('redirect'));
      const saveObj = redirectKeys.reduce((acc, curr) => {
        acc[curr] = false;
        return acc;
      }, { redirect: false });
      if (REDIRECT_URLS[key]) saveObj['redirect'] = REDIRECT_URLS[key];
      saveObj[key] = true;
      browser.storage.local.set(saveObj);
      return;
    }

    // Handle "remove" checkbox buttons
    const saveObj = { [key]: value };
    browser.storage.local.set(saveObj);

    // Update running tabs with the changed setting
    const messageObj = [{ key, value }];
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, messageObj);
    });

  });
});
