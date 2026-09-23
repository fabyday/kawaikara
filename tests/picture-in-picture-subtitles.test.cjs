const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const result = buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
    external: Object.keys(mocks), define: {
    __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify('nightly'),
    __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
    __KAWAIKARA_DISCORD_APP_ID__: JSON.stringify(''),
    __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
  } });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(loaded, id);
  loaded._compile(result.outputFiles[0].text, filename);
  return loaded.exports;
}

const { PictureInPictureSubtitleRuntime, createProviderPictureInPictureSubtitleController } = loadSource('src/Main/Functional/PictureInPictureSubtitleRuntime.ts');
const { mergeValidatedPreferences } = loadSource('src/Main/Functional/Preferences.ts');
const { UnifiedPictureInPictureManager } = loadSource(
  'src/Main/Manager/UnifiedPictureInPictureManager.ts',
  { electron: { app: { getLocale: () => 'en-US' } } },
);

function frame(url = 'https://player.example/video') {
  return {
    url, scripts: [], destroyed: false,
    isDestroyed() { return this.destroyed; },
    async executeJavaScript(source) { this.scripts.push(source); return 'frame-result'; },
  };
}

test('old preferences get 100%; persisted scale is finite and bounded', () => {
  assert.equal(mergeValidatedPreferences({}).pictureInPictureSubtitleScale, 1);
  assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: 1.6 }).pictureInPictureSubtitleScale, 1.6);
  assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: 9 }).pictureInPictureSubtitleScale, 3);
  assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: 3 }).pictureInPictureSubtitleScale, 3);
  assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: 2.7 }).pictureInPictureSubtitleScale, 2.7);
  assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: -1 }).pictureInPictureSubtitleScale, 0.5);
  for (const value of [NaN, Infinity, null, '150', undefined]) {
    assert.equal(mergeValidatedPreferences({ pictureInPictureSubtitleScale: value }).pictureInPictureSubtitleScale, 1);
  }
});

test('one Provider controller receives saved scale and live changes, then disposes once', async () => {
  const calls = [];
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  runtime.setFactory((session) => {
    calls.push(['create', session.url]);
    return { setScale: (scale) => calls.push(['scale', scale]), dispose: () => calls.push(['dispose']) };
  });
  await runtime.setScale(1.4);
  await runtime.bind(frame(), () => true);
  await runtime.setScale(1.8);
  await runtime.dispose();
  await runtime.dispose();
  assert.deepEqual(calls, [['create', 'https://player.example/video'], ['scale', 1.4], ['scale', 1.8], ['dispose']]);
});

test('player replacement restores the old adapter before creating the next one', async () => {
  const calls = [];
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  runtime.setFactory(({ url }) => {
    calls.push(`create:${url}`);
    return { setScale: (scale) => calls.push(`scale:${scale}`), dispose: () => calls.push(`dispose:${url}`) };
  });
  await runtime.setScale(1.5);
  await runtime.bind(frame('https://player.example/one'), () => true);
  await runtime.bind(frame('https://player.example/two'), () => true);
  await runtime.dispose();
  assert.deepEqual(calls, ['create:https://player.example/one', 'scale:1.5', 'dispose:https://player.example/one',
    'create:https://player.example/two', 'scale:1.5', 'dispose:https://player.example/two']);
});

test('exit cancels a pending async factory and cleans up its late controller', async () => {
  let complete;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const calls = [];
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  runtime.setFactory(() => { started(); return new Promise((resolve) => { complete = resolve; }); });
  const binding = runtime.bind(frame(), () => true);
  await ready;
  const exiting = runtime.dispose();
  complete({ setScale: () => calls.push('scale'), dispose: () => calls.push('dispose') });
  await Promise.all([binding, exiting]);
  assert.deepEqual(calls, ['dispose']);
});

test('creation and initial apply errors are isolated; the next session still works', async () => {
  const errors = [];
  let disposed = 0;
  const runtime = new PictureInPictureSubtitleRuntime(() => [], (error) => errors.push(error.message));
  runtime.setFactory(() => { throw new Error('factory-error'); });
  await runtime.bind(frame(), () => true);
  runtime.setFactory(() => ({ setScale() { throw new Error('apply-error'); }, dispose() { disposed += 1; } }));
  await runtime.bind(frame(), () => true);
  let applied;
  runtime.setFactory(() => ({ setScale(scale) { applied = scale; }, dispose() {} }));
  await runtime.bind(frame(), () => true);
  await runtime.setScale(1.6);
  await runtime.dispose();
  assert.deepEqual(errors, ['factory-error', 'apply-error']);
  assert.equal(disposed, 1);
  assert.equal(applied, 1.6);
});

