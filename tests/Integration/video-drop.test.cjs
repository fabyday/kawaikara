const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function load(relative, mocks = {}) {
    const filename = path.resolve(__dirname, '../..', relative);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    loaded._compile(
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
    return loaded.exports;
}
const { IPC_CHANNELS: channels } = load('src/Common/IPC.ts');
const { DragDropManager } = load('src/Main/Manager/DragDropManager.ts');
const { ProviderManager } = load('src/Main/Manager/ProviderManager.ts');
const { builtinBundle } = require('@kawaikara/builtin-sites');
const handlers = new Map();
const { IpcManager } = load('src/Main/Manager/IPCManager.ts', {
    electron: {
        ipcMain: { handle: (id, fn) => handlers.set(id, fn), on() {} },
    },
});

function managerFixture({
    current = true,
    present = true,
    queue = async () => true,
} = {}) {
    const events = [];
    const dragDrop = new DragDropManager();
    dragDrop.registerProvider({
        id: 'kawaikara.video',
        title: 'Video',
        permissions: ['internal-view'],
        fileDrop: {
            scope: 'global',
            extensions: ['.cjs'],
            action: 'open-local-video',
        },
    });
    const manager = new IpcManager(
        {},
        {
            dragDrop,
            getActiveProviderId: () => (current ? 'kawaikara.video' : 'other'),
            isCurrentSite: () => current,
            async load(id) {
                events.push(`load:${id}`);
            },
        },
        {
            queueDroppedVideoFiles: queue,
            hideOverlay() {
                events.push('hide');
            },
            presentQueuedVideoOpenRequest() {
                events.push('present');
                return present;
            },
            getCurrentVideoOpenRequest: () => ({
                kind: 'local',
                path: 'clip.mp4',
            }),
        },
        {},
        {},
        {},
        {},
        {},
        {
            async recordVideo() {
                events.push('record');
            },
        },
        {},
        {},
        { subscribe: () => () => {} },
    );
    manager.initialize();
    return { events, drop: handlers.get(channels.dragDrop.openFiles) };
}

test('drop reuses active Video without retiring the Provider or native player', async () => {
    const { events, drop } = managerFixture();
    assert.equal((await drop({}, [__filename])).status, 'opened');
    assert.deepEqual(events, ['hide', 'present', 'record']);
});
test('drop switches to Video only when necessary', async () => {
    for (const options of [{ current: false }, { present: false }]) {
        const { events, drop } = managerFixture(options);
        assert.equal((await drop({}, [__filename])).status, 'opened');
        assert.equal(
            events.filter((value) => value === 'load:kawaikara.video').length,
            1,
        );
    }
});
test('invalid and overlapping drops do not navigate or mutate the active source', async () => {
    const invalid = managerFixture({ queue: async () => false });
    assert.equal(
        (await invalid.drop({}, ['not-video.txt'])).status,
        'unsupported',
    );
    assert.deepEqual(invalid.events, []);
    let release, entered;
    const queueEntered = new Promise((resolve) => {
        entered = resolve;
    });
    const pending = managerFixture({
        queue: () =>
            new Promise((resolve) => {
                release = resolve;
                entered();
            }),
    });
    const first = pending.drop({}, [__filename]);
    assert.equal((await pending.drop({}, [__filename])).status, 'busy');
    await queueEntered;
    release(true);
    assert.equal((await first).status, 'opened');
    assert.deepEqual(pending.events, ['hide', 'present', 'record']);
});
test('failed drop releases the gate so the next file can open', async () => {
    let fail = true;
    const fixture = managerFixture({
        queue: async () => {
            if (fail) {
                fail = false;
                throw new Error('fixture');
            }
            return true;
        },
    });
    await assert.rejects(fixture.drop({}, [__filename]), /fixture/);
    assert.equal((await fixture.drop({}, [__filename])).status, 'opened');
});

function preloadFixture(t, open) {
    const oldWindow = global.window;
    const listeners = new Map(),
        states = [],
        calls = [];
    global.window = { addEventListener: (name, fn) => listeners.set(name, fn) };
    global.window.top = global.window;
    t.after(() => {
        listeners.get('pagehide')?.();
        global.window = oldWindow;
    });
    const { installDragDropTarget } = load('src/Preload/DragDrop.ts', {
        electron: {
            ipcRenderer: {
                invoke: async (channel, paths) => {
                    calls.push([channel, paths]);
                    return channel === channels.application.messages
                        ? { video: {} }
                        : open(paths);
                },
            },
            webUtils: { getPathForFile: (file) => file.path },
        },
        './VideoDropOverlay': {
            createVideoDropOverlay: () => ({
                show: (state) => states.push(state),
                setMessages() {},
            }),
        },
    });
    installDragDropTarget();
    function fire(name, types = ['Files']) {
        const event = {
            dataTransfer: {
                types,
                files: types.includes('Files')
                    ? [{ path: 'D:\\clip.mp4' }]
                    : [],
            },
            preventDefault() {
                this.prevented = true;
            },
            stopImmediatePropagation() {
                this.stopped = true;
            },
        };
        return { event, result: listeners.get(name)?.(event) };
    }
    return { fire, calls, states, listeners };
}
test('drag frames only update feedback: one IPC for labels and one for file paths on drop', async (t) => {
    const fixture = preloadFixture(t, async () => ({ status: 'opened' }));
    fixture.fire('dragenter');
    for (let i = 0; i < 200; i++) fixture.fire('dragover');
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.states, ['dragging']);
    const drop = fixture.fire('drop');
    await drop.result;
    assert.equal(drop.event.prevented, true);
    assert.equal(drop.event.stopped, true);
    assert.deepEqual(fixture.calls[1], [
        channels.dragDrop.openFiles,
        ['D:\\clip.mp4'],
    ]);
    assert.equal(fixture.states.at(-1), 'hidden');
});
test('nested enter/leave does not flicker and cancellation hides feedback', (t) => {
    const fixture = preloadFixture(t, async () => ({ status: 'opened' }));
    fixture.fire('dragenter');
    fixture.fire('dragenter');
    fixture.fire('dragleave');
    assert.equal(fixture.states.at(-1), 'dragging');
    fixture.fire('dragleave');
    assert.equal(fixture.states.at(-1), 'hidden');
    fixture.fire('dragenter');
    fixture.listeners.get('keydown')({ key: 'Escape' });
    assert.equal(fixture.states.at(-1), 'hidden');
});
test('text and URL drags are not intercepted', (t) => {
    const fixture = preloadFixture(t, async () => ({ status: 'opened' }));
    for (const name of ['dragenter', 'dragover', 'drop']) {
        assert.equal(
            fixture.fire(name, ['text/uri-list']).event.prevented,
            undefined,
        );
    }
    assert.equal(fixture.calls.length, 0);
});
test('preload consumes IPC rejection, displays failure, and permits retry', async (t) => {
    let fail = true;
    const fixture = preloadFixture(t, async () => {
        if (fail) {
            fail = false;
            throw new Error('expected drop failure');
        }
        return { status: 'opened' };
    });
    await fixture.fire('drop').result;
    assert.equal(fixture.states.at(-1), 'failed');
    await fixture.fire('drop').result;
    assert.equal(fixture.states.at(-1), 'hidden');
});

