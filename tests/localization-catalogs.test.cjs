const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const catalogs = Object.fromEntries(['en', 'ko', 'ja'].map(language =>
  [language, require(path.join(root, 'locales', language + '.json'))]));

function loadSource(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const code = buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: Object.keys(mocks),
    define: {
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

function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'object') flatten(item, prefix + key + '.', result);
    else result[prefix + key] = item;
  }
  return result;
}

test('every catalog has exactly the same nonempty keys and interpolation variables', () => {
  const reference = flatten(catalogs.en);
  const placeholders = value => (value.match(/\{\w+\}/g) ?? []).sort();
  for (const [language, catalog] of Object.entries(catalogs)) {
    const entries = flatten(catalog);
    assert.deepEqual(Object.keys(entries).sort(), Object.keys(reference).sort(), language);
    for (const [key, value] of Object.entries(entries)) {
      assert.equal(typeof value, 'string', `${language}.${key}`);
      assert.ok(value.trim(), `${language}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(reference[key]), `${language}.${key}`);
    }
  }
});

test('Main resolves explicit, regional, system and unsupported locales through one catalog policy', () => {
  const { getLocaleMessages } = loadSource('src/Main/Functional/Locale.ts');
  const { getRendererMessages, getAppMessages } = loadSource('src/Main/Functional/RendererMessages.ts');
  for (const [locale, system, language] of [
    ['en-US', 'ko-KR', 'en'], ['KO-kr', 'en-US', 'ko'], ['ja-JP', 'en-US', 'ja'],
    ['system', 'ja-JP', 'ja'], ['system', 'ko-KR', 'ko'], ['fr-FR', 'ja-JP', 'en'],
  ]) {
    const catalog = catalogs[language];
    assert.deepEqual(getLocaleMessages(locale, system), catalog);
    assert.deepEqual(getAppMessages(locale, system), catalog.app);
    const messages = getRendererMessages(locale, system);
    for (const section of ['app', 'video', 'videoBrowser', 'videoLibrary', 'logViewer', 'update', 'downloader']) {
      assert.deepEqual(messages[section], catalog[section], `${locale}.${section}`);
    }
  }
});

test('destructive native dialogs use catalog copy, preserve literal names and keep Cancel as default', async () => {
  const dialogs = [];
  const { confirmDataClear, confirmDataReset } = loadSource('src/Main/Functional/ApplicationData.ts', {
    electron: { app: { getLocale: () => 'ja-JP' }, dialog: {
      async showMessageBox(options) { dialogs.push(options); return { response: 0 }; },
    } },
  });
  const name = 'Profile $& $` <script>';
  for (const language of ['en', 'ko', 'ja']) {
    for (const [kind, key] of [['profile', 'clearProfile'], ['site', 'clearSite']]) {
      assert.equal(await confirmDataClear(kind, name, language), false);
      const options = dialogs.at(-1), copy = catalogs[language].applicationData[key];
      assert.equal(options.message, copy.message.replace('{name}', () => name));
      assert.equal(options.detail, copy.detail);
      assert.deepEqual(options.buttons, [copy.cancel, copy.confirm]);
      assert.equal(options.defaultId, 0);
      assert.equal(options.cancelId, 0);
    }
    for (const [kind, key] of [['cache', 'resetCache'], ['application', 'resetApplication']]) {
      assert.equal(await confirmDataReset(kind, language), false);
      assert.equal(dialogs.at(-1).message, catalogs[language].applicationData[key].message);
    }
  }
});

test('bundle confirmation and project picker copy is selected in Main', () => {
  const electron = { app: { getLocale: () => 'ja-JP' } };
  const { getInstallCopy, getBundleActionCopy } = loadSource('src/Main/Functional/BundleRuntime.ts', { electron });
  const { getChooseDevelopmentProjectTitle } = loadSource('src/Main/Functional/BundleDevelopment.ts', { electron });
  for (const language of ['en', 'ko', 'ja']) {
    assert.deepEqual(getInstallCopy(language), catalogs[language].bundle.install);
    assert.deepEqual(getBundleActionCopy(language), catalogs[language].bundle.action);
    assert.equal(getChooseDevelopmentProjectTitle(language), catalogs[language].nativeDialogs.chooseDevelopmentProject);
  }
  assert.equal(getChooseDevelopmentProjectTitle('system'), catalogs.ja.nativeDialogs.chooseDevelopmentProject);
});

test('downloader rereads the current language without installing or opening an external app', async () => {
  let locale = 'ko-KR';
  const { ExternalDownloaderManager } = loadSource('src/Main/Manager/ExternalDownloaderManager.ts', {
    electron: { app: { getLocale: () => 'en-US' } },
  });
  const manager = new ExternalDownloaderManager(() => locale);
  manager.getStatus = async message => ({ installed: false, automaticInstallSupported: false, platform: 'linux', message });
  assert.equal((await manager.install()).status.message, catalogs.ko.downloader.unsupported);
  locale = 'ja-JP';
  assert.equal((await manager.install()).status.message, catalogs.ja.downloader.unsupported);
});

test('shortcut definitions carry IDs and bindings only; every title exists in the catalogs', () => {
  const definitions = [
    ...loadSource('src/Common/AppShortcuts.ts').APP_SHORTCUTS,
    ...loadSource('src/Common/VideoControls.ts').VIDEO_SHORTCUTS,
    ...loadSource('src/Common/ShortFormVideo.ts').SHORT_FORM_VIDEO_SHORTCUTS,
  ];
  for (const definition of definitions) {
    assert.deepEqual(Object.keys(definition).sort(), ['defaultKey', 'id']);
    for (const catalog of Object.values(catalogs)) assert.ok(catalog.app.shortcutNames[definition.id]);
  }
});

test('Renderer contains no app catalog imports or literal JSX UI copy', () => {
  const violations = [];
  function visitDirectory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visitDirectory(file); continue; }
      if (!/\.tsx?$/.test(file)) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isImportDeclaration(node) && /locales\/.*\.json/.test(node.moduleSpecifier.text)) violations.push(file);
        if (ts.isJsxText(node) && /[A-Za-z]{2}|[가-힣ぁ-んァ-ヶ一-龯]/.test(node.text)) violations.push(`${file}: ${node.text.trim()}`);
        if (ts.isJsxAttribute(node) && ['label', 'title', 'placeholder', 'aria-label', 'alt'].includes(node.name.text)
          && node.initializer && ts.isStringLiteral(node.initializer)
          && /[A-Za-z]{2}|[가-힣ぁ-んァ-ヶ一-龯]/.test(node.initializer.text)) violations.push(`${file}: ${node.getText()}`);
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  visitDirectory(path.join(root, 'src/Renderer'));
  assert.deepEqual(violations, []);
});

test('localized source-validation failures still dispose MPV/Chromium listeners and timers', async () => {
  const timers = new Set();
  const previousWindow = global.window;
  global.window = { setTimeout: callback => { timers.add(callback); return callback; }, clearTimeout: handle => timers.delete(handle) };
  class MediaTarget extends EventTarget {
    listeners = new Set();
    videoWidth = 0;
    videoHeight = 0;
    addEventListener(type, fn) { this.listeners.add(fn); super.addEventListener(type, fn); }
    removeEventListener(type, fn) { this.listeners.delete(fn); super.removeEventListener(type, fn); }
  }
  try {
    const { monitorMpvSourceValidation } = loadSource('src/Renderer/View/Video/Playback/MpvSource.ts');
    const { waitForChromiumVideo } = loadSource('src/Renderer/View/Video/Playback/ChromiumSource.ts');
    for (const catalog of Object.values(catalogs)) {
      for (const validate of [monitorMpvSourceValidation, waitForChromiumVideo]) {
        const media = new MediaTarget();
        const canceled = validate(media, catalog.video);
        canceled.cancel();
        await assert.rejects(canceled.ready, error => error.message === catalog.video.sourceCanceled);
        assert.equal(media.listeners.size, 0);
        assert.equal(timers.size, 0);
        const timedOut = validate(media, catalog.video);
        for (const callback of [...timers]) callback();
        await assert.rejects(timedOut.ready, error => error.message === catalog.video.sourceTimeout);
        assert.equal(media.listeners.size, 0);
        assert.equal(timers.size, 0);
      }
    }
  } finally { global.window = previousWindow; }
});
