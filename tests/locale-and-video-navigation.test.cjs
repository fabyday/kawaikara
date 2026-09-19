const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { existsSync, mkdtempSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
function loadSource(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const code = buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: Object.keys(mocks), define: {
      __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
      __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""',
      __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
  }).outputFiles[0].text;
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id]
    : Module.prototype.require.call(loaded, id);
  loaded._compile(code, filename);
  return loaded.exports;
}

const { selectLocalizedReleaseNotes: select } = loadSource('src/Common/ReleaseNotes.ts');
const { normalizeReleaseNotes: normalize } = loadSource('src/Main/Functional/ApplicationUpdates.ts');
const { getClearAllProfilesConfirmationCopy: copy } = loadSource('src/Main/Functional/Locale.ts');
const { VideoDirectoryHistory } = loadSource('src/Common/VideoDirectoryHistory.ts');

test('all-profile dialog copy is provided entirely by the three locale JSON files', () => {
  for (const [locale, language] of [['ko-KR', 'ko'], ['ja-JP', 'ja'], ['en-US', 'en'],
    ['fr-FR', 'en'], ['system', 'ko']]) {
    const expected = require(path.join(root, `locales/${language}.json`)).applicationData.clearAllProfiles;
    assert.deepEqual(copy(locale, 'ko-KR'), expected);
    assert.deepEqual(Object.keys(expected).sort(), ['cancel', 'confirm', 'detail', 'message', 'title']);
  }
});

test('clear-all confirmation keeps Cancel as the safe default and never clears storage itself', async () => {
  const dialogs = [];
  let response = 0;
  const { confirmClearAllProfiles } = loadSource('src/Main/Functional/ApplicationData.ts', {
    electron: { app: { getLocale: () => 'ja-JP' }, dialog: {
      async showMessageBox(options) { dialogs.push(options); return { response }; },
    } },
  });
  assert.equal(await confirmClearAllProfiles('system'), false);
  assert.equal(dialogs[0].title, copy('ja', '').title);
  assert.deepEqual(dialogs[0].buttons, [copy('ja', '').cancel, copy('ja', '').confirm]);
  assert.equal(dialogs[0].defaultId, 0);
  assert.equal(dialogs[0].cancelId, 0);
  response = 1;
  assert.equal(await confirmClearAllProfiles('ko'), true);
  assert.equal(dialogs[1].detail, copy('ko', '').detail);
});

const markdown = '## English\n\n### Version\nEnglish change\n## Details\nEnglish details\n\n' +
  '## 한국어\n\n### 버전\n한국어 변경\n## 상세\n한국어 상세\n\n' +
  '## 日本語\n\n### バージョン\n日本語変更\n\n## Build metadata\nChannel: nightly';

test('selects only the resolved app locale, keeps nested H2 topics, and omits metadata', () => {
  for (const [locale, expected, unwanted] of [
    ['ko-KR', '한국어 변경', ['English change', '日本語変更']],
    ['ja-JP', '日本語変更', ['English change', '한국어 변경']],
    ['en-US', 'English change', ['한국어 변경', '日本語変更']],
    ['fr-FR', 'English change', ['한국어 변경', '日本語変更']],
  ]) {
    const body = select(markdown, locale);
    assert.ok(body.includes(expected));
    for (const text of [...unwanted, 'Build metadata', 'Channel: nightly']) assert.ok(!body.includes(text));
  }
  assert.ok(select(markdown, 'ko').includes('한국어 상세'));
  assert.equal(select(markdown.replace(/\n/g, '\r\n'), 'ko'), select(markdown, 'ko'));
  assert.equal(select(undefined, 'ko'), '');
  assert.equal(select('Legacy single-language notes', 'ja'), 'Legacy single-language notes');
});