function registration(id, scope = 'global', extensions = ['.cjs']) {
    return {
        id,
        title: id,
        permissions: ['internal-view'],
        fileDrop: { scope, extensions, action: 'open-local-video' },
    };
}

test('Global works over another Provider; Local only matches its current owner', async () => {
    const manager = new DragDropManager(),
        owners = [];
    manager.registerProvider(registration('local', 'local'));
    const dispatch = async (selected) => {
        owners.push(selected.providerId);
        return true;
    };
    assert.equal(
        (await manager.openFiles([__filename], () => 'other', dispatch)).status,
        'unsupported',
    );
    assert.equal(
        (await manager.openFiles([__filename], () => 'local', dispatch)).status,
        'opened',
    );
    manager.unregisterProvider('local');
    manager.registerProvider(registration('global'));
    assert.equal(
        (await manager.openFiles([__filename], () => 'other', dispatch)).status,
        'opened',
    );
    assert.deepEqual(owners, ['local', 'global']);
});

test('overlapping Global and Local owners never auto-select or invoke an adapter', async () => {
    for (const reverse of [false, true]) {
        const manager = new DragDropManager();
        const declarations = [
            registration('global'),
            registration('local', 'local'),
        ];
        if (reverse) declarations.reverse();
        declarations.forEach((item) => manager.registerProvider(item));
        const result = await manager.openFiles(
            [__filename],
            () => 'local',
            async () => assert.fail('Ambiguous dispatch'),
        );
        assert.equal(result.status, 'selection-required');
        assert.deepEqual(result.providers.map((item) => item.id).sort(), [
            'global',
            'local',
        ]);
        assert.equal(
            JSON.stringify(result).includes(__filename),
            false,
            'No absolute paths in chooser metadata',
        );
    }
});

