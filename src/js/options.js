
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;
const SETTINGS_LIST = {
  "dark_mode":                         { defaultValue: false, eventType: 'click' },
  "global_enable":                     { defaultValue: true,  eventType: 'click' },

  "remove_homepage":                   { defaultValue: true,  eventType: 'click' },
  "remove_sidebar":                    { defaultValue: true,  eventType: 'click' },
  "remove_end_of_video":               { defaultValue: true,  eventType: 'click' },

  "remove_all_but_one":                { defaultValue: false, eventType: 'click' },
  "remove_infinite_scroll":            { defaultValue: false, eventType: 'click' },
  "remove_extra_rows":                 { defaultValue: false, eventType: 'click' },

  "remove_logo_link":                  { defaultValue: false, eventType: 'click' },
  "remove_home_link":                  { defaultValue: false, eventType: 'click' },
  "remove_explore_link":               { defaultValue: false, eventType: 'click' },
  "remove_shorts_link":                { defaultValue: false, eventType: 'click' },

  "normalize_shorts":                  { defaultValue: false, eventType: 'click' },
  "auto_skip_ads":                     { defaultValue: false, eventType: 'click' },
  "remove_entire_sidebar":             { defaultValue: false, eventType: 'click' },
  "disable_autoplay":                  { defaultValue: false, eventType: 'click' },
  "remove_info_cards":                 { defaultValue: false, eventType: 'click' },
  "remove_play_next_button":           { defaultValue: false, eventType: 'click' },
  "remove_comments":                   { defaultValue: false, eventType: 'click' },
  "remove_chat":                       { defaultValue: false, eventType: 'click' },
  "remove_menu_buttons":               { defaultValue: false, eventType: 'change' },

  "remove_extra_results":              { defaultValue: false, eventType: 'click' },
  "remove_shorts_results":             { defaultValue: false, eventType: 'click' },
  "remove_thumbnail_mouseover_effect": { defaultValue: false, eventType: 'click' },

  "redirect_off":                      { defaultValue: true,  eventType: 'click' },
  "redirect_to_subs":                  { defaultValue: false, eventType: 'click' },
  "redirect_to_wl":                    { defaultValue: false, eventType: 'click' },
};
const VALID_SETTINGS = Object.keys(SETTINGS_LIST);

// Redirect setting constants.
const REDIRECT_URLS = {
  "redirect_off":     false,
  "redirect_to_subs": 'https://www.youtube.com/feed/subscriptions',
  "redirect_to_wl":   'https://www.youtube.com/playlist/?list=WL',
};
const REDIRECT_KEYS = VALID_SETTINGS.filter(key => key.includes('redirect'));
const REDIRECT_OPTIONS_TEMPLATE = REDIRECT_KEYS.reduce((options, key) => {
  options[key] = false;
  return options;
}, {});


// Load the options menu with our settings.
document.addEventListener("DOMContentLoaded", () => {

  // Defaults.
  Object.entries(SETTINGS_LIST).forEach(([key, { defaultValue: value }]) => {
    const settingButton = document.getElementById(key);
    if (settingButton) settingButton.checked = value;
    HTML.setAttribute(key, value);
    const button = document.getElementById(key);
    if (button && 'checked' in button) button.checked = value;
  });

  // Sync with local settings.
  browser && browser.storage.local.get(localSettings => {
    Object.entries(localSettings).forEach(([key, value]) => {
      if (!VALID_SETTINGS.includes(key)) return;
      HTML.setAttribute(key, value);
      const button = document.getElementById(key);
      if (button && 'checked' in button) button.checked = value;
    });
  });
});


// Change settings with the options menu.
Object.entries(SETTINGS_LIST).forEach(([key, { eventType }]) => {
  const settingElements = Array.from(document.getElementsByClassName(key));
  settingElements.forEach(button => button.addEventListener(eventType, async e => {

    // Toggle on click: new value is opposite of old value.
    const value = !(String(HTML.getAttribute(key)).toLowerCase() === "true");

    // Communicate changes (to local settings, content-script.js, etc.)
    let saveObj;

    // Handle standard (non-redirect) settings.
    if (!key.includes('redirect')) {
      saveObj = { [key]: value };

      // Update background script with globalEnable.
      if (key === 'global_enable') {
        browser && browser.runtime.sendMessage({ globalEnable: value });
      }

    // Handle redirect settings
    } else {
      const redirect_url = REDIRECT_URLS[key];
      saveObj = {
        ...REDIRECT_OPTIONS_TEMPLATE,
        [key]: true,
        redirect_url
      };

      // Update background script with changed redirect_url.
      browser && browser.runtime.sendMessage({ redirect_url });
    }

    // Update options page.
    Object.entries(saveObj).forEach(([key, value]) => HTML.setAttribute(key, value));
    if ('checked' in button) button.checked = value;

    if (browser) {

      // Update local storage.
      browser.storage.local.set(saveObj);
      const messageObj = Object.entries(saveObj).map(([key, value]) => {
        return { key, value };
      });

      // Update running tabs.
      if (messageObj) {
        browser.tabs.query({}, tabs => {
          tabs.forEach(tab => {
            browser.tabs.sendMessage(tab.id, { settingChanges: messageObj });
          });
        });
      }
    }

  }));
});
