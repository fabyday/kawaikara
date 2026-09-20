const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { existsSync, mkdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/Main/Manager/WindowManager.ts');
const screen = new EventEmitter();
const mocks = { electron: { screen }, 'electron-mpv-video': {} };
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(loaded, id);
loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
  platform: 'node', format: 'cjs', external: Object.keys(mocks), define: {
    __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
    __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
  },
}).outputFiles[0].text, filename);
const { WindowManager } = loaded.exports;

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const state = { fullscreen: false, topmost: true, destroyed: false, refreshes: 0, stops: 0,
    anchor: undefined, visible: true, minimized: false };
  const applied = [], warnings = [];
  const manager = Object.create(WindowManager.prototype);
  Object.assign(manager, {
    appAlwaysOnTop: true, externalFullscreenMonitoring: true,
    externalFullscreenBlocksAlwaysOnTop: false,
    viewerWindow: { isDestroyed: () => state.destroyed,
      isVisible: () => state.visible, isMinimized: () => state.minimized },
    logger: { info() {}, debug() {}, warn: (...args) => warnings.push(args) },
    externalFullscreenMonitor: {
      supported: true,
      refresh(viewer) {
        assert.equal(viewer, manager.viewerWindow);
        state.refreshes++;
        return state.fullscreen;
      },
      isAlwaysOnTopApplied: () => state.topmost,
      getYieldTarget: () => state.anchor,
      stop() { state.stops++; },
    },
    handleDisplayConfigurationChanged() {},
    isAnyPictureInPictureActive: () => false,
    applyAlwaysOnTop(viewer, enabled) {
      assert.equal(viewer, manager.viewerWindow);
      applied.push(enabled);
      state.topmost = enabled;
    },
  });
  t.after(() => manager.stopExternalFullscreenMonitoring());
  return { manager, state, applied, warnings };
}

test('the first fullscreen signal yields on the next turn, outside the native callback', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh();
  assert.deepEqual(applied, [], 'never change Electron windows inside a WinEvent callback');
  t.mock.timers.tick(0);
  assert.deepEqual(applied, [false]);
});

test('continuous native events cannot postpone yielding until the burst stops', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  for (let index = 0; index < 20; index++) {
    manager.scheduleExternalFullscreenRefresh();
    t.mock.timers.tick(10);
    assert.deepEqual(applied, [false]);
  }
  t.mock.timers.tick(100);
  assert.deepEqual(applied, [false], 'stable events must not reapply AOT or cause flicker');
});

test('same-turn signals coalesce and get one bounded geometry-settling recheck', t => {
  const { manager, state, applied } = fixture(t);
  for (let index = 0; index < 100; index++) manager.scheduleExternalFullscreenRefresh();
  t.mock.timers.tick(0);
  assert.equal(state.refreshes, 1);
  state.fullscreen = true; // Fullscreen geometry finishes after the foreground event.
  t.mock.timers.tick(40);
  assert.deepEqual(applied, [false]);
  assert.equal(state.refreshes, 2);
  t.mock.timers.tick(1000);
  assert.equal(state.refreshes, 2, 'no idle polling');
});

test('a queued signal rechecks the current application display instead of applying a stale result', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh();
  state.fullscreen = false; // The viewer moved to an unblocked monitor before dispatch.
  manager.refreshExternalFullscreenState(true);
  t.mock.timers.tick(100);
  assert.deepEqual(applied, [true]);
  state.fullscreen = true; // Moving back to the game monitor must yield again.
  manager.refreshExternalFullscreenState(true);
  assert.deepEqual(applied, [true, false]);
});

test('leaving fullscreen restores AOT only once and still repairs lost native topmost', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(0);
  state.fullscreen = false;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(applied, [false, true]);
  state.topmost = false;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(applied, [false, true, true]);
});

test('brief non-fullscreen Alt+Tab intermediates do not flash AOT back on', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  state.fullscreen = false; // Task switcher / shell owns foreground briefly.
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(0);
  assert.deepEqual(applied, [false], 'restoration should retain its settling window');
  t.mock.timers.tick(10);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(applied, [false], 'no raise/lower cycle during a quick Alt+Tab');
});

test('AOT off cancels both pending checks and ignores late native callbacks', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh();
  manager.appAlwaysOnTop = false;
  manager.stopExternalFullscreenMonitoring();
  manager.scheduleExternalFullscreenRefresh();
  assert.equal(manager.externalFullscreenRefreshTimer, undefined);
  assert.equal(manager.externalFullscreenSettleTimer, undefined);
  t.mock.timers.tick(100);
  assert.deepEqual(applied, []);
  assert.equal(state.refreshes, 0);
  assert.equal(state.stops, 1);
});

test('destroyed windows and unsupported platforms do not trigger fullscreen work', t => {
  const { manager, state, applied } = fixture(t);
  state.destroyed = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.equal(state.refreshes, 0);
  assert.deepEqual(applied, []);
  manager.externalFullscreenMonitoring = false;
  manager.externalFullscreenMonitor.supported = false;
  manager.startExternalFullscreenMonitoring();
  assert.equal(manager.externalFullscreenMonitoring, false);
});

test('refresh errors are contained and later signals can recover', t => {
  const { manager, state, applied, warnings } = fixture(t);
  const refresh = manager.externalFullscreenMonitor.refresh;
  manager.externalFullscreenMonitor.refresh = () => { throw new Error('fixture'); };
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(0);
  assert.equal(warnings.length, 1);
  manager.externalFullscreenMonitor.refresh = refresh;
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(applied, [false]);
});

