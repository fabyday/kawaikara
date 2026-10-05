// Real DOM/preload feedback probe; never opens user videos or an app profile.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-video-drop-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
const preload = path.join(profile, 'preload.cjs');
buildSync({ stdin: { resolveDir: root, contents:
  "import { installDragDropTarget } from './src/Preload/DragDrop'; installDragDropTarget();" },
  bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: preload });
let messageRequests = 0;
ipcMain.handle('kawaikara:application:messages', () => {
  messageRequests++;
  return { video: require('../locales/ko.json').video };
});
const watchdog = setTimeout(() => { console.error('Video drop DOM probe timed out'); app.exit(1); }, 20000);
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 960, height: 600,
    webPreferences: { preload, contextIsolation: true, sandbox: false, offscreen: true, backgroundThrottling: false } });
  await window.loadURL('data:text/html,<main style="height:100vh">Video drop fixture</main>');
  const result = await window.webContents.executeJavaScript(`(async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['fixture'], 'clip.mp4', { type:'video/mp4' }));
    const fire = name => window.dispatchEvent(new DragEvent(name, { dataTransfer, bubbles:true, cancelable:true }));
    const wait = () => new Promise(resolve => setTimeout(resolve, 200));
    fire('dragenter');
    for (let i=0; i<200; i++) fire('dragover');
    await wait();
    const host = document.querySelector('kawaikara-video-drop');
    const shown = getComputedStyle(host).opacity;
    const pointerEvents = getComputedStyle(host).pointerEvents;
    const bounds = host.getBoundingClientRect().toJSON();
    fire('dragenter'); fire('dragleave');
    const nestedVisible = host.hasAttribute('data-visible');
    fire('dragleave'); await wait();
    const hidden = getComputedStyle(host).opacity;
    fire('dragenter'); await wait();
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    await wait();
    return { shown, hidden, pointerEvents, bounds, nestedVisible,
      canceled: getComputedStyle(host).opacity, count:document.querySelectorAll('kawaikara-video-drop').length,
      hitTarget:document.elementFromPoint(100,100).tagName };
  })()`);
  assert.equal(result.shown, '1');
  assert.equal(result.hidden, '0');
  assert.equal(result.canceled, '0');
  assert.equal(result.pointerEvents, 'none');
  assert.equal(result.nestedVisible, true);
  assert.equal(result.count, 1);
  assert.equal(result.bounds.x, 0);
  assert.equal(result.bounds.y, 0);
  assert.ok(result.bounds.width > 900);
  assert.notEqual(result.hitTarget, 'KAWAIKARA-VIDEO-DROP');
  assert.equal(messageRequests, 2);
  console.log('Video drop DOM/preload probe passed', result);
  window.destroy();
  clearTimeout(watchdog);
  app.exit(0);
}).catch(error => { console.error(error); clearTimeout(watchdog); app.exit(1); });
