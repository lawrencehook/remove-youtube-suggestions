
// Globals
const cache = {};
const HTML = document.documentElement;
const SIDEBAR = document.getElementById('sidebar');
const TEMPLATE_SIDEBAR_SECTION = document.getElementById('template_sidebar_section');
const OPTIONS_LIST = document.getElementById('primary_options');
const TEMPLATE_SECTION = document.getElementById('template_section');
const TEMPLATE_OPTION = document.getElementById('template_option');
const TIMER_CONTAINER = document.getElementById('timer_container');
const LOCK_CODE_CONTAINER = document.getElementById('lock_code_container');
let openedTime = Date.now();
let currentUrl;


document.addEventListener("DOMContentLoaded", () => {
  recordEvent('Page View: Options');
  initAnnouncementBanner();
  browser.storage.local.get(localSettings => {
    const revealUpdates = migrateRevealSettings(localSettings);
    if (Object.keys(revealUpdates).length) {
      browser.storage.local.set(revealUpdates);
    }

    const settings = { ...DEFAULT_SETTINGS, ...localSettings };

    const tier = License.getTierSync(localSettings['license_token'], localSettings['session_token']);
    if (tier === 'free') {
      SECTIONS.forEach(section => {
        section.options.forEach(opt => {
          if (opt.premium) settings[opt.id] = false;
        });
      });
    } else if (tier === 'free_signed_in') {
      const writeBack = {};
      let kept = 0;
      SECTIONS.forEach(section => {
        section.options.forEach(opt => {
          if (!opt.premium) return;
          if (settings[opt.id] === true) {
            if (kept < PREMIUM_CONFIG.FREE_PREMIUM_SLOTS) {
              kept++;
            } else {
              settings[opt.id] = false;
              writeBack[opt.id] = false;
            }
          }
        });
      });
      if (Object.keys(writeBack).length) {
        browser.storage.local.set(writeBack);
      }
    }

    const headerSettings = Object.entries(OTHER_SETTINGS).reduce((acc, [id, value]) => {
      acc[id] = id in localSettings ? localSettings[id] : value;
      return acc;
    }, {});

    // Show logging opt-in modal if user hasn't responded yet
    if (!localSettings.log_prompt_answered) {
      showLogPrompt();
    }

    browser.tabs.query({ currentWindow: true, active: true }, tabs => {
      if (!tabs || tabs.length === 0) return;
      const [{ url }] = tabs;
      currentUrl = url;
      populateOptions(SECTIONS, headerSettings, settings);
    });
  });
  document.addEventListener("keydown", handleEnter, false);
});

// Respond to changes in settings
function logStorageChange(changes, area) {
  if (area !== 'local') return;

  Object.entries(changes).forEach(([id, { oldValue, newValue }]) => {
    if (oldValue === newValue) return;
    updateSetting(id, newValue, { write: false });
  });
}
browser.storage.onChanged.addListener(logStorageChange);


function refreshActiveSection() {
  const section = document.getElementById('active_section');
  const sidebarItem = document.getElementById('active_sidebar');
  if (!section || !sidebarItem) return;

  const isSelected = sidebarItem.hasAttribute('selected');

  // Remove old option nodes
  section.querySelectorAll('.option').forEach(opt => opt.remove());

  let count = 0;
  SECTIONS.forEach(s => {
    s.options.forEach(option => {
      const { id, name, effects, display, premium } = option;
      if (display === false) return;
      if (!cache[id]) return;

      count++;
      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.removeAttribute('id');
      optionNode.setAttribute('name', name);
      if (premium) optionNode.setAttribute('data-premium', 'true');
      optionNode.querySelector('.option_label').innerText = name;

      const svg = optionNode.querySelector('svg');
      svg.toggleAttribute('active', true);

      optionNode.addEventListener('click', async e => {
        updateSetting(id, false, { manual: true });
        // Sync the original toggle
        const originalSvg = document.querySelector(`div#${id} svg`);
        originalSvg?.toggleAttribute('active', false);

        if (effects && false in effects) {
          Object.entries(effects[false]).forEach(([eid, val]) => {
            const s = document.querySelector(`div#${eid} svg`);
            s?.toggleAttribute('active', val);
            updateSetting(eid, val);
          });
        }
      });

      section.append(optionNode);
    });
  });

  // Update sidebar badge
  const badge = sidebarItem.querySelector('.active_count');
  if (badge) badge.innerText = count;

  // Only show the section when its sidebar item is selected and there are options
  section.classList.toggle('removed', !isSelected || count === 0);
}