test('missing or empty translations fall back to one language, never all languages', () => {
  const body = '## English\nEN only\n## 한국어\n\n## Build metadata\nprivate metadata';
  assert.equal(select(body, 'ja'), 'EN only');
  assert.equal(select(body, 'ko'), 'EN only');
  assert.equal(select('## 한국어\nKR only\n## 日本語\nJA only', 'en'), 'KR only');
  assert.equal(select('## English\n\n## 한국어\n\n## Build metadata\nmeta', 'ja'), '');
});

test('GitHub HTML normalization retains language headings, lists, entities, and inert text', () => {
  const html = '<h2 id="english"><a href="#english"></a>English</h2><h3>Version</h3>' +
    '<ul><li>Fix A &amp; B</li></ul><h2>한국어</h2><p>한국어 변경 &quot;정렬&quot;</p>' +
    '<h2>日本語</h2><p>&#x65e5;&#26412;語変更 &lt;safe&gt;</p>' +
    '<h2>Build metadata</h2><p>Channel: nightly</p>';
  const notes = normalize(html);
  assert.ok(notes.includes('## English'));
  assert.ok(select(notes, 'en').includes('- Fix A & B'));
  assert.equal(select(notes, 'ko'), '한국어 변경 "정렬"');
  assert.equal(select(notes, 'ja'), '日本語変更 <safe>');
  assert.ok(!select(notes, 'ko').includes('Channel:'));
  assert.doesNotThrow(() => normalize('<p>&#99999999;</p>'));
});

test('array/full-changelog feed entries retain the selected language for each release', () => {
  const notes = normalize([{ version: '3.0.1', note: markdown }, { version: '3.0.0', note: markdown }, null]);
  assert.equal(select(notes, 'ko').match(/한국어 변경/g).length, 2);
  assert.ok(!select(notes, 'ko').includes('English change'));
});

test('real CHANGELOG release script produces locale-selectable notes for Nightly', () => {
  const output = path.join(mkdtempSync(path.join(os.tmpdir(), 'kawaikara-release-locales-')), 'notes.md');
  const version = '3.0.0-nightly.20260917.1.1.g01234567';
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/channel-release.cjs'), 'notes', 'nightly', output], {
    cwd: root, encoding: 'utf8', env: { ...process.env,
      KAWAIKARA_RELEASE_VERSION: version, KAWAIKARA_SOURCE_SHA: '0123456789abcdef0123456789abcdef01234567',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const notes = readFileSync(output, 'utf8');
  const korean = select(normalize(notes), 'ko-KR');
  const english = select(normalize(notes), 'en-US');
  assert.ok(korean.startsWith(`### Kawaikara ${version}`));
  assert.ok(english.startsWith(`### Kawaikara ${version}`));
  assert.notEqual(korean, english);
  if (existsSync(path.join(root, 'CHANGELOG/3.0.0/PATCHNOTE.JA.MD'))) {
    assert.notEqual(select(normalize(notes), 'ja'), english);
  } else {
    assert.equal(select(normalize(notes), 'ja'), english, 'missing optional JA file falls back to English');
  }
  assert.ok(!korean.includes('## English'));
  assert.ok(!korean.includes('Source commit:'));
});

test('folder history bounds, Home, same-folder deduplication, and forward branching', () => {
  const history = new VideoDirectoryHistory();
  assert.equal(history.target(-1), undefined);
  history.commit('/A');
  history.commit('/A');
  assert.deepEqual(history.target(-1), { directory: undefined });
  history.commit('/B');
  assert.deepEqual(history.target(-1), { directory: '/A' });
  history.commit('/A', -1);
  assert.deepEqual(history.target(1), { directory: '/B' });
  history.commit('/C');
  assert.equal(history.target(1), undefined);
  assert.deepEqual(history.target(-1), { directory: '/A' });
  history.commit('/A', -1);
  history.commit(undefined, -1);
  assert.equal(history.target(-1), undefined);
  assert.deepEqual(history.target(1), { directory: '/A' });
  history.reset('/Restored');
  assert.equal(history.target(-1), undefined);
  assert.equal(history.target(1), undefined);
});

test('failed folder lookup does not mutate the history cursor', () => {
  const history = new VideoDirectoryHistory();
  history.reset('/A');
  history.commit('/B');
  assert.deepEqual(history.target(-1), { directory: '/A' });
  // Directory loading fails: no commit is made, and retry targets the same visit.
  assert.deepEqual(history.target(-1), { directory: '/A' });
  assert.equal(history.target(1), undefined);
});

test('native Video commands are guarded against other sites, overlays, PiP, and destroyed hosts', () => {
  const { WindowManager } = loadSource('src/Main/Manager/WindowManager.ts', {
    electron: {}, 'electron-mpv-video': {},
  });
  const manager = Object.create(WindowManager.prototype);
  const sent = [];
  manager.videoWindow = { isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } };
  manager.internalVideoVisible = true;
  manager.routeVideoDirectoryNavigation('browser-backward');
  manager.routeVideoDirectoryNavigation('browser-forward');
  assert.deepEqual(sent.map(args => args[1]), ['back', 'forward']);
  manager.routeVideoDirectoryNavigation('media-play-pause');
  manager.internalVideoVisible = false;
  manager.routeVideoDirectoryNavigation('browser-backward');
  manager.internalVideoVisible = true;
  manager.overlayVisible = true;
  manager.routeVideoDirectoryNavigation('browser-backward');
  manager.overlayVisible = false;
  manager.internalVideoPictureInPicture = {};
  manager.routeVideoDirectoryNavigation('browser-backward');
  manager.internalVideoPictureInPicture = undefined;
  manager.videoWindow.isDestroyed = () => true;
  manager.routeVideoDirectoryNavigation('browser-backward');
  assert.equal(sent.length, 2);
});

