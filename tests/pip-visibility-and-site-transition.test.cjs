const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

function loadSource(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(loaded, id);
  loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: Object.keys(mocks), define: {
      __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
  }).outputFiles[0].text, filename);
  return loaded.exports;
}
const { trackPictureInPictureVisibility } = loadSource('src/Main/Functional/PictureInPictureVisibility.ts');
const { prepareCurrentDocumentForNavigation } = loadSource('src/Main/Functional/WindowOperations.ts', { electron: {} });
const logger = { debug() {}, warn() {}, error() {} };
let cursor = { x: 0, y: 0 };
const { WindowManager } = loadSource('src/Main/Manager/WindowManager.ts', {
  electron: { screen: { getCursorScreenPoint: () => cursor } }, 'electron-mpv-video': {},
});
const { UnifiedPictureInPictureManager } = loadSource('src/Main/Manager/UnifiedPictureInPictureManager.ts', {
  electron: { screen: { getCursorScreenPoint: () => cursor } },
});
const { SiteManager } = loadSource('src/Main/Manager/SiteManager.ts');
const { createScopedSiteContext } = loadSource('src/Main/Functional/ScopedSiteContext.ts');
const { createSitePagePipeline } = loadSource('src/Main/Functional/SitePagePipeline.ts');
const { createSiteCookieStore } = loadSource('src/Main/Functional/WindowOperations.ts', { electron: {} });

function deferred() {
  let resolve;
  const promise = new Promise(release => { resolve = release; });
  return { promise, resolve };
}
function sourceContext(events, id) {
  const contents = new EventEmitter();
  Object.assign(contents, { isDestroyed: () => false, mainFrame: { framesInSubtree: [] },
    async executeJavaScript() { events.push(`${id}:script`); }, sendInputEvent() { events.push(`${id}:input`); } });
  return { viewer: { async loadURL() { events.push(`${id}:navigate`); }, async loadInternalView() {} },
    page: createSitePagePipeline(contents, logger),
    browser: { useIdentity() { events.push(`${id}:identity`); return { dispose() { events.push(`${id}:revoke-identity`); } }; } },
    externalBrowser: { async login() { events.push(`${id}:login`); return 'completed'; }, async close() { events.push(`${id}:close`); } },
    cookies: { async list() { events.push(`${id}:cookies`); return []; }, async clear() { events.push(`${id}:clear-cookies`); return 0; } },
    openExternal: async () => { events.push(`${id}:external`); }, actions: { createUrl: () => '' }, logger,
  };
}
function realLifecycleManager(events) {
  const contexts = new Map();
  const manager = new SiteManager(async runtime => {
    events.push(`${runtime.siteId}:context`);
    const context = sourceContext(events, runtime.siteId); contexts.set(runtime.siteId, context); return context;
  }, () => ({ providerSettings: {} }), () => '', state => events.push(`${state.siteId}:${state.phase}`));
  manager.resolveLocales = () => ({ app: 'en' });
  manager.resolveBrowserProfile = registration => ({ siteId: registration.metadata.id, partition: 'fixture-shared' });
  for (const id of ['old', 'next', 'third']) {
    manager.sites.set(id, { bundleId: 'fixture-bundle', metadata: {
      id, title: id, permissions: ['navigation', 'script-injection', 'network-interception'],
      browserIdentity: { userAgent: 'chromium' }, pictureInPicture: { suppressPageControls: false },
    }, constructor: class {
      constructor(context) { this.context = context; }
      async onSettingsChanged() {}
      async load() { await this.context.viewer.loadURL('https://fixture.example/'); }
      async unload() { events.push(`${id}:unload`); }
    } });
  }
  return { manager, contexts };
}

