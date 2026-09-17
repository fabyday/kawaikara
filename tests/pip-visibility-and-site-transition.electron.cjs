// Real Chromium/native-view regression probe, with generated video, loopback
// resources, and a fresh profile only. Never import the app entry or real sites.
const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-transitions-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara Transition Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const minify = process.argv.includes('--minified');
let stage = 'setup';
const watchdog = setTimeout(() => { console.error(`Transition probe timed out: ${stage}`); app.exit(1); }, 35000);
const logger = { debug() {}, warn() {}, error() {} };
function loadSource(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const loaded = new Module(filename, module); loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(loaded, id);
  loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', minify, external: ['electron', ...Object.keys(mocks)],
    define: { __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null' },
  }).outputFiles[0].text, filename);
  return loaded.exports;
}
const { WindowManager } = loadSource('src/Main/Manager/WindowManager.ts', { 'electron-mpv-video': {} });
const { createSiteTransitionSurfaceHtml, createUpdateSiteTransitionSurfaceScript } = loadSource('src/Main/Inject/SiteTransitionSurface.ts');
const { prepareCurrentDocumentForNavigation } = loadSource('src/Main/Functional/WindowOperations.ts');
const { trackPictureInPictureVisibility } = loadSource('src/Main/Functional/PictureInPictureVisibility.ts');
const { createEnterUnifiedPictureInPictureScript } = loadSource('src/Main/Inject/UnifiedPictureInPicturePage.ts');
const { createSetPictureInPictureControlsVisibleScript } = loadSource('src/Main/Inject/PictureInPictureControls.ts');
const preferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false };
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function evaluate(contents, expression) {
  if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
  const result = await contents.debugger.sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.text);
  return result.result.value;
}
async function forceHover(contents, expression) {
  await contents.debugger.sendCommand('DOM.enable');
  await contents.debugger.sendCommand('CSS.enable');
  await contents.debugger.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
  const { result } = await contents.debugger.sendCommand('Runtime.evaluate', { expression });
  const { nodeId } = await contents.debugger.sendCommand('DOM.requestNode', { objectId: result.objectId });
  assert.ok(nodeId > 0, `missing forced-hover fixture node: ${expression}`);
  await contents.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover', 'focus-visible'] });
}

