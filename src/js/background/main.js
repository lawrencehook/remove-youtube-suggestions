const SECTIONS = [
  {
    name: "Basic",
    tags: "Basic",
    options: [
      {
        name: "Hide all homepage suggestions",
        tags: "Homepage",
        id: "remove_homepage",
        defaultValue: true
      },
      {
        name: "Hide sidebar suggestions",
        tags: "Video Player",
        id: "remove_sidebar",
        defaultValue: true 
      },
      {
        name: "Hide end-of-video suggestions",
        tags: "Video Player",
        id: "remove_end_of_video",
        defaultValue: true 
      },
    ]
  },
  {
    name: "Homepage",
    tags: "Homepage",
    options: [
      {
        name: "Hide the header",
        id: "remove_header",
        defaultValue: false
      },
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
        defaultValue: true
      },
      {
        name: "Disable infinite scrolling",
        id: "remove_infinite_scroll",
        defaultValue: true
      },
      {
        name: "Disable play on hover (page refresh required)",
        id: "disable_play_on_hover",
        defaultValue: false
      },
    ]
  },
  {
    name: "Left Navigation Bar",
    tags: "Left Navbar",
    options: [
      {
        name: "Hide the entire sidebar",
        tags: "Basic",
        id: "remove_left_nav_bar",
        defaultValue: false
      },
      {
        name: "Disable the YouTube logo link",
        id: "remove_logo_link",
        defaultValue: false
      },
      {
        name: "Hide button - Home",
        id: "remove_home_link",
        defaultValue: false
      },
      {
        name: "Hide button - Explore/Trending",
        id: "remove_explore_link",
        defaultValue: true
      },
      {
        name: "Hide button - Shorts",
        id: "remove_shorts_link",
        defaultValue: true
      },
      {
        name: "Hide button - Subscriptions",
        id: "remove_subscriptions_link",
        defaultValue: false
      },
    ]
  },
  {
    name: "Left Navigation Bar Sections",
    tags: "Left Navbar",
    options: [
      {
        name: "Hide section - Library, etc.",
        id: "remove_quick_links_section",
        defaultValue: false
      },
      {
        name: "Hide section - Subscriptions",
        id: "remove_sub_section",
        defaultValue: false
      },
      {
        name: "Hide section - Explore",
        id: "remove_explore_section",
        defaultValue: true
      },
      {
        name: "Hide section - More from YouTube",
        id: "remove_more_section",
        defaultValue: true
      },
    ]
  },
  {
    name: "Video Player - UX",
    tags: "Video Player",
    options: [
      {
        name: "Skip and close ads",
        tags: "Basic",
        id: "auto_skip_ads",
        defaultValue: true
      },
      {
        name: "Disable autoplay",
        id: "disable_autoplay",
        defaultValue: true
      },
      {
        name: "Disable ambient mode",
        id: "disable_ambient_mode",
        defaultValue: false
      },
      {
        name: "Disable annotations",
        id: "disable_annotations",
        defaultValue: false
      },
      {
        name: "Disable autoplay for playlists",
        id: "disable_playlist_autoplay",
        defaultValue: false
      },
      {
        name: "Redirect shorts to the default viewer",
        tags: "Redirects, Basic",
        id: "normalize_shorts",
        defaultValue: false
      },
      // {
      //   name: "Enable theater mode",
      //   id: "enable_theater",
      //   defaultValue: true
      // },
    ]
  },
  {
    name: "Video Player - UI",
    tags: "Video Player",
    options: [
      {
        name: "Center contents - removes the sidebar",
        id: "remove_entire_sidebar",
        defaultValue: false
      },
      {
        name: "Hide info cards",
        id: "remove_info_cards",
        defaultValue: false
      },
      {
        name: "Hide overlay suggestions",
        id: "remove_overlay_suggestions",
        defaultValue: true
      },
      {
        name: "Hide the play next button",
        id: "remove_play_next_button",
        defaultValue: false
      },
      {
        name: "Hide the menu buttons - Like, Share, etc.",
        id: "remove_menu_buttons",
        defaultValue: false
      },
      {
        name: "Hide chat (live-streaming)",
        id: "remove_chat",
        defaultValue: false
      },
      {
        name: "Hide panel - \"More Videos\" in embedded player",
        id: "remove_embedded_more_videos",
        defaultValue: true
      },
    ]
  },
  {
    name: "Video Player - Comments",
    tags: "Video Player",
    options: [
      {
        name: "Hide all comments",
        tags: "Basic",
        id: "remove_comments",
        defaultValue: false
      },
      {
        name: "Hide all but the timestamped comments",
        id: "remove_non_timestamp_comments",
        defaultValue: false,
        effects: {
          true: {
            remove_comments: false
          }
        }
      },
      {
        name: "Hide comment usernames",
        id: "remove_comment_usernames",
        defaultValue: false
      },
      {
        name: "Hide comment profile pictures",
        id: "remove_comment_profiles",
        defaultValue: false
      },
      {
        name: "Hide comment replies",
        id: "remove_comment_replies",
        defaultValue: false
      },
      {
        name: "Hide comment upvotes",
        id: "remove_comment_upvotes",
        defaultValue: false
      },
    ]
  },
  {
    name: "Search Results",
    tags: "Search",
    options: [
      {
        name: "Hide search bar suggestions",
        tags: "Basic",
        id: "remove_search_suggestions",
        defaultValue: false
      },
      {
        name: "Hide promoted videos",
        id: "remove_search_promoted",
        defaultValue: true
      },
      {
        name: "Hide results - shorts",
        id: "remove_shorts_results",
        defaultValue: true
      },
      {
        name: "Hide results - For You, Trending, etc.",
        id: "remove_extra_results",
        defaultValue: true
      },
      {
        name: "Disable the thumbnail slideshow - on hover",
        id: "remove_thumbnail_mouseover_effect",
        defaultValue: false
      },
    ]
  },
{
    name: "Subscriptions Page",
    tags: "Subscriptions",
    options: [
      {
        name: "Hide shorts",
        id: "remove_sub_shorts",
        defaultValue: false
      },
      {
        name: "Hide live videos",
        id: "remove_sub_live",
        defaultValue: false
      },
      {
        name: "Hide upcoming videos",
        id: "remove_sub_upcoming",
        defaultValue: false
      },
      {
        name: "Hide premiere videos",
        id: "remove_sub_premiere",
        defaultValue: false
      }
    ]
  },
  {
    name: "Redirect the Homepage",
    tags: "Redirects",
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
  },
  {
    name: "Extension Settings",
    tags: "Settings",
    options: [
      {
        name: "Enable menu timer - 10 seconds",
        id: "menu_timer",
        defaultValue: false
      },
    ]
  },
];

const OTHER_SETTINGS = {
  global_enable: true,
  dark_mode: false,
  log_enabled: true,
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

        browser.tabs.sendMessage(tab.id, { settings }, {});

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
