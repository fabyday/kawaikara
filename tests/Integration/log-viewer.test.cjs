const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
// Load only the orchestrator itself: no player, user profile, or native windows.
const windowsModule = new Module(__filename);
windowsModule.require = (id) =>
    id.startsWith('node:')
        ? require(id)
        : id === '../../Common/IPC'
          ? { IPC_CHANNELS: { overlay: { hidden: 'hidden' } } }
          : {};
windowsModule._compile(
    buildSync({
        entryPoints: [path.join(root, 'src/Main/Manager/WindowManager.ts')],
        bundle: false,
        platform: 'node',
        format: 'cjs',
        write: false,
    }).outputFiles[0].text,
    __filename,
);
const { WindowManager } = windowsModule.exports;
const windowState = () => {
    const calls = [];
    const content = (name) => ({
        isDestroyed: () => false,
        focus: () => calls.push(name),
    });
    const windows = Object.assign(Object.create(WindowManager.prototype), {
        overlayVisible: true,
        overlaySurface: {
            webContents: { ...content('overlay'), send: () => {} },
            setVisible: (value) => calls.push(['visible', value]),
        },
        siteView: { webContents: content('site') },
        videoView: { webContents: content('video'), getVisible: () => true },
        viewerWindow: { focus: () => {} },
        logViewer: {
            focusEmbedded: () => true,
            isEmbedded: () => true,
            close: () =>
                assert.fail(
                    'Closing the menu must not close the independent log viewer',
                ),
        },
        clearOverlayRevealTimer: () => {},
        syncOverlayBounds: () => {},
    });
    return { windows, calls };
};

test('closing menu/preferences does not close or defocus an embedded log viewer', () => {
    const { windows, calls } = windowState();
    windows.hideOverlay();
    assert.equal(windows.overlayVisible, false);
    assert.deepEqual(calls, [['visible', false]]);
});

test('log close focuses only the underlying visible layer without reopening anything', () => {
    const { windows, calls } = windowState();
    windows.focusUnderlyingLogViewer();
    windows.overlayVisible = false;
    windows.focusUnderlyingLogViewer();
    windows.internalVideoVisible = true;
    windows.focusUnderlyingLogViewer();
    assert.deepEqual(calls, ['overlay', 'site', 'video']);
    assert.equal(windows.overlayVisible, false);
});

test('delayed Video focus cannot take input from the returned log viewer', () => {
    const { windows, calls } = windowState();
    windows.overlayVisible = false;
    windows.internalVideoVisible = true;
    windows.focusInternalVideoView();
    assert.deepEqual(calls, []);
});

test('WindowManager authorizes log surface commands and owns its appearance state', async () => {
    const calls = [];
    let detached = false;
    const windows = Object.assign(Object.create(WindowManager.prototype), {
        overlaySurface: { webContents: { id: 10 } },
        appTheme: 'dark',
        appLocale: 'ko',
        logViewer: {
            owns: (id) => id === 20,
            isDetached: () => detached,
            open: async () => calls.push('open'),
            toggle: async () => {
                detached = !detached;
                calls.push('toggle');
            },
            close: () => calls.push('close'),
        },
    });
    for (const [sender, command] of [
        [99, 'open'],
        [10, 'toggle'],
        [10, 'close'],
        [99, 'state'],
        [20, 'open'],
        [20, 'invalid'],
    ]) {
        await assert.rejects(
            windows.commandLogViewer(sender, command),
            /Invalid log viewer command or sender/,
        );
    }
    assert.deepEqual(calls, []);
    assert.deepEqual(await windows.commandLogViewer(10, 'open'), {
        detached: false,
        theme: 'dark',
        locale: 'ko',
    });
    assert.deepEqual(await windows.commandLogViewer(20, 'toggle'), {
        detached: true,
        theme: 'dark',
        locale: 'ko',
    });
    windows.appTheme = 'light';
    windows.appLocale = 'ja';
    assert.deepEqual(await windows.commandLogViewer(20, 'state'), {
        detached: true,
        theme: 'light',
        locale: 'ja',
    });
    await windows.commandLogViewer(20, 'close');
    assert.deepEqual(calls, ['open', 'toggle', 'close']);
});
