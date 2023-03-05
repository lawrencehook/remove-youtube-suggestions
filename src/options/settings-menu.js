const prefix = 'rys_settings_';
const delimiter1 = ':';
const delimiter2 = ',';

const SETTINGS_MENU = document.getElementById('settings-menu');
const SETTINGS_BUTTON = document.getElementById('header-settings');
hydrateDropdown(SETTINGS_BUTTON, SETTINGS_MENU,
  x => x.classList.remove('hidden'),
  x => x.classList.add('hidden')
);


// Global toggle
const SETTINGS_ENABLE = document.getElementById('settings-enable');
const SETTINGS_DISABLE = document.getElementById('settings-disable');
const POWER_ICON = qs('#power-icon');
const POWER_OPTIONS_MENU = qs('#power-options');
const POWER_OPTIONS = qsa('#power-options > div');
SETTINGS_ENABLE.addEventListener('click', e => updateSetting('global_enable', true));
SETTINGS_DISABLE.addEventListener('click', e => updateSetting('global_enable', false));
hydrateDropdown(POWER_ICON, POWER_OPTIONS_MENU);
POWER_OPTIONS.forEach(o => {
  const minutes = o.getAttribute('minutes');
  if (!minutes) return;

  o.addEventListener('click', e => {
    const enabled = HTML.getAttribute('global_enable') === 'true';
    updateSetting('global_enable', !enabled);
    updateSetting('nextTimedChange', Date.now() + 60_000 * Number(minutes));
    updateSetting('nextTimedValue', enabled);
  });
});


/**************
 * Scheduling *
 **************/
const scheduleModalContainer = document.getElementById('schedule_container_background');
const SCHEDULING_OPTION = document.getElementById('settings-schedule');
const scheduleToggleContainer = document.getElementById('enable-schedule');
const scheduleToggle = scheduleToggleContainer.querySelector('svg');
const SCHEDULE_TIMES = document.getElementById('schedule-times');
const SCHEDULE_DAYS = document.getElementById('schedule-days');
const SCHEDULE_DAYS_OPTIONS = qsa('div', SCHEDULE_DAYS);
const TIME_PRESETS = qsa('#times-container .predefined-options a');
const DAY_PRESETS = qsa('#days-container .predefined-options a');

function updateTimes(times) {
  SCHEDULE_TIMES.value = times;
  const isValid = timeIsValid(times);
  SCHEDULE_TIMES.toggleAttribute('invalid', !isValid);
  updateSetting('scheduleTimes', times);
}
function updateDays(days) {
  const daysArray = days.split(',').map(d => d.toLowerCase().trim());
  SCHEDULE_DAYS_OPTIONS.forEach(node => {
    const day = node.getAttribute('day');
    node.toggleAttribute('active', daysArray.includes(day));
  });
  updateSetting('scheduleDays', days);
}

function closeScheduleModal() {
  scheduleModalContainer.setAttribute('hidden', '');
}
scheduleModalContainer.addEventListener('click', e => {
  if (e.target !== scheduleModalContainer) return;
  closeScheduleModal();
});

// openScheduleModal();
function openScheduleModal() {
  scheduleModalContainer.removeAttribute('hidden');

  // Populate with local data.
  browser.storage.local.get(SCHEDULE_SETTINGS, settings => {
    const { schedule, scheduleTimes, scheduleDays } = settings;

    scheduleToggle.toggleAttribute('active', schedule);
    updateTimes(scheduleTimes);
    updateDays(scheduleDays);
  });
}
SCHEDULING_OPTION.addEventListener('click', e => {
  openScheduleModal();
});

// Schedule on/off
scheduleToggleContainer.addEventListener('click', e => {
  const enabled = scheduleToggle.toggleAttribute('active');
  updateSetting('schedule', enabled);
});

// Schedule times
SCHEDULE_TIMES.addEventListener('input', e => {
  const times = SCHEDULE_TIMES.value;
  const isValid = timeIsValid(times);

  SCHEDULE_TIMES.toggleAttribute('invalid', !isValid);
  if (!isValid) return;

  updateSetting('scheduleTimes', times);
});

