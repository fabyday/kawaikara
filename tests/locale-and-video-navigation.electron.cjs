// Isolated actual React/CSS probe. All library paths and updater notes are
// fixtures: no installed app, real videos, browser profiles, or release requests.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-locale-navigation-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara Locale and Video Navigation Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
let stage = 'fixture setup';
const watchdog = setTimeout(() => {
  console.error(`Locale/navigation probe timed out: ${stage}`); app.exit(1);
}, 30000);

const fixture = buildSync({ stdin: { loader: 'jsx', resolveDir: root, contents: `
  import { createRoot } from 'react-dom/client';
  import { flushSync } from 'react-dom';
  import { KawaiProvider } from '@kawaikara/kawai-ui';
  import { VideoBrowser } from './src/Renderer/View/Video/VideoBrowser';
  import { UpdatePanel } from './src/Renderer/View/Update/UpdatePanel';
  import { normalizeReleaseNotes } from './src/Main/Functional/ApplicationUpdates';
  import { subscribeDirectoryNavigation } from './src/Preload/VideoDirectoryNavigation';
  import en from './locales/en.json';
  import ko from './locales/ko.json';
  const root = createRoot(document.getElementById('root'));
  window.probePlatform = 'darwin';
  window.failedFolders = new Set();
  window.heldFolders = new Map();
  window.listCalls = [];
  window.nativeSubscriptions = 0;
  window.openedVideos = [];
  window.trustedSideButtons = [];
  window.addEventListener('mouseup', event => {
    if ((event.button === 3 || event.button === 4) && event.isTrusted) {
      window.trustedSideButtons.push(event.button);
    }
  }, true);
  const entry = (path) => ({ path, name: path.split('/').pop(), kind: 'directory' });
  const directories = {
    '/A': ['/A/B', '/A/D'], '/A/B': ['/A/B/C'], '/A/B/C': [], '/A/D': [],
  };
  const snapshot = { locations: [{ kind: 'drive', name: 'A', path: '/A' }],
    favoriteFolders: [], recentFolders: [], recentVideos: [] };
  async function listDirectory(directory) {
    window.listCalls.push(directory);
    if (window.heldFolders.has(directory)) {
      await new Promise(resolve => window.heldFolders.set(directory, resolve));
    }
    if (window.failedFolders.has(directory)) throw new Error('Unavailable fixture folder');
    if (!(directory in directories)) throw new Error('Unknown fixture path');
    return { directory, displayName: directory.split('/').pop(),
      parent: directory === '/A' ? undefined : directory.slice(0, directory.lastIndexOf('/')),
      entries: directories[directory].map(entry) };
  }
  window.kawaikaraVideo = {
    application: { onDirectoryNavigationRequested: handler => subscribeDirectoryNavigation(
      handler, window.probePlatform, callback => {
        window.nativeNavigation = callback; window.nativeSubscriptions++;
        return () => { window.nativeNavigation = undefined; window.nativeSubscriptions--; };
      }) },
    videoLibrary: {
      getSnapshot: async () => snapshot,
      listDirectory,
      openPath: async path => ({ kind: 'directory', listing: await listDirectory(path) }),
      searchDirectory: async () => new Promise(resolve => { window.resolveSearch = resolve; }),
      getThumbnail: async () => undefined,
    },
  };
  window.renderBrowser = (theme = 'dark', language = 'en', key = 'browser') => {
    const messages = language === 'ko' ? ko : en;
    flushSync(() => root.render(<KawaiProvider>
      <main className={'video-shell kawai-theme kawai-theme-' + theme}>
        <VideoBrowser key={key} labels={messages.videoBrowser} theme={theme}
          canClose={false} backendLabel="Chromium fixture" onClose={() => {}}
          onOpenHls={() => {}} onSelectFile={async () => null}
          onOpenVideo={request => window.openedVideos.push(request)} />
      </main>
    </KawaiProvider>));
  };
  window.setInput = (selector, value) => {
    const input = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.openAddress = path => {
    window.setInput('.video-browser-address input', path);
    document.querySelector('.video-browser-address').requestSubmit();
  };
  window.sideButton = button => {
    const events = ['mousedown', 'mouseup', 'auxclick'].map(type => {
      const event = new MouseEvent(type, { button, bubbles: true, cancelable: true });
      document.querySelector('.video-browser-header').dispatchEvent(event);
      return event.defaultPrevented;
    });
    return events;
  };
  const html = '<h2>English</h2><h3>Version</h3><ul><li>English change</li></ul>' +
    '<h2>한국어</h2><h3>버전</h3><ul><li>한국어 변경</li></ul>' +
    '<h2>Build metadata</h2><p>Secret fixture metadata</p>';
  window.renderNotes = locale => flushSync(() => root.render(<KawaiProvider>
    <div className="kawai-theme kawai-theme-dark">
      <UpdatePanel locale={locale} initialView="release-notes" state={{ phase: 'available',
        origin: 'manual', channel: 'nightly', currentVersion: '3.0.0', latestVersion: '3.0.1',
        releaseNotes: normalizeReleaseNotes(html) }}
        onDismiss={() => {}} onDownload={() => {}} onInstall={() => {}} onRetry={() => {}} />
    </div>
  </KawaiProvider>));
  window.clearProbe = () => flushSync(() => root.render(null));
  window.renderBrowser();
` }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
  minify: process.argv.includes('--minified'), loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

const css = [readFileSync(require.resolve('@kawaikara/kawai-ui/styles.css'), 'utf8'),
  readFileSync(path.join(root, 'src/Renderer/Styles/Overlay.css'), 'utf8'),
  readFileSync(path.join(root, 'src/Renderer/Styles/Update.css'), 'utf8'),
  readFileSync(path.join(root, 'src/Renderer/Styles/Video.css'), 'utf8')].join('\n');

async function main() {
  await app.whenReady();
  const parent = new BrowserWindow({ width: 960, height: 540, show: false });
  parent.setContentSize(960, 540);
  const win = new BrowserWindow({ parent, ...parent.getContentBounds(), frame: false,
    roundedCorners: false, show: false, webPreferences: { sandbox: true,
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
    '<style>' + css + '</style><div id="root"></div>',
  )}`);
  const execute = source => win.webContents.executeJavaScript(source, true);
  await execute(fixture);
  const settle = async predicate => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await execute(predicate)) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`Not settled at ${stage}: ${predicate}`);
  };
  const at = directory => settle(`document.querySelector('.video-browser-address input')?.value === ${JSON.stringify(directory ?? '')} && !document.querySelector('.video-browser-loading')`);
  const clickFolder = directory => execute(`document.querySelector('button[title=${JSON.stringify(directory)}]').click()`);
  const address = directory => execute(`window.openAddress(${JSON.stringify(directory)})`);
  const native = direction => execute(`window.nativeNavigation(${JSON.stringify(direction)})`);
  await at(undefined);
  const originalLocation = await execute('({ url: location.href, history: history.length })');

  stage = 'Mac mouse folder history';
  await execute(`document.querySelector('.video-browser-location-grid button').click()`);
  await at('/A');
  await clickFolder('/A/B'); await at('/A/B');
  await clickFolder('/A/B/C'); await at('/A/B/C');
  assert.deepEqual(await execute('window.sideButton(3)'), [true, true, true]);
  await at('/A/B');
  assert.deepEqual(await execute('window.sideButton(4)'), [true, true, true]);
  await at('/A/B/C');
  // Browser-level injection produces trusted Chromium mouse events, unlike
  // dispatchEvent. This exercises the same DOM path as physical side buttons.
  const debuggerClient = win.webContents.debugger;
  debuggerClient.attach('1.3');
  for (const [button, directory] of [['back', '/A/B'], ['forward', '/A/B/C']]) {
    await debuggerClient.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: 20, y: 150, button, clickCount: 1,
    });
    await debuggerClient.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: 20, y: 150, button, clickCount: 1,
    });
    await at(directory);
  }
  assert.deepEqual(await execute('window.trustedSideButtons'), [3, 4]);
  // Several physical presses in the same task must not all target the same
  // not-yet-committed cursor while directory IPC is still in flight.
  await execute('window.sideButton(3); window.sideButton(3); window.sideButton(3)');
  await at(undefined);
  await execute('window.sideButton(4); window.sideButton(4); window.sideButton(4)');
  await at('/A/B/C');

  stage = 'Failed history destinations and retry';
  await execute(`window.failedFolders.add('/A/B'); window.sideButton(3)`);
  await settle(`Boolean(document.querySelector('[role="alert"]')) && !document.querySelector('.video-browser-loading')`);
  await at('/A/B/C');
  await execute(`window.failedFolders.delete('/A/B'); window.sideButton(3)`);
  await at('/A/B');
  await execute('window.sideButton(3)'); await at('/A');
  await clickFolder('/A/D'); await at('/A/D');
  await execute('window.sideButton(4)'); await at('/A/D');

  stage = 'Home and locale-change history preservation';
  await execute(`document.querySelector('button[aria-label="Home"]').click()`);
  await at(undefined);
  await execute(`window.renderBrowser('light', 'ko')`); await at(undefined);
  await execute('window.sideButton(3)'); await at('/A/D');
  await execute('window.sideButton(4)'); await at(undefined);

  stage = 'Windows/Linux command and mouse-event deduplication';
  for (const platform of ['win32', 'linux']) {
    await execute(`window.probePlatform=${JSON.stringify(platform)}; window.renderBrowser('dark', 'en', ${JSON.stringify(platform)})`);
    await at(undefined);
    await address('/A'); await at('/A');
    await address('/A/B'); await at('/A/B');
    await address('/A/B/C'); await at('/A/B/C');
    await native('back'); await at('/A/B');
    assert.deepEqual(await execute('window.sideButton(3)'), [true, true, true]);
    await at('/A/B');
    await native('forward'); await at('/A/B/C');
    await execute('window.sideButton(4)'); await at('/A/B/C');
  }

  stage = 'Out-of-order directories and searches';
  await address('/A'); await at('/A');
  await execute(`window.heldFolders.set('/A/B', true); window.openAddress('/A/B')`);
  await settle(`typeof window.heldFolders.get('/A/B') === 'function'`);
  await address('/A/D'); await at('/A/D');
  await execute(`window.heldFolders.get('/A/B')(); window.heldFolders.delete('/A/B')`);
  await at('/A/D');
  await execute(`window.setInput('.video-browser-search input', 'old'); document.querySelector('.video-browser-search').requestSubmit()`);
  await settle(`typeof window.resolveSearch === 'function'`);
  await address('/A'); await at('/A');
  await execute(`window.resolveSearch([{ kind: 'directory', name: 'STALE RESULT', path: '/STALE' }])`);
  await at('/A');
  assert.ok(!(await execute('document.body.innerText')).includes('STALE RESULT'));
  // A hung history destination must not hold subsequent history navigation
  // hostage after the user chooses another address. Its late response is inert.
  await address('/A/B'); await at('/A/B');
  await address('/A/B/C'); await at('/A/B/C');
  await execute(`window.heldFolders.set('/A/B', true); window.nativeNavigation('back')`);
  await settle(`typeof window.heldFolders.get('/A/B') === 'function'`);
  await address('/A/D'); await at('/A/D');
  await native('back'); await at('/A/B/C');
  await execute(`window.heldFolders.get('/A/B')(); window.heldFolders.delete('/A/B')`);
  await at('/A/B/C');
  assert.deepEqual(await execute('({ url: location.href, history: history.length })'), originalLocation);

  stage = 'Edge-to-edge native host and real CSS in both themes';
  for (const width of [320, 640, 960]) {
    parent.setContentSize(width, 540);
    win.setBounds(parent.getContentBounds(), false);
    assert.deepEqual(win.getBounds(), parent.getContentBounds());
    for (const theme of ['light', 'dark']) {
      await execute(`window.renderBrowser(${JSON.stringify(theme)}, 'en', 'linux')`);
      const bounds = await execute(`(() => {
        const surface=document.querySelector('.video-browser-surface');
        const rect=surface.getBoundingClientRect(), css=getComputedStyle(surface);
        return { left:rect.left, top:rect.top, width:rect.width, height:rect.height,
          radius:css.borderTopLeftRadius, border:css.borderTopWidth, shadow:css.boxShadow,
          viewportWidth:innerWidth, viewportHeight:innerHeight };
      })()`);
      assert.equal(bounds.left, 0); assert.equal(bounds.top, 0);
      assert.equal(bounds.width, bounds.viewportWidth); assert.equal(bounds.height, bounds.viewportHeight);
      assert.equal(bounds.radius, '0px'); assert.equal(bounds.border, '0px'); assert.equal(bounds.shadow, 'none');
    }
  }
  // Capture only this fixture renderer, with the real shipped styles.
  parent.showInactive(); win.showInactive();
  await execute('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const screenshot = path.join(profile, 'video-library-edge-to-edge.png');
  writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
  console.log(`Visual fixture: ${screenshot}`);
  await execute(`window.renderBrowser('light', 'en', 'linux')`);
  await execute('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const lightScreenshot = path.join(profile, 'video-library-edge-to-edge-light.png');
  writeFileSync(lightScreenshot, (await win.webContents.capturePage()).toPNG());
  console.log(`Visual fixture: ${lightScreenshot}`);

  stage = 'Actual update notes UI and navigation cleanup';
  for (const [locale, expected, forbidden] of [['ko-KR', '한국어 변경', 'English change'],
    ['en-US', 'English change', '한국어 변경'], ['ja-JP', 'English change', '한국어 변경']]) {
    await execute(`window.renderNotes(${JSON.stringify(locale)})`);
    const text = await execute(`document.querySelector('.update-release-notes-copy').innerText`);
    assert.ok(text.includes(expected)); assert.ok(!text.includes(forbidden));
    assert.ok(!text.includes('Secret fixture metadata'));
    assert.equal(await execute('window.nativeSubscriptions'), 0);
    assert.equal(await execute('typeof window.nativeNavigation'), 'undefined');
  }
  await execute('window.clearProbe()');
  const afterCleanup = await execute(`(() => {
    const event=new MouseEvent('mouseup', {button:3, cancelable:true});
    window.dispatchEvent(event);return event.defaultPrevented;
  })()`);
  assert.equal(afterCleanup, false, 'mouse interception is removed when the browser unmounts');
  console.log('PASS: Locale-only notes, English fallback, folder history/Home/retry/branching, platform command deduplication, stale-response guards, listener cleanup, and edge-to-edge native host/CSS in both themes.');
}
main().then(() => { clearTimeout(watchdog); app.exit(0); }).catch(error => {
  console.error(`Stage: ${stage}`, error); clearTimeout(watchdog); app.exit(1);
});
