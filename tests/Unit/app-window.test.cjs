const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

function load(file, mocks = {}) {
    const code = buildSync({
        entryPoints: [path.resolve(__dirname, '../..', file)],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        external: Object.keys(mocks),
        define: {
            __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
            __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
            __KAWAIKARA_DISCORD_APP_ID__: '""',
            __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
        },
    }).outputFiles[0].text;
    const filename = path.resolve(__dirname, '../..', file);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    loaded._compile(code, filename);
    return loaded.exports;
}
const common = load('src/Common/AppWindow.ts');
const { PreferenceManager } = load('src/Main/Manager/PreferenceManager.ts');
const displays = [
    { id: 1, workArea: { x: 0, y: 24, width: 1920, height: 1016 } },
    { id: 2, workArea: { x: -1600, y: -200, width: 1600, height: 900 } },
];
const plain = (value) => JSON.parse(JSON.stringify(value));
const bounds = (preference, position) =>
    plain(
        common.resolveAppWindowBounds(
            { ...common.DEFAULT_APP_WINDOW, ...preference },
            position,
            displays,
            displays[0],
        ),
    );

test('manual dimensions reject invalid inputs and enforce application limits', () => {
    for (const value of [
        null,
        false,
        [],
        { displayId: 17, monitor: 'display' },
    ]) {
        assert.doesNotThrow(() => common.validateAppWindow(value));
    }
    const result = common.fitAppWindowPreference(
        common.validateAppWindow({ preset: 'custom', width: 2, height: 99999 }),
        displays[0],
    );
    assert.equal(result.width, 720);
    assert.equal(result.height, 1016);
    assert.equal(
        common.validateAppWindow({ width: NaN, height: Infinity }).width,
        1280,
    );
    assert.equal(
        common.validateAppWindowLastPosition({ displayId: '1', x: NaN, y: 0 }),
        undefined,
    );
});

test('last position survives negative-coordinate monitors and preset size changes', () => {
    assert.deepEqual(
        bounds({ preset: '800x600' }, { displayId: '2', x: -1500, y: -100 }),
        { x: -1500, y: -100, width: 800, height: 600 },
    );
    assert.deepEqual(
        bounds({ preset: '1280x720' }, { displayId: '2', x: -200, y: 500 }),
        { x: -1280, y: -20, width: 1280, height: 720 },
    );
});

test('explicit monitor selection centers independently from remembered position', () => {
    assert.deepEqual(
        bounds(
            { preset: '800x600', monitor: 'display', displayId: '2' },
            { displayId: '1', x: 50, y: 50 },
        ),
        { x: -1200, y: -50, width: 800, height: 600 },
    );
    assert.deepEqual(bounds({ preset: '800x600', monitor: 'primary' }), {
        x: 560,
        y: 232,
        width: 800,
        height: 600,
    });
});

test('missing monitors and oversized presets fall back inside the primary work area', () => {
    for (const monitor of ['last-position', 'display']) {
        assert.deepEqual(
            bounds(
                { preset: '7680x4320', monitor, displayId: 'gone' },
                { displayId: 'gone', x: -8000, y: 5000 },
            ),
            { x: 0, y: 24, width: 1920, height: 1016 },
        );
    }
});