test('custom scripts stay frame-scoped and become unavailable after disposal', async () => {
  const activeFrame = frame();
  let session;
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  runtime.setFactory((value) => { session = value; return { setScale() {}, dispose() {} }; });
  await runtime.bind(activeFrame, () => true);
  assert.equal(await session.page.execute('custom-script'), 'frame-result');
  assert.deepEqual(activeFrame.scripts, ['custom-script']);
  await runtime.dispose();
  await assert.rejects(session.page.execute('late-script'), /no longer active/);
  assert.deepEqual(activeFrame.scripts, ['custom-script']);
});

test('legacy declarations and standard selectors remain available in the default adapter', async () => {
  const activeFrame = frame();
  const runtime = new PictureInPictureSubtitleRuntime(() => ['.legacy-caption'], assert.fail);
  await runtime.setScale(1.7);
  await runtime.bind(activeFrame, () => true);
  assert.match(activeFrame.scripts[0], /\.legacy-caption/);
  assert.match(activeFrame.scripts[0], /\.vjs-text-track-display/);
  assert.match(activeFrame.scripts[0], /"scale":1\.7\}\);$/);
  await runtime.dispose();
  assert.match(activeFrame.scripts[1], /\)\(\{"id":"[a-f0-9]+"\}\);$/);
});

test('all convenience adapters are cleaned up even if a custom factory throws', async () => {
  const activeFrame = frame();
  const errors = [];
  const runtime = new PictureInPictureSubtitleRuntime(() => [], (error) => errors.push(error.message));
  runtime.setFactory(async (session) => {
    await session.createDomSubtitleController({ overlaySelectors: ['.custom-caption'] }).setScale(1.5);
    throw new Error('partial-factory-error');
  });
  await runtime.bind(activeFrame, () => true);
  assert.equal(activeFrame.scripts.length, 2);
  assert.deepEqual(errors, ['partial-factory-error']);
  await runtime.dispose();
});

test('a Provider can opt out and destroyed frames do not start controllers', async () => {
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  let created = 0;
  runtime.setFactory(() => { created += 1; return undefined; });
  const activeFrame = frame();
  await runtime.bind(activeFrame, () => true);
  await runtime.setScale(1.5);
  assert.equal(activeFrame.scripts.length, 0);
  activeFrame.destroyed = true;
  await runtime.bind(activeFrame, () => true);
  await runtime.dispose();
  assert.equal(created, 1);
});

test('built-in site caption declarations have moved from decorators into Provider methods', () => {
  const { getProviderMetadata } = require('../packages/site-api/dist/Index.js');
  const sites = ['YouTube', 'Netflix', 'Chzzk', 'DisneyPlus', 'Wavve', 'Crunchyroll', 'PrimeVideo', 'Twitch', 'AppleTv'];
  for (const name of sites) {
    const Provider = require(`../packages/builtin-sites/dist/Providers/${name}/Provider.js`)[`${name}Provider`];
    let options;
    const controller = { setScale() {}, dispose() {} };
    const instance = new Provider({});
    assert.equal(instance.createPictureInPictureSubtitleController({
      url: 'https://player.example/video',
      createDomSubtitleController(value) { options = value; return controller; },
    }), controller, name);
    assert.ok(options.overlaySelectors.length > 0, name);
    assert.equal(getProviderMetadata(Provider).pictureInPicture?.contentOverlaySelectors, undefined, name);
  }
});

test('YouTube opts into raised caption-window alignment; Netflix retains App defaults', () => {
  const optionsFor = (name) => {
    const Provider = require(`../packages/builtin-sites/dist/Providers/${name}/Provider.js`)[`${name}Provider`];
    let options;
    new Provider({}).createPictureInPictureSubtitleController({
      url: 'https://player.example/video',
      createDomSubtitleController(value) { options = value; return { setScale() {}, dispose() {} }; },
    });
    return options;
  };
  const youtube = optionsFor('YouTube');
  assert.deepEqual(youtube.alignment, { horizontal: 'center', vertical: 'bottom', bottomInsetRatio: 0.08, minimumBottomInsetPx: 12 });
  assert.deepEqual(youtube.alignmentSelectors, ['.caption-window', '.ytp-caption-window-bottom']);
  assert.equal(youtube.scaleMode, 'box');
  assert.equal(optionsFor('Netflix').alignment, undefined);
  assert.equal(optionsFor('Netflix').scaleMode, undefined);
});

