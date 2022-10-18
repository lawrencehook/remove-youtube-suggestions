
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Globals
const HTML = document.documentElement;
const SIDEBAR = document.getElementById('sidebar');
const TEMPLATE_SIDEBAR_SECTION = document.getElementById('template_sidebar_section');
const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_FIELDSET = document.getElementById('template_fieldset');
const TEMPLATE_SECTION = document.getElementById('template_section');
const TEMPLATE_OPTION = document.getElementById('template_option');
const TIMER_CONTAINER = document.getElementById('timer_container');
let openedTime = Date.now();
let currentUrl;

const resultsPageRegex = new RegExp('.*://.*youtube\\.com/results.*', 'i');
const videoPageRegex =   new RegExp('.*://(www|m)\\.youtube\\.com/watch\\?v=.*', 'i');
const homepageRegex =    new RegExp('.*://(www|m)\\.youtube\\.com/$',  'i');
const shortsRegex =      new RegExp('.*://.*youtube\.com/shorts.*',  'i');
const subsRegex =        new RegExp(/\/feed\/subscriptions$/, 'i');

document.addEventListener("DOMContentLoaded", () => {
  browser.runtime.sendMessage({ getFieldsets: true });
  document.addEventListener("keydown", handleEnter, false);
});


// Receive messages
browser.runtime.onMessage.addListener((data, sender) => {
  try {
    const { SECTIONS, headerSettings, settings } = data;

    // Initial page load.
    if (SECTIONS) {
      browser.tabs.query({ currentWindow: true, active:true }, tabs => {
        if (!tabs || tabs.length === 0) return;
        const [{ url }] = tabs;
        currentUrl = url;
        populateOptions(SECTIONS, headerSettings, settings);
        HTML.setAttribute('loaded', true);
      })
    }

    return true;

  } catch (error) {
    console.log(error);
  }
});


function populateOptions(SECTIONS, headerSettings, SETTING_VALUES) {

  // Clear the options list, and the sidebar
  OPTIONS_LIST.innerHTML = '';
  SIDEBAR.innerHTML = '';
  sidebarNames = [];

  // Add option nodes to the HTML.
  SECTIONS.forEach(section => {
    const { name, sidebarName, options } = section;

    sidebarNames.push(sidebarName);

    // Create a new section
    const sectionNode = TEMPLATE_SECTION.cloneNode(true);
    sectionNode.id = name;
    sectionNode.classList.remove('removed');
    sectionNode.setAttribute('sidebarName', sidebarName);
    const label = sectionNode.querySelector('.section_label');
    label.innerText = name;

    options.forEach(option => {
      const { id, name, sidebarName, defaultValue, effects, display } = option;
      if (display === false) return;

      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.id = id;
      optionNode.setAttribute('name', name);
      optionNode.setAttribute('sidebarName', sidebarName);
      optionNode.classList.add(id);
      const optionLabel = optionNode.querySelector('.option_label');
      optionLabel.innerText = name;

      const svg = optionNode.querySelector('svg');
      const value = id in SETTING_VALUES ? SETTING_VALUES[id] : defaultValue;
      HTML.setAttribute(id, value);
      svg.toggleAttribute('active', value);

      optionNode.addEventListener('click', e => {
        const value = svg.toggleAttribute('active');
        updateSetting(id, value);

        if (effects && value in effects) {
          Object.entries(effects[value]).forEach(([id, value]) => {
            const svg = document.querySelector(`div#${id} svg`);
            svg?.toggleAttribute('active', value);
            updateSetting(id, value);
          });
        }
      });

      sectionNode.append(optionNode);
    });

    OPTIONS_LIST.append(sectionNode);
  });

  // Add sections to the sidebar
  const uniqueSidebarNames = Array.from(new Set(sidebarNames));
  uniqueSidebarNames.forEach(sidebarName => {
    const sidebarSection = TEMPLATE_SIDEBAR_SECTION.cloneNode(true);
    sidebarSection.removeAttribute('hidden');
    sidebarSection.removeAttribute('id');
    sidebarSection.setAttribute('sidebarName', sidebarName);
    sidebarSection.innerText = sidebarName;
    sidebarSection.addEventListener('click', sidebarSectionListener);
    SIDEBAR.append(sidebarSection);
  });

  // Pre-select sidebar option based on current window.
  if (resultsPageRegex.test(currentUrl)) {
    console.log('matched resultsPageRegex');
    document.querySelector('.sidebar_section[sidebarname="Search"]').click();
  }
  if (videoPageRegex.test(currentUrl)) {
    console.log('matched videoPageRegex');
    document.querySelector('.sidebar_section[sidebarname="Video Player"]').click();
  }
  if (subsRegex.test(currentUrl)) {
    console.log('matched subsRegex');
    document.querySelector('.sidebar_section[sidebarname="Subscriptions"]').click();
  }

  if (headerSettings) {
    Object.entries(headerSettings).forEach(([ id, value ]) => {
      HTML.setAttribute(id, value);

      const svg = document.querySelector(`div#${id} svg`);
      svg?.toggleAttribute('active', value);

      const elt = document.querySelector(`#${id}`);
      elt?.addEventListener('click', e => {
        const value = !(HTML.getAttribute(id) === 'true');
        updateSetting(id, value);
      });
    });
  }

  const searchBar = document.getElementById('search_bar');
  searchBar.addEventListener('input', onSearchInput);

  const turnBackOn = document.getElementById('turn_back_on');
  turnBackOn.addEventListener('click', e => updateSetting('global_enable', true));

  if (SETTING_VALUES['menu_timer']) {
    HTML.setAttribute('menu_timer_counting_down', '')
    timerLoop();
  }
}


