const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { buildSync } = require('esbuild');
const { waitForNativeUpdate } = require('../src/Main/Functional/UpdateInstallation.ts');

const compiled = buildSync({
  entryPoints: [path.join(__dirname, '../src/Main/Manager/UpdateManager.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['electron', 'electron-updater'],
  define: {
    __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
    __KAWAIKARA_DISTRIBUTION_BUILD__: 'true',
    __KAWAIKARA_DISCORD_APP_ID__: '""',
    __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
  },
}).outputFiles[0].text;

function fixture(platform, origin = 'manual') {
  const calls = [];
  const updater = new EventEmitter();
  const native = new EventEmitter();
  native.checkForUpdates = () => calls.push('native-check');
  updater.quitAndInstall = (...args) => calls.push(['quit', ...args]);
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, setTimeout, clearTimeout, setImmediate, Error,
    process: { platform, env: {} },
    require(name) {
      if (name === 'electron') return {
        app: { getVersion: () => '3.0.0-nightly.1', isPackaged: true },
        autoUpdater: native, BrowserWindow: { getAllWindows: () => [] },
      };
      if (name === 'electron-updater') return { autoUpdater: updater };
      return require(name);
    },
  });
  const manager = new module.exports.UpdateManager({
    showUpdateOverlay: (state) => calls.push(['show', state.phase]),
    updateUpdateOverlay: (state) => calls.push(['state', state.phase]),
  }, { getLogger: () => ({ info() {}, error() {} }), updaterLogger: {} });
  manager.currentState = manager.downloadedState = {
    phase: 'downloaded', origin, channel: 'nightly',
    currentVersion: '3.0.0-nightly.1', latestVersion: '3.0.0-nightly.2',
  };
  manager.setInstallLifecycle({
    prepare: async () => { calls.push('prepare'); },
    recover: async () => { calls.push('recover'); },
  });
  return { manager, updater, native, calls };
}

test('native staging timeout cleans listeners; late readiness cannot schedule a quit', async () => {
  const native = new EventEmitter();
  await assert.rejects(waitForNativeUpdate(native, () => {}, 5), /timed out/);
  assert.equal(native.listenerCount('error'), 0);
  assert.equal(native.listenerCount('update-downloaded'), 0);
  native.emit('update-downloaded');
});

test('native synchronous failure preserves the error and cleans listeners', async () => {
  const native = new EventEmitter();
  const reason = Object.assign(new Error('invalid signature'), { code: 'ERR_UPDATER_INVALID_SIGNATURE' });
  await assert.rejects(waitForNativeUpdate(native, () => { throw reason; }), (error) => error === reason);
  assert.equal(native.listenerCount('update-downloaded'), 0);
});

test('macOS waits for native validation, deduplicates restart and only then prepares/quits', async () => {
  const { manager, native, calls } = fixture('darwin');
  const first = manager.installUpdate();
  const second = manager.installUpdate();
  assert.deepEqual(calls, [['state', 'preparing'], 'native-check']);
  assert.equal(manager.isInstalling(), false);
  await assert.rejects(manager.checkForUpdates(), /already/);
  native.emit('update-downloaded');
  await Promise.all([first, second]);
  assert.deepEqual(calls.slice(-3), ['prepare', ['state', 'installing'], ['quit', false, true]]);
  assert.equal(manager.isInstalling(), true);
  assert.equal(native.listenerCount('update-downloaded'), 0);
});

test('macOS signature failure does not dispose resources or leave a native quit listener', async () => {
  const { manager, native, calls } = fixture('darwin');
  const request = manager.installUpdate();
  native.emit('error', Object.assign(new Error('bad signature'), { code: 'ERR_UPDATER_INVALID_SIGNATURE' }));
  await request;
  assert.equal(manager.getState().phase, 'error');
  assert.equal(manager.getState().canRetryInstall, false);
  assert.equal(manager.isInstalling(), false);
  assert.equal(calls.includes('prepare'), false);
  assert.equal(calls.includes('recover'), false);
  assert.equal(native.listenerCount('update-downloaded'), 0);
  native.emit('update-downloaded');
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === 'quit'), false);
});