test('Provider alignment and box scaling reach the selected frame without decorator changes', async () => {
  const activeFrame = frame();
  const runtime = new PictureInPictureSubtitleRuntime(() => [], assert.fail);
  runtime.setFactory(session => session.createDomSubtitleController({
    overlaySelectors: ['.caption-layer'], alignmentSelectors: ['.caption-window'], scaleMode: 'box',
    alignment: { vertical: 'bottom', bottomInsetRatio: 0.12 },
  }));
  await runtime.bind(activeFrame, () => true);
  assert.match(activeFrame.scripts[0], /"alignmentSelectors":\["\.caption-window"\]/);
  assert.match(activeFrame.scripts[0], /"scaleMode":"box"/);
  assert.match(activeFrame.scripts[0], /"alignment":\{"vertical":"bottom","bottomInsetRatio":0\.12\}/);
  await runtime.dispose();
});

test('transfer sizes the detached view before attaching it to the visible target', async () => {
  const { transferWebContentsView } = loadSource('src/Main/Functional/WebContentsViewTransfer.ts');
  const calls = [];
  const view = { bounds: { width: 960, height: 540 },
    setBounds(bounds) { this.bounds = bounds; calls.push('size'); },
    webContents: { isDestroyed: () => false, invalidate() { calls.push('invalidate'); },
      async executeJavaScript() { calls.push('frames'); } },
  };
  const sourceWindow = { isDestroyed: () => false, contentView: { removeChildView() { calls.push('remove'); } } };
  const targetWindow = { isDestroyed: () => false, getContentSize: () => [320, 180],
    showInactive() { calls.push('show'); }, contentView: { addChildView(transferred) {
      assert.deepEqual(transferred.bounds, { x: 0, y: 0, width: 320, height: 180 });
      calls.push('add');
    } },
  };
  await transferWebContentsView({ sourceWindow, targetWindow, view });
  assert.deepEqual(calls, ['show', 'remove', 'size', 'add', 'invalidate', 'frames']);
});

test('slow subtitle initialization cannot defer view transfer or first PiP presentation', async () => {
  const calls = [];
  const { UnifiedPictureInPictureManager: Manager } = loadSource('src/Main/Manager/UnifiedPictureInPictureManager.ts', {
    electron: { app: { getLocale: () => 'en-US' } }, '../Functional/WebContentsViewTransfer': { async transferWebContentsView() { calls.push('transfer'); } },
  });
  const activeFrame = frame();
  activeFrame.executeJavaScript = async () => ({ status: 'entered', videoWidth: 640, videoHeight: 360 });
  const viewer = { hide() { calls.push('hide-viewer'); } };
  const pip = { show() {}, focus() {} };
  const view = { webContents: { on() {}, focus() {} } };
  const manager = new Manager(() => viewer, () => view, () => [],
    { getLogger: () => ({ debug: assert.fail, error: assert.fail }) }, () => calls.push('entered'), () => {});
  manager.findVideoCandidate = async () => ({ status: 'ready', frame: activeFrame, aspectRatio: 16 / 9 });
  manager.enterHostFrames = async () => [];
  manager.resolveInitialBounds = () => ({ width: 320, height: 180 });
  manager.createPipWindow = () => pip;
  manager.attachWindowEvents = () => {};
  manager.syncSiteViewBounds = () => calls.push('fit');
  manager.presentMacPictureInPicture = () => calls.push('present');
  manager.startHoverTracking = () => {};
  manager.scheduleFullscreenReassertion = () => {};
  let release;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  manager.setSubtitleControllerFactory(async () => {
    calls.push('subtitles'); markStarted(); await held;
    return { setScale() {}, dispose() {} };
  });
  const entering = manager.enter();
  await started;
  const beforeSubtitles = [...calls];
  release();
  assert.equal((await entering).status, 'entered');
  for (const action of ['transfer', 'fit', 'hide-viewer']) {
    assert.ok(beforeSubtitles.indexOf(action) >= 0 && beforeSubtitles.indexOf(action) < beforeSubtitles.indexOf('subtitles'), action);
  }
  assert.equal(calls.at(-1), 'entered');
});

test('custom page execution is permission-gated without changing DOM-helper capability', () => {
  const helper = { setScale() {}, dispose() {} };
  const session = { url: 'https://player.example/video', page: { execute() {} }, createDomSubtitleController() { return helper; } };
  let scoped;
  const provider = { createPictureInPictureSubtitleController(value) { scoped = value; return value.createDomSubtitleController(); } };
  assert.equal(createProviderPictureInPictureSubtitleController(provider, session, false), helper);
  assert.equal(scoped.page, undefined);
  assert.equal(scoped.url, session.url);
  assert.equal(createProviderPictureInPictureSubtitleController(provider, session, true), helper);
  assert.equal(scoped.page, session.page);
  assert.equal(createProviderPictureInPictureSubtitleController({}, session, false), helper, 'old bundles lack the method');
  assert.equal(createProviderPictureInPictureSubtitleController(undefined, session, true), undefined);
});

