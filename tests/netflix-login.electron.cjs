// Cookie/storage integration only: fresh profile, fake credentials, no real
// Netflix navigation, external login browser, application entry point, or DRM.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-netflix-cookie-probe-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara Netflix Cookie Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const filename = path.resolve(__dirname, '../src/Main/Manager/ExternalBrowserManager.ts');
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded.require = (id) => {
  if (id === 'patchright') return { chromium: { launchPersistentContext() { throw new Error('Real browser launch is forbidden in this probe.'); } } };
  if (id === '../Functional/UserDataPaths') return { getKawaiDataPath: (...parts) => path.join(profile, 'KawaiData', ...parts) };
  return Module.prototype.require.call(loaded, id);
};
loaded._compile(buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['patchright', '../Functional/UserDataPaths'], minify: process.argv.includes('--minified'),
}).outputFiles[0].text, filename);
const { ExternalBrowserManager } = loaded.exports;
const watchdog = setTimeout(() => { console.error('Netflix cookie probe timed out.'); app.exit(1); }, 30000);

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, webPreferences: { partition: 'persist:cookie-probe',
    sandbox: true, nodeIntegration: false, contextIsolation: true } });
  await win.loadURL('data:text/html,<p>Isolated cookie probe</p>');
  const session = win.webContents.session;
  const origins = ['https://netflix.com', 'https://www.netflix.com'];
  const required = [{ name: 'NetflixId', domain: 'netflix.com' }, { name: 'SecureNetflixId', domain: 'netflix.com' }];
  const source = required.map(({ name }) => ({ name, value: `fake-new-${name}`, domain: '.netflix.com',
    path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' }));
  source.push({ name: '__Host-Probe', value: 'fake-host-token', domain: 'www.netflix.com',
    path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' });
  await session.cookies.set({ url: 'https://www.netflix.com/', name: 'NetflixId', value: 'fake-old-domain', domain: '.netflix.com', secure: true });
  await session.cookies.set({ url: 'https://www.netflix.com/', name: 'NetflixId', value: 'fake-old-host', secure: true });
  await session.cookies.set({ url: 'https://other.example/', name: 'OtherSiteAuth', value: 'fake-unrelated-token', secure: true });
  const manager = new ExternalBrowserManager();
  const before = await session.cookies.get({});
  await assert.rejects(manager.replaceSessionLogin([], session, win.webContents, origins, false, 'domain-scoped-https', required, true), /required authentication/);
  assert.deepEqual(await session.cookies.get({}), before, 'invalid source does not destroy existing cookies');

  await manager.replaceSessionLogin(source, session, win.webContents, origins, false, 'domain-scoped-https', required, true);
  const jar = await session.cookies.get({});
  for (const { name } of required) {
    const matches = jar.filter((cookie) => cookie.name === name);
    assert.equal(matches.length, 1, 'old host/domain identities cannot conflict after scoped reset');
    assert.equal(matches[0].value, `fake-new-${name}`);
    assert.equal(matches[0].secure, true);
    assert.equal(matches[0].httpOnly, true);
  }
  assert.equal(jar.find((cookie) => cookie.name === 'OtherSiteAuth').value, 'fake-unrelated-token', 'shared-profile unrelated cookies remain intact');
  const host = jar.find((cookie) => cookie.name === '__Host-Probe');
  assert.equal(host.hostOnly, true);
  assert.equal(host.domain, 'www.netflix.com');
  assert.equal(host.secure, true);
  assert.equal(host.path, '/');
  await session.closeAllConnections();
  win.destroy();
  console.log('PASS: Chromium Netflix-origin reset removes stale host/domain conflicts, preserves unrelated shared-profile cookies, validates the auth pair before reset, and imports secure/HttpOnly/__Host- cookies.');
}

main().then(() => { clearTimeout(watchdog); app.exit(0); }).catch((error) => {
  console.error(error); clearTimeout(watchdog); app.exit(1);
});
