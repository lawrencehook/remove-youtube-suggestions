
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;
const SETTINGS_LIST = {
  "dark_mode":                         { defaultValue: false },
  "global_enable":                     { defaultValue: true  },

  "remove_homepage":                   { defaultValue: true  },
  "remove_sidebar":                    { defaultValue: true  },
  "remove_end_of_video":               { defaultValue: true  },

  "remove_all_but_one":                { defaultValue: false },
  "remove_infinite_scroll":            { defaultValue: false },
  "remove_extra_rows":                 { defaultValue: false },

  "remove_logo_link":                  { defaultValue: false },
  "remove_home_link":                  { defaultValue: false },
  "remove_explore_link":               { defaultValue: false },
  "remove_shorts_link":                { defaultValue: false },

  "normalize_shorts":                  { defaultValue: false },
  "auto_skip_ads":                     { defaultValue: false },
  "remove_entire_sidebar":             { defaultValue: false },
  "disable_autoplay":                  { defaultValue: false },
  "remove_info_cards":                 { defaultValue: false },
  "remove_overlay_suggestions":        { defaultValue: false },
  "remove_play_next_button":           { defaultValue: false },
  "remove_menu_buttons":               { defaultValue: false },
  "remove_comments":                   { defaultValue: false },
  "remove_chat":                       { defaultValue: false },
  "remove_embedded_more_videos":       { defaultValue: false },

  "remove_search_suggestions":         { defaultValue: false },
  "remove_extra_results":              { defaultValue: false },
  "remove_shorts_results":             { defaultValue: false },
  "remove_thumbnail_mouseover_effect": { defaultValue: false },

  "redirect_off":                      { defaultValue: true  },
  "redirect_to_subs":                  { defaultValue: false },
  "redirect_to_wl":                    { defaultValue: false },
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


const FIELDSETS = [
  {
    name: "Basic",
    options: [
      {
        name: "Hide homepage suggestions",
        id: "remove_homepage",
        defaultValue: true 
      },
      {
        name: "Hide sidebar suggestions",
        id: "remove_sidebar",
        defaultValue: true 
      },
      {
        name: "Hide end-of-video grid of suggestions",
        id: "remove_end_of_video",
        defaultValue: true 
      },
    ]
  },
  {
    name: "Homepage",
    options: [
      {
        name: "Hide all but the first row of suggestions",
        id: "remove_all_but_one",
        defaultValue: false,
        effects: {
          true: {
            remove_homepage: false,
            remove_extra_rows: true,
            remove_infinite_scroll: true,
          }
        }
      },
      {
        name: "Hide extra rows (Shorts, Trending, etc.)",
        id: "remove_extra_rows",
        defaultValue: false
      },
      {
        name: "Disable infinite scrolling",
        id: "remove_infinite_scroll",
        defaultValue: false
      },
    ]
  },
  {
    name: "Left Navigation Bar",
    options: [
      {
        name: "Disable the link to home in the YouTube logo",
        id: "remove_logo_link",
        defaultValue: false
      },
      {
        name: "Hide home button",
        id: "remove_home_link",
        defaultValue: false
      },
      {
        name: "Hide explore button",
        id: "remove_explore_link",
        defaultValue: false
      },
      {
        name: "Hide shorts button",
        id: "remove_shorts_link",
        defaultValue: false
      },
    ]
  },
  {
    name: "Video Player (dynamic)",
    options: [
      {
        name: "Skip and close ads",
        id: "auto_skip_ads",
        defaultValue: false
      },
      {
        name: "Redirect shorts to the default viewer",
        id: "normalize_shorts",
        defaultValue: false
      },
      {
        name: "Center contents (will remove the entire sidebar)",
        id: "remove_entire_sidebar",
        defaultValue: false
      },
      {
        name: "Disable autoplay",
        id: "disable_autoplay",
        defaultValue: false
      },
    ]
  },
  {
    name: "Video Player (static)",
    options: [
      {
        name: "Hide info cards",
        id: "remove_info_cards",
        defaultValue: false
      },
      {
        name: "Hide overlay text",
        id: "remove_overlay_suggestions",
        defaultValue: false
      },
      {
        name: "Hide the play next button",
        id: "remove_play_next_button",
        defaultValue: false
      },
      {
        name: "Hide the menu buttons (Like, Share, etc.)",
        id: "remove_menu_buttons",
        defaultValue: false
      },
      {
        name: "Hide comments",
        id: "remove_comments",
        defaultValue: false
      },
      {
        name: "Hide chat (live-streaming)",
        id: "remove_chat",
        defaultValue: false
      },
      {
        name: "Hide the \"More Videos\" panel in embedded videos",
        id: "remove_embedded_more_videos",
        defaultValue: true
      },
    ]
  },
  {
    name: "Search Results",
    options: [
      {
        name: "Hide search bar suggestions",
        id: "remove_search_suggestions",
        defaultValue: false
      },
      {
        name: "Hide extra results (For You, Trending, etc.)",
        id: "remove_extra_results",
        defaultValue: false
      },
      {
        name: "Hide shorts from search results",
        id: "remove_shorts_results",
        defaultValue: false
      },
      {
        name: "Disable the thumbnail slideshow (on hover)",
        id: "remove_thumbnail_mouseover_effect",
        defaultValue: false
      },
    ]
  },
  {
    name: "Redirect the Homepage",
    options: [
      {
        name: "Redirect home to Subscriptions",
        id: "redirect_off",
        defaultValue: false 
      },
      {
        name: "Redirect home to Watch Later",
        id: "redirect_to_subs",
        defaultValue: false
      },
      {
        name: "Do not redirect home",
        id: "redirect_to_wl",
        defaultValue: true
      },
    ]
  }
];
const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_FIELDSET = document.getElementById('template_fieldset');
const TEMPLATE_OPTION = document.getElementById('template_option');


// Load the options menu with our settings.
document.addEventListener("DOMContentLoaded", () => {

  // Populate options.
  FIELDSETS.forEach(({ name, options }) => {
    const fieldset = TEMPLATE_FIELDSET.cloneNode(true);
    fieldset.classList.remove('removed');
    const legend = fieldset.querySelector('legend');
    legend.innerText = name;

    options.forEach(({ id, name, defaultValue }) => {
      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.id = id;
      const optionLabel = optionNode.querySelector('a');
      optionLabel.innerText = name;
      fieldset.append(optionNode);
    });

    OPTIONS_LIST.append(fieldset);
    // OPTIONS_LIST.append(optionNode);
  });

  // Defaults.
  Object.entries(SETTINGS_LIST).forEach(([key, { defaultValue: value }]) => {
    const settingButton = document.getElementById(key);
    if (settingButton) settingButton.checked = value;
    HTML.setAttribute(key, value);
    const button = document.getElementById(key);
    if (button && 'checked' in button) button.checked = value;

    const settingSvg = document.querySelector(`div#${key} svg`);
    settingSvg?.toggleAttribute('active', value);
  });

  // Sync with local settings.
  browser && browser.storage.local.get(localSettings => {
    Object.entries(localSettings).forEach(([key, value]) => {
      if (!VALID_SETTINGS.includes(key)) return;
      HTML.setAttribute(key, value);
      const button = document.getElementById(key);
      if (button && 'checked' in button) button.checked = value;


      const settingSvg = document.querySelector(`div#${key} svg`);
      settingSvg?.toggleAttribute('active', value);
    });
  });
});


// Change settings with the options menu.
Object.entries(SETTINGS_LIST).forEach(([key, value]) => {
  const settingElements = Array.from(document.getElementsByClassName(key));
  settingElements.forEach(button => button.addEventListener('click', async e => {

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
