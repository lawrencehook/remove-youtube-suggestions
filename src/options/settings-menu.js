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
const POWER_ICON = qs('#power-icon');
const POWER_OPTIONS_MENU = qs('#power-options');
const POWER_OPTIONS = qsa('#power-options > div');
hydrateDropdown(POWER_ICON, POWER_OPTIONS_MENU);
POWER_OPTIONS.forEach(o => {
  const minutes = o.getAttribute('minutes');
  if (!minutes) return;

  o.addEventListener('click', e => {
    const enabled = HTML.getAttribute('global_enable') === 'true';
    const nextTimedChange = Date.now() + 60_000 * Number(minutes);

    recordEvent('Timed Change', { enabled, minutes });

    updateSetting('global_enable', !enabled);
    updateSetting('nextTimedChange', nextTimedChange);
    updateSetting('nextTimedValue', enabled);
  });
});


/**************
 * Scheduling *
 **************/
const scheduleModalContainer  = qs('#schedule_container_background');
const SCHEDULING_OPTION       = qs('#settings-schedule');
const OPEN_SCHEDULE_OPTION    = qs('#open-schedule');
const RESUME_SCHEDULE_OPTION  = qs('#resume-schedule');
const scheduleToggleContainer = qs('#enable-schedule');
const scheduleToggle          = qs('svg', scheduleToggleContainer);
const SCHEDULE_TIMES          = qs('#schedule-times');
const SCHEDULE_DAYS           = qs('#schedule-days');
const SCHEDULE_DAYS_OPTIONS   = qsa('div', SCHEDULE_DAYS);
const TIME_PRESETS            = qsa('#times-container .predefined-options a');
const DAY_PRESETS             = qsa('#days-container .predefined-options a');

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
OPEN_SCHEDULE_OPTION.addEventListener('click', e => {
  openScheduleModal();
});
RESUME_SCHEDULE_OPTION.addEventListener('click', e => {
  const scheduleIsActive = checkSchedule(cache['scheduleTimes'], cache['scheduleDays']);

  recordEvent('Resume schedule', { scheduleIsActive });

  updateSetting('global_enable', scheduleIsActive);
  updateSetting('nextTimedChange', false);
});

// Schedule on/off
scheduleToggleContainer.addEventListener('click', e => {
  const enabled = scheduleToggle.toggleAttribute('active');
  updateSetting('schedule', enabled, { manual: true });
});

// Schedule times
SCHEDULE_TIMES.addEventListener('input', e => {
  const times = SCHEDULE_TIMES.value;
  const isValid = timeIsValid(times);

  SCHEDULE_TIMES.toggleAttribute('invalid', !isValid);
  if (!isValid) return;

  updateSetting('scheduleTimes', times, { manual: true });
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

    const newDaysStr = newDays.filter(d => d !== '').join(',');
    updateSetting('scheduleDays', newDaysStr, { manual: true });
  });
});

// Schedule preset options
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


/************
 * Password *
 ************/
const passwordModalContainer     = qs('#password_container_background');
const ENABLE_PASSWORD_CONTAINER  = qs('#enable_password_container');
const PASSWORD_OPTION            = qs('#settings-password');
const PASSWORD_INPUT1            = qs('#password-input-1');
const PASSWORD_INPUT2            = qs('#password-input-2');
const PASSWORD_BUTTON            = qs('#password-button button');
const UNLOCK_PASSWORD_INPUT      = qs('#unlock-password-input');
const UNLOCK_PASSWORD_BUTTON     = qs('#unlock-password-button');
const DISABLE_PASSWORD_CONTAINER = qs('#disable_password_container');
const DISABLE_PASSWORD_INPUT     = qs('#disable-password-input');
const DISABLE_PASSWORD_BUTTON    = qs('#disable-password-button');

function closePasswordModal() {
  passwordModalContainer.toggleAttribute('hidden', true);
}
passwordModalContainer.addEventListener('click', e => {
  if (e.target !== passwordModalContainer) return;
  closePasswordModal();
});

function openPasswordModal() {
  passwordModalContainer.toggleAttribute('hidden', false);

  PASSWORD_INPUT1.value = '';
  PASSWORD_INPUT2.value = '';

  // Get local data.
  browser.storage.local.get(PASSWORD_SETTINGS, settings => {
    const { password, hashed_password } = settings;
    ENABLE_PASSWORD_CONTAINER.toggleAttribute('hidden', password);
    DISABLE_PASSWORD_CONTAINER.toggleAttribute('hidden', !password);
  });
}
PASSWORD_OPTION.addEventListener('click', e => {
  openPasswordModal();
});

function lockWithPassword() {
  HTML.removeAttribute('passwordEntered');
}
function unlockWithPassword() {
  HTML.setAttribute('passwordEntered', 'true');
}

PASSWORD_INPUT2.addEventListener('input', e => {
  const password = PASSWORD_INPUT1.value;
  const reentry = PASSWORD_INPUT2.value;
  const matching = password !== '' && password === reentry;
  PASSWORD_BUTTON.toggleAttribute('disabled', !matching);
});

PASSWORD_BUTTON.addEventListener('click', e => {
  const password = PASSWORD_INPUT1.value;
  const reentry = PASSWORD_INPUT2.value;
  const matching = password !== '' && password === reentry;
  if (!matching) return;

  // Set password.
  const hashed = md5(password);
  updateSetting('password', true, { manual: true });
  updateSetting('hashed_password', hashed, { manual: true });
  lockWithPassword();
  closePasswordModal();
});

UNLOCK_PASSWORD_BUTTON.addEventListener('click', e => {
  const hashedInput = md5(UNLOCK_PASSWORD_INPUT.value);
  const hashedPassword = HTML.getAttribute('hashed_password');
  const matching = hashedInput === hashedPassword;

  if (!matching) {
    displayStatus('Wrong password');
  } else {
    displayStatus('Unlocked');
    unlockWithPassword();
  }
});

DISABLE_PASSWORD_BUTTON.addEventListener('click', e => {
  const password = DISABLE_PASSWORD_INPUT.value;
  const hashedInput = md5(password);
  const hashedPassword = HTML.getAttribute('hashed_password');
  const matching = hashedInput === hashedPassword;

  if (!matching) {
    displayStatus('Wrong password');
    return;
  }

  // Disable password settings.
  updateSetting('password', false, { manual: true });
  updateSetting('hashed_password', '', { manual: true });
  closePasswordModal();
  displayStatus('Password disabled');
});


// Logging toggle
const LOG_ENABLE = document.getElementById('log-enable');
LOG_ENABLE.addEventListener('click', e => {
  updateSetting('log_enabled', true, { manual: true });
});
const LOG_DISABLE = document.getElementById('log-disable');
LOG_DISABLE.addEventListener('click', e => {
  updateSetting('log_enabled', false, { manual: true });
});


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
