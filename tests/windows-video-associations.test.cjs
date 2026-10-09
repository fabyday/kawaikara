const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function load(file, mocks = {}, platform = process.platform) {
  const source = buildSync({ entryPoints: [path.resolve(__dirname, '..', file)], bundle: true,
    write: false, platform: 'node', format: 'cjs', external: ['electron', './UserDataPaths', '../../Common/BuildConfig'],
  }).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, URL, console,
    process: { ...process, platform }, require: id => id in mocks ? mocks[id] : require(id) });
  return module.exports;
}
const parser = load('src/Main/Functional/ExternalOpen.ts');

test('OS video arguments accept spaces, Unicode and encoded file URLs, not executable/options/deep-linked files', () => {
  const filename = path.resolve('videos', '한글 sample.MP4');
  for (const value of [filename, pathToFileURL(filename).href]) {
    assert.equal(parser.parseExternalVideoFile(value).localVideoPath, filename);
    assert.equal(parser.parseExternalOpenArguments(['app.exe', value])[0].localVideoPath, filename);
  }
  for (const value of ['movie.mp4', '--file=movie.mp4', 'https://example.com/movie.mp4',
    path.resolve('app.exe'), '\\\\?\\C:\\movie.mp4', '\\\\.\\C:\\movie.mp4', 'file:%broken']) {
    assert.equal(parser.parseExternalVideoFile(value), undefined, value);
  }
  assert.equal(parser.parseExternalOpenArguments([filename]).length, 0, 'argv[0] is never a file request');
  assert.equal(parser.parseExternalOpenUrl(`kawaikara://open?url=${encodeURIComponent(pathToFileURL(filename).href)}`), undefined);
  assert.equal(parser.parseExternalOpenUrl('kawaikara://open?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dx').targetUrl,
    'https://youtube.com/watch?v=x');
});

test('local handoff validates before queueing and reuses the retained video surface', async () => {
  const { openExternalRequest } = load('src/Main/Functional/ApplicationPostInitialization.ts', {
    electron: {}, '../../Common/BuildConfig': {}, './UserDataPaths': {},
  });
  for (const current of [false, true]) {
    const calls = [], request = { id: 'video' };
    const application = {
      videoLibrary: { openPath: async filename => { calls.push(['validate', filename]); return { kind: 'video', request }; } },
      sites: { isCurrentSite: () => current, load: async id => calls.push(['load', id]) },
      windows: { queueVideoOpenRequest: value => calls.push(['queue', value]), hideOverlay: () => calls.push('hide'),
        presentQueuedVideoOpenRequest: () => { calls.push('present'); return true; }, focusViewer: () => calls.push('focus') },
    };
    assert.equal(await openExternalRequest(application, { localVideoPath: 'movie', targetUrl: 'file:///movie' }), true);
    assert.equal(calls[0][0], 'validate');
    assert.equal(calls.some(item => Array.isArray(item) && item[0] === 'load'), !current);
    assert.equal(calls.at(-1), 'focus');
    calls.length = 0;
    application.videoLibrary.openPath = async () => { throw new Error('missing file'); };
    await assert.rejects(openExternalRequest(application, { localVideoPath: 'missing' }), /missing file/);
    assert.equal(calls.length, 0);
  }
});

test('default app settings target this installed channel in the registered scope, with a safe fallback', async () => {
  for (const scope of ['HKCU', 'HKLM', 'none']) {
    const opened = [], queries = [];
    const settings = load('src/Main/Functional/DefaultVideoApp.ts', {
      electron: { app: { isPackaged: true, getName: () => 'Kawaikara Nightly' }, shell: { openExternal: async url => opened.push(url) } },
      '../../Common/BuildConfig': { UPDATE_TEST_PROFILE: undefined },
      'node:child_process': { execFile: (exe, args, options, callback) => {
        queries.push(args); callback(args[1].startsWith(scope) ? null : new Error('unregistered'), '', '');
      } },
    }, 'win32');
    await settings.openDefaultVideoAppSettings();
    const key = scope === 'HKCU' ? 'registeredAppUser' : 'registeredAppMachine';
    assert.equal(opened[0], 'ms-settings:defaultapps' + (scope === 'none' ? '' : `?${key}=Kawaikara%20Nightly`));
    assert.ok(queries.every(args => args[0] === 'query' && args[3] === 'Kawaikara Nightly'));
  }
  for (const [platform, packaged, profile] of [['darwin', true, undefined], ['win32', false, undefined], ['win32', true, {}]]) {
    const settings = load('src/Main/Functional/DefaultVideoApp.ts', {
      electron: { app: { isPackaged: packaged }, shell: { openExternal: () => assert.fail('must not launch settings') } },
      '../../Common/BuildConfig': { UPDATE_TEST_PROFILE: profile },
    }, platform);
    assert.equal(settings.canConfigureDefaultVideoApp(), false);
    await assert.rejects(settings.openDefaultVideoAppSettings(), /installed Windows/);
  }
});

test('Explorer registrations are channel-owned candidates, never user defaults', () => {
  const script = readFileSync(path.resolve(__dirname, '../packaging/nsis/video-associations.nsh'), 'utf8');
  assert.match(script, /OpenWithProgids/);
  assert.match(script, /SystemFileAssociations/);
  assert.doesNotMatch(script, /UserChoice|SetUserFTA/);
  assert.match(script, /ReadRegStr \$0 SHCTX .*\$\{APP_ID\}\.Video/);
  assert.match(script, /\$\{If\} \$0 ==/);
  assert.doesNotMatch(script, /WriteRegStr SHCTX "Software\\Classes\\\.\$\{EXT\}"/);
  assert.doesNotMatch(script, /kawaiVideoExtension "ts"/);
});

test('second-instance file requests queue before readiness and are delivered serially afterward', async () => {
  const events = new (require('node:events').EventEmitter)();
  events.requestSingleInstanceLock = () => true;
  const { ApplicationLifecycleManager } = load('src/Main/Manager/ApplicationLifecycleManager.ts', { electron: { app: events } });
  const manager = new ApplicationLifecycleManager({}, { error: error => assert.fail(String(error)) });
  assert.equal(manager.start(), true);
  const first = path.resolve('first.mp4'), second = path.resolve('second.mkv');
  events.emit('second-instance', {}, ['app.exe', first]);
  assert.equal(manager.takeStartupRequest().localVideoPath, first);
  events.emit('second-instance', {}, ['app.exe', second]);
  const received = [];
  manager.activateExternalOpenHandler(async request => { received.push(request.localVideoPath); });
  events.emit('second-instance', {}, ['app.exe', first]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, [second, first]);
});