test('invalid files, directories, huge batches and unknown types never dispatch', async () => {
    const manager = new DragDropManager();
    manager.registerProvider(registration('owner'));
    for (const input of [
        null,
        [],
        ['relative.cjs'],
        [42],
        [__dirname],
        [__filename + '.missing'],
        [__filename + '\0'],
        Array(257).fill(__filename),
    ]) {
        const result = await manager.openFiles(
            input,
            () => undefined,
            async () => assert.fail('Invalid dispatch'),
        );
        assert.equal(result.status, 'unsupported');
    }
});

test('deduplicates files and preserves input order; registrations are copied', async () => {
    const manager = new DragDropManager();
    const declaration = registration('owner');
    manager.registerProvider(declaration);
    declaration.fileDrop.extensions[0] = '.txt';
    let seen;
    const result = await manager.openFiles(
        [__filename, __filename],
        () => undefined,
        async (_selected, files) => {
            seen = files;
            return true;
        },
    );
    assert.equal(result.status, 'opened');
    assert.deepEqual(seen, [__filename]);
});

test('owner removal or Local target change during file validation cancels matching', async () => {
    const manager = new DragDropManager();
    manager.registerProvider(registration('local', 'local'));
    let active = 'local';
    const old = manager.openFiles(
        [__filename],
        () => active,
        async () => assert.fail('Stale owner'),
    );
    manager.unregisterProvider('local');
    manager.registerProvider(registration('local', 'local'));
    assert.equal((await old).status, 'unsupported');
    const moving = manager.openFiles(
        [__filename],
        () => active,
        async () => assert.fail('Wrong Local target'),
    );
    active = 'another';
    assert.equal((await moving).status, 'unsupported');
});

test('invalid registrations and unsupported action permissions are rejected', () => {
    const manager = new DragDropManager();
    for (const invalid of [
        { ...registration('a'), permissions: [] },
        registration('b', 'everywhere'),
        registration('c', 'global', ['*']),
        registration('d', 'global', ['.cjs', '.cjs']),
        {
            ...registration('e'),
            fileDrop: {
                scope: 'global',
                extensions: ['.mp4'],
                action: 'run-script',
            },
        },
    ])
        assert.throws(
            () => manager.registerProvider(invalid),
            /invalid file-drop/,
        );
    manager.registerProvider(registration('valid'));
    assert.throws(
        () => manager.registerProvider(registration('valid')),
        /Duplicate drop owner/,
    );
});

test('Video manifest is the sole built-in route and Bundle rollback removes it', async () => {
    const sites = new ProviderManager(
        async () => assert.fail('Matching must not instantiate Providers'),
        () => ({ providerSettings: {} }),
        () => '',
    );
    assert.deepEqual(
        builtinBundle.providers
            .filter((item) => item.manifest.contributes.fileDrop)
            .map((item) => item.manifest.id),
        ['kawaikara.video'],
    );
    sites.registerBundle(builtinBundle);
    const video = sites.dragDrop.registrations.get('kawaikara.video');
    assert.equal(video.descriptor.scope, 'global');
    assert.ok(video.descriptor.extensions.includes('.mp4'));
    assert.equal(sites.getActiveProviderId(), undefined);
    sites.rollbackBundleRegistration(builtinBundle.id);
    assert.equal(sites.dragDrop.registrations.size, 0);
});

test('failed Bundle staging leaves no partial drop registrations', () => {
    const sites = new ProviderManager(
        async () => ({}),
        () => ({ providerSettings: {} }),
        () => '',
    );
    const bad = {
        ...builtinBundle,
        providers: builtinBundle.providers.map((item) =>
            item.manifest.id !== 'kawaikara.video'
                ? item
                : {
                      ...item,
                      manifest: {
                          ...item.manifest,
                          contributes: {
                              ...item.manifest.contributes,
                              fileDrop: {
                                  ...item.manifest.contributes.fileDrop,
                                  scope: 'invalid',
                              },
                          },
                      },
                  },
        ),
    };
    assert.throws(() => sites.registerBundle(bad), /invalid file-drop/);
    assert.equal(sites.dragDrop.registrations.size, 0);
    assert.equal(sites.sites.size, 0);
});

test('preload gives conflict feedback instead of pretending a file was opened', async (t) => {
    const fixture = preloadFixture(t, async () => ({
        status: 'selection-required',
        providers: [],
    }));
    await fixture.fire('drop').result;
    assert.equal(fixture.states.at(-1), 'ambiguous');
});
