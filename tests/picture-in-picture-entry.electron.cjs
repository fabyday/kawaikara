// Real WebContentsView transfer and the real PiP manager, isolated profile and
// generated canvas video only. Never load the application entry point or sites.
const { app, BrowserWindow, WebContentsView } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-pip-entry-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara PiP Entry Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const filename = path.resolve(__dirname, '../src/Main/Manager/UnifiedPictureInPictureManager.ts');
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded._compile(buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['electron'], minify: process.argv.includes('--minified'),
}).outputFiles[0].text, filename);
const { UnifiedPictureInPictureManager } = loaded.exports;
const { YouTubeProvider } = require('../packages/builtin-sites/dist/Providers/YouTube/Provider.js');
let stage = 'initial video';
const watchdog = setTimeout(() => { console.error(`PiP entry probe timed out: ${stage}`); app.exit(1); }, 30000);

async function main() {
  await app.whenReady();
  const viewer = new BrowserWindow({ show: false, width: 960, height: 540,
    webPreferences: { backgroundThrottling: false } });
  viewer.setContentSize(960, 540);
  const pip = new BrowserWindow({ show: false, width: 320, height: 180,
    webPreferences: { backgroundThrottling: false } });
  pip.setContentSize(320, 180);
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true,
    nodeIntegration: false, backgroundThrottling: false } });
  viewer.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 960, height: 540 });
  viewer.showInactive();
  const execute = source => view.webContents.executeJavaScript(source, true);
  await view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <style>body{margin:0}video{width:100%;height:100%;object-fit:contain}
    .ytp-caption-window-container{position:fixed;inset:0}
    .caption-window{position:absolute;bottom:2px;left:10px;width:120px;height:24px;overflow:hidden}
    .ytp-caption-segment{font:20px/24px sans-serif}</style>
    <video id="video" muted></video><div class="ytp-caption-window-container">
    <div class="caption-window"><span class="ytp-caption-segment">Current cue</span></div></div>
    <div id="unrelated"></div>
  `)}`);
  await execute(`new Promise(resolve => {
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    canvas.getContext('2d').fillRect(0,0,160,90);window.probeStream=canvas.captureStream(5);
    const video=document.getElementById('video');video.srcObject=probeStream;
    video.onloadeddata=()=>video.play().then(resolve);
  })`);
  await execute(`(() => {
    const fragment=document.createDocumentFragment();
    for(let index=0;index<6000;index++) {const node=document.createElement('div');node.textContent='Unrelated page item';fragment.appendChild(node)}
    document.getElementById('unrelated').appendChild(fragment);
    window.documentScans=0;
    const query=Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll=function(selector) {
      if(selector==='*') window.documentScans++;
      return query.call(this,selector);
    };
  })()`);
  const errors = [];
  const manager = new UnifiedPictureInPictureManager(() => viewer, () => view, () => [],
    { getLogger: () => ({ debug() {}, warn() {}, error(...details) { errors.push(details); } }) }, () => {}, () => {});
  manager.findVideoCandidate = async () => ({ status: 'ready', frame: view.webContents.mainFrame, aspectRatio: 16 / 9 });
  manager.enterHostFrames = async () => [];
  manager.restoreHostFrames = async () => {};
  manager.resolveInitialBounds = () => ({ x: 0, y: 0, width: 320, height: 180 });
  manager.createPipWindow = () => pip;
  manager.presentMacPictureInPicture = () => {};
  manager.restoreMacApplicationPresentation = async () => {};
  manager.startHoverTracking = () => {};
  manager.scheduleFullscreenReassertion = () => {};
  // Accessory probe windows may not deliver draw RAFs during teardown. Bound
  // only this test's cleanup wait; assert the real synchronous style restore.
  const restoreVideo = manager.restoreInjectedVideo.bind(manager);
  manager.restoreInjectedVideo = async frame => {
    let timeout;
    await Promise.race([
      restoreVideo(frame),
      new Promise(resolve => { timeout = setTimeout(resolve, 300); }),
    ]);
    clearTimeout(timeout);
  };
  let releaseFactory;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const held = new Promise(resolve => { releaseFactory = resolve; });
  manager.setSubtitleControllerFactory(async session => {
    markStarted();
    await held;
    return new YouTubeProvider({}).createPictureInPictureSubtitleController(session);
  });
  await manager.setSubtitleScale(2);
  stage = 'entry factory';
  const entering = manager.enter();
  await started;
  stage = 'old/new-size geometry before subtitle factory';
  const beforeSubtitles = await execute(`(() => {
    const rect=document.getElementById('video').getBoundingClientRect();
    return {viewportWidth:innerWidth,viewportHeight:innerHeight,videoWidth:rect.width,videoHeight:rect.height};
  })()`);
  const nativeViewBeforeSubtitles = view.getBounds();
  console.log(JSON.stringify({ beforeSubtitles, nativeViewBeforeSubtitles }));
  releaseFactory();
  stage = 'entry completion';
  assert.equal((await entering).status, 'entered');
  stage = 'renderer settle';
  const flush = () => execute(`new Promise(resolve => {
    const timeout=setTimeout(resolve,100);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve()}));
  })`);
  await flush();
  const scansBefore = await execute('window.documentScans');
  for (let index = 0; index < 8; index++) {
    stage = `unrelated mutation ${index}`;
    await execute(`document.getElementById('unrelated').style.color='rgb(${index},0,0)'`);
    await flush();
  }
  const unrelatedScans = await execute('window.documentScans') - scansBefore;
  const geometry = () => execute(`(() => {
    const box=document.querySelector('.caption-window').getBoundingClientRect();
    return {center:box.left+box.width/2,bottom:box.bottom,height:box.height};
  })()`);
  const first = await geometry();
  stage = 'caption update';
  await execute(`document.querySelector('.ytp-caption-segment').textContent='New cue'`);
  await flush();
  const updated = await geometry();
  console.log(JSON.stringify({ beforeSubtitles, nativeViewBeforeSubtitles, unrelatedScans, first, updated }));
  stage = 'exit';
  await manager.exit();
  assert.equal(await execute('Boolean(window.__kawaikaraUnifiedPictureInPicture)'), false);
  assert.equal(await execute(`document.getElementById('video').style.position`), '');
  await execute('probeStream.getTracks().forEach(track=>track.stop())');
  view.webContents.close();
  viewer.destroy();
  if (!pip.isDestroyed()) pip.destroy();
  assert.deepEqual(errors, []);
  assert.equal(nativeViewBeforeSubtitles.width, 320, 'the view must fit PiP before awaiting the Provider');
  assert.equal(nativeViewBeforeSubtitles.height, 180);
  assert.equal(beforeSubtitles.viewportWidth, 320, 'the first new-size renderer frames precede subtitle work');
  assert.equal(beforeSubtitles.videoWidth, 320);
  assert.equal(beforeSubtitles.videoHeight, 180);
  assert.equal(unrelatedScans, 0, 'unrelated page styles must not rescan the entire document for captions');
  assert.ok(Math.abs(first.center - 160) < 1);
  assert.ok(Math.abs(first.bottom - (180 - 180 * 0.08)) < 1);
  assert.equal(first.height, 48);
  assert.deepEqual(updated, first, 'caption updates retain the new-size geometry');
  console.log('PASS: Real native view and video fit before slow subtitle initialization; unrelated page mutations do not trigger whole-page scans; caption geometry and exit restoration remain valid.');
}

main().then(() => { clearTimeout(watchdog); app.exit(0); }).catch(error => {
  console.error(error); clearTimeout(watchdog); app.exit(1);
});
