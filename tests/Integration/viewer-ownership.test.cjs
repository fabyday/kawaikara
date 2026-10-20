const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const root = path.resolve(__dirname, '../..');
function load(relative, mocks = {}) {
    const filename = path.join(root, relative),
        instance = new Module(filename, module);
    instance.paths = module.paths;
    instance.require = (name) =>
        Object.hasOwn(mocks, name)
            ? mocks[name]
            : Module.prototype.require.call(instance, name);
    instance._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            write: false,
            platform: 'node',
            format: 'cjs',
            external: Object.keys(mocks),
            define: {
                __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
                __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
                __KAWAIKARA_DISCORD_APP_ID__: '""',
                __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
            },
        }).outputFiles[0].text,
        filename,
    );
    return instance.exports;
}
let id = 0;
class Contents extends EventEmitter {
    constructor() {
        super();
        this.id = ++id;
        this.destroyed = false;
        this.sent = [];
        this.session = {
            flushStorageData() {},
            cookies: { flushStore: async () => {} },
        };
    }
    isDestroyed() {
        return this.destroyed;
    }
    send(...args) {
        this.sent.push(args);
    }
    loadURL() {
        return Promise.resolve();
    }
    loadFile() {
        return Promise.resolve();
    }
    executeJavaScript() {
        return Promise.resolve();
    }
    focus() {}
    invalidate() {}
    close() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.emit('destroyed');
    }
}
class Surface {
    constructor() {
        this.webContents = new Contents();
        this.visible = false;
    }
    setBackgroundColor() {}
    setVisible(value) {
        this.visible = value;
    }
    getVisible() {
        return this.visible;
    }
    setBounds(bounds) {
        this.bounds = bounds;
    }
}
class Window extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.webContents = new Contents();
        this.children = new Set();
        this.contentView = {
            addChildView: (view) => this.children.add(view),
            removeChildView: (view) => this.children.delete(view),
        };
        this.visible = true;
        this.destroyed = false;
    }
    isDestroyed() {
        return this.destroyed;
    }
    isVisible() {
        return this.visible;
    }
    isFullScreen() {
        return false;
    }
    isMaximized() {
        return false;
    }
    isMinimized() {
        return false;
    }
    getContentSize() {
        return [1280, 720];
    }
    getBounds() {
        return { x: 10, y: 10, width: 1280, height: 720 };
    }
    getNormalBounds() {
        return this.getBounds();
    }
    setMenu() {}
    setMenuBarVisibility() {}
    setTitle() {}
    setBackgroundColor() {}
    setAlwaysOnTop() {}
    loadURL() {
        return Promise.resolve();
    }
    focus() {}
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.emit('closed');
        this.webContents.close();
    }
    close() {
        this.destroy();
    }
    static getAllWindows() {
        return [];
    }
}
function fixture() {
    const display = {
        id: 1,
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
    };
    const screen = Object.assign(new EventEmitter(), {
        getAllDisplays: () => [display],
        getPrimaryDisplay: () => display,
        getDisplayMatching: () => display,
    });
    const calls = [];
    const native = {
        attachWindow: (host) => calls.push(['attach', host.webContents.id]),
        detachWindow: async (host) =>
            calls.push(['detach', host.webContents.id]),
        dispose: async () => calls.push(['dispose']),
    };
    const electron = {
        app: { getLocale: () => 'en-US', isPackaged: false },
        BrowserWindow: Window,
        WebContentsView: Surface,
        screen,
        session: { defaultSession: new Contents().session },
    };
    const { createViewerRuntime } = load(
        'src/Main/Functional/Viewer/ViewerRuntime.ts',
        { electron, 'electron-mpv-video': { createMpvMain: () => native } },
    );
    const runtime = createViewerRuntime(
        { close: async () => {}, cancelLogin: async () => {} },
        () => ({
            isActive: () => false,
            exitAllModes: async () => {},
            handleViewerClosed() {},
            setSubtitleControllerFactory() {},
        }),
        {
            getLogger: () => ({ info() {}, warn() {}, debug() {}, error() {} }),
            attachRenderer() {},
        },
    );
    runtime.video.videoPlayback.getCapabilities = () => ({
        nativeBackendAvailable: false,
    });
    return { runtime, calls, screen };
}

test('real composition creates independent state owners and retains playback across presentation changes', async () => {
    const { runtime: r, calls } = fixture();
    r.viewer.createWindows();
    const host = r.windows.requireViewerWindow();
    assert.ok(host.children.has(r.viewer.overlaySurface));
    assert.equal('overlayVisible' in r.windows, false);
    assert.equal('videoView' in r.windows, false);
    assert.equal('siteView' in r.windows, false);
    assert.equal('videoPlayback' in r.viewer, false);
    const first = await r.video.ensureVideoView();
    r.viewer.internalVideoVisible = true;
    r.video.setInternalVideoSiteVisibility(first, true);
    r.video.setInternalVideoSiteVisibility(first, false);
    assert.equal(await r.video.ensureVideoView(), first);
    assert.deepEqual(calls, [['attach', first.webContents.id]]);
    await r.lifecycle.dispose();
    assert.equal(host.isDestroyed(), true);
    assert.equal(first.webContents.isDestroyed(), true);
    assert.equal(calls.filter((c) => c[0] === 'detach').length, 1);
    assert.equal(calls.filter((c) => c[0] === 'dispose').length, 1);
    assert.equal(host.listenerCount('resize'), 0);
    assert.equal(first.webContents.listenerCount('before-input-event'), 0);
    assert.equal(r.lifecycle.dispose(), r.lifecycle.dispose());
});

