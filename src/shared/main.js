
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

const HOST = 'https://lawrencehook.com/rys/';
const SECTIONS = [
  {
    name: "General",
    tags: "General",
    options: [
      {
        name: "Hide all Shorts",
        tags: "Homepage, Subscriptions, Video Player, Search",
        id: "remove_all_shorts",
        defaultValue: false,
      },
      {
        name: "Hide video thumbnails",
        tags: "Homepage, Subscriptions, Video Player, Search",
        id: "remove_video_thumbnails",
        defaultValue: false,
      },
      {
        name: "Blur video thumbnails",
        tags: "Homepage, Subscriptions, Video Player, Search",
        id: "blur_video_thumbnails",
        defaultValue: false,
      },
      {
        name: "Disable play on hover",
        id: "disable_play_on_hover",
        defaultValue: false
      },
      {
        name: "Enable search engine mode",
        id: "search_engine_mode",
        defaultValue: false,
      },
    ]
  },
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
        defaultValue: false
      },
      {
        name: "Disable infinite scroll - homepage",
        id: "remove_infinite_scroll",
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
        defaultValue: false
      },
      {
        name: "Hide button - Shorts",
        id: "remove_shorts_link",
        defaultValue: false
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
        defaultValue: false
      },
      {
        name: "Hide section - More from YouTube",
        id: "remove_more_section",
        defaultValue: false
      },
      {
        name: "Hide section - Settings",
        id: "remove_settings_section",
        defaultValue: false
      },
      {
        name: "Hide section - Footer",
        id: "remove_footer_section",
        defaultValue: false
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
        defaultValue: false
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
        name: "Auto-expand the description",
        id: "expand_description",
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
        name: "Hide the description",
        id: "remove_vid_description",
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
    name: "Video Player - Sidebar",
    tags: "Video Player",
    options: [
      {
        name: "Center contents - removes the sidebar",
        id: "remove_entire_sidebar",
        defaultValue: false
      },
      {
        name: "Disable infinite scroll - sidebar",
        id: "remove_sidebar_infinite_scroll",
        defaultValue: false
      },
      {
        name: "Hide extra sidebar tags (English only)",
        id: "remove_extra_sidebar_tags",
        defaultValue: false
      },
      {
        name: "Hide the live-stream chat",
        id: "remove_chat",
        defaultValue: false
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
        defaultValue: false
      },
      {
        name: "Hide results - For You, Trending, etc.",
        id: "remove_extra_results",
        defaultValue: false
      },
      {
        name: "Disable the thumbnail slideshow - on hover",
        id: "remove_thumbnail_mouseover_effect",
        defaultValue: false
      },
      {
        name: "Disable infinite scroll - search results",
        id: "remove_infinite_scroll_search",
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
      },
      {
        name: "Hide VODs (English only)",
        id: "remove_sub_vods",
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
    name: "Other",
    tags: "Other",
    options: [
      {
        name: "Hide playlist suggestions",
        id: "remove_playlist_suggestions",
        defaultValue: false,
      },
      {
        name: "Hide the notification bell",
        id: "remove_notif_bell",
        defaultValue: false,
      },
      {
        name: "Autofocus the search bar",
        id: "autofocus_search",
        defaultValue: false,
      },
      {
        name: "Remove context boxes",
        id: "remove_context",
        defaultValue: false,
      },
      {
        name: "Reverse sort channel videos: oldest, least popular",
        id: "reverse_channel_video_list",
        defaultValue: false,
      },
      {
        name: "Disable autoplay on the channel page",
        id: "disable_channel_autoplay",
        defaultValue: false,
      },
      {
        name: "Enable the menu timer - 10 seconds",
        id: "menu_timer",
        defaultValue: false,
      },
    ]
  },
];

const TIMED_SETTINGS = {
  nextTimedChange: false,
  nextTimedValue: true,
};

const SCHEDULE_SETTINGS = {
  schedule: false,
  scheduleTimes: '9:00a-5:00p',
  scheduleDays: 'mo,tu,we,th,fr',
};

const OTHER_SETTINGS = {
  global_enable: true,
  dark_mode: false,
  log_enabled: true,
  ...TIMED_SETTINGS,
  ...SCHEDULE_SETTINGS,
};

const DEFAULT_SETTINGS = SECTIONS.reduce((acc, fieldset) => {
  fieldset.options.forEach(option => acc[option.id] = option.defaultValue);
  return acc;
}, { ...OTHER_SETTINGS });


// For import/export
const idToShortId = {
  "global_enable":                      '0',
  "dark_mode":                          '1',
  "log_enabled":                        '2',
  "remove_homepage":                    '3',
  "remove_sidebar":                     '4',
  "remove_end_of_video":                '5',
  "remove_header":                      '6',
  "remove_all_but_one":                 '7',
  "remove_extra_rows":                  '8',
  "remove_infinite_scroll":             '9',
  "disable_play_on_hover":             '10',
  "remove_left_nav_bar":               '11',
  "remove_logo_link":                  '12',
  "remove_home_link":                  '13',
  "remove_explore_link":               '14',
  "remove_shorts_link":                '15',
  "remove_subscriptions_link":         '16',
  "remove_quick_links_section":        '17',
  "remove_sub_section":                '18',
  "remove_explore_section":            '19',
  "remove_more_section":               '20',
  "auto_skip_ads":                     '21',
  "disable_autoplay":                  '22',
  "disable_ambient_mode":              '23',
  "disable_annotations":               '24',
  "disable_playlist_autoplay":         '25',
  "normalize_shorts":                  '26',
  "remove_entire_sidebar":             '27',
  "remove_info_cards":                 '28',
  "remove_overlay_suggestions":        '29',
  "remove_play_next_button":           '30',
  "remove_menu_buttons":               '31',
  "remove_chat":                       '32',
  "remove_embedded_more_videos":       '33',
  "remove_comments":                   '34',
  "remove_non_timestamp_comments":     '35',
  "remove_comment_usernames":          '36',
  "remove_comment_profiles":           '37',
  "remove_comment_replies":            '38',
  "remove_comment_upvotes":            '39',
  "remove_search_suggestions":         '40',
  "remove_search_promoted":            '41',
  "remove_shorts_results":             '42',
  "remove_extra_results":              '43',
  "remove_thumbnail_mouseover_effect": '44',
  "remove_sub_shorts":                 '45',
  "remove_sub_live":                   '46',
  "remove_sub_upcoming":               '47',
  "remove_sub_premiere":               '48',
  "redirect_to_subs":                  '49',
  "redirect_to_wl":                    '50',
  "redirect_to_library":               '51',
  "redirect_off":                      '52',
  "menu_timer":                        '53',
  "remove_all_shorts":                 '54',
  "remove_video_thumbnails":           '55',
  "search_engine_mode":                '56',
  "remove_notif_bell":                 '57',
  "schedule":                          '58',
  "scheduleTimes":                     '59',
  "scheduleDays":                      '60',
  "nextTimedChange":                   '61',
  "nextTimedValue":                    '62',
  "remove_settings_section":           '63',
  "remove_footer_section":             '64',
  "remove_infinite_scroll_search":     '65',
  "autofocus_search":                  '66',
  "remove_playlist_suggestions":       '67',
  "reverse_channel_video_list":        '68',
  "expand_description":                '69',
  "remove_context":                    '70',
  "remove_sub_vods":                   '71',
  "disable_channel_autoplay":          '72',
  "remove_vid_description":            '73',
  "blur_video_thumbnails":             '74',
  "remove_extra_sidebar_tags":         '75',
};


const shortIdToId = Object.entries(idToShortId).reduce((acc, [id, shortId]) => {
  acc[shortId] = id;
  return acc;
}, {});


function sectionNameToUrl(name) {
  const sectionPath = name.
                        toLowerCase().
                        replaceAll(' - ', '_').
                        replaceAll(' ', '_');

  return HOST + 'features/' + sectionPath + '/';
}
