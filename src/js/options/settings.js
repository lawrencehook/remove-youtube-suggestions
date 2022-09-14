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