test('cleanup errors do not strand the frame session or poison the next entry', async () => {
  const errors = [];
  let session;
  const runtime = new PictureInPictureSubtitleRuntime(() => [], (error) => errors.push(error.message));
  runtime.setFactory((value) => {
    session = value;
    return { setScale() {}, dispose() { throw new Error('cleanup-error'); } };
  });
  await runtime.bind(frame(), () => true);
  await runtime.dispose();
  await assert.rejects(session.page.execute('late-script'), /no longer active/);
  let scale;
  runtime.setFactory(() => ({ setScale(value) { scale = value; }, dispose() {} }));
  await runtime.bind(frame(), () => true);
  await runtime.setScale(1.9);
  await runtime.dispose();
  assert.equal(scale, 1.9);
  assert.deepEqual(errors, ['cleanup-error']);
});

function managerWithState(activeFrame) {
  const calls = [];
  const manager = new UnifiedPictureInPictureManager(() => ({}), () => ({}), () => [],
    { getLogger: () => ({ debug: assert.fail, error: assert.fail }) },
    (result) => calls.push(['state', result.status]), () => calls.push(['exited']));
  const state = {
    frame: activeFrame, siteView: { webContents: { off() {} } },
    closing: false, refreshingVideo: false, hostFrames: [], controlsVisible: false,
    viewerWindow: { isDestroyed: () => false, show() {} },
    pipWindow: { isDestroyed: () => false, hide() {}, destroy() {} },
  };
  manager.state = state;
  manager.subtitles = { async bind(value) { calls.push(['bind', value.url]); }, async dispose() { calls.push(['dispose']); } };
  manager.updateAspectRatio = () => {};
  manager.setControlsVisible = () => calls.push(['controls']);
  manager.inspectVideoFrames = async () => ({ status: 'ready', frame: activeFrame });
  manager.restoreHostFrames = async () => {};
  manager.enterHostFrames = async () => [];
  manager.restoreInjectedVideo = async (value) => calls.push(['restore', value.url]);
  return { manager, state, calls };
}

test('ordinary PiP refresh keeps the controller; replacement video recreates it', async () => {
  const activeFrame = frame();
  const { manager, state, calls } = managerWithState(activeFrame);
  activeFrame.executeJavaScript = async () => ({ status: 'unchanged', videoWidth: 640, videoHeight: 360 });
  await manager.refreshActiveVideo(state);
  assert.deepEqual(calls, []);
  activeFrame.executeJavaScript = async () => ({ status: 'refreshed', videoWidth: 640, videoHeight: 360 });
  await manager.refreshActiveVideo(state);
  assert.deepEqual(calls, [['bind', activeFrame.url]]);
});

test('a navigated document in the same frame regains PiP layout, controls, and captions', async () => {
  const activeFrame = frame();
  const { manager, state, calls } = managerWithState(activeFrame);
  const results = [{ status: 'missing' }, { status: 'entered', videoWidth: 640, videoHeight: 360 }];
  activeFrame.executeJavaScript = async () => results.shift();
  await manager.refreshActiveVideo(state);
  assert.deepEqual(calls, [['controls'], ['bind', activeFrame.url]]);
  assert.equal(results.length, 0);
});

test('replacement iframe binds captions in the new frame and restores the previous frame', async () => {
  const previous = frame('https://player.example/previous');
  const next = frame('https://player.example/next');
  const { manager, state, calls } = managerWithState(previous);
  next.executeJavaScript = async () => ({ status: 'entered', videoWidth: 640, videoHeight: 360 });
  manager.inspectVideoFrames = async () => ({ status: 'ready', frame: next });
  await manager.refreshActiveVideo(state);
  assert.equal(state.frame, next);
  assert.deepEqual(calls, [['bind', next.url], ['controls'], ['restore', previous.url]]);
});

test('PiP exit waits for an in-flight iframe refresh before restoring the active frame', async () => {
  const previous = frame('https://player.example/previous');
  const next = frame('https://player.example/next');
  const { manager, state, calls } = managerWithState(previous);
  for (const name of ['stopHoverTracking', 'clearFullscreenReassertions', 'clearVideoRefreshes', 'clearResizeAnimation']) manager[name] = () => {};
  manager.rememberCurrentPlacement = async () => {};
  manager.restoreSiteView = async () => {};
  manager.restoreMacApplicationPresentation = async () => {};
  let finishRefresh;
  manager.videoRefresh = new Promise((resolve) => { finishRefresh = resolve; });
  const exiting = manager.performExit();
  assert.equal(state.closing, true);
  await Promise.resolve();
  assert.deepEqual(calls, [], 'no viewer/style restoration may race the pending refresh');
  state.frame = next;
  finishRefresh();
  const result = await exiting;
  assert.equal(result.status, 'exited');
  assert.deepEqual(calls, [['dispose'], ['restore', next.url], ['state', 'exited'], ['exited']]);
  assert.equal(manager.state, undefined);
});