test('next Provider loads while captured outgoing Plugin/Provider/login cleanup remains pending', async () => {
  const events = [], plugin = deferred(), login = deferred();
  const { manager, contexts } = realLifecycleManager(events);
  await manager.load('old');
  const outgoing = manager.currentProvider;
  contexts.get('old').externalBrowser.close = () => { events.push('old:close'); return login.promise; };
  manager.currentPlugins.push({ async deactivate() { events.push('old:plugin-start'); await plugin.promise; events.push('old:plugin-done'); } });
  await manager.load('next');
  assert.ok(events.includes('next:navigate'));
  assert.ok(!events.includes('old:plugin-done'));
  assert.ok(!events.includes('old:unload'));
  assert.equal(manager.currentSiteId, 'next');
  assert.ok(events.indexOf('old:revoke-identity') < events.indexOf('next:identity'));
  await assert.rejects(outgoing.context.viewer.loadURL('https://late.example/'), /no longer active/);
  await assert.rejects(outgoing.context.cookies.clear({ domains: ['fixture.example'] }), /no longer active/);
  await outgoing.context.externalBrowser.close();
  assert.equal(events.filter(event => event === 'old:close').length, 1);
  assert.ok(!events.includes('next:close'), 'old close cannot cancel the new context');
  plugin.resolve(); login.resolve(); await manager.drainRetiredSiteCleanups();
  assert.ok(events.includes('old:unload'));
  assert.equal(manager.currentSiteId, 'next');
  assert.equal(manager.currentProvider.context, manager.activeContext);
  assert.equal(manager.retiredSiteCleanups.size, 0);
  await manager.dispose();
});
test('several outgoing lifecycles can finish out of order without clearing the latest Provider', async () => {
  const events = [], first = deferred(), second = deferred();
  const { manager } = realLifecycleManager(events);
  await manager.load('old'); manager.currentProvider.unload = () => first.promise;
  await manager.load('next'); manager.currentProvider.unload = () => second.promise;
  await manager.load('third');
  assert.equal(manager.retiredSiteCleanups.size, 2);
  second.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(manager.currentSiteId, 'third');
  first.resolve(); await manager.drainRetiredSiteCleanups();
  assert.equal(manager.currentSiteId, 'third'); await manager.dispose();
});
test('failed new activation reports promptly instead of waiting for retired cleanup', async () => {
  const events = [], held = deferred();
  const { manager } = realLifecycleManager(events);
  await manager.load('old'); manager.currentProvider.unload = () => held.promise;
  manager.createContext = async () => { throw new Error('Fixture activation failure'); };
  await assert.rejects(manager.load('next'), /activation failure/);
  assert.ok(events.includes('next:failed')); assert.equal(manager.currentProvider, undefined);
  assert.equal(manager.retiredSiteCleanups.size, 1);
  held.resolve(); await manager.dispose();
});
test('a failed constructor revokes its partially created context and preserves the original error', async () => {
  const events = [], { manager } = realLifecycleManager(events);
  let captured;
  manager.sites.get('next').constructor = class {
    constructor(context) { captured = context; throw new Error('Fixture constructor failure'); }
  };
  await assert.rejects(manager.load('next'), /constructor failure/);
  assert.equal(manager.activeContext, undefined); assert.equal(manager.currentProvider, undefined);
  await assert.rejects(captured.viewer.loadURL('late'), /no longer active/);
  await manager.dispose(); assert.ok(events.includes('next:close'));
});
test('shutdown and storage reset drain already retired cleanup even for an inactive partition', async () => {
  for (const operation of ['shutdown', 'storage']) {
    const events = [], held = deferred();
    const { manager } = realLifecycleManager(events);
    await manager.load('old'); manager.currentProvider.unload = () => held.promise;
    await manager.load('next');
    let finished = false;
    const running = operation === 'shutdown' ? manager.dispose().then(() => { finished = true; })
      : manager.withPartitionSuspended('inactive-fixture', async () => { finished = true; });
    await Promise.resolve(); await Promise.resolve(); assert.equal(finished, false);
    held.resolve(); await running; assert.equal(finished, true);
    await manager.dispose();
  }
});
test('retired context capabilities and queued hooks cannot mutate a successor', async () => {
  const events = [];
  const source = sourceContext(events, 'old');
  let queued;
  source.page.on = (_, listener) => { queued = listener; return { dispose() {} }; };
  const scoped = createScopedSiteContext(source), context = scoped.context;
  context.page.on('dom-ready', () => { events.push('late-hook'); });
  await scoped.retire(); await scoped.retire(); queued();
  for (const action of [() => context.viewer.loadURL('late'), () => context.viewer.loadInternalView('video'),
    () => context.externalBrowser.login({}), () => context.openExternal('late'),
    () => context.cookies.list({ domains: ['fixture.example'] }),
    () => context.page.execute('late', '1'), () => context.page.executeInAllFrames('late', '1'),
    () => context.page.refresh('late')]) await assert.rejects(action(), /no longer active/);
  assert.throws(() => context.browser.useIdentity({ userAgent: 'late' }), /no longer active/);
  assert.throws(() => context.page.sendKeyPress('Space'), /no longer active/);
  assert.throws(() => context.page.register({ id: 'late', source: '1' }), /no longer active/);
  await context.externalBrowser.close();
  assert.deepEqual(events, ['old:close']);
});
test('an asynchronous injection source resumed after disposal never executes in a retired page', async () => {
  const events = [], held = deferred(), source = sourceContext(events, 'old');
  source.page.register({ id: 'held', source: () => held.promise });
  const running = source.page.refresh('held'); source.page.dispose(); source.page.dispose();
  held.resolve('1'); await running;
  assert.ok(!events.includes('old:script'));
  await assert.rejects(source.page.execute('late', '1'), /no longer active/);
});
test('an old cookie read resumed after native ownership changes cannot remove shared cookies', async () => {
  const held = deferred(); let active = true, removed = 0;
  const store = createSiteCookieStore({ cookies: {
    get: () => held.promise, async remove() { removed++; }, async flushStore() {},
  } }, () => { if (!active) throw new Error('Retired cookie ownership'); });
  const running = assert.rejects(store.clear({ domains: ['fixture.example'] }), /Retired cookie ownership/);
  active = false; held.resolve([{ domain: '.fixture.example', name: 'fixture', path: '/' }]);
  await running; assert.equal(removed, 0);
});

