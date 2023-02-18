
const HTML = document.documentElement;
browser.storage.local.get('dark_mode', ({ dark_mode }) => {
	HTML.setAttribute('dark_mode', dark_mode)
});