function populateOptions(SECTIONS, headerSettings, SETTING_VALUES) {

  // Clear the options list, and the sidebar
  OPTIONS_LIST.innerHTML = '';
  SIDEBAR.innerHTML = '';
  let allTags = [];

  // Create the Active Options section (hidden until sidebar selected)
  const activeSection = TEMPLATE_SECTION.cloneNode(true);
  activeSection.id = 'active_section';
  activeSection.querySelector('.section_label > a').innerText = 'Active Options';
  activeSection.querySelector('.section_label > a').removeAttribute('href');
  OPTIONS_LIST.append(activeSection);

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
      const { id, name, tags, defaultValue, effects, display, premium } = option;
      if (display === false) return;

      const optionNode = TEMPLATE_OPTION.cloneNode(true);
      optionNode.classList.remove('removed');
      optionNode.id = id;
      optionNode.setAttribute('name', name);
      optionNode.setAttribute('tags', tags);
      optionNode.classList.add(id);
      const optionLabel = optionNode.querySelector('.option_label');
      optionLabel.innerText = name;

      // Mark premium options
      if (premium) {
        optionNode.setAttribute('data-premium', 'true');
      }

      const svg = optionNode.querySelector('svg');
      const value = id in SETTING_VALUES ? SETTING_VALUES[id] : defaultValue;
      HTML.setAttribute(id, value);
      cache[id] = value;
      svg.toggleAttribute('active', value);

      optionNode.addEventListener('click', async e => {
        if (premium && HTML.getAttribute('is_premium') !== 'true') {
          const togglingOn = cache[id] !== true;
          const tier = HTML.getAttribute('tier');
          const hasSlot = tier === 'free_signed_in' &&
                          countActivePremium(cache) < PREMIUM_CONFIG.FREE_PREMIUM_SLOTS;
          if (togglingOn && !hasSlot) {
            if (tier === 'free_signed_in') openUpgradeModal({ reason: 'slot_limit' });
            else openPremiumRequiredModal();
            return;
          }
        }

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

  // Add "All" and "Active" sidebar items at the top
  const sidebarTopRow = document.createElement('div');
  sidebarTopRow.id = 'sidebar_top_row';

  const allSidebar = document.createElement('div');
  allSidebar.id = 'all_sidebar';
  allSidebar.className = 'sidebar_section';
  allSidebar.innerText = 'all';
  allSidebar.addEventListener('click', showAll);

  const activeSidebar = document.createElement('div');
  activeSidebar.id = 'active_sidebar';
  activeSidebar.className = 'sidebar_section';
  activeSidebar.innerHTML = '<span>active</span><span class="active_count"></span>';
  activeSidebar.addEventListener('click', activeSidebarListener);

  sidebarTopRow.append(allSidebar, activeSidebar);
  SIDEBAR.append(sidebarTopRow);

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
    Object.entries(headerSettings).forEach(([ id, value ]) => {
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
  } else if (homepageRegex.test(currentUrl)) {
    qs('.sidebar_section[tag="Homepage"]').click();
  } else {
    qs('.sidebar_section[tag="Basic"]').click();
  }

  updateSlotIndicator();

  const searchBar = document.getElementById('search_bar');
  searchBar.addEventListener('input', onSearchInput);
  const searchInput = searchBar.querySelector('input');
  const focusSearchInput = () => {
    if (!searchInput) return;
    if (document.activeElement === searchInput) return;
    searchInput.focus();
  };
  focusSearchInput();
  setTimeout(focusSearchInput, 0);
  setTimeout(focusSearchInput, 50);
  window.addEventListener('focus', focusSearchInput);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focusSearchInput();
  });

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
      if (input.value === code) {
        HTML.removeAttribute('entering_lock_code', '');
      }
    });
  }

  const openScheduleButton = document.getElementById('disabled_message_open_schedule');
  openScheduleButton.addEventListener('click', e => openScheduleModal());

  // Begin time loop -- checks for timedChanges, scheduling
  timeLoop();
  refreshActiveSection();
  HTML.setAttribute('loaded', true);
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


