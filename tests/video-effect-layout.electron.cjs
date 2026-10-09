// Real DOM and video frame callbacks with a lightweight effect engine.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { buildSync } = require('esbuild');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-effect-layout-')));
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
const code = buildSync({ entryPoints: [path.resolve(__dirname, '../src/Main/Inject/VideoEffect.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'EffectHost' }).outputFiles[0].text;
const timeout = setTimeout(() => { console.error('Effect layout timed out'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 600,
    webPreferences: { backgroundThrottling: false, contextIsolation: true } });
  const fixture = path.join(app.getPath('userData'), 'fixture.html');
  fs.writeFileSync(fixture, '<main style="position:relative;width:640px;height:360px"><video autoplay muted style="width:100%;height:100%"></video></main>');
  await win.loadFile(fixture);
  win.showInactive();
  await win.webContents.executeJavaScript(code);
  const result = await win.webContents.executeJavaScript(`(async () => {
    const source = document.createElement('canvas'); source.width = 64; source.height = 36;
    const ctx = source.getContext('2d'), video = document.querySelector('video');
    let tick = 0, disposed = false;
    const draw = setInterval(() => { ctx.fillStyle = 'rgb(' + tick++ % 255 + ',80,160)'; ctx.fillRect(0,0,64,36); }, 30);
    video.srcObject = source.captureStream(30); await video.play();
    await new Promise(resolve => video.requestVideoFrameCallback(resolve));
    const mutations = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(document.querySelector('main'), { subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    EffectHost.installVideoEffect('layout', () => video, async (v,c) => {
      c.width = 64; c.height = 36; const draw = c.getContext('2d');
      return { async render() { draw.drawImage(v,0,0,64,36); }, dispose() { disposed = true; } };
    });
    const wait = () => new Promise(resolve => setTimeout(resolve, 250));
    for (let i=0;i<20 && window.__kawaikaraEffectStatus.get('layout').presentedFrames < 10;i++) await wait();
    const output = document.querySelector('[data-kawaikara-video-effect]');
    if (!output) throw Error(JSON.stringify(window.__kawaikaraEffectStatus.get('layout')));
    const status = {...window.__kawaikaraEffectStatus.get('layout')};
    const styleWrites = mutations.filter(x => x.target === output && x.attributeName === 'style').length;
    const hiddenWrites = mutations.filter(x => x.target === output && x.attributeName === 'hidden').length;
    const before = output.getBoundingClientRect().width;
    document.querySelector('main').style.width = '480px'; await wait();
    const resized = output.getBoundingClientRect().width;
    document.querySelector('main').style.transform = 'translateX(17px)'; await wait();
    const aligned = Math.abs(output.getBoundingClientRect().left - video.getBoundingClientRect().left) < .1;
    video.pause(); await wait();
    document.querySelector('main').style.width = '320px'; await wait();
    const pausedWidth = output.getBoundingClientRect().width;
    window.__kawaikaraEffects.get('layout')(); await wait();
    observer.disconnect(); clearInterval(draw); video.srcObject.getTracks().forEach(t => t.stop());
    return { status, styleWrites, hiddenWrites, before, resized, aligned, pausedWidth, disposed,
      remaining: document.querySelectorAll('[data-kawaikara-video-effect]').length };
  })()`);
  console.log(JSON.stringify(result));
  assert.ok(result.status.presentedFrames >= 10);
  assert.equal(result.styleWrites, 1, 'Stable frames must not rewrite CSS');
  assert.ok(result.hiddenWrites <= 2, 'Stable frames must not rewrite visibility');
  assert.equal(result.before, 640); assert.equal(result.resized, 480);
  assert.equal(result.pausedWidth, 320); assert.equal(result.aligned, true);
  assert.equal(result.disposed, true); assert.equal(result.remaining, 0);
  clearTimeout(timeout); win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