test('the actual macOS native signature message is classified even without an NSError code', async () => {
  const { manager, native } = fixture('darwin');
  const request = manager.installUpdate();
  native.emit('error', new Error('Code signature at URL file:///test.app/ did not pass validation: code failed to satisfy specified code requirement(s)'));
  await request;
  assert.equal(manager.getState().errorCode, 'ERR_UPDATER_INVALID_SIGNATURE');
  assert.equal(manager.getState().canRetryInstall, false);
});

test('Windows automatic NSIS handoff is silent, relaunches, and recovers emitted errors', async () => {
  const { manager, updater, calls } = fixture('win32', 'automatic');
  await manager.installUpdate();
  assert.deepEqual(calls.slice(-1), [['quit', true, true]]);
  updater.emit('error', new Error('installer spawn failed'));
  await new Promise(setImmediate);
  assert.equal(manager.isInstalling(), false);
  assert.equal(manager.getState().errorStage, 'install');
  assert.equal(manager.getState().canRetryInstall, true);
  assert.equal(calls.includes('recover'), true);
  assert.equal(updater.listenerCount('error'), 1); // only permanent diagnostic observer
  await manager.installUpdate();
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'quit').length, 2);
});

test('Windows manual in-app updates also suppress Setup and relaunch normally', async () => {
  const { manager, calls } = fixture('win32', 'manual');
  await manager.installUpdate();
  assert.deepEqual(calls.slice(-1), [['quit', true, true]]);
});

test('restart notice stays visible before installer handoff and repeated clicks do not restart twice', async () => {
  const { manager, calls } = fixture('win32', 'automatic');
  const started = Date.now();
  const first = manager.installUpdate();
  const second = manager.installUpdate();
  await new Promise(setImmediate);
  assert.equal(manager.getState().phase, 'installing');
  assert.equal(manager.isInstalling(), false);
  assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'quit'), false);
  await assert.rejects(manager.checkForUpdates(), /already/);
  await Promise.all([first, second]);
  assert.ok(Date.now() - started >= 1100, 'restart notice was dismissed too soon');
  assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'quit').length, 1);
});

test('failed preparation restores input without calling the installer', async () => {
  const { manager, calls } = fixture('win32');
  manager.setInstallLifecycle({
    prepare: async () => { calls.push('prepare'); throw new Error('flush failed'); },
    recover: async () => { calls.push('recover'); },
  });
  await manager.installUpdate();
  assert.deepEqual(calls.slice(-3), ['prepare', 'recover', ['show', 'error']]);
  assert.equal(manager.isInstalling(), false);
});

test('a thrown installer startup error restores the app and the download can be reused', async () => {
  const { manager, updater, calls } = fixture('win32');
  updater.quitAndInstall = () => { throw new Error('cannot spawn'); };
  await manager.installUpdate();
  assert.equal(manager.getState().canRetryInstall, true);
  assert.equal(manager.isInstalling(), false);
  assert.equal(calls.includes('recover'), true);
  assert.equal(updater.listenerCount('error'), 1);
});

function updateFixture(automaticUpdates) {
  const f = fixture('win32');
  f.manager.currentState = undefined;
  f.manager.downloadedState = undefined;
  f.updater.setFeedURL = () => {};
  f.updater.checkForUpdates = async () => {
    f.calls.push('check');
    f.updater.emit('update-available', { version: '3.0.0-nightly.2' });
    return {};
  };
  f.updater.downloadUpdate = async () => { f.calls.push('download'); return []; };
  if (automaticUpdates !== undefined) f.manager.configure({ automaticUpdates });
  return f;
}

