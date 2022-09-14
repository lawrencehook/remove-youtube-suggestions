
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Some global constants.
const HTML = document.documentElement;
const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_FIELDSET = document.getElementById('template_fieldset');
const TEMPLATE_SECTION = document.getElementById('template_section');
const TEMPLATE_OPTION = document.getElementById('template_option');

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
      populateOptions(SECTIONS, headerSettings, settings);
      HTML.setAttribute('loaded', true);
    }

    return true;

  } catch (error) {
    console.log(error);
  }
});


function populateOptions(SECTIONS, headerSettings, SETTING_VALUES) {

  // Clear the options list
  OPTIONS_LIST.innerHTML = '';

  // Add option nodes to the HTML.
  SECTIONS.forEach(section => {
    const { name, options } = section;

    // Create a new section
    const sectionNode = TEMPLATE_SECTION.cloneNode(true);
    sectionNode.id = name;
    sectionNode.classList.remove('removed');
    const label = sectionNode.querySelector('.section_label');
    label.innerText = name;

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
      const value = id in SETTING_VALUES ? SETTING_VALUES[id] : defaultValue;
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

  if (headerSettings) {
    Object.entries(headerSettings).forEach(([ id, value ]) => {
      updateSetting(id, value);

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


function handleEnter(e) {
  const keycode = e.keyCode || e.which;
  keycode === 13 && document.activeElement.click();
}