
// Globals
const cache = {};
let strictModeEndTime = 0;

const HTML = document.documentElement;
const SIDEBAR = document.getElementById('sidebar');
const TEMPLATE_SIDEBAR_SECTION = document.getElementById('template_sidebar_section');
const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_FIELDSET = document.getElementById('template_fieldset');
const TEMPLATE_SECTION = document.getElementById('template_section');
const TEMPLATE_OPTION = document.getElementById('template_option');
const TIMER_CONTAINER = document.getElementById('timer_container');
const LOCK_CODE_CONTAINER = document.getElementById('lock_code_container');
let openedTime = Date.now();
let currentUrl;

const resultsPageRegex = new RegExp('.*://.*youtube\\.com/results.*', 'i');
const videoPageRegex = new RegExp('.*://(www|m)\\.youtube\\.com/watch\\?v=.*', 'i');
const homepageRegex = new RegExp('.*://(www|m)\\.youtube\\.com/$', 'i');
const channelRegex = new RegExp('.*://.*youtube\.com/(@|channel)', 'i');
const shortsRegex = new RegExp('.*://.*youtube\.com/shorts.*', 'i');
const subsRegex = new RegExp(/\/feed\/subscriptions$/, 'i');

document.addEventListener("DOMContentLoaded", () => {
  recordEvent('Page View: Options');
  browser.storage.local.get(localSettings => {
    const settings = { ...DEFAULT_SETTINGS, ...localSettings };
    const headerSettings = Object.entries(OTHER_SETTINGS).reduce((acc, [id, value]) => {
      acc[id] = id in localSettings ? localSettings[id] : value;
      return acc;
    }, {});

    browser.tabs.query({ currentWindow: true, active: true }, tabs => {
      if (!tabs || tabs.length === 0) return;
      const [{ url }] = tabs;
      currentUrl = url;
      populateOptions(SECTIONS, headerSettings, settings);
    });
  });
  document.addEventListener("keydown", handleEnter, false);
});

function showStrictModeConfirmation() {
  return new Promise((resolve) => {
    const confirmed = confirm('Are you sure you want to enable Strict Mode? This will prevent you from changing any settings until disabled or the set time expires.');
    resolve(confirmed);
  });
}

function promptStrictModeDuration() {
  return new Promise((resolve) => {
    let durationMinutes;
    do {
      const input = prompt('Enter the number of minutes for Strict Mode (max 360 minutes / 6 hours):', '60');
      if (input === null) {
        resolve(null); // User cancelled
        return;
      }
      durationMinutes = parseInt(input, 10);
    } while (isNaN(durationMinutes) || durationMinutes <= 0 || durationMinutes > 360);
    resolve(durationMinutes);
  });
}

function updateStrictModeTimer() {
  const timeLeft = strictModeEndTime - Date.now();
  if (timeLeft <= 0) {
    updateSetting('strict_mode', false, { manual: false });
    updateSetting('strict_mode_end_time', null, { manual: false });
    blockEdit(false);
    return;
  }

  const hours = Math.floor(timeLeft / (60 * 60 * 1000));
  const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

  const timerElement = document.getElementById('strict_mode_timer') || createTimerElement();
  timerElement.textContent = `Strict Mode: ${hours}h ${minutes}m ${seconds}s remaining`;

  setTimeout(updateStrictModeTimer, 1000);
}

function createTimerElement() {
  const timerElement = document.createElement('div');
  timerElement.id = 'strict_mode_timer';
  timerElement.style.position = 'fixed';
  timerElement.style.bottom = '10px';
  timerElement.style.right = '10px';
  timerElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  timerElement.style.color = 'white';
  timerElement.style.padding = '5px 10px';
  timerElement.style.borderRadius = '5px';
  document.body.appendChild(timerElement);
  return timerElement;
}


// Respond to changes in settings
function logStorageChange(changes, area) {
  if (area !== 'local') return;

  Object.entries(changes).forEach(([id, { oldValue, newValue }]) => {
    if (oldValue === newValue) return;
    updateSetting(id, newValue, { write: false });
  });
}
browser.storage.onChanged.addListener(logStorageChange);


