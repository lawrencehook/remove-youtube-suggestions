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


const SETTINGS_ENABLE = document.getElementById('settings-enable');
SETTINGS_ENABLE.addEventListener('click', e => updateSetting('global_enable', true));
const SETTINGS_DISABLE = document.getElementById('settings-disable');
SETTINGS_DISABLE.addEventListener('click', e => updateSetting('global_enable', false));

const SETTINGS_PA_ENABLE = document.getElementById('settings-page-action-enable');
SETTINGS_PA_ENABLE.addEventListener('click', e => updateSetting('page_action', true));
const SETTINGS_PA_DISABLE = document.getElementById('settings-page-action-disable');
SETTINGS_PA_DISABLE.addEventListener('click', e => updateSetting('page_action', false));
