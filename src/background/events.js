
if (typeof browser === 'undefined') {
  globalThis.browser = typeof chrome !== 'undefined' ? chrome : null;
}

// Chrome MV3 runs this file as a service worker without manifest script arrays;
// Firefox MV2 loads these dependencies via manifest.json background.scripts.
if (typeof License === 'undefined' && typeof importScripts === 'function') {
  importScripts('/shared/config.js', '/shared/auth.js', '/shared/license.js');
}

const LICENSE_REFRESH_ALARM = 'rys_license_refresh';
const LICENSE_REFRESH_PERIOD_MINUTES = 240; // every 4 hours (inside 24h refresh threshold)

let inflightLicenseRefresh = null;

function refreshLicenseInBackground() {
  if (inflightLicenseRefresh) return inflightLicenseRefresh;
  inflightLicenseRefresh = (async () => {
    try {
      if (typeof License === 'undefined') return null;
      // Non-forced check: skips the network when signed out or when the
      // cached license token is valid outside the 24h refresh threshold.
      return await License.checkLicense(false);
    } catch (err) {
      console.error('Background license refresh error:', err);
      return null;
    } finally {
      inflightLicenseRefresh = null;
    }
  })();
  return inflightLicenseRefresh;
}

async function ensureLicenseRefreshAlarm() {
  if (!browser?.alarms) return;
  try {
    const existing = await browser.alarms.get(LICENSE_REFRESH_ALARM);
    if (!existing) {
      browser.alarms.create(LICENSE_REFRESH_ALARM, {
        periodInMinutes: LICENSE_REFRESH_PERIOD_MINUTES,
      });
    }
  } catch (err) {
    console.error('Failed to ensure license refresh alarm:', err);
  }
}

browser.alarms?.onAlarm.addListener(alarm => {
  if (alarm?.name === LICENSE_REFRESH_ALARM) {
    refreshLicenseInBackground();
  }
});

browser.runtime.onStartup?.addListener(() => {
  ensureLicenseRefreshAlarm();
  refreshLicenseInBackground();
});

const uninstallUrl = encodeURI("https://lawrencehook.com/rys/👋");
browser.runtime.setUninstallURL(uninstallUrl);

browser.runtime.onInstalled.addListener(async object => {
  ensureLicenseRefreshAlarm();
  const url = "https://lawrencehook.com/rys/welcome";
  if (object.reason !== browser.runtime.OnInstalledReason.INSTALL) return;
  // management.getSelf() returns a Promise in both Chrome MV3 and Firefox
  // (Firefox ignores callbacks), so use await for cross-browser consistency.
  const info = await browser.management.getSelf();
  if (info && info.installType === 'development') return; // skip on unpacked/dev loads
  browser.tabs.create({ url });
});

ensureLicenseRefreshAlarm();

// Change the browserAction icon if the extension is disabled
const inactiveIcons = { path: {
  16: "/images/16_dark.png",
  32: "/images/32_dark.png",
  64: "/images/64_dark.png",
  128: "/images/128_dark.png",
}};
const activeIcons = { path: {
  16: "/images/16.png",
  32: "/images/32.png",
  64: "/images/64.png",
  128: "/images/128.png",
}};
browser.storage.onChanged.addListener((changes, area) => {
  const changedItems = Object.keys(changes);
  for (const item of changedItems) {

    if (item === 'global_enable') {
      let icons;
      if (changes[item].newValue === false) icons = inactiveIcons;
      if (changes[item].newValue === true)  icons = activeIcons;

      browser.browserAction?.setIcon(icons);
      browser.action?.setIcon(icons);
    }

  }
});