function blockEdit(strictMode) {
  const options = document.querySelectorAll('.option:not(.strict_mode)');
  options.forEach(option => {
    if (strictMode) {
      option.style.pointerEvents = 'none';
      option.style.opacity = '0.5';
    } else {
      option.style.pointerEvents = 'auto';
      option.style.opacity = '1';
    }
  });
}

function populateOptions(SECTIONS, headerSettings, SETTING_VALUES) {

  // Clear the options list, and the sidebar
  OPTIONS_LIST.innerHTML = '';
  SIDEBAR.innerHTML = '';
  let allTags = [];

  // Add option nodes to the HTML.
  SECTIONS.forEach(section => {
    const { name, tags, options } = section;

    tags.split(',').forEach(tag => allTags.push(tag.trim()));

    // Create a new section
    const sectionNode = TEMPLATE_SECTION.cloneNode(true);
    sectionNode.id = name;
    sectionNode.classList.remove('removed');
    sectionNode.setAttribute('tags', tags);
    const label = sectionNode.querySelector('.section_label > a');
    label.innerText = name;
    label.setAttribute('href', sectionNameToUrl(name));

    options.forEach(option => {
      const { id, name, tags, defaultValue, effects, display } = option;
      if (display === false) return;

      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.id = id;
      optionNode.setAttribute('name', name);
      optionNode.setAttribute('tags', tags);
      optionNode.classList.add(id);
      const optionLabel = optionNode.querySelector('.option_label');
      optionLabel.innerText = name;

      const svg = optionNode.querySelector('svg');
      const value = id in SETTING_VALUES ? SETTING_VALUES[id] : defaultValue;
      HTML.setAttribute(id, value);
      cache[id] = value;
      svg.toggleAttribute('active', value);

      optionNode.addEventListener('click', e => {
        const value = svg.toggleAttribute('active');
        updateSetting(id, value, { manual: true });

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
  const uniqueTags = Array.from(new Set(allTags));
  uniqueTags.forEach(tag => {
    const sidebarSection = TEMPLATE_SIDEBAR_SECTION.cloneNode(true);
    sidebarSection.removeAttribute('hidden');
    sidebarSection.removeAttribute('id');
    sidebarSection.setAttribute('tag', tag);
    sidebarSection.innerText = tag;
    sidebarSection.addEventListener('click', sidebarSectionListener);
    SIDEBAR.append(sidebarSection);
  });

  if (headerSettings) {
    Object.entries(headerSettings).forEach(([id, value]) => {
      HTML.setAttribute(id, value);
      cache[id] = value;

      const svg = document.querySelector(`div#${id} svg`);
      svg?.toggleAttribute('active', value);

      const elt = document.querySelector(`#${id}`);
      elt?.addEventListener('click', e => {
        const value = !(HTML.getAttribute(id) === 'true');
        updateSetting(id, value, { manual: true });
      });
    });
  }

  // Pre-select sidebar option based on current window. Default to 'Basic'
  if (resultsPageRegex.test(currentUrl)) {
    qs('.sidebar_section[tag="Search"]').click();
  } else if (videoPageRegex.test(currentUrl)) {
    qs('.sidebar_section[tag="Video Player"]').click();
  } else if (subsRegex.test(currentUrl)) {
    qs('.sidebar_section[tag="Subscriptions"]').click();
  } else if (channelRegex.test(currentUrl)) {
    qs('.sidebar_section[tag="Channel"]').click();
  } else {
    qs('.sidebar_section[tag="Basic"]').click();
  }

  const searchBar = document.getElementById('search_bar');
  searchBar.addEventListener('input', onSearchInput);

  const turnBackOn = document.getElementById('turn_back_on');
  turnBackOn.addEventListener('click', e => {
    updateSetting('global_enable', true, { manual: true });
  });

  if (SETTING_VALUES['menu_timer']) {
    HTML.setAttribute('menu_timer_counting_down', '');
    timerLoop();
  }

  if (SETTING_VALUES['lock_code']) {
    HTML.setAttribute('entering_lock_code', '');
    const code = generateRandomString(16);
    const input = qs('input', LOCK_CODE_CONTAINER);
    qs('div#code', LOCK_CODE_CONTAINER).innerText = code;
    input.addEventListener('input', e => {
      console.log(input.value);
      console.log();
      if (input.value === code) {
        HTML.removeAttribute('entering_lock_code', '');
      }
    });
  }

  const openScheduleButton = document.getElementById('disabled_message_open_schedule');
  openScheduleButton.addEventListener('click', e => openScheduleModal());

  // Begin time loop -- checks for timedChanges, scheduling
  timeLoop();

  // Add Strict Mode toggle
  const strictModeToggle = TEMPLATE_OPTION.cloneNode(true);
  strictModeToggle.classList.remove('removed');
  strictModeToggle.id = 'strict_mode';
  strictModeToggle.setAttribute('name', 'Strict Mode');
  strictModeToggle.setAttribute('tags', 'Basic');
  strictModeToggle.classList.add('strict_mode');
  const strictModeLabel = strictModeToggle.querySelector('.option_label');
  strictModeLabel.innerText = 'Strict Mode';

  const strictModeSvg = strictModeToggle.querySelector('svg');
  const strictModeValue = SETTING_VALUES['strict_mode'] || false;
  HTML.setAttribute('strict_mode', strictModeValue);
  cache['strict_mode'] = strictModeValue;
  strictModeSvg.toggleAttribute('active', strictModeValue);

  strictModeToggle.addEventListener('click', async (e) => {
    if (!cache['strict_mode']) {
      const confirmed = await showStrictModeConfirmation();
      if (confirmed) {
        const durationMinutes = await promptStrictModeDuration();
        if (durationMinutes) {
          const endTime = Date.now() + durationMinutes * 60 * 1000;
          await updateSetting('strict_mode', true, { manual: true });
          await updateSetting('strict_mode_end_time', endTime, { manual: true });
          strictModeEndTime = endTime;
          blockEdit(true);
          updateStrictModeTimer();
        }
      }
    }
    // Remove the else block that allowed turning off strict mode
  });

  OPTIONS_LIST.querySelector('#Basic').append(strictModeToggle);

  HTML.setAttribute('loaded', true);

  // Load strict mode state
  if (SETTING_VALUES['strict_mode'] && SETTING_VALUES['strict_mode_end_time']) {
    strictModeEndTime = SETTING_VALUES['strict_mode_end_time'];
    if (Date.now() < strictModeEndTime) {
      blockEdit(true);
      updateStrictModeTimer();
    } else {
      // Strict mode has expired
      updateSetting('strict_mode', false, { manual: false });
      updateSetting('strict_mode_end_time', null, { manual: false });
    }
  } else {
    // Ensure strict mode is off by default
    updateSetting('strict_mode', false, { manual: false });
    updateSetting('strict_mode_end_time', null, { manual: false });
  }
}


function updateTimeInfo() {

  // Timed changes
  const { nextTimedChange, nextTimedValue } = cache;
  const disabledMessage = qs('#disabled_message span');
  if (nextTimedChange) {
    const nextChange = new Date(Number(nextTimedChange));
    const message = formatDateMessageShort(nextChange);
    disabledMessage.innerText = message;

    const remainingTime = nextChange - Date.now();
    const { hours, minutes, seconds } = parseTimeRemaining(remainingTime);
    let title = `Turning ${nextTimedValue ? 'on' : 'off'} in `;
    if (hours) title = title.concat(hours, ' hours and ');
    if (minutes) title = title.concat(minutes, ' minutes and ');
    title = title.concat(seconds, ' seconds.');
    POWER_ICON.setAttribute('title', title);
  }

  // Scheduling
  const { schedule, scheduleTimes, scheduleDays } = cache;
  const scheduleIsActive = checkSchedule(scheduleTimes, scheduleDays);
  const nextChange = nextScheduleChange(scheduleTimes, scheduleDays);
  const scheduleMessageNode = qs('#disabled_message_schedule span');
  const scheduleMessage = formatDateMessage(nextChange)
  scheduleMessageNode.innerText = scheduleMessage;

  if (!nextTimedChange) {
    const remainingTime = nextChange - Date.now();
    const { days, hours, minutes, seconds } = parseTimeRemaining(remainingTime);
    let title = `Turning ${scheduleIsActive ? 'off' : 'on'} in `;
    if (days) title = title.concat(days, ' days and ');
    if (hours) title = title.concat(hours, ' hours and ');
    if (minutes) title = title.concat(minutes, ' minutes and ');
    title = title.concat(seconds, ' seconds.');
    POWER_ICON.setAttribute('title', title);
  }

  // Default
  if (!nextTimedChange && !schedule) {
    const title = `On/Off`;
    POWER_ICON.setAttribute('title', title);
  }

}


async function updateSetting(id, value, { write = true, manual = false } = {}) {
  if (id === 'strict_mode' && cache['strict_mode'] && Date.now() < cache['strict_mode_end_time']) {
    console.log('Strict Mode cannot be disabled until the set time expires');
    return;
  }


  if (manual) recordEvent('Setting changed', { id, value });

  HTML.setAttribute(id, value);
  cache[id] = value;

  const svg = document.querySelector(`div#${id} svg`);
  svg?.toggleAttribute('active', value);

  // Update local storage.
  if (write) await browser.storage.local.set({ [id]: value });


  // Special cases
  if (id === 'global_enable' && manual) {
    updateSetting('nextTimedChange', false);
  }

  const timeInfoIds = [
    'nextTimedChange', 'schedule',
    'scheduleTimes', 'scheduleDays'
  ];
  if (timeInfoIds.includes(id)) {
    updateTimeInfo();
  }
}


function onSearchInput(e) {
  const { target } = e;
  const { value } = target;
  const sidebarSections = qsa('.sidebar_section');
  const sections = qsa('.section_container:not(#template_section)');

  // Reset
  sidebarSections.forEach(s => s.removeAttribute('selected'));
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
  const sidebarSections = qsa('.sidebar_section');
  const selected = sidebarSection.toggleAttribute('selected');
  const tag = sidebarSection.getAttribute('tag');
  const sections = qsa('.section_container:not(#template_section)');

  recordEvent('Section selected', { tag, selected });

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
    const sectionTags = section.getAttribute('tags').split(',').map(t => t.trim());
    const sectionMatch = sectionTags.some(t => t === tag);
    if (sectionMatch) return;

    const options = Array.from(section.querySelectorAll('div.option'));
    let optionFound = false;
    options.forEach(option => {
      const optionTags = option.getAttribute('tags').split(',').map(t => t.trim());
      const optionMatch = optionTags.some(t => t === tag);
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


// For the menu timer option
function timerLoop() {
  const timeLeft = 10 - Math.floor((Date.now() - openedTime) / 1000);
  const timeLeftElt = TIMER_CONTAINER.querySelector('div:nth-child(2)');
  timeLeftElt.innerText = `${timeLeft} second${timeLeft === 1 ? '' : 's'} remaining.`;

  if (timeLeft < 1) {
    HTML.removeAttribute('menu_timer_counting_down');
  } else {
    setTimeout(timerLoop, 50);
  }
}


// For timedChanged and scheduling
function timeLoop() {
  const {
    schedule, scheduleTimes, scheduleDays,
    nextTimedChange, nextTimedValue
  } = cache;

  if (cache['strict_mode'] && cache['strict_mode_end_time']) {
    if (Date.now() > cache['strict_mode_end_time']) {
      updateSetting('strict_mode', false, { manual: false });
      updateSetting('strict_mode_end_time', null, { manual: false });
      blockEdit(false);
      const timerElement = document.getElementById('strict_mode_timer');
      if (timerElement) {
        timerElement.remove();
      }
    }
  }



  if (nextTimedChange) {
    if (Date.now() > Number(nextTimedChange)) {
      updateSetting('nextTimedChange', false);
      updateSetting('global_enable', nextTimedValue);
    }
  } else if (schedule) {
    const scheduleIsActive = checkSchedule(scheduleTimes, scheduleDays);
    if (scheduleIsActive) {
      if (!cache['global_enable']) {
        updateSetting('global_enable', true);
      }
    } else {
      if (cache['global_enable']) {
        updateSetting('global_enable', false);
      }
    }
  }

  updateTimeInfo();
  setTimeout(() => timeLoop(), 2_000);
}
