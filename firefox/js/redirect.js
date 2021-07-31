browser.webRequest.onBeforeRequest.addListener(async details => {

    const { global_enable } = await browser.storage.local.get('global_enable');
    if (global_enable === false) return;

    const { redirect } = await browser.storage.local.get('redirect');
    if (redirect) return { redirectUrl: redirect };
  },
  { urls: [
      "*://youtube.com/",
      "*://www.youtube.com/",
    ] },
  ["blocking"]
);
