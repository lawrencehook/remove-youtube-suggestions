browser.webRequest.onBeforeRequest.addListener(async details => {
    const setting = await browser.storage.local.get('redirect');
    const redirectUrl = setting['redirect'];
    if (redirectUrl) return { redirectUrl };
  },
  { urls: [
      "*://youtube.com/",
      "*://www.youtube.com/",
    ] },
  ["blocking"]
);