function nativeWindow() {
  return { visible: true, minimized: false, destroyed: false, focused: false,
    bounds: { x: 100, y: 100, width: 320, height: 180 },
    isVisible() { return this.visible; }, isMinimized() { return this.minimized; },
    isDestroyed() { return this.destroyed; }, getBounds() { return this.bounds; },
  };
}
test('app-owned PiP visibility: initial reset, repeated entry/exit, bounds, unfocused hover', () => {
  const win = nativeWindow(), changes = [];
  let point = { x: 0, y: 0 };
  const tracker = trackPictureInPictureVisibility(win, () => point, () => true, value => changes.push(value));
  try {
    assert.deepEqual(changes, [false]);
    for (let cycle = 0; cycle < 3; cycle++) {
      point = { x: 100, y: 100 }; tracker.sync(); tracker.sync();
      assert.equal(changes.at(-1), true, 'hover is usable without focusing the PiP window');
      point = { x: 420, y: 110 }; tracker.sync();
      assert.equal(changes.at(-1), false, 'right edge is outside');
    }
    point = { x: 101, y: 280 }; tracker.sync();
    assert.equal(changes.at(-1), false, 'bottom edge is outside');
    point = { x: 101, y: 279 }; tracker.sync();
    win.bounds = { x: 500, y: 500, width: 100, height: 100 }; tracker.sync();
    assert.equal(changes.at(-1), false, 'native drag/resize uses current screen bounds');
    assert.deepEqual(changes.slice(0, 7), [false, true, false, true, false, true, false]);
  } finally { tracker.dispose(); }
});
test('hidden/minimized/disposed PiP cannot retain a visible overlay', async () => {
  const win = nativeWindow(), changes = [];
  let active = true;
  const tracker = trackPictureInPictureVisibility(win, () => ({ x: 110, y: 110 }), () => active, value => changes.push(value));
  win.visible = false; tracker.sync(); assert.equal(changes.at(-1), false);
  win.visible = true; tracker.sync(); assert.equal(changes.at(-1), true);
  win.minimized = true; tracker.sync(); assert.equal(changes.at(-1), false);
  win.minimized = false; tracker.sync(); assert.equal(changes.at(-1), true);
  active = false; tracker.sync(); assert.equal(changes.at(-1), false);
  const count = changes.length;
  active = true; tracker.sync(); tracker.dispose();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(changes.length, count, 'disposed polling never revives a prior session');
  win.destroyed = true;
  const dead = trackPictureInPictureVisibility(win, assert.fail, () => true, value => changes.push(value));
  dead.dispose();
  assert.equal(changes.at(-1), false);
});
test('internal Video and remote Provider managers use the same native visibility policy', () => {
  const win = nativeWindow(), videoEvents = [], remoteEvents = [];
  win.webContents = { send: (channel, value) => videoEvents.push(value) };
  const video = Object.assign(Object.create(WindowManager.prototype), {
    videoWindow: win, internalVideoPictureInPicture: {}, logger,
  });
  const state = { pipWindow: win, closing: false };
  const remote = Object.assign(Object.create(UnifiedPictureInPictureManager.prototype), { state });
  remote.setControlsVisible = (_, value) => remoteEvents.push(value);
  cursor = { x: 0, y: 0 };
  video.startInternalVideoPictureInPicturePointerMonitor(win);
  remote.startHoverTracking(state);
  try {
    for (const point of [{ x: 110, y: 110 }, { x: 800, y: 800 }, { x: 110, y: 110 }]) {
      cursor = point;
      video.internalVideoPictureInPictureVisibility.sync(); state.controlsVisibility.sync();
    }
    video.clearInternalVideoPictureInPicturePointerMonitor(); remote.stopHoverTracking(state);
    assert.deepEqual(videoEvents, [false, true, false, true, false]);
    assert.deepEqual(remoteEvents, videoEvents);
  } finally { video.clearInternalVideoPictureInPicturePointerMonitor(); remote.stopHoverTracking(state); }
});
test('late page mousemove reconciles native visibility instead of forcing controls on', () => {
  const win = nativeWindow();
  let synchronized = 0;
  const state = { pipWindow: win, closing: false,
    controlsVisibility: { sync() { synchronized++; } } };
  const manager = Object.create(UnifiedPictureInPictureManager.prototype);
  manager.setControlsVisible = assert.fail;
  manager.handlePointerInput(state, { type: 'mouseMove', x: 10, y: 10 });
  manager.handlePointerInput(state, { type: 'mouseLeave' });
  assert.equal(synchronized, 2);
});
test('iframe replacement preserves the latest native hidden state', () => {
  const manager = Object.create(UnifiedPictureInPictureManager.prototype);
  const state = { controlsVisible: true, frame: { isDestroyed: () => true } };
  manager.setControlsVisible(state, false);
  assert.equal(state.controlsVisible, false);
  const scripts = [];
  state.frame = { isDestroyed: () => false, async executeJavaScript(script) { scripts.push(script); } };
  manager.setControlsVisible(state, state.controlsVisible, true);
  assert.equal(scripts.length, 1);
});

