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

test('an explicit download of a startup prompt stays manual when automatic installation is disabled', async () => {
  const { manager, updater } = fixture('win32', 'automatic');
  manager.currentState = { ...manager.currentState, phase: 'available' };
  updater.downloadUpdate = async () => [];
  const result = await manager.downloadUpdate();
  assert.equal(result.phase, 'downloaded');
  assert.equal(result.origin, 'manual');
  assert.equal(manager.isInstalling(), false);
});