test('actual Video host factory keeps content bounds, disables duplicate rounding, and wires native commands', async () => {
  const sent = [];
  let options;
  class FakeWindow extends EventEmitter {
    constructor(value) {
      super(); options = value;
      this.webContents = new EventEmitter();
      this.webContents.id = 999;
      this.webContents.send = (...args) => sent.push(args);
    }
    isDestroyed() { return false; }
    setMenu() {}
    setMenuBarVisibility() {}
    loadFile() { return Promise.resolve(); }
  }
  const { WindowManager } = loadSource('src/Main/Manager/WindowManager.ts', {
    electron: { BrowserWindow: FakeWindow }, 'electron-mpv-video': {},
  });
  const manager = Object.create(WindowManager.prototype);
  const bounds = { x: 40, y: 80, width: 960, height: 540 };
  manager.viewerWindow = { isDestroyed: () => false, getContentBounds: () => bounds };
  manager.logging = { attachRenderer() {} };
  manager.appLocale = 'ko-KR';
  manager.systemLocale = 'en-US';
  manager.mpv = { attachWindow() {} };
  manager.editingWebContentsIds = new Set();
  manager.startVideoRendererInitializationWatchdog = () => {};
  // Factory's existing Windows pre-show behavior is unrelated to this regression.
  manager.setManagedWindowOpacity = () => {};
  FakeWindow.prototype.setIgnoreMouseEvents = () => {};
  FakeWindow.prototype.setFocusable = () => {};
  FakeWindow.prototype.showInactive = () => {};
  const video = await manager.ensureVideoWindow();
  assert.equal(options.title, require(path.join(root, 'locales/ko.json')).nativeDialogs.videoWindowTitle);
  assert.equal(options.frame, false);
  assert.equal(options.roundedCorners, false);
  for (const key of Object.keys(bounds)) assert.equal(options[key], bounds[key]);
  assert.equal(options.resizable, false);
  assert.equal(options.webPreferences.preload.endsWith(path.join('preload', 'viewer.js')), true);
  manager.internalVideoVisible = true;
  video.emit('app-command', {}, 'browser-backward');
  assert.equal(sent[0][1], 'back');
  manager.videoWindow = undefined;
  video.emit('app-command', {}, 'browser-forward');
  assert.equal(sent.length, 1, 'stale hosts cannot route commands to a replacement');
});