test('automatic updates are opt-in even in Nightly and invalid/missing settings default to off', () => {
  const output = buildSync({
    entryPoints: [path.join(__dirname, '../src/Main/Functional/Preferences.ts')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    define: { __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'true',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null' },
  }).outputFiles[0].text;
  const loaded = { exports: {} };
  new Function('require', 'module', output)(require, loaded);
  const { DEFAULT_PREFERENCES, mergeValidatedPreferences } = loaded.exports;
  assert.equal(DEFAULT_PREFERENCES.automaticUpdates, false);
  for (const value of [{}, { automaticUpdates: 'true' }, { automaticUpdates: false }]) {
    assert.equal(mergeValidatedPreferences(value).automaticUpdates, false);
  }
  assert.equal(mergeValidatedPreferences({ automaticUpdates: true }).automaticUpdates, true);
});

test('startup does not check, display, download or install with automatic updates off or unset', async () => {
  for (const preference of [false, undefined]) {
    const { manager, calls } = updateFixture(preference);
    await manager.checkAtStartup();
    assert.deepEqual(calls, []);
  }
});

test('enabled automatic updates download, install and restart without user commands', async () => {
  const { manager, calls } = updateFixture(true);
  await manager.checkAtStartup();
  assert.equal(manager.getState().origin, 'automatic');
  assert.deepEqual(calls.filter(c => typeof c === 'string'), ['check', 'download', 'prepare']);
  assert.deepEqual(calls.at(-1), ['quit', true, true]);
});

test('manual check waits for Update now even when automatic updates are enabled', async () => {
  for (const preference of [false, true]) {
    const { manager, calls } = updateFixture(preference);
    await manager.checkForUpdates();
    assert.equal(manager.getState().phase, 'available');
    assert.equal(manager.getState().origin, 'manual');
    assert.equal(calls.includes('download'), false);
    assert.equal(calls.includes('prepare'), false);
    const results = await Promise.all([manager.downloadUpdate(), manager.downloadUpdate()]);
    assert.equal(results[0].phase, 'installing');
    assert.equal(results[0].origin, 'manual');
    assert.equal(calls.filter(c => c === 'download').length, 1);
    assert.equal(calls.filter(c => Array.isArray(c) && c[0] === 'quit').length, 1);
  }
});

test('turning automatic updates off during a check prevents download and the startup prompt', async () => {
  const { manager, updater, calls } = updateFixture(true);
  let finish;
  updater.checkForUpdates = () => new Promise(resolve => { finish = () => {
    updater.emit('update-available', { version: '3.0.0-nightly.2' }); resolve({});
  }; });
  const pending = manager.checkAtStartup();
  manager.configure({ automaticUpdates: false });
  finish();
  await pending;
  assert.deepEqual(calls, []);
});

test('opting out during a download requires Update now before reusing the file and restarting', async () => {
  const { manager, updater, calls } = updateFixture(true);
  updater.downloadUpdate = async () => {
    calls.push('download'); manager.configure({ automaticUpdates: false }); return [];
  };
  await manager.checkAtStartup();
  assert.equal(manager.getState().phase, 'available');
  assert.equal(manager.getState().origin, 'manual');
  assert.equal(manager.isInstalling(), false);
  assert.equal(calls.includes('prepare'), false);
  await manager.downloadUpdate();
  assert.equal(calls.filter(c => c === 'download').length, 1);
  assert.deepEqual(calls.at(-1), ['quit', true, true]);
});

test('failed download never starts installation or restarts the app', async () => {
  const { manager, updater, calls } = updateFixture(false);
  updater.downloadUpdate = async () => { throw new Error('network failure'); };
  await manager.checkForUpdates();
  const result = await manager.downloadUpdate();
  assert.equal(result.phase, 'error');
  assert.equal(result.errorStage, 'download');
  assert.equal(calls.includes('prepare'), false);
  assert.equal(calls.some(c => Array.isArray(c) && c[0] === 'quit'), false);
});
