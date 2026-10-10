const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function load(file, platform, imports = {}, arch = 'x64') {
    const filename = path.resolve(__dirname, '../../src/Main/Platform', file);
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'cjs',
        write: false,
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        __filename: filename,
        Buffer,
        console,
        process: { ...process, platform, arch },
        require: (id) =>
            Object.hasOwn(imports, id) ? imports[id] : require(id),
    });
    return module.exports;
}

function presentation(platform) {
    const calls = [];
    const app = {
        isPackaged: true,
        setActivationPolicy: (value) => calls.push(['policy', value]),
        dock: {
            hide: () => calls.push(['dock-hide']),
            show: async () => calls.push(['dock-show']),
        },
        focus: (value) => calls.push(['app-focus', value.steal]),
    };
    const window = {
        isDestroyed: () => false,
        isAlwaysOnTop: () => true,
        isVisibleOnAllWorkspaces: () => false,
        isVisible: () => true,
        isMinimized: () => false,
        getNativeWindowHandle: () => Buffer.alloc(8),
        setAlwaysOnTop: (...args) => calls.push(['topmost', ...args]),
        setVisibleOnAllWorkspaces: (value, options) =>
            calls.push([
                'workspaces',
                value,
                options.visibleOnFullScreen,
                options.skipTransformProcessType,
            ]),
        show: () => calls.push(['show']),
        showInactive: () => calls.push(['show-inactive']),
        moveTop: () => calls.push(['raise']),
        focus: () => calls.push(['focus']),
    };
    const api = load('Window/Presentation.ts', platform, {
        electron: { app },
        'node:module': {
            createRequire: () => () => ({
                setFullScreenAuxiliary: () => calls.push(['auxiliary-on']),
                clearFullScreenAuxiliary: () => calls.push(['auxiliary-off']),
            }),
        },
        'node:path': {
            ...path,
            join: (...parts) => parts.filter(Boolean).join('/'),
        },
    });
    return { api, calls, window };
}

for (const platform of ['win32', 'darwin', 'linux']) {
    test(`${platform}: PiP presentation preserves activation and restoration policy`, async () => {
        const { api, calls, window } = presentation(platform);
        api.presentPictureInPicture(
            window,
            { focus: () => calls.push(['content-focus']) },
            true,
        );
        assert.deepEqual(
            calls.map((call) => call[0]),
            platform === 'darwin'
                ? [
                      'policy',
                      'dock-hide',
                      'topmost',
                      'workspaces',
                      'auxiliary-on',
                      'show-inactive',
                      'raise',
                  ]
                : ['show', 'raise', 'focus', 'content-focus'],
        );
        assert.equal(
            api.shouldHidePictureInPictureFromTaskbar(),
            platform !== 'darwin',
        );
        assert.deepEqual(
            [...api.getPictureInPictureReassertionDelays()],
            platform === 'darwin' ? [0, 250, 1000] : [],
        );
        calls.length = 0;
        await api.restorePictureInPicturePresentation(window);
        assert.deepEqual(
            calls.map((call) => call[0]),
            platform === 'darwin'
                ? ['auxiliary-off', 'workspaces', 'policy', 'dock-show']
                : [],
        );
        if (platform === 'darwin') assert.equal(calls[2][1], 'regular');
    });

    test(`${platform}: always-on-top repairs native state without activating a window`, () => {
        const { api, calls, window } = presentation(platform);
        assert.equal(
            api.applyViewerAlwaysOnTop(window, true, false),
            platform === 'win32',
        );
        assert.deepEqual(
            calls.map((call) => call[0]),
            platform === 'win32'
                ? ['topmost', 'topmost', 'raise']
                : platform === 'darwin'
                  ? ['topmost', 'workspaces']
                  : ['topmost'],
        );
        if (platform === 'win32')
            assert.deepEqual(calls[0], ['topmost', false]);
        if (platform === 'darwin')
            assert.deepEqual(calls[1], ['workspaces', true, false, true]);
        assert.equal(
            calls.some((call) => call[0] === 'focus'),
            false,
        );
        calls.length = 0;
        api.applyViewerAlwaysOnTop(window, false, false);
        assert.equal(
            calls.some((call) => call[0] === 'raise'),
            false,
        );
    });

    test(`${platform}: storage roots and shortcut policy expose platform capabilities`, async () => {
        const checked = [];
        const api = load('Storage.ts', platform, {
            'node:fs/promises': {
                ...require('node:fs/promises'),
                stat: async (value) => {
                    checked.push(value);
                    if (value !== 'C:\\') throw new Error('No drive');
                    return { isDirectory: () => true };
                },
            },
        });
        assert.equal(api.supportsCustomDataLocation(), platform === 'win32');
        assert.deepEqual(
            [...(await api.listFileSystemRoots())],
            platform === 'win32' ? ['C:\\'] : ['/'],
        );
        assert.equal(checked.length, platform === 'win32' ? 26 : 0);
        assert.equal(
            api.getFileSystemRootLabel(platform === 'win32' ? 'C:\\' : '/'),
            platform === 'win32' ? 'C:' : '/',
        );
        if (platform !== 'win32') {
            assert.equal(api.readInstalledDataRoot(), undefined);
            assert.throws(
                () => api.resolveDataRootSelection('unused'),
                /unsupported/,
            );
            await assert.rejects(api.writeInstalledDataRoot(), /unsupported/);
        }
        const keyboard = load('Keyboard.ts', platform);
        assert.equal(
            keyboard.getPrimaryShortcutModifier(),
            platform === 'darwin' ? 'meta' : 'control',
        );
        assert.equal(keyboard.supportsRedoWithY(), platform !== 'darwin');
    });
}

test('native video availability is limited to the shipped OS and architecture combinations', () => {
    for (const platform of ['win32', 'darwin', 'linux'])
        for (const arch of ['x64', 'arm64']) {
            const api = load('Graphics.ts', platform, { electron: {} }, arch);
            assert.equal(
                api.hasNativeVideoBackend(),
                (platform === 'win32' && arch === 'x64') ||
                    (platform === 'darwin' && arch === 'arm64'),
            );
            assert.equal(api.shouldPrewarmVideoSurface(), platform === 'win32');
        }
});

test('destroyed PiP windows cannot be shown or activated', () => {
    for (const platform of ['win32', 'darwin', 'linux']) {
        const { api, calls, window } = presentation(platform);
        window.isDestroyed = () => true;
        api.presentPictureInPicture(window);
        assert.deepEqual(calls, []);
    }
});
