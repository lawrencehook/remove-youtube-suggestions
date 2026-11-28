const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadSourceFiles, resetStorage, setStorageData, getStorageData } = require('../setup');

function createMockJWT(payload, expiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode(header)}.${encode({ ...payload, iat: now, exp: now + expiresInSeconds })}.sig`;
}

function loadBackground({ existingAlarm = null, fetchImpl } = {}) {
  const alarms = new Map();
  if (existingAlarm) alarms.set(existingAlarm.name, existingAlarm);

  const createdAlarms = [];
  const alarmListeners = [];
  const startupListeners = [];
  const installedListeners = [];
  const fetchCalls = [];

  const browserMock = {
    storage: {
      local: {
        get: async keys => {
          const data = getStorageData();
          if (typeof keys === 'string') return { [keys]: data[keys] };
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach(k => { if (k in data) out[k] = data[k]; });
            return out;
          }
          return data;
        },
        set: async items => {
          setStorageData({ ...getStorageData(), ...items });
        },
        remove: async keys => {
          const data = getStorageData();
          (Array.isArray(keys) ? keys : [keys]).forEach(k => delete data[k]);
          setStorageData(data);
        },
      },
      onChanged: {
        addListener: () => {},
      },
    },
    alarms: {
      get: async name => alarms.get(name),
      create: (name, info) => {
        const record = { name, ...info };
        alarms.set(name, record);
        createdAlarms.push(record);
      },
      onAlarm: {
        addListener: fn => alarmListeners.push(fn),
      },
    },
    runtime: {
      OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
      setUninstallURL: () => {},
      onStartup: {
        addListener: fn => startupListeners.push(fn),
      },
      onInstalled: {
        addListener: fn => installedListeners.push(fn),
      },
    },
    management: {
      getSelf: async () => ({ installType: 'normal' }),
    },
    tabs: {
      create: () => {},
    },
    action: {
      setIcon: () => {},
    },
  };

  const ctx = loadSourceFiles(
    ['shared/config.js', 'shared/auth.js', 'shared/license.js', 'background/events.js'],
    {
      browser: browserMock,
      chrome: browserMock,
      fetch: async (url, options) => {
        fetchCalls.push({ url, options });
        if (fetchImpl) return fetchImpl(url, options);
        return { ok: true, status: 200, json: async () => ({}) };
      },
    }
  );

  return {
    ctx,
    alarms,
    createdAlarms,
    alarmListeners,
    startupListeners,
    installedListeners,
    fetchCalls,
  };
}

describe('Background license renewal', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('creates the periodic alarm when absent and retains it without rescheduling when present', async () => {
    const fresh = loadBackground();
    await new Promise(r => setImmediate(r));
    assert.strictEqual(fresh.createdAlarms.length, 1);
    assert.strictEqual(fresh.createdAlarms[0].name, 'rys_license_refresh');
    assert.ok(fresh.createdAlarms[0].periodInMinutes > 0);

    const existing = loadBackground({
      existingAlarm: { name: 'rys_license_refresh', scheduledTime: Date.now() + 60_000 },
    });
    await new Promise(r => setImmediate(r));
    assert.strictEqual(existing.createdAlarms.length, 0);
  });

  it('ignores unrelated alarms', async () => {
    const expiring = createMockJWT({ email: 'u@example.com', premium: true }, 3600);
    setStorageData({ session_token: 'sess', license_token: expiring });

    const bg = loadBackground();
    bg.alarmListeners.forEach(fn => fn({ name: 'some_other_alarm' }));
    await new Promise(r => setImmediate(r));

    assert.strictEqual(bg.fetchCalls.length, 0);
  });

  it('skips the network when signed out or when cached license is not near expiry', async () => {
    const bg1 = loadBackground();
    await bg1.ctx.refreshLicenseInBackground();
    assert.strictEqual(bg1.fetchCalls.length, 0);

    const freshToken = createMockJWT({ email: 'u@example.com', premium: true }, 10 * 24 * 3600);
    setStorageData({ session_token: 'sess', license_token: freshToken });
    const bg2 = loadBackground();
    await bg2.ctx.refreshLicenseInBackground();
    assert.strictEqual(bg2.fetchCalls.length, 0);
  });

  it('renews an expiring or expired (wake-from-sleep) license without touching stored preferences', async () => {
    const expiredToken = createMockJWT({ email: 'u@example.com', premium: true }, -3600);
    const renewedToken = createMockJWT({ email: 'u@example.com', premium: true }, 14 * 24 * 3600);
    setStorageData({
      session_token: 'sess',
      license_token: expiredToken,
      user_email: 'u@example.com',
      remove_video_thumbnails: true,
      grayscale_mode: true,
      remove_chat: true,
    });

    const bg = loadBackground({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ license_token: renewedToken }),
      }),
    });

    bg.alarmListeners.forEach(fn => fn({ name: 'rys_license_refresh' }));
    await bg.ctx.refreshLicenseInBackground();

    assert.strictEqual(bg.fetchCalls.length, 1);
    const stored = getStorageData();
    assert.strictEqual(stored.license_token, renewedToken);
    assert.strictEqual(stored.remove_video_thumbnails, true);
    assert.strictEqual(stored.grayscale_mode, true);
    assert.strictEqual(stored.remove_chat, true);
  });

  it('deduplicates overlapping startup and alarm refreshes into a single network request', async () => {
    const expiring = createMockJWT({ email: 'u@example.com', premium: true }, 3600);
    const renewed = createMockJWT({ email: 'u@example.com', premium: true }, 14 * 24 * 3600);
    setStorageData({ session_token: 'sess', license_token: expiring });

    let resolveFetch;
    const bg = loadBackground({
      fetchImpl: () => new Promise(resolve => {
        resolveFetch = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ license_token: renewed }),
        });
      }),
    });

    bg.startupListeners.forEach(fn => fn());
    bg.alarmListeners.forEach(fn => fn({ name: 'rys_license_refresh' }));
    const p3 = bg.ctx.refreshLicenseInBackground();
    await new Promise(r => setImmediate(r));

    assert.strictEqual(bg.fetchCalls.length, 1);
    resolveFetch();
    await p3;
    assert.strictEqual(getStorageData().license_token, renewed);
  });

  it('leaves auth tokens and preferences unchanged on transient network or 500 errors', async () => {
    const expired = createMockJWT({ email: 'u@example.com', premium: true }, -3600);
    const seed = {
      session_token: 'sess',
      license_token: expired,
      user_email: 'u@example.com',
      remove_video_thumbnails: true,
      blur_video_thumbnails: true,
      remove_chat: true,
    };

    for (const fetchImpl of [
      async () => { throw new Error('offline'); },
      async () => ({ ok: false, status: 500 }),
    ]) {
      setStorageData(seed);
      const bg = loadBackground({ fetchImpl });
      await bg.ctx.refreshLicenseInBackground();
      assert.deepStrictEqual(getStorageData(), seed);
    }
  });

  it('removes only auth keys on 401 while preserving all preference keys', async () => {
    const expired = createMockJWT({ email: 'u@example.com', premium: true }, -3600);
    setStorageData({
      session_token: 'expired-sess',
      license_token: expired,
      user_email: 'u@example.com',
      remove_video_thumbnails: true,
      blur_video_thumbnails: true,
      remove_chat: true,
    });

    const bg = loadBackground({
      fetchImpl: async () => ({ ok: false, status: 401 }),
    });
    await bg.ctx.refreshLicenseInBackground();

    const stored = getStorageData();
    assert.strictEqual('session_token' in stored, false);
    assert.strictEqual('license_token' in stored, false);
    assert.strictEqual('user_email' in stored, false);
    assert.strictEqual(stored.remove_video_thumbnails, true);
    assert.strictEqual(stored.blur_video_thumbnails, true);
    assert.strictEqual(stored.remove_chat, true);
  });
});
