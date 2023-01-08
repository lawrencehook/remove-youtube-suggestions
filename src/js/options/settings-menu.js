const prefix = 'rys_settings_';
const delimiter1 = ':';
const delimiter2 = ',';

const SETTINGS_MENU = document.getElementById('settings-menu');
const SETTINGS_BUTTON = document.getElementById('header-settings');
const settingsListener = e => {
  SETTINGS_MENU.classList.remove('hidden');
  SETTINGS_BUTTON.removeEventListener('click', settingsListener);

  const hideSettingsMenu1 = e => {
    document.removeEventListener('mousedown', hideSettingsMenu1);

    const hideSettingsMenu2 = e => {
      document.removeEventListener('mousedown', hideSettingsMenu1);
      document.removeEventListener('mouseup', hideSettingsMenu2);
      setTimeout(() => {
        SETTINGS_MENU.classList.add('hidden')
        SETTINGS_BUTTON.addEventListener('click', settingsListener);
      }, 50);
    }
    document.addEventListener('mouseup', hideSettingsMenu2);
  };
  document.addEventListener('mousedown', hideSettingsMenu1);
}
SETTINGS_BUTTON.addEventListener('click', settingsListener);

// Global toggle
const SETTINGS_ENABLE = document.getElementById('settings-enable');
SETTINGS_ENABLE.addEventListener('click', e => updateSetting('global_enable', true));
const SETTINGS_DISABLE = document.getElementById('settings-disable');
SETTINGS_DISABLE.addEventListener('click', e => updateSetting('global_enable', false));

// Logging toggle
const LOG_ENABLE = document.getElementById('log-enable');
LOG_ENABLE.addEventListener('click', e => updateSetting('log_enabled', true));
const LOG_DISABLE = document.getElementById('log-disable');
LOG_DISABLE.addEventListener('click', e => updateSetting('log_enabled', false));


// Import settings
const IMPORT_SETTINGS = document.getElementById('import-settings');
IMPORT_SETTINGS.addEventListener('click', e => {
  openImportModal();
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

function updateSettings(settings) {
  Object.entries(settings).forEach(([ id, value ]) => {
    HTML.setAttribute(id, value);

    const svg = document.querySelector(`div#${id} svg`);
    svg?.toggleAttribute('active', value);
  });

  try {
    // Update running tabs.
    browser.tabs.query({ url: '*://*.youtube.com/*' }, tabs => {
      tabs.forEach(tab => {
        browser.tabs.sendMessage(tab.id, { settings });
      });
    });
  } catch (error) {
    console.log(error);
  }
}

function openImportModal() {
  importModalContainer.removeAttribute('hidden');
}
function closeImportModal() {
  importModalContainer.setAttribute('hidden', '');
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
  const getVal = val => val === true ? 't' : 'f';

  const str = Object.entries(settings).map(([id, val]) => `${getId(id)}${delimiter1}${getVal(val)}`).join(delimiter2);
  return prefix + str;
}

function settingsStrToObj(settingsStr) {
  const getId = id => {
    if (!(id in shortIdToId)) throw new Error('Invalid ID: ' + id);
    return shortIdToId[id];
  }
  const getVal = val => val === 't';

  if (settingsStr.substring(0, prefix.length) !== prefix) throw new Error('Invalid settings string');

  settingsStr = settingsStr.substring(prefix.length);
  const obj = settingsStr.split(delimiter2).reduce((acc, curr) => {
    const [ id, val ] = curr.split(delimiter1);
    acc[getId(id)] = getVal(val);
    return acc;
  }, {});

  return obj;
}
