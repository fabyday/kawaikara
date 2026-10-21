const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const path = require('node:path');
const { buildSync } = require('esbuild');

function loadSource(relative, mocks) {
    const filename = path.resolve(__dirname, '../..', relative);
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
        external: Object.keys(mocks),
    }).outputFiles[0].text;
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    loaded._compile(code, filename);
    return loaded.exports;
}
const { bindWindowInput, resolveWindowInput, resolveBrowserNavigation } =
    loadSource('src/Main/Functional/Window/WindowInput.ts', { electron: {} });
function key(key, extra = {}) {
    return {
        key,
        type: 'keyDown',
        isAutoRepeat: false,
        isComposing: false,
        control: false,
        meta: false,
        alt: false,
        shift: false,
        ...extra,
    };
}
function state(extra = {}) {
    return {
        surface: 'overlay',
        active: true,
        editing: false,
        overlay: 'menu',
        closeMenuOnEscape: true,
        videoVisible: false,
        videoPictureInPicture: false,
        ...extra,
    };
}

test('modal Back and menu actions preserve editing, IME, modifier and shortcut ownership', () => {
    assert.equal(
        resolveWindowInput(
            key('Escape'),
            state({ overlay: 'preference', editing: true }),
        ),
        'back',
    );
    assert.equal(
        resolveWindowInput(
            key('Backspace'),
            state({ overlay: 'preference', editing: true }),
        ),
        'renderer',
    );
    assert.equal(
        resolveWindowInput(key('Backspace'), state({ overlay: 'preference' })),
        'back',
    );
    assert.equal(
        resolveWindowInput(
            key('Tab', { shift: true }),
            state({ overlay: 'preference' }),
        ),
        'consume',
    );
    assert.equal(
        resolveWindowInput(key('Tab'), state({ overlay: 'update' })),
        'renderer',
    );
    assert.equal(
        resolveWindowInput(key('p'), state({ overlay: 'update' })),
        'renderer',
    );
    assert.equal(
        resolveWindowInput(key('Tab'), state({ editing: true })),
        'toggle-menu',
    );
    assert.equal(
        resolveWindowInput(key('Escape'), state({ editing: true })),
        'renderer',
    );
    assert.equal(
        resolveWindowInput(key('Escape'), state({ closeMenuOnEscape: false })),
        'shortcut',
    );
    for (const extra of [
        { isAutoRepeat: true },
        { isComposing: true },
        { control: true },
        { meta: true },
        { alt: true },
        { shift: true },
        { type: 'keyUp' },
    ]) {
        assert.equal(
            resolveWindowInput(key('Tab', extra), state()),
            'shortcut',
        );
    }
});

test('Video host and retained view share actions, while PiP consumes menu keys and editors keep Space', () => {
    for (const surface of ['viewer', 'video']) {
        const active = state({
            surface,
            videoVisible: true,
            overlay: undefined,
        });
        assert.equal(resolveWindowInput(key('Tab'), active), 'toggle-menu');
        assert.equal(
            resolveWindowInput(key('Tab'), {
                ...active,
                videoPictureInPicture: true,
            }),
            'consume',
        );
        assert.equal(resolveWindowInput(key(' '), active), 'toggle-playback');
        assert.equal(
            resolveWindowInput(key(' ', { code: 'Space' }), {
                ...active,
                editing: true,
            }),
            'shortcut',
        );
        assert.equal(
            resolveWindowInput(key('Tab'), { ...active, videoVisible: false }),
            'shortcut',
        );
    }
    assert.equal(resolveBrowserNavigation('browser-backward'), 'back');
    assert.equal(resolveBrowserNavigation('browser-forward'), 'forward');
    assert.equal(resolveBrowserNavigation('media-play-pause'), undefined);
});

