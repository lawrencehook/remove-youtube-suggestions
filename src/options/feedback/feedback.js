recordEvent('Page View: Feedback');

const HTML = document.documentElement;
browser.storage.local.get('dark_mode', ({ dark_mode }) => {
	HTML.setAttribute('dark_mode', dark_mode)
});

const extensionVersion = document.getElementById('extension-version');
extensionVersion.innerText = browser.runtime.getManifest().version;

const browserVersion = document.getElementById('browser-version');
const path = browser.runtime.getURL('/');
const isFirefox = path.startsWith('moz');
const isChrome = path.startsWith('chrome');
browserVersion.innerText = isFirefox ? 'firefox' : 'chrome';
