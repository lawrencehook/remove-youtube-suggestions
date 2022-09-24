const SECTIONS = [
  {
    name: "Basic",
    options: [
      {
        name: "Hide homepage suggestions",
        id: "remove_homepage",
        defaultValue: false
      },
      {
        name: "Hide sidebar suggestions",
        id: "remove_sidebar",
        defaultValue: true 
      },
      {
        name: "Hide end-of-video suggestions",
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
        defaultValue: true,
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
        defaultValue: true
      },
      {
        name: "Disable infinite scrolling",
        id: "remove_infinite_scroll",
        defaultValue: true
      },
    ]
  },
  {
    name: "Left Navigation Bar",
    options: [
      {
        name: "Disable the YouTube logo link",
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
        defaultValue: true
      },
      {
        name: "Hide shorts button",
        id: "remove_shorts_link",
        defaultValue: true
      },
    ]
  },
  {
    name: "Video Player (dynamic)",
    options: [
      {
        name: "Skip and close ads",
        id: "auto_skip_ads",
        defaultValue: true
      },
      {
        name: "Redirect shorts to the default viewer",
        id: "normalize_shorts",
        defaultValue: true
      },
      {
        name: "Disable autoplay",
        id: "disable_autoplay",
        defaultValue: true
      },
      // {
      //   name: "Enable theater mode",
      //   id: "enable_theater",
      //   defaultValue: true
      // },
    ]
  },
  {
    name: "Video Player (static)",
    options: [
      {
        name: "Center contents (removes the sidebar)",
        id: "remove_entire_sidebar",
        defaultValue: false
      },
      {
        name: "Hide info cards",
        id: "remove_info_cards",
        defaultValue: false
      },
      {
        name: "Hide overlay text",
        id: "remove_overlay_suggestions",
        defaultValue: true
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
        defaultValue: true
      },
      {
        name: "Hide shorts from search results",
        id: "remove_shorts_results",
        defaultValue: true
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
        id: "redirect_to_subs",
        defaultValue: false,
        effects: {
          true: {
            redirect_to_wl: false,
            redirect_to_library: false,
            redirect_off: false
          },
          false: {
            redirect_off: true
          }
        }
      },
      {
        name: "Redirect home to Watch Later",
        id: "redirect_to_wl",
        defaultValue: false,
        effects: {
          true: {
            redirect_to_subs: false,
            redirect_to_library: false,
            redirect_off: false
          },
          false: {
            redirect_off: true
          }
        }
      },
      {
        name: "Redirect home to Library",
        id: "redirect_to_library",
        defaultValue: false,
        effects: {
          true: {
            redirect_to_subs: false,
            redirect_to_wl: false,
            redirect_off: false
          },
          false: {
            redirect_off: true
          }
        }
      },
      {
        name: "Do not redirect home",
        id: "redirect_off",
        defaultValue: true,
        display: false
      },
    ]
  }
];

const OTHER_SETTINGS = {
  global_enable: true,
  dark_mode: false
};

const DEFAULT_SETTINGS = SECTIONS.reduce((acc, fieldset) => {
  fieldset.options.forEach(option => acc[option.id] = option.defaultValue);
  return acc;
}, { ...OTHER_SETTINGS });

// Respond to requests
browser.runtime.onMessage.addListener((data, sender) => {
  try {
    const {
      getSettings,
      getFieldsets,
    } = data;

    if (getSettings) {
      const { frameId, tab } = sender;
      browser.storage.local.get(localSettings => {
        const settings = { ...DEFAULT_SETTINGS, ...localSettings };
        browser.tabs.sendMessage(tab.id, { settings }, { frameId });

        // Gray out browserAction
        if (settings['global_enable'] === false) {
          browser.browserAction.setIcon(inactiveIcons);
        }

      });
    }

    if (getFieldsets) {
      const { frameId, tab } = sender;
      browser.storage.local.get(localSettings => {
        const settings = { ...DEFAULT_SETTINGS, ...localSettings };
        const headerSettings = Object.entries(OTHER_SETTINGS).reduce((acc, [id, value]) => {
          acc[id] = id in localSettings ? localSettings[id] : value;
          return acc;
        }, {});
        if (tab)  browser.tabs.sendMessage(tab.id, { SECTIONS, headerSettings, settings }, { frameId });
        if (!tab) browser.runtime.sendMessage({ SECTIONS, headerSettings, settings });
      });
    }

  } catch (error) {
    console.log(`ERROR: ${error}`);
  }
});