test('input binding reads live state and prioritizes native editing over actions and shortcuts', () => {
    const contents = new EventEmitter();
    const seen = [];
    contents.copy = () => seen.push('copy');
    let current = state();
    bindWindowInput(contents, {
        getState: () => current,
        dispatch: (action) => seen.push(action),
        shortcut: (_input, editing) => {
            seen.push(['shortcut', editing]);
            return true;
        },
    });
    function emit(input) {
        let prevented = false;
        contents.emit(
            'before-input-event',
            {
                preventDefault: () => {
                    prevented = true;
                },
            },
            input,
        );
        return prevented;
    }
    assert.equal(emit(key('Tab')), true);
    current = state({ surface: 'site', editing: true });
    assert.equal(
        emit(
            key('c', {
                [process.platform === 'darwin' ? 'meta' : 'control']: true,
            }),
        ),
        true,
    );
    assert.equal(emit(key('x')), true);
    current = state({ surface: 'site', active: false });
    assert.equal(emit(key('Tab')), false);
    current = state({ overlay: 'preference', editing: true });
    assert.equal(emit(key('Backspace')), false);
    assert.deepEqual(seen, ['toggle-menu', 'copy', ['shortcut', true]]);
});

function playbackFixture() {
    const attached = [],
        detached = [];
    let disposed = 0;
    const { VideoPlaybackRuntime } = loadSource(
        'src/Main/Functional/Video/VideoPlaybackRuntime.ts',
        {
            electron: {
                app: {
                    isPackaged: false,
                    isHardwareAccelerationEnabled: () => true,
                },
            },
            'electron-mpv-video': {
                createMpvMain: () => ({
                    attachWindow: (host) => attached.push(host),
                    detachWindow: async (host) => detached.push(host),
                    dispose: async () => {
                        disposed++;
                    },
                }),
            },
        },
    );
    function view(id) {
        const webContents = new EventEmitter();
        Object.assign(webContents, { id, isDestroyed: () => false });
        return { webContents };
    }
    let current = view(1),
        pip = false,
        replacements = 0,
        replace;
    const runtime = new VideoPlaybackRuntime(
        {
            getView: () => current,
            isPictureInPicture: () => pip,
            replaceView: async (video) => {
                replacements++;
                return replace ? replace(video) : true;
            },
        },
        { warn() {}, error() {} },
    );
    runtime.getCapabilities = () => ({ nativeBackendAvailable: true });
    return {
        runtime,
        view,
        attached,
        detached,
        get disposed() {
            return disposed;
        },
        get current() {
            return current;
        },
        set current(value) {
            current = value;
        },
        set pip(value) {
            pip = value;
        },
        set replace(value) {
            replace = value;
        },
        get replacements() {
            return replacements;
        },
    };
}

test('native playback owns attachment/detachment while retained views survive host changes', async () => {
    const f = playbackFixture();
    f.runtime.attach(f.current);
    assert.equal(f.attached[0].webContents, f.current.webContents);
    // Moving the same retained view into PiP does not require a second native attachment.
    f.pip = true;
    assert.equal(await f.runtime.recover(1), false);
    f.pip = false;
    assert.equal(await f.runtime.recover(999), false);
    await f.runtime.detach(f.current);
    await f.runtime.detach(f.current);
    assert.deepEqual(f.detached, [f.attached[0]]);
    await f.runtime.dispose();
    assert.equal(f.disposed, 1);
});

test('recovery coalesces concurrent requests and selects software before replacing the view', async () => {
    const f = playbackFixture();
    let finish;
    f.replace = () => {
        assert.deepEqual(f.runtime.rendererPreferences, {
            disableBlinkFeatures: 'WebGPU',
        });
        return new Promise((resolve) => {
            finish = resolve;
        });
    };
    const first = f.runtime.recover(1);
    assert.equal(f.runtime.recover(1), first);
    finish(true);
    assert.equal(await first, true);
    assert.equal(await f.runtime.recover(1), false);
    assert.equal(f.replacements, 1);
    await f.runtime.dispose();
});

test('readiness, destruction, and disposal cannot leave a watchdog recovering a stale renderer', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = playbackFixture();
    f.runtime.attach(f.current);
    f.runtime.markReady(1);
    f.runtime.watch(f.current); // Renderer ready may arrive before loadFile resolves.
    t.mock.timers.tick(5000);
    assert.equal(f.replacements, 0);
    const old = f.current;
    f.current = f.view(2);
    f.runtime.attach(f.current);
    f.runtime.watch(f.current);
    f.runtime.markReady(old.webContents.id);
    f.runtime.forget(old.webContents.id);
    t.mock.timers.tick(5000);
    await Promise.resolve();
    assert.equal(f.replacements, 1);
    await f.runtime.dispose();

    const stopped = playbackFixture();
    stopped.runtime.watch(stopped.current);
    await stopped.runtime.dispose();
    t.mock.timers.tick(5000);
    assert.equal(stopped.replacements, 0);
});