test('real AOT apply demotes and then restacks behind the game without focus/hide/minimize', t => {
  const { manager, state } = fixture(t);
  const calls = [];
  manager.externalFullscreenBlocksAlwaysOnTop = true;
  state.anchor = 'window:123:0';
  Object.assign(manager.viewerWindow, {
    isAlwaysOnTop: () => state.topmost,
    setAlwaysOnTop(enabled) { calls.push(['aot', enabled]); state.topmost = enabled; },
    moveAbove(anchor) { calls.push(['restack', anchor]); state.anchor = undefined; },
    moveTop() { throw new Error('must not raise the viewer'); },
    focus() { throw new Error('must not change focus'); },
    hide() { throw new Error('must not hide the viewer'); },
    minimize() { throw new Error('must not minimize the viewer'); },
  });
  WindowManager.prototype.applyAlwaysOnTop.call(manager, manager.viewerWindow, false);
  assert.deepEqual(calls, [['aot', false], ['restack', 'window:123:0']]);
  manager.handleExternalFullscreenChanged(true);
  assert.equal(calls.length, 2, 'already-yielded windows do not get moved repeatedly');
});

test('unchanged fullscreen must still repair a normal window remaining above the game', t => {
  const { manager, state, applied } = fixture(t);
  manager.externalFullscreenBlocksAlwaysOnTop = true;
  state.topmost = false;
  state.anchor = 'window:456:0';
  const moves = [];
  manager.viewerWindow.moveAbove = anchor => { moves.push(anchor); state.anchor = undefined; };
  manager.handleExternalFullscreenChanged(true);
  manager.handleExternalFullscreenChanged(true);
  assert.deepEqual(moves, ['window:456:0']);
  assert.deepEqual(applied, [], 'correct cached AOT does not need a toggle');
});

test('other-display focus preserves explicit activation until the fullscreen owner is selected again', t => {
  const { manager, state, applied } = fixture(t);
  state.fullscreen = true;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(applied, [false]);
  // Explicit activation is represented by no yield target, not by abandoning
  // the display's fullscreen owner or by turning global topmost back on.
  state.anchor = undefined;
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  const moves = [];
  manager.viewerWindow.moveAbove = anchor => { moves.push(anchor); state.anchor = undefined; };
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(moves, [], 'explicitly activated viewer stays above when another display gets focus');
  state.anchor = 'window:789:0'; // User returns to the fullscreen game on the viewer's display.
  manager.scheduleExternalFullscreenRefresh(); t.mock.timers.tick(100);
  assert.deepEqual(moves, ['window:789:0']);
  assert.deepEqual(applied, [false], 'no raise/lower cycle that would disturb the taskbar');
});

test('unexpected native topmost restoration during suppression is not ignored', t => {
  const { manager, state, applied } = fixture(t);
  manager.externalFullscreenBlocksAlwaysOnTop = true;
  state.topmost = true;
  manager.handleExternalFullscreenChanged(true);
  assert.deepEqual(applied, [false]);
});

test('manual AOT off, PiP, hidden and minimized viewers are never restacked', t => {
  const { manager, state } = fixture(t);
  state.anchor = 'window:456:0';
  manager.externalFullscreenBlocksAlwaysOnTop = true;
  manager.viewerWindow.moveAbove = () => { throw new Error('unexpected restack'); };
  manager.appAlwaysOnTop = false;
  manager.yieldToExternalFullscreen(manager.viewerWindow);
  manager.appAlwaysOnTop = true; manager.isAnyPictureInPictureActive = () => true;
  manager.yieldToExternalFullscreen(manager.viewerWindow);
  manager.isAnyPictureInPictureActive = () => false; state.visible = false;
  manager.yieldToExternalFullscreen(manager.viewerWindow);
  state.visible = true; state.minimized = true;
  manager.yieldToExternalFullscreen(manager.viewerWindow);
});

test('native WinEvent/monitor regression fixtures (no real windows or focus changes)', {
  skip: process.platform !== 'win32',
}, () => {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)',
    'Microsoft Visual Studio/Installer/vswhere.exe');
  assert.ok(existsSync(vswhere), 'Visual Studio C++ build tools are required');
  const installation = spawnSync(vswhere, ['-latest', '-products', '*', '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' });
  assert.equal(installation.status, 0, installation.stderr);
  const vcvars = path.join(installation.stdout.trim(), 'VC/Auxiliary/Build/vcvars64.bat');
  assert.ok(existsSync(vcvars));
  const output = path.join(root, 'tests/Release/external-fullscreen-monitor');
  mkdirSync(output, { recursive: true });
  const executable = path.join(output, 'fullscreen-test.exe');
  const command = `call "${vcvars}" >nul && cl.exe /nologo /std:c++17 /EHsc /O2 /DUNICODE /D_UNICODE ` +
    `/Fo:"${path.join(output, 'fullscreen-test.obj')}" ` +
    `"${path.join(root, 'tests/windows-foreground-window.test.cpp')}" ` +
    `/link /OUT:"${executable}" /IMPLIB:"${path.join(output, 'fullscreen-test.lib')}" user32.lib`;
  const build = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
    cwd: root, encoding: 'utf8', windowsVerbatimArguments: true,
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const result = spawnSync(executable, [], { cwd: output, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /All native fullscreen fixtures passed/);
});
