const subscriptionsUrl = 'https://www.youtube.com/feed/subscriptions';

browser.webRequest.onBeforeRequest.addListener(async details => {
    const setting = await browser.storage.local.get('redirect_home_to_subs');
    if (('redirect_home_to_subs' in setting) && setting['redirect_home_to_subs']) {
      return { redirectUrl: subscriptionsUrl };
    }
  },
  { urls: [ "*://*.youtube.com/" ] },
  ["blocking"]
);