function updateSetting(id, value) {

  HTML.setAttribute(id, value);

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


function onSearchInput(e) {
  const { target } = e;
  const { value } = target;
  const sections = Array.from(document.querySelectorAll('.section_container:not(#template_section)'));

  // Reset
  sections.forEach(section => {
    section.classList.remove('removed');
    const options = Array.from(section.querySelectorAll('div.option'));
    options.forEach(option => option.classList.remove('removed'));
  });

  if (value === '') return;

  const searchTerms = value.toLowerCase().split(' ');

  sections.forEach(section => {
    const sectionMatch = searchTerms.find(term => {
      return section.id.toLowerCase().includes(term);
    });
    if (sectionMatch) return;

    const options = Array.from(section.querySelectorAll('div.option'));
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
      section.classList.add('removed');
    }
  });
}


function sidebarSectionListener(e) {
  const sidebarSection = e.target;
  const sidebarSections = Array.from(document.querySelectorAll('.sidebar_section'));
  const selected = sidebarSection.toggleAttribute('selected');
  const sidebarName = sidebarSection.getAttribute('sidebarName');
  const sections = Array.from(document.querySelectorAll('.section_container:not(#template_section)'));

  // Reset
  sections.forEach(section => {
    section.classList.remove('removed');
    const options = Array.from(section.querySelectorAll('div.option'));
    options.forEach(option => option.classList.remove('removed'));
  });
  sidebarSections.forEach(sidebarSection => {
    sidebarSection.removeAttribute('selected');
  })

  sidebarSection.toggleAttribute('selected', selected);
  if (!selected) return;

  sections.forEach(section => {
    const sectionSidebarName = section.getAttribute('sidebarName');
    const sectionMatch = sidebarName === sectionSidebarName;
    if (sectionMatch) return;

    const options = Array.from(section.querySelectorAll('div.option'));
    let optionFound = false;
    options.forEach(option => {
      const optionSidebarName = option.getAttribute('sidebarName');
      const optionMatch = sidebarName === optionSidebarName;
      if (optionMatch) {
        optionFound = true;
      } else {
        option.classList.add('removed');
      }
    });

    if (!optionFound) {
      section.classList.add('removed');
    }
  });
}


function handleEnter(e) {
  const keycode = e.keyCode || e.which;
  keycode === 13 && document.activeElement.click();
}


function timerLoop() {
  const timeLeft = 9 - Math.floor((Date.now() - openedTime) / 1000);
  const timeLeftElt = TIMER_CONTAINER.querySelector('div:nth-child(2)');
  timeLeftElt.innerText = `${timeLeft} second${timeLeft === 1 ? '' : 's'} remaining.`;

  if (timeLeft < 0) {
    HTML.removeAttribute('menu_timer_counting_down');
  } else {
    setTimeout(timerLoop, 50);
  }
}