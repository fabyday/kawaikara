// Exercises real View composition with the existing in-memory Storybook bridge.
// Never starts Main, reads user logs, changes preferences or opens real sites.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-view-composition-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
let stage = 'setup';
const watchdog = setTimeout(() => {
  console.error(`Renderer View probe timed out: ${stage}`);
  app.exit(1);
}, 30000);
const fixture = buildSync({ stdin: { loader: 'jsx', resolveDir: root, contents: `
  import { createRoot } from 'react-dom/client';
  import { flushSync } from 'react-dom';
  import { App } from './src/Renderer/View/Menu/App';
  import { YouTubeDownloaderPanel } from './src/Renderer/View/Video/YouTubeDownloaderPanel';
  import { getRendererMessages } from './src/Main/Functional/RendererMessages';
  import { installKawaikaraMock, STORY_MESSAGES } from './stories/Mocks/KawaikaraMock';
  const api = installKawaikaraMock({ logFileCount: 48 });
  window.labels = STORY_MESSAGES;
  window.probe = { subscriptions: 0, errors: [], reads: [] };
  window.addEventListener('error', e => window.probe.errors.push(e.message));
  window.addEventListener('unhandledrejection', e => window.probe.errors.push(String(e.reason)));
  for (const section of Object.values(api)) {
    for (const [name, original] of Object.entries(section)) {
      if (!/^on[A-Z]/.test(name) || typeof original !== 'function') continue;
      section[name] = (...args) => {
        const dispose = original(...args);
        window.probe.subscriptions++;
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          window.probe.subscriptions--;
          dispose();
        };
      };
    }
  }
  const readLog = api.application.readLogFile;
  api.application.readLogFile = (...args) => {
    window.probe.reads.push(args);
    return readLog(...args);
  };
  const root = createRoot(document.getElementById('root'));
  window.render = mounted => flushSync(() => root.render(mounted ? <App /> : null));
  window.downloaderCalls = 0;
  window.kawaikaraVideo.downloads = {
    getStatus: async () => { window.downloaderCalls++; return { installed: false, automaticInstallSupported: true, platform: 'win32' }; },
    install: async () => ({ canceled: true, status: { installed: false, automaticInstallSupported: true, platform: 'win32' } }),
    openReleasePage: async () => {},
  };
  window.renderDownloader = locale => {
    const labels = getRendererMessages(locale, 'en-US').downloader;
    window.downloaderLabels = labels;
    flushSync(() => root.render(<YouTubeDownloaderPanel labels={labels} initialUrl="https://youtube.com/watch?v=fixture" />));
  };
  window.clickLabel = (label, scope = document) => {
    const button = [...scope.querySelectorAll('button')].find(button =>
      button.getAttribute('aria-label') === label || button.textContent.trim() === label);
    if (!button) throw new Error('Missing button: ' + label);
    button.click();
  };
  window.key = (key, extra = {}, target = document) => target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
  window.setQuery = value => {
    const input = document.querySelector('.log-viewer-search input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
` }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
  minify: process.argv.includes('--minified'), loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = [require.resolve('@kawaikara/kawai-ui/styles.css'),
  ...['Overlay', 'LogViewer', 'Video', 'Update'].map(name => path.join(root, 'src/Renderer/Styles', name + '.css'))]
  .map(file => readFileSync(file, 'utf8')).join('\n');
const fixturePath = path.join(profile, 'view-fixture.html');
writeFileSync(fixturePath, '<!doctype html><style>' + css +
  '</style><div id="root"></div><script>' + fixture.replace(/<\/script/gi, '<\\/script') + '</script>');

async function main() {
  await app.whenReady();
  const window = new BrowserWindow({ show: false, width: 1280, height: 900,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const evaluate = expression => window.webContents.executeJavaScript(expression);
  const waitFor = async expression => {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Timed out: ' + expression);
  };
  await window.loadFile(fixturePath);
  for (let cycle = 0; cycle < 2; cycle++) {
    stage = `menu mount ${cycle}`;
    await evaluate('render(true)');
    await waitFor('document.querySelector(".menu-panel") && document.querySelectorAll(".menu-category").length > 0');
    await evaluate('key("l", {ctrlKey: true})');
    assert.equal(await evaluate('document.activeElement.closest(".menu-address-section") !== null'), true);
    await evaluate('document.activeElement.blur(); clickLabel(labels.app.alwaysOnTop)');
    await waitFor(`document.querySelector('.always-on-top-button').classList.contains('is-active') === ${cycle === 0}`);
    await evaluate('clickLabel(labels.app.openPreferences)');
    await waitFor('document.querySelectorAll(".preference-tab-list [role=tab]").length >= 7');
    stage = 'settings tab composition';
    const count = await evaluate('document.querySelectorAll(".preference-tab-list [role=tab]").length');
    for (let i = 0; i < count; i++) {
      await evaluate(`document.querySelectorAll('.preference-tab-list [role=tab]')[${i}].click()`);
      await waitFor(`document.querySelectorAll('.preference-tab-list [role=tab]')[${i}].getAttribute('aria-selected') === 'true'`);
    }
    stage = 'nested log viewer';
    await evaluate('clickLabel(labels.app.appInfo); clickLabel(labels.app.logViewer)');
    await waitFor('document.querySelectorAll(".log-viewer-file").length === 48 && document.querySelectorAll(".log-viewer-entry").length > 0');
    assert.equal(await evaluate('document.querySelector(".preference-surface").inert'), true);
    await evaluate('document.querySelector(".log-viewer-file").click()');
    await waitFor('document.querySelectorAll(".log-viewer-file.is-selected").length === 1');
    await evaluate(`document.querySelectorAll('.log-viewer-file')[1].dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}))`);
    await waitFor('document.querySelectorAll(".log-viewer-file.is-selected").length === 2');
    await evaluate(`document.querySelector('.log-viewer-file').focus(); key('a', {ctrlKey: true}, document.activeElement)`);
    await waitFor('document.querySelectorAll(".log-viewer-file.is-selected").length === 48');
    assert.equal(await evaluate(`(() => { const area=document.querySelector('.log-viewer-file-scroll'); area.scrollTop=area.scrollHeight; return area.scrollTop > 0; })()`), true);
    await evaluate('setQuery("renderer")');
    await waitFor('document.querySelector(".log-viewer-entry mark")');
    await evaluate('setQuery(""); document.activeElement.blur(); clickLabel(labels.logViewer.externalRepository)');
    await waitFor('document.querySelectorAll(".log-viewer-group-button").length === 2');
    await evaluate('document.querySelector(".log-viewer-group-button").click()');
    await waitFor('document.querySelectorAll(".log-viewer-file").length === 2');
    await evaluate('key("Escape")');
    await waitFor('!document.querySelector(".log-viewer-shell")');
    assert.equal(await evaluate('!!document.querySelector(".preference-tabs")'), true);
    await evaluate('clickLabel(labels.app.backToSites)');
    await waitFor('!document.querySelector(".preference-shell")');
    stage = 'unmount subscription cleanup';
    await evaluate('render(false)');
    await waitFor('probe.subscriptions === 0');
    assert.deepEqual(await evaluate('probe.errors'), []);
    assert.equal(await evaluate('probe.reads.some(args => args[0] === "external" && !args[2])'), false);
  }
  stage = 'downloader language changes preserve mounted state';
  for (const locale of ['en-US', 'ko-KR', 'ja-JP']) {
    await evaluate(`renderDownloader(${JSON.stringify(locale)})`);
    await waitFor('document.querySelector(".youtube-downloader-panel").textContent.includes(downloaderLabels.notInstalled)');
    assert.equal(await evaluate('document.querySelector(".youtube-downloader-panel input").placeholder === downloaderLabels.urlPlaceholder'), true);
    assert.equal(await evaluate('document.querySelector(".youtube-downloader-panel input").value'), 'https://youtube.com/watch?v=fixture');
    await evaluate('clickLabel(downloaderLabels.install)');
  }
  assert.equal(await evaluate('downloaderCalls'), 1, 'locale changes do not remount the panel or repeat its effect');
  assert.deepEqual(await evaluate('probe.errors'), []);
  await evaluate('render(false)');
  window.destroy();
  clearTimeout(watchdog);
  console.log('PASS: Menu input/AOT, all settings tabs, nested log return, search, multi-selection, history scroll, external repository identity, repeated mount/subscription cleanup, and EN/KO/JA downloader state preservation.');
  app.exit(0);
}
main().catch(error => { console.error(`View probe failed at ${stage}:`, error); clearTimeout(watchdog); app.exit(1); });
