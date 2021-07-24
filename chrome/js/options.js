const HTML = document.documentElement;
const DEFAULT_SETTINGS = {
  "remove_homepage": true,
  "remove_sidebar": true,
  "remove_end_of_video": true,
  "remove_info_cards": false,
  "remove_trending": false,
  "remove_comments": false,
  "remove_chat": false,
  "redirect_off": true,
  "redirect_to_subs": false,
  "redirect_to_wl": false,
};

const REDIRECT_KEYS = Object.keys(DEFAULT_SETTINGS).
  filter(key => key.includes('redirect'));

const REDIRECT_URLS = {
  "redirect_to_subs": 'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl": 'https://www.youtube.com/playlist/?list=WL',
};

// Make checkboxes reflect local settings
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(localSettings => {
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
    let saveObj = {}
    let messageObj;

    // Handle "redirect" radio buttons
    if (key.includes('redirect')) {
      
      // Only one redirect can be active at a time.
      REDIRECT_KEYS.forEach(key => saveObj[key] = false);
      saveObj[key] = true;

      saveObj['redirectUrl'] = REDIRECT_URLS[key] || false;

      messageObj = Object.entries(saveObj).
        map(([key, value]) => [{ key, value }]);

    // Handle "remove" checkbox buttons
    } else {
      saveObj[key] = value;
      messageObj = [{ key, value }];
    }

    // Update local storage with changed settings.
    chrome.storage.local.set(saveObj);

    // Update running tabs with changed settings.
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, messageObj);
      });
    });

    // Update background script with changed redirectUrl.
    if ('redirectUrl' in saveObj) {
      chrome.runtime.sendMessage({
        "message": "change_redirect",
        "redirectUrl": saveObj['redirectUrl']
      });
    }
  });
});
