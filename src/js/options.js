
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
const REDIRECT_KEYS = VALID_SETTINGS.filter(id => id.includes('redirect'));
const REDIRECT_OPTIONS_TEMPLATE = REDIRECT_KEYS.reduce((options, id) => {
  options[id] = false;
  return options;
}, {});


const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_FIELDSET = document.getElementById('template_fieldset');
const TEMPLATE_OPTION = document.getElementById('template_option');


function init() {
  browser.runtime.sendMessage({ getFieldsets: true });
  document.addEventListener("keydown", handleEnter, false);
}

// Load the options menu with our settings.
document.addEventListener("DOMContentLoaded", init);


function handleEnter(e) {
  const keycode = e.keyCode || e.which;
  console.log(keycode);
  console.log(typeof keycode);
  console.log(document.activeElement)
  keycode === 13 && document.activeElement.click();
}


// Receive messages
browser.runtime.onMessage.addListener((data, sender) => {
  try {
    const { FIELDSETS, settings={} } = data;

    // Initial page load.
    if (FIELDSETS) {
      populateOptions(FIELDSETS, settings);
      HTML.setAttribute('loaded', true);
    }

    return true;

  } catch (error) {
    console.log(error);
  }
});


function updateSetting(id, value) {

  // Update local storage.
  browser.storage.local.set({ [id]: value });

  const settings = { [id]: value };
  try {
    // Update running tabs.
    browser.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, { settings });
      });
    });
  } catch (error) {
    console.log(error);
  }
}


// Change settings with the options menu.
Object.entries(SETTINGS_LIST).forEach(([id, value]) => {
  const settingElements = Array.from(document.getElementsByClassName(id));
  settingElements.forEach(button => button.addEventListener('click', async e => {

    // Toggle on click: new value is opposite of old value.
    const value = !(String(HTML.getAttribute(id)).toLowerCase() === "true");

    // Communicate changes (to local settings, content-script.js, etc.)
    let saveObj;

    // Handle standard (non-redirect) settings.
    if (!id.includes('redirect')) {
      saveObj = { [id]: value };

      // Update background script with globalEnable.
      if (id === 'global_enable') {
        browser && browser.runtime.sendMessage({ globalEnable: value });
      }

    // Handle redirect settings
    } else {
      const redirect_url = REDIRECT_URLS[id];
      saveObj = {
        ...REDIRECT_OPTIONS_TEMPLATE,
        [id]: true,
        redirect_url
      };

      // Update background script with changed redirect_url.
      browser && browser.runtime.sendMessage({ redirect_url });
    }

    // Update options page.
    Object.entries(saveObj).forEach(([id, value]) => HTML.setAttribute(id, value));
    if ('checked' in button) button.checked = value;


    // Update local storage.
    browser.storage.local.set(saveObj);

    const settings = saveObj;

    // Update running tabs.
    if (settings) {
      browser.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, { settings });
        });
      });
    }
  }));
});


function populateOptions(sections, settings={}) {

  // Clear the options list
  OPTIONS_LIST.innerHTML = '';

  // Add option nodes to the HTML.
  sections.forEach(section => {
    const { name, options } = section;
    const fieldset = TEMPLATE_FIELDSET.cloneNode(true);
    fieldset.id = name;
    fieldset.classList.remove('removed');
    const legend = fieldset.querySelector('legend');
    legend.innerText = name;

    options.forEach(option => {
      const { id, name, defaultValue, effects, display } = option;
      if (display === false) return;

      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.id = id;
      optionNode.setAttribute('name', name);
      optionNode.classList.add(id);
      const optionLabel = optionNode.querySelector('.option_label');
      optionLabel.innerText = name;

      const svg = optionNode.querySelector('svg');
      const value = id in settings ? settings[id] : defaultValue;
      svg.toggleAttribute('active', value);

      optionNode.addEventListener('click', e => {
        const value = svg.toggleAttribute('active');
        HTML.setAttribute(id, value);
        updateSetting(id, value);

        if (effects && value in effects) {
          Object.entries(effects[value]).forEach(([id, value]) => {
            const svg = document.querySelector(`div#${id} svg`);
            svg?.toggleAttribute('active', value);
            HTML.setAttribute(id, value);
            updateSetting(id, value);
          });
        }
      });

      fieldset.append(optionNode);
    });

    OPTIONS_LIST.append(fieldset);
  });

  if (settings) {
    Object.entries(settings).forEach(([ id, value ]) => {
      HTML.setAttribute(id, value);
      const svg = document.querySelector(`div#${id} svg`);
      svg?.toggleAttribute('active', value);
    });
  }

  const searchBar = document.getElementById('search-bar');
  searchBar.addEventListener('input', onSearchInput);
}


function onSearchInput(e) {
  const { target } = e;
  const { value } = target;
  const fieldsets = Array.from(document.querySelectorAll('fieldset:not(#template_fieldset)'));

  // Reset
  fieldsets.forEach(fieldset => {
    fieldset.classList.remove('removed');
    const options = Array.from(fieldset.querySelectorAll('div.option'));
    options.forEach(option => option.classList.remove('removed'));
  });

  if (value === '') return;

  const searchTerms = value.toLowerCase().split(' ');

  fieldsets.forEach(fieldset => {
    const fieldsetMatch = searchTerms.find(term => {
      return fieldset.id.toLowerCase().includes(term);
    });
    if (fieldsetMatch) return;

    const options = Array.from(fieldset.querySelectorAll('div.option'));
    let optionFound = false;
    options.forEach(option => {
      const optionMatch = searchTerms.find(term => {
        return option.id.toLowerCase().includes(term) ||
               option.getAttribute('name').toLowerCase().includes(term);
      });
      if (optionMatch) {
        optionFound = true;
        return;
      }
      option.classList.add('removed');
    });

    if (!optionFound) {
      fieldset.classList.add('removed');
    }
  });
}

