const { asViewerRuntime } = require('../Helpers/ViewerRuntime.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const vm = require('node:vm');
const {
    createBuildDefinitions,
} = require('../../scripts/lib/build-definitions.cjs');
const root = path.resolve(__dirname, '../..');
const code = buildSync({
    stdin: {
        contents: `export { IpcManager } from './src/Main/Manager/IPCManager';
                   export { IPC_CHANNELS } from './src/Common/IPC';`,
        resolveDir: root,
        loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    define: createBuildDefinitions(root, {}),
}).outputFiles[0].text;

function fixture() {
    const handlers = new Map();
    const events = new EventEmitter();
    const calls = [];
    let subscriptions = 0;
    let failChannel;
    let failRemove;
    const ipcMain = {
        handle(channel, handler) {
            if (channel === failChannel || handlers.has(channel))
                throw new Error(`Registration failed: ${channel}`);
            handlers.set(channel, handler);
        },
        removeHandler(channel) {
            handlers.delete(channel);
            if (channel === failRemove) throw new Error('Removal failed');
        },
        on: (channel, handler) => events.on(channel, handler),
        off: (channel, handler) => events.off(channel, handler),
    };
    const module = { exports: {} };
    const timers = new Set();
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        process,
        console,
        URL,
        __dirname: path.join(root, 'dist/main'),
        __filename: path.join(root, 'dist/main/main.js'),
        setTimeout: (callback) => {
            timers.add(callback);
            return callback;
        },
        clearTimeout: (callback) => timers.delete(callback),
        require: (id) =>
            id === 'electron'
                ? {
                      ipcMain,
                      clipboard: {
                          writeText: (text) => calls.push(['copy', text]),
                      },
                      app: {
                          getLocale: () => 'en-US',
                          relaunch: () => calls.push(['relaunch']),
                          quit() {},
                      },
                  }
                : require(id),
    });
    const { IpcManager, IPC_CHANNELS: channels } = module.exports;
    const windows = {
        setEditingState: (...args) => calls.push(['editing', ...args]),
        setInternalVideoPresentation: (...args) =>
            calls.push(['presentation', ...args]),
        notifyVideoPlaybackRendererReady: (...args) =>
            calls.push(['ready', ...args]),
        commandLogViewer: (...args) => calls.push(['log', ...args]),
        hideOverlay: () => calls.push(['hide']),
        showOverlay: () => calls.push(['show']),
    };
    const social = {
        openLink: (id) => calls.push(['social', id]),
        getDeveloperYouTubeStatus: () => ({ isLive: false }),
    };
    const data = {
        selectLocation: (locale) => calls.push(['location', locale]),
    };
    const sites = {
        load: async () => {
            throw new Error('Provider failed');
        },
    };
    const manager = new IpcManager(
        {},
        sites,
        asViewerRuntime(windows),
        {
            get: () => ({ graphicsMode: 'native' }),
            update: async (patch) => patch,
        },
        {},
        social,
        {},
        {},
        {},
        {},
        data,
        {
            subscribe: () => {
                subscriptions++;
                return () => subscriptions--;
            },
        },
    );
    const mainFrame = {
        url: pathToFileURL(path.join(root, 'dist/renderer/index.html')).href,
    };
    const event = { sender: { id: 10, mainFrame }, senderFrame: mainFrame };
    return {
        manager,
        channels,
        event,
        calls,
        handlers,
        events,
        timers,
        subscriptions: () => subscriptions,
        failRegistration: (value) => {
            failChannel = value;
        },
        failCleanup: (value) => {
            failRemove = value;
        },
        invoke: (channel, ...args) => handlers.get(channel)(event, ...args),
    };
}

