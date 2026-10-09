const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
function load(relative, imports = {}, bundle = true) {
  const file = path.join(root, relative);
  const loaded = new Module(file, module); loaded.paths = module.paths;
  loaded.require = id => id in imports ? imports[id] : require(id);
  loaded._compile(buildSync({ entryPoints: [file], bundle, packages: 'external', platform: 'node',
    format: 'cjs', write: false, define: { __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
      __KAWAIKARA_DISTRIBUTION_BUILD__: 'false', __KAWAIKARA_DISCORD_APP_ID__: '""',
      __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null' } }).outputFiles[0].text, file);
  return loaded.exports;
}
const { PreferenceManager } = load('src/Main/Manager/PreferenceManager.ts');
const { readStartupGraphicsMode } = load('src/Main/Functional/Preferences.ts');
const validation = load('src/Main/Functional/IPCValidation.ts', { electron: {} });
test('each persisted mode is the mode read before the next Electron startup', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-mode-state-'));
  try {
    const file = path.join(directory, 'preferences.json'), preferences = new PreferenceManager(file);
    await preferences.load();
    for (const mode of ['native', 'software', 'capture', 'native']) {
      await preferences.update({ graphicsMode: mode });
      assert.equal(readStartupGraphicsMode(file), mode);
      const reopened = new PreferenceManager(file); await reopened.load();
      assert.equal(reopened.get().graphicsMode, mode);
    }
    for (const legacy of [true, false]) {
      fs.writeFileSync(file, JSON.stringify({ enableGpuAcceleration: legacy }));
      const reopened = new PreferenceManager(file); await reopened.load();
      assert.equal(readStartupGraphicsMode(file), reopened.get().graphicsMode);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('invalid explicit modes cannot silently change the saved mode without a restart', () => {
  for (const value of ['invalid', null, undefined, true, {}]) {
    assert.throws(() => validation.readRequestedGraphicsMode({ graphicsMode: value }), /supported graphics mode/);
  }
  assert.equal(validation.readRequestedGraphicsMode({ appTheme: 'dark' }), undefined);
});
test('IPC rejects unconfirmed changes and persists a valid mode before scheduling restart', async () => {
  const handlers = new Map(), calls = [];
  const { IPC_CHANNELS } = load('src/Common/IPC.ts');
  const compiled = buildSync({ entryPoints: [path.join(root, 'src/Main/Manager/IPCManager.ts')],
    bundle: false, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const loaded = new Module(__filename, module);
  loaded.require = id => id === 'electron' ? { ipcMain: { handle: (key, fn) => handlers.set(key, fn), on() {} } }
    : id === '../../Common/IPC' ? { IPC_CHANNELS }
    : id === '../Functional/IPCValidation' ? validation : id.startsWith('node:') ? require(id) : {};
  loaded._compile(compiled, __filename);
  const manager = Object.assign(Object.create(loaded.exports.IpcManager.prototype), {
    development: { subscribe: () => () => {} },
    preferences: { get: () => ({ graphicsMode: 'capture' }), update: async patch => {
      await new Promise(resolve => setImmediate(resolve)); calls.push('persisted'); return patch;
    } }, scheduleApplicationRelaunch() { calls.push('restart'); },
  });
  manager.initialize();
  const update = handlers.get(IPC_CHANNELS.preferences.update);
  for (const mode of ['native', 'software']) {
    await assert.rejects(update({}, { graphicsMode: mode }, {}), /restart confirmation/);
  }
  await assert.rejects(update({}, { graphicsMode: 'invalid' }, { restartForGraphicsChange: true }), /supported graphics/);
  assert.deepEqual(calls, []);
  assert.equal((await update({}, { graphicsMode: 'software' }, { restartForGraphicsChange: true })).graphicsMode, 'software');
  assert.deepEqual(calls, ['persisted', 'restart']);
});
test('startup respects GPU driver policy, capture overlays, and forced software override', () => {
  const source = fs.readFileSync(path.join(root, 'src/Main/Functional/ApplicationPreInitialization.ts'), 'utf8');
  const code = buildSync({ stdin: { contents: source, loader: 'ts' }, bundle: false, platform: 'node',
    format: 'cjs', write: false }).outputFiles[0].text;
  for (const platform of ['win32', 'darwin', 'linux']) for (const mode of ['native', 'capture', 'software']) {
    const switches = new Map([['disable-features', 'ExistingFeature']]); let disabled = false;
    const process = { platform, env: { MPV_HWDEC: 'no' } };
    const app = { disableHardwareAcceleration() { disabled = true; }, commandLine: {
      appendSwitch: (name, value = '') => switches.set(name, value),
      removeSwitch: name => switches.delete(name), getSwitchValue: name => switches.get(name) || '',
    } };
    const context = { exports: {}, module: { exports: {} }, process,
      require: id => id === 'electron' ? { app } : id === './Preferences' ? { readStartupGraphicsMode: () => mode } : {} };
    vm.runInNewContext(code, context);
    const configure = context.module.exports.configureGraphics;
    configure('fixture', { info() {} });
    assert.equal(disabled, mode === 'software'); assert.equal(process.env.MPV_HWDEC, 'no');
    assert.equal(switches.has('ignore-gpu-blocklist'), false);
    assert.equal(switches.has('enable-gpu-rasterization'), false);
    assert.equal(switches.has('enable-zero-copy'), false);
    assert.equal(switches.has('disable_direct_composition_video_overlays'), platform === 'win32' && mode === 'capture');
    assert.equal(switches.get('disable-features'), platform === 'darwin' && mode === 'capture'
      ? 'ExistingFeature,avfoundation-overlays' : 'ExistingFeature');
    process.env.KAWAIKARA_FORCE_SOFTWARE_RENDERING = '1'; disabled = false;
    configure('fixture', { info() {} }); assert.equal(disabled, true);
  }
});
