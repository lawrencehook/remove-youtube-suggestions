const HTML = document.documentElement;
const SETTINGS_LIST = {
  "global_enable":        { default: true,  eventType: 'click'  },
  "remove_homepage":      { default: true,  eventType: 'click' },
  "remove_sidebar":       { default: true,  eventType: 'click' },
  "remove_end_of_video":  { default: true,  eventType: 'click' },
  "remove_info_cards":    { default: false, eventType: 'click' },
  "remove_home_sidebar":  { default: false, eventType: 'click' },
  "remove_trending":      { default: false, eventType: 'click' },
  "remove_comments":      { default: false, eventType: 'click' },
  "remove_chat":          { default: false, eventType: 'click' },
  "redirect_off":         { default: true,  eventType: 'click' },
  "redirect_to_subs":     { default: false, eventType: 'click' },
  "redirect_to_wl":       { default: false, eventType: 'click' },
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
      HTML.setAttribute(key, value);
    });
  });
});

// Handle click/change events from the options menu.
//    1. Save changes to local storage.
//    2. Send messages to main.js which updates the HTML attributes.
//    3. (optional) Dynamically change options.html.
Object.keys(SETTINGS_LIST).forEach(key => {
  const { eventType } = SETTINGS_LIST[key];
  const settingElements = Array.from(document.getElementsByClassName(key));
  settingElements.forEach(button => button.addEventListener(eventType, async e => {

    const value = !(String(HTML.getAttribute(key)).toLowerCase() === "true");
    HTML.setAttribute(key, value);

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
        HTML.setAttribute(curr, false);
        return acc;
      }, { redirect: false });
      HTML.setAttribute(key, true);
      saveObj[key] = true;

      // Set the redirect URL.
      if (REDIRECT_URLS[key]) saveObj['redirect'] = REDIRECT_URLS[key];

      browser.storage.local.set(saveObj);
      return;
    }

    // Handle changes to a global option.
    if (key === 'global_enable') {

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
  }));
});