function transitionManager() {
  const contents = new EventEmitter();
  let visible = false, focus = 0, invalidations = 0;
  Object.assign(contents, { id: 42, getURL: () => 'https://site.example/',
    isDestroyed: () => false, invalidate() { invalidations++; }, focus() { focus++; },
    insertCSS: async () => '', setWindowOpenHandler() {},
  });
  const view = { webContents: contents, setVisible(value) { visible = value; }, getVisible: () => visible };
  const manager = Object.assign(Object.create(WindowManager.prototype), {
    logger, siteView: view, siteViewAttached: true, siteViewSiteId: 'next',
    siteTransitionState: { siteId: 'next', title: 'Next', phase: 'loading' },
    siteTransitionStartedAt: Date.now(), editingWebContentsIds: new Set(),
  });
  manager.installRemoteThemeBridge = () => {};
  return { manager, contents, view, focus: () => focus, invalidations: () => invalidations };
}
test('actual site event wiring presents DOM-ready content before did-finish-load', () => {
  const { manager, contents, view, focus, invalidations } = transitionManager();
  manager.attachSiteWebContents(contents, {});
  assert.equal(view.getVisible(), false);
  contents.emit('dom-ready');
  assert.equal(view.getVisible(), true);
  assert.equal(focus(), 1); assert.equal(invalidations(), 1);
});
test('site presentation never revives a stale, detached, failed or internal Video view', () => {
  const { manager, contents, view, focus } = transitionManager();
  for (const [key, value] of [['siteViewAttached', false], ['internalVideoVisible', true],
    ['siteViewSiteId', 'old'], ['siteTransitionState', { siteId: 'next', phase: 'failed' }]]) {
    const previous = manager[key]; manager[key] = value;
    manager.revealActiveSiteView(contents, 'dom-ready'); assert.equal(view.getVisible(), false);
    manager[key] = previous;
  }
  manager.revealActiveSiteView({ ...contents }, 'dom-ready'); assert.equal(view.getVisible(), false);
  const url = contents.getURL; contents.getURL = () => 'about:blank';
  manager.revealActiveSiteView(contents, 'dom-ready'); assert.equal(view.getVisible(), false);
  contents.getURL = url; manager.overlayVisible = true;
  manager.revealActiveSiteView(contents, 'dom-ready');
  assert.equal(view.getVisible(), true); assert.equal(focus(), 0, 'never steals focus from an open app menu');
});
test('retired request policies cannot affect old views/profiles, but OAuth popup initial navigation remains covered', () => {
  const { manager, contents } = transitionManager(), session = {};
  contents.session = session; manager.retiredSiteWebContentsIds = new Set([40]);
  assert.equal(manager.isActiveSiteRequest(session, 42), true);
  assert.equal(manager.isActiveSiteRequest(session, 40), false);
  assert.equal(manager.isActiveSiteRequest(session, 99), true, 'popup request can precede did-create-window');
  assert.equal(manager.isActiveSiteRequest(session, undefined), true, 'retain same-Session worker requests');
  assert.equal(manager.isActiveSiteRequest({}, 42), false);
  manager.siteView = undefined; assert.equal(manager.isActiveSiteRequest(session, 42), false);
});
test('handoff state begins before teardown, failure propagates, queued retry recovers', async () => {
  const changes = [];
  const manager = new SiteManager(() => {}, () => ({}), () => '', state => changes.push(state));
  manager.sites.set('next', { metadata: { title: 'Next' } });
  let release, first = true;
  const hold = new Promise(resolve => { release = resolve; });
  manager.loadRegisteredSite = async () => {
    assert.equal(changes.at(-1).phase, 'loading');
    if (first) { first = false; await hold; throw new Error('Fixture teardown failure'); }
  };
  const failed = assert.rejects(manager.load('next'), /teardown failure/);
  const retried = manager.load('next');
  await Promise.resolve();
  assert.deepEqual(changes.map(change => change.phase), ['loading']);
  release(); await failed; await retried;
  assert.deepEqual(changes.map(change => change.phase), ['loading', 'failed', 'loading', 'ready']);
  assert.equal(changes[1].error, 'Fixture teardown failure');
  const count = changes.length;
  await assert.rejects(manager.load('unknown'), /Unknown site/);
  assert.equal(changes.length, count, 'invalid site ID cannot hide an existing view');
});
test('loading keeps the outgoing view visible and muted; only failure hides it', () => {
  let visible = true, muted = false;
  const manager = Object.assign(Object.create(WindowManager.prototype), {
    logger, siteView: { setVisible(value) { visible = value; },
      webContents: { isDestroyed: () => false, setAudioMuted(value) { muted = value; } } },
  });
  manager.notifySiteTransition({ siteId: 'next', title: 'Next', phase: 'loading' });
  assert.equal(visible, true, 'do not expose the backing page before native replacement');
  assert.equal(muted, true, 'outgoing audio still stops promptly');
  manager.notifySiteTransition({ siteId: 'next', title: 'Next', phase: 'ready' });
  assert.equal(visible, true);
  manager.notifySiteTransition({ siteId: 'next', title: 'Next', phase: 'failed', error: 'Fixture failure' });
  assert.equal(visible, false, 'failed content cannot obscure recovery guidance');
});
test('real context-creation failure is covered by transition failure feedback', async () => {
  const changes = [];
  const manager = new SiteManager(async () => { throw new Error('Fixture context failure'); }, () => ({}), () => '', value => changes.push(value));
  manager.sites.set('next', { metadata: { title: 'Next', permissions: [] } });
  manager.unloadCurrent = async () => { assert.equal(changes.at(-1).phase, 'loading'); };
  manager.resolveLocales = () => ({}); manager.resolveBrowserProfile = () => ({});
  await assert.rejects(manager.load('next'), /context failure/);
  assert.deepEqual(changes.map(change => change.phase), ['loading', 'failed']);
});
test('only the latest queued root-surface update is applied when its initial document becomes ready', async () => {
  let ready;
  const scripts = [];
  const manager = Object.assign(Object.create(WindowManager.prototype), {
    logger, appLocale: 'ko', systemLocale: 'en', appTheme: 'dark', siteTransitionSurfaceRevision: 0,
    siteTransitionSurfaceReady: new Promise(resolve => { ready = resolve; }),
    viewerWindow: { isDestroyed: () => false, webContents: { async executeJavaScript(script) { scripts.push(script); } } },
  });
  manager.notifySiteTransition({ siteId: 'one', title: 'Old site', phase: 'loading' });
  manager.notifySiteTransition({ siteId: 'two', title: 'Latest site', phase: 'failed', error: 'Fixture error' });
  ready(true); await Promise.resolve(); await Promise.resolve();
  assert.equal(scripts.length, 1); assert.ok(scripts[0].includes('Latest site'));
  assert.ok(!scripts[0].includes('Old site'));
});

