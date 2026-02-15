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
SCHEDULING_OPTION.addEventListener('click', async e => {
  if (HTML.getAttribute('is_premium') !== 'true') {
    await handlePremiumFeatureClick();
    return;
  }
  openScheduleModal();
});
OPEN_SCHEDULE_OPTION.addEventListener('click', async e => {
  if (HTML.getAttribute('is_premium') !== 'true') {
    await handlePremiumFeatureClick();
    return;
  }
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
PASSWORD_OPTION.addEventListener('click', async e => {
  if (HTML.getAttribute('is_premium') !== 'true') {
    await handlePremiumFeatureClick();
    return;
  }
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
    updateSetting(id, value, { write: false });
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


/***************
 * Account/Premium
 ***************/
const ACCOUNT_OPTION = qs('#settings-account');
const DONATE_LINK = qs('#settings-donate');
const DONATE_URL = 'https://www.paypal.com/donate/?cmd=_donations&business=FF9K9YD6K6SWG&Z3JncnB0=';
const HEADER_PREMIUM_BADGE = qs('#header-premium-badge');

// Sign-in modal elements
const signinModalContainer = qs('#signin_container_background');
const signinEmailForm = qs('#signin_email_form');
const signinEmailInput = qs('#signin-email-input');
const signinSendButton = qs('#signin-send-button');
const signinWaiting = qs('#signin_waiting');
const signinWaitingEmail = qs('#signin-waiting-email');
const signinStatus = qs('#signin-status');
const signinCancelButton = qs('#signin-cancel-button');
const signinError = qs('#signin_error');
const signinErrorMessage = qs('#signin-error-message');
const signinRetryButton = qs('#signin-retry-button');

// Account modal elements
const accountModalContainer = qs('#account_container_background');
const accountEmail = qs('#account-email');
const accountPremiumLabel = qs('#account-premium-label');
const accountUpgradeButton = qs('#account-upgrade-button');
const accountBillingButton = qs('#account-billing-button');
const accountSignoutButton = qs('#account-signout-button');

// Upgrade modal elements
const upgradeModalContainer = qs('#upgrade_container_background');
const upgradePlans = qsa('.upgrade-plan');
const upgradeCheckoutButton = qs('#upgrade-checkout-button');
const upgradeCancelButton = qs('#upgrade-cancel-button');

// Premium required modal elements
const premiumRequiredModalContainer = qs('#premium_required_container_background');
const premiumRequiredSigninButton = qs('#premium-required-signin-button');
const premiumRequiredCancelButton = qs('#premium-required-cancel-button');

let currentPollAbortController = null;
let selectedPlan = 'monthly'; // Default to monthly
let awaitingUpgrade = false;
let upgradePollInterval = null;

async function refreshLicense(force = false) {
  const signedIn = await Auth.isSignedIn();
  if (!signedIn) return;

  const licenseData = await License.checkLicense(force);
  updatePremiumUI(licenseData);
  if (licenseData.isPremium && awaitingUpgrade) {
    recordEvent('Checkout Completed', { source: licenseData.source });
    awaitingUpgrade = false;
    stopUpgradePolling();
    displayStatus('Welcome to Premium!');
  }
}

function startUpgradePolling() {
  stopUpgradePolling();
  upgradePollInterval = setInterval(() => refreshLicense(true), PREMIUM_CONFIG.POLL_INTERVAL_MS);
  // Stop polling after timeout
  setTimeout(stopUpgradePolling, PREMIUM_CONFIG.POLL_TIMEOUT_MS);
}

function stopUpgradePolling() {
  if (upgradePollInterval) {
    clearInterval(upgradePollInterval);
    upgradePollInterval = null;
  }
}

function handleVisibilityRefresh() {
  if (!awaitingUpgrade || document.hidden) return;
  refreshLicense(true);
}

document.addEventListener('visibilitychange', handleVisibilityRefresh);
window.addEventListener('focus', handleVisibilityRefresh);

// Initialize account state on load
async function initAccountState() {
  const signedIn = await Auth.isSignedIn();
  if (signedIn) {
    ACCOUNT_OPTION.textContent = 'Account';
    // Check license in background
    refreshLicense(true);
  } else {
    ACCOUNT_OPTION.textContent = 'Sign In';
    // Auto-open sign-in modal if ?signin=1 param is present
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') === '1') {
      openSigninModal();
    }
  }
}
initAccountState();

function updatePremiumUI(licenseData) {
  if (licenseData && licenseData.signedOut) {
    ACCOUNT_OPTION.textContent = 'Sign In';
    HTML.setAttribute('is_premium', 'false');
    if (DONATE_LINK) {
      DONATE_LINK.textContent = 'Donate';
      DONATE_LINK.setAttribute('href', DONATE_URL);
      DONATE_LINK.style.cursor = '';
    }
    if (HEADER_PREMIUM_BADGE) HEADER_PREMIUM_BADGE.setAttribute('hidden', '');
    return;
  }

  if (licenseData && licenseData.isPremium) {
    HTML.setAttribute('is_premium', 'true');
    if (DONATE_LINK) {
      DONATE_LINK.textContent = 'Premium';
      DONATE_LINK.removeAttribute('href');
      DONATE_LINK.style.cursor = 'default';
    }
    if (HEADER_PREMIUM_BADGE) HEADER_PREMIUM_BADGE.removeAttribute('hidden');
  } else {
    HTML.setAttribute('is_premium', 'false');
    if (DONATE_LINK) {
      DONATE_LINK.textContent = 'Donate';
      DONATE_LINK.setAttribute('href', DONATE_URL);
      DONATE_LINK.style.cursor = '';
    }
    if (HEADER_PREMIUM_BADGE) HEADER_PREMIUM_BADGE.setAttribute('hidden', '');
  }
}

// Account option click handler
ACCOUNT_OPTION.addEventListener('click', async () => {
  const signedIn = await Auth.isSignedIn();
  if (signedIn) {
    openAccountModal();
  } else {
    // Always open in new tab for sign-in
    // (prevents popup closing and killing the polling loop)
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') === '1') {
      // Already in the sign-in tab, just open modal
      openSigninModal();
    } else {
      browser.tabs.create({ url: browser.runtime.getURL('/options/main.html?signin=1') });
      window.close();
    }
  }
});

// Sign-in modal
function openSigninModal() {
  signinModalContainer.removeAttribute('hidden');
  signinEmailForm.removeAttribute('hidden');
  signinWaiting.setAttribute('hidden', '');
  signinError.setAttribute('hidden', '');
  signinEmailInput.value = '';
  signinEmailInput.focus();
}

function closeSigninModal() {
  signinModalContainer.setAttribute('hidden', '');
  if (currentPollAbortController) {
    currentPollAbortController.abort();
    currentPollAbortController = null;
  }
}

signinModalContainer.addEventListener('click', e => {
  if (e.target === signinModalContainer) closeSigninModal();
});

signinEmailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    signinSendButton.click();
  }
});