test('update preparation is reversible and reuses the current request without duplicating input connections', async () => {
    const { runtime: r } = fixture();
    r.viewer.createWindows();
    const before = await r.video.ensureVideoView();
    r.viewer.internalVideoVisible = true;
    r.video.queueVideoOpenRequest({ kind: 'local', path: 'owned.mp4' });
    await r.lifecycle.prepareForUpdateInstallation();
    assert.equal(before.webContents.isDestroyed(), true);
    assert.throws(
        () => r.video.queueYouTubeDownloader('https://example.com/'),
        /not accepting/,
    );
    await r.lifecycle.recoverAfterFailedUpdate();
    assert.equal(r.lifecycle.preparingUpdate, false);
    assert.notEqual(r.video.videoView, before);
    assert.equal(
        r.video.videoView.webContents.listenerCount('before-input-event'),
        1,
    );
    assert.equal(r.video.pendingVideoOpenRequest.path, 'owned.mp4');
    await r.lifecycle.dispose();
});

test('shutdown continues releasing native playback and windows after another feature fails', async () => {
    const { runtime: r, calls } = fixture();
    r.viewer.createWindows();
    const window = r.windows.requireViewerWindow();
    await r.video.ensureVideoView();
    r.site.cancelExternalLogin = async () => {
        throw new Error('login teardown failed');
    };
    await assert.rejects(r.lifecycle.dispose(), AggregateError);
    assert.equal(window.isDestroyed(), true);
    assert.ok(calls.some((c) => c[0] === 'dispose'));
});

test('event connection disposal leaves unrelated listeners and rolls back partial registration', () => {
    const { ownEventConnections } = load(
        'src/Main/Functional/Window/EventConnections.ts',
    );
    const emitter = new EventEmitter(),
        calls = [];
    emitter.on('tick', () => calls.push('external'));
    const dispose = ownEventConnections(emitter, 'destroyed', () =>
        emitter.on('tick', () => calls.push('owned')),
    );
    dispose();
    dispose();
    emitter.emit('tick');
    assert.deepEqual(calls, ['external']);
    assert.throws(
        () =>
            ownEventConnections(emitter, 'destroyed', () => {
                emitter.on('tick', () => calls.push('partial'));
                throw new Error('failed');
            }),
        /failed/,
    );
    emitter.emit('tick');
    assert.deepEqual(calls, ['external', 'external']);
});

test('native window ownership cannot regain content, input, IPC, or decoder responsibilities', () => {
    const source = readFileSync(
        path.join(root, 'src/Main/Manager/WindowManager.ts'),
        'utf8',
    );
    for (const symbol of [
        'ProviderManager',
        'ViewerController',
        'VideoController',
        'electron-mpv-video',
        'IPC_CHANNELS',
        'overlayView',
        'siteView',
        'videoView',
        'before-input-event',
        'editingWebContentsIds',
    ]) {
        assert.equal(source.includes(symbol), false, symbol);
    }
    const viewer = readFileSync(
        path.join(root, 'src/Main/Functional/Viewer/ViewerController.ts'),
        'utf8',
    );
    assert.equal(viewer.includes('videoPlayback'), false);
    assert.equal(viewer.includes('createSitePagePipeline'), false);
});

test('queued PiP commands observe the current request gate and prevent decoder replacement during transfer', async () => {
    const { runtime: r } = fixture();
    r.viewer.createWindows();
    const video = await r.video.ensureVideoView();
    let finish,
        starts = 0;
    r.pip.canEnterPictureInPicture = () => true;
    r.pip.togglePictureInPictureWithOverlay = async () => {
        starts++;
        await new Promise((resolve) => {
            finish = resolve;
        });
        return { status: 'entered', mode: 'window' };
    };
    const first = r.pip.togglePictureInPicture();
    const second = r.pip.toggleGamePictureInPicture();
    const rejected = assert.rejects(second, /not accepting/);
    await Promise.resolve();
    assert.equal(starts, 1);
    assert.equal(r.pip.isPictureInPictureTransitionPending, true);
    assert.equal(
        await r.video.recoverVideoPlaybackRenderer(video.webContents.id),
        false,
    );
    r.lifecycle.beginViewerShutdown();
    finish();
    await first;
    await rejected;
    assert.equal(starts, 1);
    assert.equal(r.pip.isPictureInPictureTransitionPending, false);
    await r.lifecycle.dispose();
});