async function main() {
  await app.whenReady();
  const viewer = new BrowserWindow({ show: false, width: 640, height: 400, webPreferences: preferences });
  viewer.showInactive();
  await viewer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(createSiteTransitionSurfaceHtml('dark')));
  const manager = Object.assign(Object.create(WindowManager.prototype), {
    viewerWindow: viewer, logger, appLocale: 'ko', systemLocale: 'en', appTheme: 'dark',
    siteTransitionSurfaceReady: Promise.resolve(true), siteTransitionSurfaceRevision: 0,
    editingWebContentsIds: new Set(), pictureInPicture: { isActive: () => false },
  });
  manager.installRemoteThemeBridge = () => {};
  stage = 'failure-only locale-backed native backing surface';
  for (const language of ['ko', 'en', 'ja']) {
    const messages = require(path.join(root, `locales/${language}.json`)).app;
    await viewer.webContents.executeJavaScript(createUpdateSiteTransitionSurfaceScript(
      { siteId: 'probe', title: 'Fixture site', phase: 'loading' }, messages, language, 'light'));
    const loading = await evaluate(viewer.webContents, `({title:document.getElementById('title').textContent,
      active:document.documentElement.dataset.active,hidden:document.getElementById('transition').getAttribute('aria-hidden'),
      display:getComputedStyle(document.getElementById('transition')).display,spinner:!!document.querySelector('.spinner'),
      theme:document.documentElement.dataset.theme,
      background:getComputedStyle(document.body).backgroundColor,lang:document.documentElement.lang})`);
    assert.equal(loading.title, ''); assert.equal(loading.active, 'false'); assert.equal(loading.hidden, 'true');
    assert.equal(loading.display, 'none'); assert.equal(loading.spinner, false);
    assert.equal(loading.theme, 'light'); assert.equal(loading.lang, language);
    assert.equal(loading.background, 'rgb(244, 244, 245)');
    const error = '<img src="bad" onerror="window.untrusted=true">';
    await viewer.webContents.executeJavaScript(createUpdateSiteTransitionSurfaceScript(
      { siteId: 'probe', title: 'Fixture site', phase: 'failed', error }, messages, language, 'dark'));
    const failed = await evaluate(viewer.webContents, `({error:document.getElementById('description').textContent,
      title:document.getElementById('title').textContent,active:document.documentElement.dataset.active,
      display:getComputedStyle(document.getElementById('transition')).display,
      role:document.getElementById('transition').getAttribute('role'),images:document.images.length,
      recovery:document.getElementById('recovery').hidden})`);
    assert.equal(failed.error, error); assert.equal(failed.role, 'alert'); assert.equal(failed.images, 0);
    assert.equal(failed.title, messages.siteTransitionFailed); assert.equal(failed.active, 'true');
    assert.notEqual(failed.display, 'none'); assert.equal(failed.recovery, false);
    await viewer.webContents.executeJavaScript(createUpdateSiteTransitionSurfaceScript(
      { siteId: 'probe', title: 'Fixture site', phase: 'loading' }, messages, language, 'dark'));
    const retry = await evaluate(viewer.webContents, `({active:document.documentElement.dataset.active,
      display:getComputedStyle(document.getElementById('transition')).display,
      text:document.getElementById('transition').textContent.trim()})`);
    assert.equal(retry.active, 'false'); assert.equal(retry.display, 'none'); assert.equal(retry.text, '');
  }
  manager.notifySiteTransition({ siteId: 'next', title: 'Fixture next site', phase: 'loading' });
  await wait(30);
  assert.equal(await evaluate(viewer.webContents, 'document.documentElement.dataset.active'), 'false');
  writeFileSync(path.join(profile, 'viewer-idle-before-dom.png'), (await viewer.webContents.capturePage()).toPNG());

  stage = 'real DOM-ready while image loading remains stalled';
  let imageRequested, heldImage;
  const requested = new Promise(resolve => { imageRequested = resolve; });
  const server = http.createServer((request, response) => {
    if (request.url === '/held.png') { heldImage = response; imageRequested(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><style>body{background:#eedcff;color:#24152f;font:24px system-ui}</style>' +
      '<h1 id="loaded">DOM-ready fixture site</h1><img src="/held.png">');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const view = new WebContentsView({ webPreferences: preferences });
  viewer.contentView.addChildView(view); view.setBounds({ x: 0, y: 0, width: 640, height: 400 }); view.setVisible(false);
  manager.siteView = view; manager.siteViewAttached = true; manager.siteViewSiteId = 'next';
  manager.attachSiteWebContents(view.webContents, view.webContents.session);
  let loadSettled = false;
  const ready = new Promise(resolve => view.webContents.once('dom-ready', resolve));
  const start = performance.now();
  const loading = view.webContents.loadURL(url).then(() => { loadSettled = true; }, () => { loadSettled = true; });
  await ready; await requested;
  const domReadyMs = performance.now() - start;
  assert.equal(view.getVisible(), true, 'actual WindowManager DOM-ready handler reveals the native view');
  assert.equal(loadSettled, false, 'the old did-finish-load gate is still waiting on the image');
  assert.equal(view.webContents.isLoading(), true);
  assert.equal(await evaluate(view.webContents, 'document.getElementById("loaded").textContent'), 'DOM-ready fixture site');
  await wait(250);
  assert.equal(loadSettled, false); assert.equal(view.getVisible(), true);
  writeFileSync(path.join(profile, 'site-before-subresources-finish.png'), (await view.webContents.capturePage()).toPNG());
  stage = 'switch away from stalled outgoing resources';
  const cleanupStart = performance.now(); await prepareCurrentDocumentForNavigation(view.webContents);
  const outgoingCleanupMs = performance.now() - cleanupStart;
  assert.ok(outgoingCleanupMs < 650, `stalled old network delayed cleanup ${outgoingCleanupMs}ms`);
  await loading;
  heldImage.end(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  manager.notifySiteTransition({ siteId: 'next', title: 'Fixture next site', phase: 'ready' });
  await wait(30);
  assert.equal(await evaluate(viewer.webContents, 'document.documentElement.dataset.active'), 'false');
  viewer.contentView.removeChildView(view); view.webContents.close(); manager.siteView = undefined;

  stage = 'real VideoView React state and CSS sticky hover';
  const fixture = buildSync({ stdin: { loader: 'jsx', resolveDir: root, contents: `
    import { createRoot } from 'react-dom/client';
    import { VideoView } from './src/Renderer/View/Video/App';
    import en from './locales/en.json';
    window.errors=[];window.addEventListener('error',event=>window.errors.push(event.message));
    window.addEventListener('unhandledrejection',event=>window.errors.push(String(event.reason)));
    window.kawaikaraVideo={
      application:{getMessages:async()=>({...en,locale:'en'}),isFullScreen:async()=>false,
        notifyPlaybackRendererReady(){},onFullScreenChanged:()=>()=>{},
        onPictureInPictureChanged:callback=>{window.pipChanged=callback;return()=>{}},
        onPictureInPicturePointerChanged:callback=>{window.pointerChanged=callback;return()=>{}},
        onVisibilityChanged:()=>()=>{},onPlaybackToggleRequested:()=>()=>{},
        onDirectoryNavigationRequested:()=>()=>{},togglePictureInPicture:async()=>{}},
      source:{getPlaybackCapabilities:async()=>({nativeBackendAvailable:false,platform:'probe',arch:'probe',
        electronGpuAccelerationEnabled:false,hardwareAccelerationDisabled:true,nativeRenderMode:'software'}),
        getOpenRequest:async()=>({kind:'local',path:'/fixture/generated.webm',displayName:'Generated video',url:'probe:generated'}),
        onOpenRequest:()=>()=>{}},
      preferences:{get:async()=>({appTheme:'dark',shortcuts:{},videoControlsLayout:'overlay',
        videoOverlayHideSeconds:0.1,videoSeekSeconds:10,videoVolume:0}),setVideoVolume:async value=>value},
      presentation:{update(){}},videoLibrary:{getSnapshot:async()=>({locations:[],favoriteFolders:[],recentFolders:[],recentVideos:[]})}
    };
    window.renderVideo=()=>createRoot(document.getElementById('root')).render(<VideoView/>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', minify, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
  const fixturePath = path.join(profile, 'video.html');
  writeFileSync(path.join(profile, 'fixture.js'), fixture);
  writeFileSync(fixturePath, '<!doctype html><style>' + readFileSync(path.join(root, 'src/Renderer/Styles/Video.css'), 'utf8') +
    '</style><div id="root"></div><script src="./fixture.js"></script>');
  const video = new BrowserWindow({ show: false, width: 320, height: 180, frame: false, webPreferences: preferences });
  video.webContents.on('console-message', event => {
    if (event.level === 'error') console.error('Video fixture console:', event.message);
  });
  video.showInactive(); await video.loadFile(fixturePath);
  assert.equal(await evaluate(video.webContents, 'typeof window.renderVideo'), 'function');
  stage = 'generated canvas source adapter';
  // Adapt the fixture's local URL to an in-memory stream: no codec encoder,
  // network fetch, mpv initialization, or real filesystem media is required.
  await evaluate(video.webContents, `(()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    const context=canvas.getContext('2d');context.fillStyle='#776688';context.fillRect(0,0,160,90);
    window.stream=canvas.captureStream(10);
    window.paintTimer=setInterval(()=>context.fillRect(0,0,160,90),40);
    const source=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
    Object.defineProperty(HTMLVideoElement.prototype,'src',{configurable:true,get(){return source.get.call(this)},
      set(value){if(value==='probe:generated')this.srcObject=window.stream;else source.set.call(this,value)}});
    renderVideo();return true;
  })()`);
  stage = 'actual Video React mount';
  await evaluate(video.webContents, `new Promise((resolve,reject)=>{
    const started=performance.now();const timer=setInterval(()=>{
      if(document.querySelector('.video-shell[data-has-source="true"]')){clearInterval(timer);resolve()}
      else if(performance.now()-started>3000){clearInterval(timer);reject(new Error('Video source not ready'))}
    },20);
  })`);
  stage = 'native PiP pointer and forced hover';
  await evaluate(video.webContents, 'pipChanged(true)'); await wait(60);
  assert.equal(await evaluate(video.webContents, 'document.querySelector(".video-shell").dataset.controlsVisible'), 'false');
  await forceHover(video.webContents, 'document.querySelector(".video-pip-overlay")');
  await forceHover(video.webContents, 'document.querySelector(".video-pip-playback-button")');
  let point = { x: -10000, y: -10000 };
  const tracker = trackPictureInPictureVisibility(video, () => point, () => true,
    visible => { void evaluate(video.webContents, `pointerChanged(${visible})`); });
  const opacity = () => evaluate(video.webContents, 'getComputedStyle(document.querySelector(".video-pip-playback-button")).opacity');
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      const bounds = video.getBounds(); point = { x: bounds.x + 100, y: bounds.y + 100 }; tracker.sync();
      await wait(230); assert.equal(await opacity(), '1');
      point = { x: -10000, y: -10000 }; tracker.sync();
      // Lingering page pointer events must not defeat the native outside state.
      await evaluate(video.webContents, 'document.querySelector(".video-interaction-surface").dispatchEvent(new PointerEvent("pointermove",{bubbles:true}))');
      await wait(230); assert.equal(await opacity(), '0');
      assert.equal(await evaluate(video.webContents, 'document.querySelector(".video-shell").dataset.controlsVisible'), 'false');
    }
  } finally { tracker.dispose(); }
  assert.deepEqual(await evaluate(video.webContents, 'window.errors'), []);
  await evaluate(video.webContents, 'clearInterval(paintTimer);stream.getTracks().forEach(track=>track.stop())');

  stage = 'Provider overlay empty attribute and forced sticky hover';
  const remote = new BrowserWindow({ show: false, width: 320, height: 180, frame: false, webPreferences: preferences });
  remote.showInactive(); await remote.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<style>body{margin:0}video{width:100%;height:100%}</style><video muted></video>'));
  await evaluate(remote.webContents, `new Promise(resolve=>{
    const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){
      const shadow=original.call(this,options);if(options.mode==='closed')window.overlayShadow=shadow;return shadow};
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    canvas.getContext('2d').fillRect(0,0,160,90);window.stream=canvas.captureStream(5);
    const video=document.querySelector('video');video.srcObject=stream;video.onloadeddata=()=>video.play().then(resolve);
  })`);
  const entered = await remote.webContents.executeJavaScript(createEnterUnifiedPictureInPictureScript({
    contentOverlaySelectors: [], playbackButtonSize: 44, playbackMessage: 'probe-play',
    restoreMessage: 'probe-restore', videoSizeMessage: 'probe-size:',
  }));
  assert.equal(entered.status, 'entered');
  await evaluate(remote.webContents, 'true');
  await forceHover(remote.webContents, 'window.__kawaikaraUnifiedPictureInPicture.overlay');
  await forceHover(remote.webContents, 'window.overlayShadow.querySelector(".playback-button")');
  await remote.webContents.executeJavaScript(createSetPictureInPictureControlsVisibleScript(true)); await wait(230);
  assert.equal(await evaluate(remote.webContents, 'window.__kawaikaraUnifiedPictureInPicture.overlay.getAttribute("data-controls-visible")'), '');
  assert.equal(await evaluate(remote.webContents, 'getComputedStyle(overlayShadow.querySelector(".playback-button")).opacity'), '1');
  await remote.webContents.executeJavaScript(createSetPictureInPictureControlsVisibleScript(false)); await wait(230);
  assert.equal(await evaluate(remote.webContents, 'getComputedStyle(overlayShadow.querySelector(".playback-button")).opacity'), '0');
  await evaluate(remote.webContents, 'stream.getTracks().forEach(track=>track.stop())');
  remote.destroy(); video.destroy(); viewer.destroy(); clearTimeout(watchdog);
  console.log(JSON.stringify({ passed: true, minified: minify, domReadyMs, outgoingCleanupMs, profile }));
  app.exit(0);
}
main().catch(error => { console.error(`Transition probe failed at ${stage}:`, error); clearTimeout(watchdog); app.exit(1); });