test('native close is intercepted before asynchronous preparation, and only navigation commands dispatch', () => {
    const { bindViewerWindowEvents } = loadSource(
        'src/Main/Functional/Window/ViewerWindowEvents.ts',
        { electron: {} },
    );
    const viewer = new EventEmitter(),
        seen = [];
    let defer = true;
    bindViewerWindowEvents(viewer, {
        layout() {},
        refreshStacking() {},
        topmostChanged() {},
        fullScreenChanged() {},
        visible() {},
        focused() {},
        closed: () => seen.push('closed'),
        navigate: (direction) => seen.push(direction),
        shouldDeferClose: () => defer,
        prepareClose: () => seen.push('prepare'),
    });
    viewer.emit('app-command', {}, 'media-play-pause');
    viewer.emit('app-command', {}, 'browser-backward');
    viewer.emit('close', { preventDefault: () => seen.push('prevent') });
    defer = false;
    viewer.emit('close', { preventDefault: () => seen.push('unexpected') });
    viewer.emit('closed');
    assert.deepEqual(seen, ['back', 'prevent', 'prepare', 'closed']);
});

test('late load completion after playback disposal cannot restart recovery', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = playbackFixture();
    await f.runtime.dispose();
    f.runtime.watch(f.current);
    t.mock.timers.tick(5000);
    assert.equal(await f.runtime.recover(1), false);
    assert.equal(f.replacements, 0);
});

test('site bindings read current Provider policy and intercept only application actions in subframes', () => {
    const { bindSiteSurfaceEvents } = loadSource(
        'src/Main/Functional/Window/SiteSurfaceEvents.ts',
        { electron: {} },
    );
    const contents = new EventEmitter(),
        actions = [],
        routes = [];
    let current = true,
        allowed = true,
        policy = 'deny',
        openWindow;
    contents.setWindowOpenHandler = (handler) => {
        openWindow = handler;
    };
    bindSiteSurfaceEvents(
        contents,
        {},
        {
            isCurrent: () => current,
            getViewer: () => undefined,
            ready() {},
            applyTheme() {},
            refreshSurface() {},
            parseAction: (url) =>
                url.startsWith('kawaikara:') ? 'open' : undefined,
            dispatchAction: (action) => actions.push(action),
            allowNavigation: () => allowed,
            resolveWindowPolicy: () => policy,
            navigated: (url) => routes.push(url),
            clearEditing() {},
            titleChanged() {},
            devToolsChanged() {},
            popupOpened() {},
            popupClosed() {},
            logger: { debug() {}, warn() {}, error() {} },
        },
    );
    const page = 'https://video.example/watch';
    function navigation(eventName, url) {
        let prevented = false;
        const event = {
            url,
            preventDefault: () => {
                prevented = true;
            },
        };
        contents.emit(eventName, event, url);
        return prevented;
    }
    assert.equal(navigation('will-navigate', page), false);
    allowed = false;
    assert.equal(navigation('will-redirect', page), true);
    assert.equal(openWindow({ url: page }).action, 'deny');
    assert.equal(navigation('will-frame-navigate', page), false);
    assert.equal(navigation('will-frame-navigate', 'kawaikara:open'), true);
    assert.deepEqual(actions, ['open']);
    allowed = true;
    policy = 'popup';
    assert.equal(openWindow({ url: page }).action, 'allow');
    current = false;
    assert.equal(navigation('will-navigate', 'kawaikara:open'), true);
    assert.equal(openWindow({ url: 'kawaikara:open' }).action, 'deny');
    assert.deepEqual(
        actions,
        ['open'],
        'retired sites cannot dispatch Provider actions',
    );
    current = true;
    contents.emit('did-navigate-in-page', {}, page, false);
    contents.emit('did-navigate-in-page', {}, page, true);
    assert.deepEqual(
        routes,
        [page],
        'PiP policy is evaluated only for committed main-frame routes',
    );
});

test('external app modal owns Escape and ordinary keys without triggering site shortcuts', () => {
    assert.equal(resolveWindowInput(key('Escape'), state({ overlay: 'external-app', editing: true })), 'back');
    assert.equal(resolveWindowInput(key('Tab'), state({ overlay: 'external-app' })), 'renderer');
    assert.equal(resolveWindowInput(key('p'), state({ overlay: 'external-app' })), 'renderer');
});