test('startup preferences and closing position persist independently across restarts', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kawaikara-window-'));
    try {
        const file = path.join(dir, 'preferences.json');
        const first = new PreferenceManager(file);
        await first.load();
        await first.update({
            appWindow: {
                preset: '1920x1080',
                monitor: 'display',
                displayId: '2',
                width: 800,
                height: 600,
            },
        });
        await first.update({
            appWindowLastPosition: { displayId: '1', x: 80, y: 100, width: 1500, height: 900, fillsWorkArea: true },
        });
        const second = new PreferenceManager(file);
        await second.load();
        const saved = second.get();
        assert.equal(saved.appWindow.preset, '1920x1080');
        assert.equal(saved.appWindow.displayId, '2');
        assert.equal(saved.appWindowLastPosition.x, 80);
        assert.equal(saved.appWindowLastPosition.width, 1500);
        assert.equal(saved.appWindowLastPosition.fillsWorkArea, true);
        saved.appWindow.width = 12;
        assert.equal(
            second.get().appWindow.width,
            800,
            'callers cannot mutate stored state',
        );
        await second.update({
            closeMenuOnEscape: false,
            closeMenuOnOutsideClick: false,
            alwaysOnTop: true,
        });
        assert.equal(second.get().closeMenuOnEscape, true);
        assert.equal(second.get().closeMenuOnOutsideClick, true);
        assert.equal(
            second.get().alwaysOnTop,
            true,
            'Tab-menu always-on-top remains supported',
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('remembering PiP position disables alignment, including legacy settings', () => {
    const { validatePictureInPicturePlacement } = load(
        'src/Common/PictureInPicture.ts',
    );
    assert.equal(
        validatePictureInPicturePlacement({
            monitor: { mode: 'last-position' },
            align: true,
        }).align,
        false,
    );
    assert.equal(
        validatePictureInPicturePlacement({ position: 'last', align: true })
            .align,
        false,
    );
    assert.equal(
        validatePictureInPicturePlacement({
            monitor: { mode: 'primary' },
            align: true,
        }).align,
        true,
    );
});

test('last monitor centers while last position restores exact coordinates', () => {
    const last = { displayId: '2', x: -1500, y: -100 };
    assert.deepEqual(
        bounds({ preset: '800x600', monitor: 'last-display' }, last),
        { x: -1200, y: -50, width: 800, height: 600 },
    );
    assert.deepEqual(
        bounds({ preset: '800x600', monitor: 'last-position' }, last),
        { x: -1500, y: -100, width: 800, height: 600 },
    );
    for (const monitor of ['last-position', 'last-display']) {
        assert.deepEqual(
            bounds(
                { preset: '800x600', monitor },
                { ...last, displayId: 'missing' },
            ),
            { x: 560, y: 232, width: 800, height: 600 },
        );
    }
});

test('remembered size overrides presets and full-area intent follows a fallback monitor', () => {
    const last = { displayId: '2', x: -1500, y: -100, width: 900, height: 650 };
    assert.equal(bounds({ rememberSize: true }, last).width, 900);
    assert.equal(bounds({ rememberSize: false }, last).width, 1280);
    assert.deepEqual(
        bounds(
            { rememberSize: true },
            { ...last, displayId: 'missing', fillsWorkArea: true },
        ),
        { x: 0, y: 24, width: 1920, height: 1016 },
    );
    assert.deepEqual(
        bounds({ preset: 'maximum', monitor: 'display', displayId: '2' }),
        { x: -1600, y: -200, width: 1600, height: 900 },
    );
});

test('default is 1280x720 and oversized selections normalize to the OS work area', () => {
    assert.equal(common.validateAppWindow(undefined).preset, '1280x720');
    const normalized = common.fitAppWindowPreference(
        { ...common.DEFAULT_APP_WINDOW, preset: '7680x4320' },
        displays[1],
    );
    assert.equal(normalized.preset, 'custom');
    assert.equal(normalized.width, 1600);
    assert.equal(normalized.height, 900);
    const wide = {
        id: 3,
        workArea: { x: 0, y: 0, width: 10000, height: 5000 },
    };
    assert.equal(
        common.fitAppWindowPreference(
            { ...common.DEFAULT_APP_WINDOW, preset: 'custom', width: 9000 },
            wide,
        ).width,
        9000,
    );
});

const { WindowManager } = load('src/Main/Manager/WindowManager.ts', {
    electron: {
        screen: {
            getAllDisplays: () => displays,
            getPrimaryDisplay: () => displays[0],
            getDisplayMatching: (bounds) =>
                bounds.x < 0 ? displays[1] : displays[0],
        },
    },
    'electron-mpv-video': {},
});
function nativeFixture(preference = common.DEFAULT_APP_WINDOW) {
    const window = new EventEmitter();
    let current = { x: 30, y: 40, width: 1000, height: 700 };
    const calls = [];
    Object.assign(window, {
        isDestroyed: () => false,
        isMaximized: () => false,
        isFullScreen: () => false,
        getNormalBounds: () => current,
        getBounds: () => current,
        setBounds: (bounds) => {
            calls.push(bounds);
            current = bounds;
        },
        unmaximize: () => {},
    });
    const manager = Object.create(WindowManager.prototype);
    manager.viewerWindow = window;
    manager.configureStartupWindow(
        preference,
        { displayId: '2', x: -1500, y: -100 },
        async () => {},
    );
    return { manager, window, calls };
}

test('native save applies changed dimensions but leaves unrelated and memory-only saves alone', async () => {
    const { manager, calls } = nativeFixture();
    await manager.applyAppWindowPreference({
        ...common.DEFAULT_APP_WINDOW,
        rememberSize: true,
    });
    assert.equal(calls.length, 0);
    const next = manager.normalizeAppWindowPreference({
        ...common.DEFAULT_APP_WINDOW,
        preset: '720x480',
    });
    await manager.applyAppWindowPreference(next);
    assert.deepEqual(calls[0], { x: 30, y: 40, width: 720, height: 480 });
    await manager.applyAppWindowPreference(next);
    assert.equal(calls.length, 1);
});

test('native monitor policy applies last monitor center and records maximized area intent', async () => {
    const { manager, window, calls } = nativeFixture({
        ...common.DEFAULT_APP_WINDOW,
        monitor: 'primary',
    });
    await manager.applyAppWindowPreference({
        ...common.DEFAULT_APP_WINDOW,
        preset: '800x600',
        monitor: 'last-display',
    });
    assert.deepEqual(calls[0], { x: -1200, y: -50, width: 800, height: 600 });
    let saved;
    manager.appWindowPositionRecorder = async (position) => {
        saved = position;
    };
    window.isMaximized = () => true;
    await manager.recordAppWindowPosition();
    assert.deepEqual(saved, {
        displayId: '2',
        ...displays[1].workArea,
        fillsWorkArea: true,
    });
});
