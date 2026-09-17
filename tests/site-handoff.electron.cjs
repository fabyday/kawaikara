// Actual SiteManager + WindowManager native handoff, isolated profile and
// loopback/generated media only. Deliberately hold all outgoing cleanup tasks.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-site-handoff-'));
for (const directory of ['session', 'main', 'preload']) mkdirSync(path.join(profile, directory));
writeFileSync(path.join(profile, 'preload/viewer.js'), '// No production bridges or native backends in this probe.');
app.setName('Kawaikara Site Handoff Probe');
app.setPath('userData', profile); app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const minify = process.argv.includes('--minified');
let stage = 'setup';
const watchdog = setTimeout(() => { console.error(`Site handoff timed out: ${stage}`); app.exit(1); }, 20000);
const events = [], logger = { debug() {}, info() {}, warn() {}, error() {} };
function deferred() {
  let resolve; const promise = new Promise(release => { resolve = release; }); return { promise, resolve };
}
function loadSource(relative, mocks = {}) {
  const filename = path.join(root, relative), loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(loaded, id);
  const code = buildSync({ entryPoints: [filename], bundle: true, write: false, minify,
    platform: 'node', format: 'cjs', external: ['electron', ...Object.keys(mocks)], define: {
      __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
  }).outputFiles[0].text;
  loaded._compile(code, path.join(profile, 'main', path.basename(relative) + '.cjs'));
  return loaded.exports;
}
const { WindowManager } = loadSource('src/Main/Manager/WindowManager.ts', { 'electron-mpv-video': {} });
const { SiteManager } = loadSource('src/Main/Manager/SiteManager.ts');
const { createSiteTransitionSurfaceHtml } = loadSource('src/Main/Inject/SiteTransitionSurface.ts');
async function evaluate(contents, expression) {
  if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
  const result = await contents.debugger.sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.text);
  return result.result.value;
}
async function main() {
  await app.whenReady();
  const imageRequested = deferred(), outgoingPlugin = deferred(), outgoingUnload = deferred(), browserCleanup = deferred();
  let heldImage;
  const server = http.createServer((request, response) => {
    if (request.url === '/next/held.png') { heldImage = response; imageRequested.resolve(); return; }
    const id = request.url.split('/')[1];
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><style>body{margin:0;background:#dacdee;font:24px system-ui}</style>
      <h1 id="site">${id} page</h1><video muted></video>${id === 'next' ? '<img src="/next/held.png">' : ''}`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const viewer = new BrowserWindow({ show: false, width: 640, height: 400, webPreferences: { backgroundThrottling: false } });
  await viewer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(createSiteTransitionSurfaceHtml('dark')));
  viewer.showInactive();
  const windows = Object.assign(Object.create(WindowManager.prototype), {
    viewerWindow: viewer, logger, logging: { attachRenderer() {} }, appTheme: 'dark', appLocale: 'ko', systemLocale: 'en',
    siteTransitionSurfaceReady: Promise.resolve(true), siteTransitionSurfaceRevision: 0, externalLoginGeneration: 0,
    configuredSiteSessions: new WeakSet(), retiredSiteWebContentsIds: new Set(), sitePopupWindows: new Set(), editingWebContentsIds: new Set(),
    pictureInPicture: { isActive: () => false, async exitAllModes() {} },
    externalBrowser: { async cancelLogin() { events.push('cancel-auth'); }, close() { events.push('close-browser'); return browserCleanup.promise; } },
  });
  windows.installRemoteThemeBridge = () => {};
  const domReady = new Map(), contexts = new Map();
  const sites = new SiteManager(async (runtime, permissions) => {
    const context = await windows.createSiteContext(runtime, permissions);
    contexts.set(runtime.siteId, context);
    const ready = deferred(); domReady.set(runtime.siteId, ready);
    windows.siteView.webContents.once('dom-ready', ready.resolve);
    return context;
  }, () => ({ providerSettings: {} }), () => '', state => windows.notifySiteTransition(state));
  sites.resolveLocales = () => ({ app: 'ko' });
  sites.resolveBrowserProfile = registration => ({ siteId: registration.metadata.id, id: 'fixture', partition: 'persist:handoff-fixture' });
  for (const id of ['old', 'next', 'third']) {
    sites.sites.set(id, { metadata: { id, title: id, permissions: ['navigation', 'internal-view', 'external-browser', 'cookies'],
      pictureInPicture: { suppressPageControls: false } }, constructor: class {
      constructor(context) { this.context = context; }
      async onSettingsChanged() {}
      async load() { await this.context.viewer.loadURL(`${base}/${id}/`); }
      async unload() { events.push(`${id}:unload`); }
    } });
  }
  stage = 'outgoing generated video'; await sites.load('old');
  const oldView = windows.siteView, oldContext = sites.currentProvider.context, oldSession = oldView.webContents.session;
  const oldContents = oldView.webContents;
  await oldSession.cookies.set({ url: base, name: 'fixture-cookie', value: 'preserved' });
  await evaluate(oldView.webContents, `new Promise(resolve=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    canvas.getContext('2d').fillRect(0,0,160,90);window.stream=canvas.captureStream(5);
    const video=document.querySelector('video');video.srcObject=stream;video.onloadeddata=()=>video.play().then(resolve);
  })`);
  let muteIssued = false, forbiddenCleanupCalls = 0;
  const mute = oldView.webContents.setAudioMuted.bind(oldView.webContents);
  oldView.webContents.setAudioMuted = value => { if (value) muteIssued = true; mute(value); };
  // An outgoing renderer that never responds must not gate native replacement.
  oldView.webContents.executeJavaScript = () => { forbiddenCleanupCalls++; return new Promise(() => {}); };
  sites.currentPlugins.push({ async deactivate() { await outgoingPlugin.promise; events.push('old:plugin-done'); } });
  sites.currentProvider.unload = async () => { await outgoingUnload.promise; events.push('old:unload-done'); };
  const nativeOwnershipPending = deferred(), restoreNativeOwnership = deferred();
  windows.pictureInPicture.exitAllModes = async () => {
    nativeOwnershipPending.resolve(); await restoreNativeOwnership.promise;
  };
  stage = 'new native view while all old cleanup is pending';
  const start = performance.now(); let newLoadFinished = false;
  const loading = sites.load('next').then(() => { newLoadFinished = true; });
  void loading.catch(() => {});
  await nativeOwnershipPending.promise;
  assert.equal(oldView.getVisible(), true, 'retain outgoing presentation until native cutover');
  assert.equal(muteIssued, true);
  assert.equal(await evaluate(viewer.webContents, 'document.documentElement.dataset.active'), 'false',
    'there is no loading interstitial even while critical native ownership is pending');
  restoreNativeOwnership.resolve();
  await imageRequested.promise; await domReady.get('next').promise;
  const newDomMs = performance.now() - start;
  assert.ok(newDomMs < 1000, `new DOM delayed ${newDomMs}ms`);
  assert.equal(windows.siteView.getVisible(), true);
  assert.equal(await evaluate(windows.siteView.webContents, 'document.getElementById("site").textContent'), 'next page');
  assert.equal(newLoadFinished, false, 'the incoming page is visible while its image/full load remains pending');
  assert.equal(await evaluate(viewer.webContents, 'document.documentElement.dataset.active'), 'false');
  assert.equal(muteIssued, true); assert.equal(forbiddenCleanupCalls, 0);
  assert.equal(oldContents.isDestroyed(), true, 'old decoded video/native document no longer exists');
  assert.ok(!events.includes('old:plugin-done')); assert.ok(!events.includes('old:unload-done'));
  assert.equal(sites.retiredSiteCleanups.size, 1);
  assert.equal(windows.siteView.webContents.session, oldSession, 'retain shared Session rather than resetting its data');
  await assert.rejects(oldContext.viewer.loadURL(`${base}/old/`), /no longer active/);
  await assert.rejects(oldContext.viewer.loadInternalView('video'), /no longer active/);
  await assert.rejects(contexts.get('old').viewer.loadURL(`${base}/old/`), /no longer active/);
  await assert.rejects(contexts.get('old').viewer.loadInternalView('video'), /no longer active/);
  const closeCount = events.filter(event => event === 'close-browser').length;
  await oldContext.externalBrowser.close();
  assert.equal(events.filter(event => event === 'close-browser').length, closeCount, 'late old close cannot affect the successor');
  await assert.rejects(oldContext.cookies.clear({ domains: ['127.0.0.1'] }), /no longer active/);
  assert.equal((await oldSession.cookies.get({ name: 'fixture-cookie' })).length, 1);
  // DOM readiness can precede the native compositor's first captureable frame.
  // Keep every cleanup and the image blocked while also asserting real painting.
  let nextScreenshot;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    nextScreenshot = await windows.siteView.webContents.capturePage();
    if (!nextScreenshot.isEmpty()) break;
  }
  assert.equal(nextScreenshot.isEmpty(), false, 'the new view paints before old cleanup/full load completes');
  assert.equal(newLoadFinished, false);
  assert.ok(!events.includes('old:plugin-done')); assert.ok(!events.includes('old:unload-done'));
  writeFileSync(path.join(profile, 'next-visible-during-cleanup.png'), nextScreenshot.toPNG());
  heldImage.end(); await loading;
  stage = 'third activation before old cleanup completes';
  await sites.load('third'); assert.equal(sites.currentSiteId, 'third');
  outgoingPlugin.resolve(); outgoingUnload.resolve(); browserCleanup.resolve(); await sites.drainRetiredSiteCleanups();
  assert.equal(sites.currentSiteId, 'third');
  assert.equal(await evaluate(windows.siteView.webContents, 'document.getElementById("site").textContent'), 'third page');
  stage = 'shutdown drain'; await sites.dispose(); windows.destroySiteView(); viewer.destroy();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  clearTimeout(watchdog); console.log(JSON.stringify({ passed: true, minified: minify, newDomMs, profile })); app.exit(0);
}
main().catch(error => { console.error(`Site handoff failed at ${stage}:`, error); clearTimeout(watchdog); app.exit(1); });
