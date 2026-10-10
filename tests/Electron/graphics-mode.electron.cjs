const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Real Electron startup policy; isolated profiles, no installed app or user preferences.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const mode = process.argv[2];
assert.ok(['native', 'capture', 'software'].includes(mode));
const profile = fs.mkdtempSync(
    path.join(getTestTempRoot(), 'kawaikara-graphics-'),
);
app.setPath('userData', profile);
const filename = path.resolve(
    __dirname,
    '../../src/Main/Functional/App/ApplicationPreInitialization.ts',
);
const compiled = buildSync({
    entryPoints: [filename],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'cjs',
    write: false,
    define: {
        __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
        __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
        __KAWAIKARA_DISCORD_APP_ID__: '""',
        __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
}).outputFiles[0].text;
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const file = path.join(profile, 'preferences.json');
fs.writeFileSync(file, JSON.stringify({ graphicsMode: mode }));
delete process.env.KAWAIKARA_FORCE_SOFTWARE_RENDERING;
delete process.env.MPV_HWDEC;
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
loaded.exports.configureGraphics(file, { info() {} });
assert.equal(process.env.MPV_HWDEC, 'auto-safe');
if (!process.argv.includes('--baseline')) {
    for (const flag of [
        'ignore-gpu-blocklist',
        'enable-gpu-rasterization',
        'enable-zero-copy',
    ]) {
        assert.equal(
            app.commandLine.hasSwitch(flag),
            false,
            'Respect driver policy: ' + flag,
        );
    }
}
if (process.platform === 'win32') {
    assert.equal(
        app.commandLine.getSwitchValue(
            'disable_direct_composition_video_overlays',
        ),
        mode === 'capture' ? '1' : '',
    );
}
const watchdog = setTimeout(() => {
    console.error('Graphics probe timed out');
    app.exit(1);
}, 30000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            width: 960,
            height: 540,
            webPreferences: {
                backgroundThrottling: false,
                contextIsolation: true,
                sandbox: true,
            },
        });
        await win.loadURL(
            'data:text/html,<canvas width="960" height="540"></canvas>',
        );
        win.showInactive();
        const measurement = await win.webContents
            .executeJavaScript(`(async () => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
    const gaps = []; let last;
    for (let i = 0; i < 120; i++) {
      const time = await new Promise(requestAnimationFrame);
      if (last !== undefined) gaps.push(time - last); last = time;
      if (gl) { gl.clearColor(i / 120, 0.3, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    gaps.sort((a,b) => a-b);
    return { renderer, medianFrameMs: gaps[Math.floor(gaps.length / 2)],
      p95FrameMs: gaps[Math.floor(gaps.length * .95)], gapsOver50Ms: gaps.filter(x => x > 50).length };
  })()`);
        const features = app.getGPUFeatureStatus();
        assert.equal(app.isHardwareAccelerationEnabled(), mode !== 'software');
        if (mode === 'software')
            assert.ok(!features.gpu_compositing.startsWith('enabled'));
        console.log(
            JSON.stringify({
                mode,
                electron: process.versions.electron,
                features,
                ...measurement,
            }),
        );
        clearTimeout(watchdog);
        win.destroy();
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        app.exit(1);
    });
