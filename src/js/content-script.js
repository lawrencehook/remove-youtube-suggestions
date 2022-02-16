
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;
const SETTINGS_LIST = {
  "global_enable":                     { defaultValue: true,  eventType: 'click'  },
  "remove_homepage":                   { defaultValue: true,  eventType: 'change' },
  "remove_sidebar":                    { defaultValue: true,  eventType: 'change' },
  "remove_end_of_video":               { defaultValue: true,  eventType: 'change' },
  "remove_info_cards":                 { defaultValue: false, eventType: 'change' },
  "remove_logo_link":                  { defaultValue: false, eventType: 'change' },
  "remove_home_link":                  { defaultValue: false, eventType: 'change' },
  "remove_shorts_link":                { defaultValue: false, eventType: 'change' },
  "remove_explore_link":               { defaultValue: false, eventType: 'change' },
  "remove_infinite_scroll":            { defaultValue: false, eventType: 'change' },
  "remove_all_but_one":                { defaultValue: false, eventType: 'change' },
  "remove_shorts":                     { defaultValue: false, eventType: 'change' },
  "remove_thumbnail_mouseover_effect": { defaultValue: false, eventType: 'change' },
  "remove_play_next_button":           { defaultValue: false, eventType: 'change' },
  "remove_comments":                   { defaultValue: false, eventType: 'change' },
  "remove_chat":                       { defaultValue: false, eventType: 'change' },
  "redirect_off":                      { defaultValue: true,  eventType: 'change' },
  "redirect_to_subs":                  { defaultValue: false, eventType: 'change' },
  "redirect_to_wl":                    { defaultValue: false, eventType: 'change' },
};

// Initialize HTML attributes with local settings, or default.
try {
  browser.storage.local.get(localSettings => {
    Object.entries(SETTINGS_LIST).forEach(([key, { defaultValue }]) => {
      HTML.setAttribute(key, localSettings[key] ?? defaultValue);
    });
  });
} catch (e) {
  console.log(e);
}

// Update HTML attributes in real time.
//   receive messages from options.js
browser.runtime.onMessage.addListener((data, sender) => {
  data.forEach(({ key, value }) => HTML.setAttribute(key, value));
  return true;
});
