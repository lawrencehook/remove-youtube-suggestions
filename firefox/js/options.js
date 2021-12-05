
// Useful for local testing.
if (typeof browser === 'undefined') browser = null;

// Some global constants.
const HTML = document.documentElement;
const SETTINGS_LIST = {
  "global_enable":        { defaultValue: true,  eventType: 'click'  },
  "remove_homepage":      { defaultValue: true,  eventType: 'click' },
  "remove_sidebar":       { defaultValue: true,  eventType: 'click' },
  "remove_end_of_video":  { defaultValue: true,  eventType: 'click' },
  "remove_info_cards":    { defaultValue: false, eventType: 'click' },
  "remove_home_link":     { defaultValue: false, eventType: 'click' },
  "remove_explore_link":  { defaultValue: false, eventType: 'click' },
  "remove_comments":      { defaultValue: false, eventType: 'click' },
  "remove_chat":          { defaultValue: false, eventType: 'click' },
  "redirect_off":         { defaultValue: true,  eventType: 'click' },
  "redirect_to_subs":     { defaultValue: false, eventType: 'click' },
  "redirect_to_wl":       { defaultValue: false, eventType: 'click' },
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
}, { redirect: false });


// Load the options menu with our settings.
document.addEventListener("DOMContentLoaded", () => {

  // Defaults.
  Object.entries(SETTINGS_LIST).forEach(([key, { defaultValue: value }]) => HTML.setAttribute(key, value));

  // Sync with local settings.
  browser && browser.storage.local.get(localSettings => {
    Object.entries(localSettings).forEach(([key, value]) => {
      if (!VALID_SETTINGS.includes(key)) return;
      HTML.setAttribute(key, value);
    });
  });
});


// Change settings with the options menu.
Object.entries(SETTINGS_LIST).forEach(([key, { eventType }]) => {
  const settingElements = Array.from(document.getElementsByClassName(key));
  settingElements.forEach(button => button.addEventListener(eventType, async e => {

    // Toggle on click: new value is opposite of old value.
    const value = !(String(HTML.getAttribute(key)).toLowerCase() === "true");

    let saveObj, messageObj;

    // Handle standard settings.
    if (!key.includes('redirect')) {
      saveObj = { [key]: value };
      messageObj = [{ key, value }];

    // Handle redirect settings
    } else {
      saveObj = {
        ...REDIRECT_OPTIONS_TEMPLATE,
        [key]: true,
        redirect: REDIRECT_URLS[key]
      };
    }

    // Update options page.
    Object.entries(saveObj).forEach(([key, value]) => HTML.setAttribute(key, value));

    // Update local storage.
    browser && browser.storage.local.set(saveObj);

    // Update running tabs.
    if (messageObj) {
      const tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
      tabs.forEach(tab => browser.tabs.sendMessage(tab.id, messageObj));
    }

  }));
});
