const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const { buildSync } = require('esbuild');

const filename = path.resolve(__dirname, '../src/Main/Manager/ExternalBrowserManager.ts');
const loaded = new Module(filename, module);
loaded.paths = module.paths;
const logged = [];
loaded.require = (id) => {
  if (id === '__test_console__') return Object.fromEntries(['info', 'warn', 'debug'].map((level) => [level, (...args) => logged.push([level, ...args])]));
  if (id === 'patchright') return { chromium: {} };
  if (id === '../Functional/UserDataPaths') return { getKawaiDataPath: () => { throw new Error('User state must never be accessed in this test.'); } };
  return Module.prototype.require.call(loaded, id);
};
loaded._compile('const console = require("__test_console__");\n' + buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['patchright', '../Functional/UserDataPaths'],
}).outputFiles[0].text, filename);
const { ExternalBrowserManager } = loaded.exports;
const required = [{ name: 'NetflixId', domain: 'netflix.com' }, { name: 'SecureNetflixId', domain: 'netflix.com' }];
const origins = ['https://netflix.com', 'https://www.netflix.com'];
const cookie = (name = 'NetflixId', extra = {}) => ({ name, value: `fake-${name}-value`, domain: '.netflix.com',
  path: '/', expires: -1, secure: true, httpOnly: true, sameSite: 'Lax', ...extra });
const authCookies = () => required.map(({ name }) => cookie(name));

function sessionFixture({ failedName, discardedName, duplicates = false } = {}) {
  const events = [];
  let jar = [cookie('NetflixId', { value: 'old-session' }), cookie('OtherSite', { domain: 'other.example', value: 'unrelated-session' })];
  return { events, get jar() { return jar; }, cookies: {
    async get() { return jar; },
    async set(details) {
      events.push(['set', details.name]);
      if (details.name === failedName) throw new Error('simulated write failure');
      if (details.name === discardedName) return;
      const stored = { ...details, domain: details.domain ?? new URL(details.url).hostname };
      jar = jar.filter((existing) => existing.name !== stored.name || existing.domain !== stored.domain);
      jar.push(stored);
      if (duplicates) jar.push({ ...stored, domain: stored.domain.replace(/^\./, '') });
    },
    async flushStore() { events.push('flushCookies'); },
  },
    async closeAllConnections() { events.push('closeConnections'); },
    async clearData(details) {
      events.push(['clear', details]);
      jar = details.origins ? jar.filter((existing) => existing.domain.replace(/^\./, '') !== 'netflix.com') : [];
    },
    async flushStorageData() { events.push('flushStorage'); },
  };
}

test('Netflix opts into scoped reset, cookie stabilization, required auth pair, and strict import', async () => {
  const { NetflixProvider } = require('../packages/builtin-sites/dist/Providers/Netflix/Provider.js');
  let options;
  const provider = new NetflixProvider({
    page: { register: () => ({ dispose() {} }), async refresh() {} },
    actions: { createUrl: () => 'kawaikara-test://login' },
    logger: { info() {} },
    externalBrowser: { async login(value) { options = value; return 'completed'; } },
  });
  await provider.beforeLoad();
  await provider.onAction('login');
  assert.deepEqual(options.resetSessionOrigins, origins);
  assert.deepEqual(options.requiredCookies, required);
  assert.equal(options.cookieSettleMs, 750);
  assert.equal(options.strictCookieSynchronization, true);
  assert.notEqual(options.replaceSessionCookies, true, 'never erase unrelated user-assigned shared-profile cookies');
  assert.equal(options.returnUrl, 'https://www.netflix.com/');
});

test('missing/empty/expired/wrong-domain/partitioned auth cookies leave existing Session untouched', async () => {
  for (const cookies of [[], [cookie()], [cookie(), cookie('SecureNetflixId', { value: '' })],
    [cookie(), cookie('SecureNetflixId', { expires: 1 })], [cookie(), cookie('SecureNetflixId', { domain: '.example.com' })],
    [cookie(), cookie('SecureNetflixId', { partitionKey: 'https://example.com' })]]) {
    const manager = new ExternalBrowserManager();
    const session = sessionFixture();
    await assert.rejects(manager.replaceSessionLogin(cookies, session, {}, origins, false, 'domain-scoped-https', required, true), /required authentication cookie/);
    assert.deepEqual(session.events, [], 'validate before clearData or even closing connections');
    assert.equal(session.jar[0].value, 'old-session');
  }
});

test('empty cookie jar cannot clear origins in the generic replacement flow either', async () => {
  for (const reset of [true, false]) {
    const session = sessionFixture();
    await assert.rejects(new ExternalBrowserManager().replaceSessionLogin([], session, {}, reset ? origins : [], !reset), /without cookies/);
    assert.deepEqual(session.events, []);
  }
});

test('valid import clears only Netflix origins before writes and preserves unrelated cookies', async () => {
  const manager = new ExternalBrowserManager();
  const session = sessionFixture();
  await manager.replaceSessionLogin(authCookies(), session, {}, origins, false, 'domain-scoped-https', required, true);
  assert.deepEqual(session.events.slice(0, 2), ['closeConnections', ['clear', {
    dataTypes: ['cache', 'cookies', 'indexedDB', 'localStorage', 'serviceWorkers'], origins,
    originMatchingMode: 'origin-in-all-contexts',
  }]]);
  assert.equal(session.jar.find((entry) => entry.name === 'NetflixId').value, cookie().value);
  assert.equal(session.jar.find((entry) => entry.name === 'OtherSite').value, 'unrelated-session');
  assert.deepEqual(session.events.slice(-2), ['flushStorage', 'closeConnections']);
});

