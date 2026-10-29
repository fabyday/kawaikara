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
        URL,
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
    const api = load('Presentation.ts', platform, {
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

for (const platform of ['darwin', 'win32', 'linux']) {
    test(`${platform}: default browser validates URLs before invoking native policy`, async () => {
        const opened = [];
        const api = load('DefaultBrowser.ts', platform, {
            electron: {
                shell: { openExternal: async (...args) => opened.push(args) },
            },
        });
        for (const value of [
            'file:///secret',
            'https://user:pass@example.com',
            'not a URL',
        ]) {
            await assert.rejects(api.openInDefaultBrowser(value));
        }
        assert.equal(opened.length, 0);
        await api.openInDefaultBrowser('https://example.com');
        assert.equal(opened[0][0], 'https://example.com/');
        assert.deepEqual(
            Object.keys(opened[0][1]),
            platform === 'darwin'
                ? ['activate']
                : platform === 'win32'
                  ? ['logUsage']
                  : [],
        );
    });

    test(`${platform}: arbitrary external applications use native protocol launch`, async () => {
        const commands = [], opened = [];
        const api = load('ExternalApplication.ts', platform, {
            electron: { shell: { openExternal: async value => opened.push(value) } },
            'node:child_process': {
                execFile(command, args, options, callback) {
                    commands.push([command, args, options]); callback(null, '', '');
                },
            },
        });
        const link = 'example-editor://edit?document=fixture';
        await api.launchExternalApplication(link, '/fixture/editor.app');
        if (platform === 'darwin') {
            assert.equal(commands[0][0], '/usr/bin/open');
            assert.deepEqual(Array.from(commands[0][1]), ['-a', '/fixture/editor.app', link]);
        } else assert.deepEqual(opened, [link]);
    });

    test(`${platform}: native addon loading is deferred until its feature is used`, () => {
        let loads = 0;
        const api = load('ExternalFullscreenMonitor.ts', platform, {
            electron: {},
            'node:module': {
                createRequire: () => {
                    loads++;
                    throw new Error('unexpected addon load');
                },
            },
        });
        const monitor = api.createExternalFullscreenMonitor();
        assert.equal(monitor.supported, platform === 'win32');
        monitor.stop();
        assert.equal(loads, 0);
        if (platform !== 'win32') {
            assert.equal(
                monitor.start({}, () => assert.fail('unexpected notification')),
                false,
            );
            assert.equal(monitor.refresh({}), false);
            assert.equal(monitor.isAlwaysOnTopApplied({}), undefined);
            assert.equal(monitor.getYieldTarget({}), undefined);
        }
    });
}

test('Darwin capture settings preserve existing disabled Chromium features', () => {
    const switches = new Map([
        ['disable-features', 'existing-feature,avfoundation-overlays'],
    ]);
    const api = load('Graphics.ts', 'darwin', {
        electron: {
            app: {
                commandLine: {
                    getSwitchValue: (name) => switches.get(name) ?? '',
                    removeSwitch: (name) => switches.delete(name),
                    appendSwitch: (name, value) => switches.set(name, value),
                },
            },
        },
    });
    api.configureCaptureCompatibleGraphics();
    api.configureCaptureCompatibleGraphics();
    assert.equal(
        switches.get('disable-features'),
        'existing-feature,avfoundation-overlays',
    );
});

test('unknown operating systems cannot silently inherit Linux behavior', () => {
    assert.throws(
        () => load('Keyboard.ts', 'freebsd'),
        /Unsupported operating system: freebsd/,
    );
});


test('darwin: repeated PiP reassertions do not transform application type or request focus', async () => {
    const { api, calls, window } = presentation('darwin');
    api.preparePictureInPicturePresentation();
    api.presentPictureInPicture(window);
    api.presentPictureInPicture(window);
    assert.equal(calls.filter(c => c[0] === 'policy').length, 1);
    assert.equal(calls.filter(c => c[0] === 'dock-hide').length, 1);
    assert.ok(calls.filter(c => c[0] === 'workspaces').every(c => c[3] === true));
    assert.ok(!calls.some(c => ['focus','app-focus'].includes(c[0])));
    await api.restorePictureInPicturePresentation(window);
    calls.length = 0;
    api.preparePictureInPicturePresentation();
    assert.deepEqual(calls.map(c => c[0]), ['policy','dock-hide']);
});
