// Manual integration check: leave an external fullscreen app on the primary
// display before running. Foreground may belong to another display. Only an
// invisible isolated fixture is moved, including between displays when possible.
// No keyboard/mouse input, no existing app windows or user profiles are changed.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtempSync } = require('node:fs');
const Module = require('node:module');
const { app, BrowserWindow, screen } = require('electron');
const { buildSync } = require('esbuild');
app.disableHardwareAcceleration();
app.setPath('userData', mkdtempSync(path.join(os.tmpdir(), 'kawaikara-aot-yield-')));
app.on('window-all-closed', () => {});
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  if (process.platform !== 'win32') { app.exit(0); return; }
  const manifest = require(path.join(root, 'dist/native/kawaikara_windows_foreground.json'));
  const native = require(path.join(root, 'dist/native', manifest.file));
  const filename = path.join(root, 'src/Main/Manager/WindowManager.ts');
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: ['electron', 'electron-mpv-video'], define: {
      __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
  }).outputFiles[0].text, filename);
  const bounds = screen.getPrimaryDisplay().bounds;
  // Independent first-yield scenarios: the real app deliberately never enables
  // AOT again while this same fullscreen foreground still blocks its display.
  for (let cycle = 1; cycle <= 5; cycle++) {
    const manager = Object.create(loaded.exports.WindowManager.prototype);
    const viewer = new BrowserWindow({ x: bounds.x + 24, y: bounds.y + 24, width: 80, height: 80,
      show: false, opacity: 0, frame: false, focusable: true, skipTaskbar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const overlay = new BrowserWindow({ parent: viewer, x: bounds.x + 24, y: bounds.y + 24,
      width: 40, height: 40, show: false, opacity: 0, frame: false, focusable: false, skipTaskbar: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    if (process.argv.includes('--trace')) {
      for (const method of ['setAlwaysOnTop', 'moveTop', 'setPosition']) {
        const original = viewer[method].bind(viewer);
        viewer[method] = (...args) => {
          original(...args);
          console.log('TRACE', method, args, { cached: viewer.isAlwaysOnTop(),
            native: native.isApplicationWindowTopmost(viewer.getNativeWindowHandle()), bounds: viewer.getBounds() });
        };
      }
    }
    Object.assign(manager, {
      viewerWindow: viewer, appAlwaysOnTop: true, externalFullscreenBlocksAlwaysOnTop: true,
      externalFullscreenMonitoring: true,
      isAnyPictureInPictureActive: () => false,
      logger: { info: (...args) => console.log(...args) },
      externalFullscreenMonitor: {
        refresh: window => native.isExternalFullscreenActive(window.getNativeWindowHandle()),
        isAlwaysOnTopApplied: window => native.isApplicationWindowTopmost(window.getNativeWindowHandle()),
        getYieldTarget: window => native.getExternalFullscreenYieldTarget(window.getNativeWindowHandle()),
      },
    });
    try {
      viewer.setAlwaysOnTop(true, 'screen-saver');
      viewer.showInactive();
      overlay.showInactive();
      await sleep(50);
      const handle = viewer.getNativeWindowHandle();
      if (!native.isExternalFullscreenActive(handle)) {
        console.log('SKIP: open an external fullscreen app on the primary display, then rerun.');
        return;
      }
      assert.equal(native.isApplicationWindowTopmost(handle), true);
      assert.ok(native.getExternalFullscreenYieldTarget(handle), 'fixture initially obstructs fullscreen z-order');
      viewer.setAlwaysOnTop(false);
      assert.equal(native.isApplicationWindowTopmost(handle), false);
      console.log('After setAlwaysOnTop(false), still above fullscreen:', Boolean(native.getExternalFullscreenYieldTarget(handle)));
      manager.applyAlwaysOnTop(viewer, false);
      await sleep(50);
      assert.equal(native.isExternalFullscreenActive(handle), true, 'fullscreen still owns the display');
      assert.equal(native.isApplicationWindowTopmost(handle), false);
      assert.equal(native.getExternalFullscreenYieldTarget(handle), undefined, 'viewer and owned overlay are below fullscreen');
      console.log(`PASS ${cycle}: real Electron restacking yielded without activation, hide or minimize.`);
      const otherDisplay = screen.getAllDisplays().find(display => display.id !== screen.getPrimaryDisplay().id);
      if (cycle === 1 && otherDisplay) {
        const destination = otherDisplay.bounds;
        viewer.setPosition(destination.x + 100, destination.y + 100);
        overlay.setPosition(destination.x + 100, destination.y + 100);
        const occupied = native.isExternalFullscreenActive(handle);
        manager.refreshExternalFullscreenState(true);
        await sleep(50);
        assert.equal(manager.getEffectiveAppAlwaysOnTop(), !occupied,
          'AOT policy follows the destination display, not the fullscreen foreground');
        // The fixture is never activated. On some Windows/game configurations,
        // promotion of this invisible background fixture is refused; do not
        // substitute it for the separate interactive taskbar/Alt+Tab check.
        console.log('PASS: destination display policy:', { occupied,
          effectiveAOT: manager.getEffectiveAppAlwaysOnTop(),
          observedFixtureAOT: native.isApplicationWindowTopmost(handle) });
        viewer.setPosition(bounds.x + 24, bounds.y + 24);
        overlay.setPosition(bounds.x + 24, bounds.y + 24);
        manager.refreshExternalFullscreenState(true);
        await sleep(50);
        assert.equal(native.isApplicationWindowTopmost(handle), false);
        assert.equal(native.getExternalFullscreenYieldTarget(handle), undefined);
        console.log('PASS: moving back yields to fullscreen again without refocusing it.');
      }
    } finally {
      overlay.destroy();
      viewer.destroy();
    }
  }
}).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