test('strict import rejects failed writes, silently discarded writes, and conflicting identities', async () => {
  for (const settings of [{ failedName: 'SecureNetflixId' }, { discardedName: 'SecureNetflixId' }, { duplicates: true }]) {
    await assert.rejects(new ExternalBrowserManager().replaceSessionLogin(authCookies(), sessionFixture(settings), {}, origins, false, 'domain-scoped-https', required, true), /cookie (verification|synchronization) failed/);
  }
});

test('non-strict legacy Providers retain warning-only partial-cookie behavior', async () => {
  await new ExternalBrowserManager().syncCookies(authCookies(), sessionFixture({ failedName: 'SecureNetflixId' }), {}, 'preserve-source');
});

test('strict verification detects missing, changed, or ambiguous stored cookies', async () => {
  const manager = new ExternalBrowserManager();
  for (const jar of [[], [cookie('NetflixId', { value: 'wrong' })], [cookie(), cookie('NetflixId', { domain: 'netflix.com' })]]) {
    await assert.rejects(manager.verifyCookieSynchronization([cookie()], { cookies: { async get() { return jar; } } }, true), /verification failed/);
  }
});

test('failure diagnostics never include captured or stored credential values', async () => {
  const manager = new ExternalBrowserManager();
  const secret = 'probe-only-sensitive-cookie-value';
  await assert.rejects(manager.verifyCookieSynchronization([cookie('NetflixId', { value: secret })],
    { cookies: { async get() { return [cookie('NetflixId', { value: `${secret}-wrong` })]; } } }, true), /verification failed/);
  assert.equal(JSON.stringify(logged).includes(secret), false);
});

test('domain-scoped HTTPS conversion preserves required __Host- cookie restrictions', () => {
  const manager = new ExternalBrowserManager();
  const host = manager.toElectronCookie(cookie('__Host-Test', { domain: 'www.netflix.com' }), 'domain-scoped-https');
  assert.equal(host.url, 'https://www.netflix.com/');
  assert.equal(Object.hasOwn(host, 'domain'), false);
  assert.equal(host.secure, true);
  assert.equal(host.path, '/');
  assert.equal(manager.toElectronCookie(cookie(), 'domain-scoped-https').domain, '.netflix.com');
});

test('cookie stability capture waits after the last jar change; defaults still capture immediately', async () => {
  const manager = new ExternalBrowserManager();
  let reads = 0;
  const context = { async cookies() { reads += 1; return [cookie('NetflixId', { value: reads === 1 ? 'initial' : 'settled' })]; } };
  assert.equal((await manager.captureSettledCookies(context, 30))[0].value, 'settled');
  assert.ok(reads >= 3);
  reads = 0;
  await manager.captureSettledCookies(context, 0);
  assert.equal(reads, 1);
});

function browserFixture(t, cookies) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-login-unit-'));
  t.after(() => rmSync(profile, { recursive: true, force: true }));
  const context = new EventEmitter();
  const page = new EventEmitter();
  let url = 'about:blank';
  let closed = false;
  page.url = () => url;
  page.isClosed = () => closed;
  const mainFrame = { url: () => url, page: () => page };
  page.mainFrame = () => mainFrame;
  page.goto = async () => { url = 'https://www.netflix.com/browse'; page.emit('framenavigated', mainFrame); };
  context.pages = () => [page];
  context.cookies = async () => cookies;
  context.close = async () => { closed = true; context.emit('close'); };
  return { context, page, profile, get closed() { return closed; } };
}

test('completion URL with missing auth cookies rejects, closes the browser, and releases pending login', async (t) => {
  const manager = new ExternalBrowserManager();
  const browser = browserFixture(t, []);
  const session = sessionFixture();
  await assert.rejects(manager.waitForLogin(browser.context, browser.page, browser.profile, /\/browse/, 'https://www.netflix.com/login',
    session, {}, origins, false, 'domain-scoped-https', false, 0, undefined, required, true), /required authentication/);
  assert.equal(browser.closed, true);
  assert.equal(manager.activeLogin, undefined);
  assert.equal(browser.context.listenerCount('page'), 0);
  assert.deepEqual(session.events, []);
});

test('a synchronization error cannot resolve as completed; next login can succeed', async (t) => {
  const manager = new ExternalBrowserManager();
  const failed = browserFixture(t, authCookies());
  await assert.rejects(manager.waitForLogin(failed.context, failed.page, failed.profile, /\/browse/, 'https://www.netflix.com/login',
    sessionFixture({ failedName: 'SecureNetflixId' }), {}, origins, false, 'domain-scoped-https', false, 0, undefined, required, true), /verification failed/);
  assert.equal(manager.activeLogin, undefined);
  const next = browserFixture(t, authCookies());
  assert.equal(await manager.waitForLogin(next.context, next.page, next.profile, /\/browse/, 'https://www.netflix.com/login',
    sessionFixture(), {}, origins, false, 'domain-scoped-https', false, 0, undefined, required, true), 'completed');
  await manager.close();
  assert.equal(next.closed, true);
});