function updateSetting(id, value, { write=true, manual=false }={}) {

  // Clamp premium writes that would exceed the free-tier slot budget, so chained
  // effects behave the same as direct toggles.
  if (PREMIUM_FEATURE_ID_SET.has(id) && value === true) {
    const tier = HTML.getAttribute('tier');
    if (tier === 'free') {
      value = false;
    } else if (tier === 'free_signed_in' && cache[id] !== true &&
               countActivePremium(cache) >= PREMIUM_CONFIG.FREE_PREMIUM_SLOTS) {
      value = false;
    }
  }

  if (manual) recordEvent('Setting changed', { id, value });

  HTML.setAttribute(id, value);
  cache[id] = value;

  const svg = document.querySelector(`div#${id} svg`);
  svg?.toggleAttribute('active', value);

  // Update local storage.
  if (write) browser.storage.local.set({ [id]: value });


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

  refreshActiveSection();

  if (PREMIUM_FEATURE_ID_SET.has(id)) updateSlotIndicator();
}


function onSearchInput(e) {
  const { value } = e.target;

  showAll();
  if (value === '') return;

  // Deselect "all" during active search
  const allSidebar = document.getElementById('all_sidebar');
  if (allSidebar) allSidebar.removeAttribute('selected');

  const sections = qsa('.section_container:not(#template_section):not(#active_section)');
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


function showAll() {
  const sidebarSections = qsa('.sidebar_section');
  const sections = qsa('.section_container:not(#template_section):not(#active_section)');
  const activeSection = document.getElementById('active_section');

  sidebarSections.forEach(s => s.removeAttribute('selected'));
  const allSidebar = document.getElementById('all_sidebar');
  if (allSidebar) allSidebar.setAttribute('selected', '');
  sections.forEach(section => {
    section.classList.remove('removed');
    section.querySelectorAll('div.option').forEach(opt => opt.classList.remove('removed'));
  });
  if (activeSection) activeSection.classList.add('removed');
}


function activeSidebarListener(e) {
  const target = e.currentTarget;
  const selected = target.toggleAttribute('selected');

  if (selected) {
    // Reset other selections, hide regular sections, show active
    qsa('.sidebar_section').forEach(s => {
      if (s !== target) s.removeAttribute('selected');
    });
    qsa('.section_container:not(#template_section):not(#active_section)').forEach(s => s.classList.add('removed'));
    refreshActiveSection();
  } else {
    showAll();
  }
}


function sidebarSectionListener(e) {
  const sidebarSection = e.target;
  const wasSelected = sidebarSection.hasAttribute('selected');
  const tag = sidebarSection.getAttribute('tag');

  recordEvent('Section selected', { tag, selected: !wasSelected });

  showAll();
  if (wasSelected) return;

  const allSidebar = document.getElementById('all_sidebar');
  if (allSidebar) allSidebar.removeAttribute('selected');
  sidebarSection.setAttribute('selected', '');
  const sections = qsa('.section_container:not(#template_section):not(#active_section)');

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
let timeLoopId = null;

function timeLoop() {
  // Don't run if page is hidden
  if (document.hidden) return;

  const {
    schedule, scheduleTimes, scheduleDays,
    nextTimedChange, nextTimedValue
  } = cache;

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
  timeLoopId = setTimeout(() => timeLoop(), 2_000);
}

// Pause/resume timeLoop based on visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (timeLoopId) {
      clearTimeout(timeLoopId);
      timeLoopId = null;
    }
  } else {
    if (!timeLoopId) {
      timeLoop();
    }
  }
});


// Announcement banners
function initAnnouncementBanner() {
  const container = document.getElementById('banner_container');
  if (!container) return;

  const logoUrl = browser.runtime.getURL('images/rys.svg');
  const banners = getActiveBanners('options');

  banners.forEach(banner => {
    initBanner(banner, logoUrl, () => ({
      element: container,
      insertMethod: 'append'
    }));
  });
}


// Logging opt-in banner
function showLogPrompt() {
  const banner = document.getElementById('log_prompt_banner');
  const yesBtn = document.getElementById('log_prompt_yes');
  const noBtn = document.getElementById('log_prompt_no');
  const dismissBtn = document.getElementById('log_prompt_dismiss');

  banner.hidden = false;

  yesBtn.addEventListener('click', () => {
    browser.storage.local.set({ log_enabled: true, log_prompt_answered: true });
    banner.hidden = true;
  }, { once: true });

  noBtn.addEventListener('click', () => {
    browser.storage.local.set({ log_enabled: false, log_prompt_answered: true });
    banner.hidden = true;
  }, { once: true });

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
  }, { once: true });
}