test('all feature groups connect once and fully disconnect, including clipboard and events', async () => {
    const f = fixture();
    const unrelated = () => {};
    f.events.on(f.channels.overlay.editingChanged, unrelated);
    f.manager.initialize();
    assert.equal(f.handlers.size, 79);
    assert.equal(f.subscriptions(), 1);
    f.manager.initialize();
    assert.equal(f.handlers.size, 79);
    assert.equal(f.subscriptions(), 1);
    f.invoke(f.channels.application.copyText, 'copied');
    await f.invoke(f.channels.social.openLink, 'discord');
    assert.throws(
        () => f.invoke(f.channels.application.copyText, 42),
        /Clipboard/,
    );
    await assert.rejects(
        f.invoke(f.channels.social.openLink, 'unknown'),
        /Unknown application link/,
    );
    f.events.emit(f.channels.overlay.editingChanged, f.event, true);
    f.events.emit(f.channels.overlay.editingChanged, f.event, 'invalid');
    f.events.emit(f.channels.video.presentationChanged, f.event, 'frame');
    f.events.emit(f.channels.video.playbackRendererReady, f.event);
    assert.deepEqual(f.calls, [
        ['copy', 'copied'],
        ['social', 'discord'],
        ['editing', 10, true],
        ['presentation', 10, 'frame'],
        ['ready', 10],
    ]);
    f.manager.dispose();
    f.manager.dispose();
    assert.equal(f.handlers.size, 0);
    assert.equal(f.subscriptions(), 0);
    assert.deepEqual(f.events.listeners(f.channels.overlay.editingChanged), [
        unrelated,
    ]);
    assert.equal(
        f.events.listenerCount(f.channels.video.presentationChanged),
        0,
    );
    assert.equal(
        f.events.listenerCount(f.channels.video.playbackRendererReady),
        0,
    );
    f.manager.initialize();
    assert.equal(f.handlers.size, 79);
    f.manager.dispose();
});

test('partial registration rolls back earlier groups and leaves unrelated handlers alone', () => {
    const f = fixture();
    const unrelated = () => {};
    f.handlers.set('unrelated-handler', unrelated);
    f.failRegistration(f.channels.video.listDirectory);
    assert.throws(() => f.manager.initialize(), /Registration failed/);
    assert.deepEqual([...f.handlers], [['unrelated-handler', unrelated]]);
    assert.equal(f.subscriptions(), 0);
    assert.equal(f.events.eventNames().length, 0);
    f.failRegistration(undefined);
    f.manager.initialize();
    assert.equal(f.handlers.size, 80);
    f.manager.dispose();
});

test('one failed removal still releases every other feature and allows reinitialization', () => {
    const f = fixture();
    f.manager.initialize();
    f.failCleanup(f.channels.video.listDirectory);
    assert.throws(() => f.manager.dispose(), /IPC cleanup failed/);
    assert.equal(f.handlers.size, 0);
    assert.equal(f.subscriptions(), 0);
    assert.equal(f.events.eventNames().length, 0);
    f.failCleanup(undefined);
    f.manager.initialize();
    f.manager.dispose();
});

test('settings and log sender checks remain enforced after extraction', async () => {
    const f = fixture();
    f.manager.initialize();
    const select = f.handlers.get(f.channels.data.selectLocation);
    const bridge = f.handlers.get(
        f.channels.application.webExtensionConnection,
    );
    const log = f.handlers.get(f.channels.logViewer.command);
    for (const senderFrame of [
        null,
        { url: f.event.senderFrame.url },
        { url: 'https://example.com/' },
    ]) {
        const event = { ...f.event, senderFrame };
        assert.throws(
            () => select(event, 'en-US'),
            /Only the application settings UI/,
        );
        await assert.rejects(
            bridge(event, 'status'),
            /Only the application settings UI/,
        );
        assert.throws(() => log(event, 'open'), /main frame/);
    }
    // A remote main frame is also rejected for settings-only operations.
    const remote = { url: 'https://example.com/' };
    assert.throws(
        () =>
            select(
                { sender: { mainFrame: remote }, senderFrame: remote },
                'en-US',
            ),
        /Only the application settings UI/,
    );
    select(f.event, 'en-US');
    assert.deepEqual(f.calls, [['location', 'en-US']]);
    f.manager.dispose();
});

test('optional browser bridge can be attached or replaced after registration', async () => {
    const f = fixture();
    f.manager.initialize();
    await assert.rejects(
        f.invoke(f.channels.application.webExtensionConnection, 'status'),
        /unavailable/,
    );
    f.manager.setWebExtensionManager({ status: () => 'first' });
    assert.equal(
        await f.invoke(f.channels.application.webExtensionConnection, 'status'),
        'first',
    );
    f.manager.setWebExtensionManager({ status: () => 'second' });
    assert.equal(
        await f.invoke(f.channels.application.webExtensionConnection, 'status'),
        'second',
    );
    f.manager.dispose();
});

test('failed Provider navigation restores the overlay and disposal cancels a scheduled relaunch', async () => {
    const f = fixture();
    f.manager.initialize();
    await assert.rejects(
        f.invoke(f.channels.sites.open, 'broken'),
        /Provider failed/,
    );
    assert.deepEqual(f.calls, [['hide'], ['show']]);
    await f.invoke(
        f.channels.preferences.update,
        { graphicsMode: 'software' },
        { restartForGraphicsChange: true },
    );
    assert.equal(f.timers.size, 1);
    f.manager.dispose();
    assert.equal(f.timers.size, 0);
});