function outgoingContents(execute) {
  const calls = [];
  return { calls, isDestroyed: () => false, isLoading: () => true,
    getURL: () => 'https://outgoing.example/watch?q="fixture"', stop() { calls.push('stop'); },
    executeJavaScript(script) { calls.push('cleanup'); this.script = script; return execute(); },
  };
}
test('outgoing network loading stops before media cleanup JavaScript is requested', async () => {
  const contents = outgoingContents(async () => {});
  await prepareCurrentDocumentForNavigation(contents);
  assert.deepEqual(contents.calls, ['stop', 'cleanup', 'stop']);
  assert.ok(contents.script.startsWith(`if (location.href === ${JSON.stringify(contents.getURL())})`));
});
test('an unresponsive outgoing renderer cannot indefinitely block the next site', async () => {
  const contents = outgoingContents(() => new Promise(() => {}));
  const start = performance.now(); await prepareCurrentDocumentForNavigation(contents);
  const elapsed = performance.now() - start;
  assert.ok(elapsed >= 200 && elapsed < 650, `bounded cleanup took ${elapsed}ms`);
  assert.deepEqual(contents.calls, ['stop', 'cleanup', 'stop']);
});
test('cleanup skips destroyed/blank documents and does not issue premature stop on idle ones', async () => {
  await prepareCurrentDocumentForNavigation({ isDestroyed: () => true, getURL: assert.fail });
  await prepareCurrentDocumentForNavigation({ isDestroyed: () => false, getURL: () => 'about:blank', stop: assert.fail });
  const contents = outgoingContents(async () => {}); contents.isLoading = () => false;
  await prepareCurrentDocumentForNavigation(contents);
  assert.deepEqual(contents.calls, ['cleanup', 'stop']);
});