signinSendButton.addEventListener('click', async () => {
  const email = signinEmailInput.value.trim();
  if (!email || !email.includes('@')) {
    displayStatus('Please enter a valid email');
    return;
  }

  signinSendButton.disabled = true;
  recordEvent('Sign In Started');
  try {
    const requestId = await Auth.sendMagicLink(email);
    recordEvent('Magic Link Sent');

    // Show waiting state
    signinEmailForm.setAttribute('hidden', '');
    signinWaiting.removeAttribute('hidden');
    signinWaitingEmail.textContent = email;

    // Start polling
    currentPollAbortController = new AbortController();
    const result = await Auth.pollForVerification(requestId, ({ elapsed }) => {
      const totalSeconds = Math.floor(PREMIUM_CONFIG.POLL_TIMEOUT_MS / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      signinStatus.textContent = `Waiting for verification... ${mins}:${secs.toString().padStart(2, '0')}`;
    }, { signal: currentPollAbortController.signal });

    if (result && result.canceled) {
      recordEvent('Sign In Canceled');
      return;
    }

    // Success
    displayStatus('Signed in successfully');
    closeSigninModal();
    ACCOUNT_OPTION.textContent = 'Account';

    // Check license
    const licenseData = await License.checkLicense(true);
    updatePremiumUI(licenseData);

    recordEvent('Sign In Success');
  } catch (err) {
    signinWaiting.setAttribute('hidden', '');
    signinError.removeAttribute('hidden');
    signinErrorMessage.textContent = err.message;
    recordEvent('Sign In Error', { error: err.message });
  } finally {
    signinSendButton.disabled = false;
  }
});

signinCancelButton.addEventListener('click', closeSigninModal);

signinRetryButton.addEventListener('click', () => {
  signinError.setAttribute('hidden', '');
  signinEmailForm.removeAttribute('hidden');
  signinEmailInput.focus();
});

// Account modal
async function openAccountModal() {
  const email = await Auth.getUserEmail();
  const licenseData = await License.checkLicense(true);
  if (licenseData.signedOut) {
    recordEvent('Session Expired');
    updatePremiumUI(licenseData);
    closeAccountModal();
    openSigninModal();
    displayStatus('Session expired. Please sign in again.');
    return;
  }
  recordEvent('Account Modal Opened', { isPremium: licenseData.isPremium, source: licenseData.source });

  accountEmail.textContent = email || 'Unknown';

  if (licenseData.isPremium) {
    if (licenseData.source === 'grandfathered') {
      accountPremiumLabel.textContent = 'Lifetime';
      accountPremiumLabel.setAttribute('data-status', 'grandfathered');
      accountBillingButton.setAttribute('hidden', '');
    } else {
      accountPremiumLabel.textContent = 'Premium';
      accountPremiumLabel.setAttribute('data-status', 'premium');
      accountBillingButton.removeAttribute('hidden');
    }
    accountUpgradeButton.setAttribute('hidden', '');
  } else {
    accountPremiumLabel.textContent = 'Free';
    accountPremiumLabel.setAttribute('data-status', 'free');
    accountUpgradeButton.removeAttribute('hidden');
    accountBillingButton.setAttribute('hidden', '');
  }

  accountModalContainer.removeAttribute('hidden');
}

function closeAccountModal() {
  accountModalContainer.setAttribute('hidden', '');
}

accountModalContainer.addEventListener('click', e => {
  if (e.target === accountModalContainer) closeAccountModal();
});

accountSignoutButton.addEventListener('click', async () => {
  await Auth.signOut();
  ACCOUNT_OPTION.textContent = 'Sign In';
  HTML.setAttribute('is_premium', 'false');
  // Disable all premium options
  SECTIONS.forEach(section => {
    section.options.forEach(option => {
      if (option.premium) updateSetting(option.id, false);
    });
  });
  if (DONATE_LINK) {
    DONATE_LINK.textContent = 'Donate';
    DONATE_LINK.setAttribute('href', DONATE_URL);
    DONATE_LINK.style.cursor = '';
  }
  if (HEADER_PREMIUM_BADGE) HEADER_PREMIUM_BADGE.setAttribute('hidden', '');
  closeAccountModal();
  displayStatus('Signed out');
  recordEvent('Sign Out');
});

accountUpgradeButton.addEventListener('click', () => {
  closeAccountModal();
  openUpgradeModal();
});

accountBillingButton.addEventListener('click', async () => {
  try {
    accountBillingButton.disabled = true;
    const portalUrl = await License.createBillingPortalSession();
    window.open(portalUrl, '_blank');
    closeAccountModal();
    recordEvent('Billing Portal Opened');
  } catch (err) {
    displayStatus(err.message);
    recordEvent('Billing Portal Error', { error: err.message });
  } finally {
    accountBillingButton.disabled = false;
  }
});

// Upgrade modal
function openUpgradeModal() {
  recordEvent('Upgrade Modal Opened');
  upgradeModalContainer.removeAttribute('hidden');
  selectPlan('monthly');
}

// Premium feature click handler - checks sign-in first
async function handlePremiumFeatureClick() {
  const signedIn = await Auth.isSignedIn();
  if (!signedIn) {
    // Not signed in - show premium required modal
    recordEvent('Premium Feature Click', { signedIn: false });
    openPremiumRequiredModal();
    return;
  }
  // Signed in but not premium - open upgrade modal
  recordEvent('Premium Feature Click', { signedIn: true });
  openUpgradeModal();
}

// Premium required modal (for non-signed-in users)
function openPremiumRequiredModal() {
  premiumRequiredModalContainer.removeAttribute('hidden');
}

function closePremiumRequiredModal() {
  premiumRequiredModalContainer.setAttribute('hidden', '');
}

premiumRequiredModalContainer.addEventListener('click', e => {
  if (e.target === premiumRequiredModalContainer) closePremiumRequiredModal();
});

premiumRequiredCancelButton.addEventListener('click', closePremiumRequiredModal);

premiumRequiredSigninButton.addEventListener('click', () => {
  closePremiumRequiredModal();
  const params = new URLSearchParams(window.location.search);
  if (params.get('signin') === '1') {
    openSigninModal();
  } else {
    browser.tabs.create({ url: browser.runtime.getURL('/options/main.html?signin=1') });
    window.close();
  }
});

function closeUpgradeModal() {
  upgradeModalContainer.setAttribute('hidden', '');
}

function selectPlan(plan) {
  selectedPlan = plan;
  upgradePlans.forEach(el => {
    el.toggleAttribute('selected', el.dataset.plan === plan);
  });
}

upgradeModalContainer.addEventListener('click', e => {
  if (e.target === upgradeModalContainer) closeUpgradeModal();
});

upgradePlans.forEach(el => {
  el.addEventListener('click', () => selectPlan(el.dataset.plan));
});

upgradeCancelButton.addEventListener('click', closeUpgradeModal);

upgradeCheckoutButton.addEventListener('click', async () => {
  try {
    upgradeCheckoutButton.disabled = true;
    const checkoutUrl = await License.createCheckoutSession(selectedPlan);
    window.open(checkoutUrl, '_blank');
    closeUpgradeModal();
    recordEvent('Checkout Started', { plan: selectedPlan });
    awaitingUpgrade = true;
    startUpgradePolling();
  } catch (err) {
    displayStatus(err.message);
    recordEvent('Checkout Error', { plan: selectedPlan, error: err.message });
  } finally {
    upgradeCheckoutButton.disabled = false;
  }
});