// Schedule days
SCHEDULE_DAYS_OPTIONS.forEach(o => {
  o.addEventListener('click', e => {
    const day = o.getAttribute('day');
    const active = o.toggleAttribute('active');
    const currentDays = HTML.getAttribute('scheduleDays').split(',');

    let newDays;
    if (active) {
      newDays = currentDays.concat(day);
    } else {
      newDays = currentDays.filter(d => d.toLowerCase().trim() !== day);
    }

    updateSetting('scheduleDays', newDays.join(','))
  });
});

// Schdule preset options
TIME_PRESETS.forEach(node => {
  node.addEventListener('click', e => {
    const times = node.getAttribute('times');
    updateTimes(times);
  });
});
DAY_PRESETS.forEach(node => {
  node.addEventListener('click', e => {
    const days = node.getAttribute('days');
    updateDays(days);
  });
});

// Logging toggle
const LOG_ENABLE = document.getElementById('log-enable');
LOG_ENABLE.addEventListener('click', e => updateSetting('log_enabled', true));
const LOG_DISABLE = document.getElementById('log-disable');
LOG_DISABLE.addEventListener('click', e => updateSetting('log_enabled', false));


// Export settings
const EXPORT_SETTINGS = document.getElementById('export-settings');
EXPORT_SETTINGS.addEventListener('click', e => {
  browser.storage.local.get(async localSettings => {
    const settingsObj = { ...DEFAULT_SETTINGS, ...localSettings };
    const settingsStr = settingsObjToStr(settingsObj);
    navigator.clipboard.writeText(settingsStr);

    displayStatus('Settings copied to clipboard');
  });
});


// Import settings
const IMPORT_SETTINGS = document.getElementById('import-settings');
IMPORT_SETTINGS.addEventListener('click', e => {
  openImportModal();
});


// Import Modal
const importModalContainer = document.getElementById('import_container_background');
const importModal = document.getElementById('import_container');
const importInput = document.getElementById('import_input');
const importSubmit = document.getElementById('import_submit');

importModalContainer.addEventListener('click', e => {
  if (e.target === importModalContainer) importModalContainer.setAttribute('hidden', '');
});

importSubmit.addEventListener('click', e => {
  const settingsStr = importInput.value;

  try {
    const settingsObj = settingsStrToObj(settingsStr);
    console.log(settingsObj);

    browser.storage.local.set(settingsObj).then(x => {
      updateSettings(settingsObj);
      displayStatus('Successfully imported settings');
      closeImportModal();
    });

  } catch (error) {
    displayStatus('Import failed');
    closeImportModal();
  }

});

function openImportModal() {
  importModalContainer.removeAttribute('hidden');
}

function closeImportModal() {
  importModalContainer.setAttribute('hidden', '');
}


function updateSettings(settings) {
  Object.entries(settings).forEach(([ id, value ]) => {
    updateSetting(id, value, false);
  });
}


// Status overlay 
const statusOverlayContainer = document.getElementById('status_overlay_container');
const statusMessage = document.getElementById('status_message');
function displayStatus(msg, fadeTime=1500) {
  statusOverlayContainer.removeAttribute('hidden');
  statusMessage.innerText = msg;

  setTimeout(() => statusOverlayContainer.setAttribute('hidden', ''), fadeTime);
}


function settingsObjToStr(settings) {
  const getId = id => idToShortId[id];
  const getVal = val => {
    if (val === true || val === false) return val === true ? 't' : 'f';

    // Schedule settings
    return val.toString().replaceAll(delimiter1, '<d1>').replaceAll(delimiter2, '<d2>');

  }

  const str = Object.entries(settings).
                filter(([id, val]) => getId(id)).
                map(([id, val]) => `${getId(id)}${delimiter1}${getVal(val)}`).join(delimiter2);
  return prefix + str;
}


function settingsStrToObj(settingsStr) {
  const getId = id => {
    if (!(id in shortIdToId)) throw new Error('Invalid ID: ' + id);
    return shortIdToId[id];
  }
  const getVal = val => {
    if (val === 't' || val === 'f') return val === 't';

    // Schedule settings
    return val.replaceAll('<d1>', delimiter1).replaceAll('<d2>', delimiter2);
  }

  if (settingsStr.substring(0, prefix.length) !== prefix) throw new Error('Invalid settings string');

  settingsStr = settingsStr.substring(prefix.length);
  const obj = settingsStr.split(delimiter2).reduce((acc, curr) => {
    const [ id, val ] = curr.split(delimiter1);
    acc[getId(id)] = getVal(val);
    return acc;
  }, {});

  return obj;
}
