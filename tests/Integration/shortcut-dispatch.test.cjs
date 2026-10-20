const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
function load(relative, electron = {}) {
    const filename = path.resolve(__dirname, '../..', relative);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        id === 'electron'
            ? electron
            : Module.prototype.require.call(loaded, id);
    loaded._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            write: false,
            platform: 'node',
            format: 'cjs',
            external: ['electron'],
        }).outputFiles[0].text,
        filename,
    );
    return loaded.exports;
}
function fixture() {
    const registrations = new Map(),
        calls = [];
    const globalShortcut = {
        isRegistered: (key) => registrations.has(key),
        register(key, run) {
            calls.push(['register', key]);
            registrations.set(key, run);
            return true;
        },
        unregister(key) {
            calls.push(['unregister', key]);
            registrations.delete(key);
        },
    };
    const { ShortcutManager } = load('src/Main/Manager/ShortcutManager.ts', {
        globalShortcut,
    });
    const state = { bindings: [], overrides: {}, route: undefined };
    const manager = new ShortcutManager({
        getBindings: () => state.bindings,
        getOverrides: () => state.overrides,
        routeInput: () => state.route,
    });
    return { manager, state, registrations, calls, globalShortcut };
}
const input = (extra = {}) => ({
    type: 'keyDown',
    key: 'x',
    code: 'KeyX',
    control: true,
    meta: false,
    alt: false,
    shift: false,
    ...extra,
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('dispatcher uses feature metadata for repeats, editing, overrides and renderer delegation', () => {
    const { manager, state } = fixture();
    let runs = 0;
    state.bindings = [
        {
            id: 'third-party.action',
            defaultKey: 'Control+X',
            run: () => runs++,
        },
    ];
    assert.equal(manager.handleInput(input()), true);
    assert.equal(manager.handleInput(input({ isAutoRepeat: true })), false);
    assert.equal(manager.handleInput(input(), true), false);
    state.bindings[0] = {
        ...state.bindings[0],
        repeatable: true,
        allowWhileEditing: true,
    };
    assert.equal(
        manager.handleInput(input({ isAutoRepeat: true }), true),
        true,
    );
    state.overrides = { 'third-party.action': '' };
    assert.equal(manager.handleInput(input()), false);
    state.overrides = {};
    state.route = false;
    assert.equal(manager.handleInput(input()), false);
    state.route = true;
    assert.equal(manager.handleInput(input()), true);
    assert.equal(manager.handleInput(input({ isComposing: true })), false);
    assert.equal(runs, 2);
});

test('global refresh is incremental, respects external ownership and invokes fresh eligible handlers', () => {
    const { manager, state, registrations, calls } = fixture();
    let old = 0,
        fresh = 0;
    registrations.set('Control+Z', () => {});
    state.bindings = [
        {
            id: 'primary',
            defaultKey: 'Control+X',
            global: true,
            run: () => old++,
        },
        {
            id: 'duplicate',
            defaultKey: 'Control+X',
            global: true,
            run: () => {
                throw new Error('Wrong priority');
            },
        },
        { id: 'foreign', defaultKey: 'Control+Z', global: true, run: () => {} },
    ];
    manager.refreshGlobalShortcut();
    manager.refreshGlobalShortcut();
    assert.deepEqual(calls, [['register', 'Control+X']]);
    const queued = registrations.get('Control+X');
    state.bindings = [{ ...state.bindings[0], run: () => fresh++ }];
    queued();
    assert.equal(old, 0);
    assert.equal(fresh, 1);
    state.bindings = [{ ...state.bindings[0], global: false }];
    queued();
    assert.equal(fresh, 1);
    manager.refreshGlobalShortcut();
    assert.equal(registrations.has('Control+X'), false);
    assert.equal(registrations.has('Control+Z'), true);
    state.bindings[0].global = true;
    state.overrides = { primary: 'Control+Y' };
    manager.refreshGlobalShortcut();
    assert.equal(registrations.has('Control+Y'), true);
    manager.dispose();
    manager.dispose();
    assert.deepEqual([...registrations.keys()], ['Control+Z']);
    assert.equal(manager.handleInput(input({ key: 'y', code: 'KeyY' })), false);
    manager.refreshGlobalShortcut();
    registrations.get('Control+Y')();
    assert.equal(fresh, 2);
});

test('dispatch contains synchronous throws and rejected handler promises', async () => {
    const { manager, state } = fixture();
    const errors = [],
        previous = console.error;
    console.error = (...args) => errors.push(args);
    try {
        state.bindings = [
            {
                id: 'throw',
                defaultKey: 'Control+X',
                run() {
                    throw new Error('sync');
                },
            },
        ];
        assert.equal(manager.handleInput(input()), true);
        state.bindings = [
            {
                id: 'reject',
                defaultKey: 'Control+X',
                run: () => Promise.reject(new Error('async')),
            },
        ];
        assert.equal(manager.handleInput(input()), true);
        await flush();
        assert.equal(errors.length, 2);
    } finally {
        console.error = previous;
    }
});

const { createShortFormShortcutBindings } = load(
    'src/Main/Functional/Bundle/Provider/ShortFormShortcuts.ts',
);
const { SHORT_FORM_VIDEO_ACTIONS } = require('@kawaikara/site-api');
function shortFormFixture() {
    const state = {
        id: 'third-party.shorts',
        descriptor: {
            previous: true,
            next: true,
            autoAdvance: { settingKey: 'auto', defaultValue: false },
            publisherBan: { settingKey: 'banned' },
        },
        preferences: { shortcuts: {}, providerSettings: {} },
    };
    const actions = [],
        updates = [],
        applied = [];
    const sites = {
        getCurrentSiteId: () => state.id,
        getCurrentShortFormVideoDescriptor: () => state.descriptor,
        getCurrentShortFormVideoPublisher: async () => ({
            id: 'publisher',
            label: 'Creator',
        }),
        handleAction: async (action) => actions.push(action),
        applyCurrentProviderSettings: async () => applied.push(state.id),
    };
    const preferences = {
        get: () => state.preferences,
        update: async (patch) => {
            updates.push(patch);
            state.preferences = { ...state.preferences, ...patch };
            return state.preferences;
        },
    };
    const bindings = () =>
        createShortFormShortcutBindings(sites, preferences, true);
    return { state, sites, preferences, actions, updates, applied, bindings };
}

test('short-form bindings follow declared capabilities and preserve settings/ban navigation behavior', async () => {
    const f = shortFormFixture();
    let bindings = f.bindings();
    assert.equal(bindings.find((b) => b.id.endsWith('.next')).repeatable, true);
    assert.equal(
        bindings.find((b) => b.id.endsWith('.toggle-auto-advance')).repeatable,
        false,
    );
    await bindings.find((b) => b.id.endsWith('.toggle-auto-advance')).run();
    assert.equal(f.state.preferences.providerSettings[f.state.id].auto, true);
    assert.deepEqual(f.actions, [SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance]);
    f.actions.length = 0;
    await bindings.find((b) => b.id.endsWith('.ban-current-publisher')).run();
    assert.equal(
        f.state.preferences.providerSettings[f.state.id].banned.length,
        1,
    );
    assert.deepEqual(f.actions, [
        SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan,
    ]);
    f.actions.length = 0;
    await bindings.find((b) => b.id.endsWith('.ban-current-publisher')).run();
    assert.deepEqual(f.actions, [SHORT_FORM_VIDEO_ACTIONS.next]);
    f.state.descriptor = { next: true };
    bindings = f.bindings();
    assert.deepEqual(
        bindings.map((b) => b.id),
        ['short-form-video.next'],
    );
    f.state.descriptor = undefined;
    assert.deepEqual(f.bindings(), []);
});

test('publisher lookup completing after a Provider switch cannot write settings or act on the successor', async () => {
    const f = shortFormFixture();
    let resolve;
    f.sites.getCurrentShortFormVideoPublisher = () =>
        new Promise((r) => {
            resolve = r;
        });
    const binding = f
        .bindings()
        .find((b) => b.id.endsWith('.ban-current-publisher'));
    const pending = binding.run();
    f.state.id = 'different.provider';
    resolve({ id: 'old-publisher' });
    await pending;
    assert.deepEqual(f.updates, []);
    assert.deepEqual(f.applied, []);
    assert.deepEqual(f.actions, []);
    await binding.run();
    assert.deepEqual(f.updates, []);
});

test('application composition preserves Video renderer precedence and dynamic PiP globals', async () => {
    const f = fixture();
    const { createApplicationShortcuts } = load(
        'src/Main/Functional/Shortcut/ApplicationShortcuts.ts',
        { globalShortcut: f.globalShortcut },
    );
    let pip = false,
        video = false,
        toggles = 0,
        release;
    const runtime = {
        pip: {
            isPictureInPictureActive: () => pip,
            togglePictureInPicture: () => {
                toggles++;
                return new Promise((r) => {
                    release = r;
                });
            },
        },
        site: { goBack() {}, goForward() {} },
        windows: { toggleAppFullScreen() {}, setAlwaysOnTop() {} },
        viewer: {
            toggleOverlay() {},
            showPreferencesOverlay() {},
            reloadViewer() {},
            hideOverlay() {},
        },
    };
    const short = shortFormFixture();
    const sites = {
        ...short.sites,
        isCurrentSite: (id) => video && id === 'kawaikara.video',
        listMenuItems: () => [],
        load: async () => {},
    };
    const manager = createApplicationShortcuts(
        sites,
        runtime,
        short.preferences,
    );
    manager.refreshGlobalShortcut();
    assert.equal(f.registrations.size, 1); // always-on-top only
    pip = true;
    manager.refreshGlobalShortcut();
    assert.equal(f.registrations.size, 6); // topmost, PiP and four declared short-form actions
    assert.equal(
        manager.handleInput(input({ key: 'Tab', code: 'Tab', control: false })),
        true,
    );
    const { APP_SHORTCUTS } = load('src/Common/AppShortcuts.ts');
    const accelerator = APP_SHORTCUTS.find(
        (b) => b.id === 'app.toggle-picture-in-picture',
    ).defaultKey;
    f.registrations.get(accelerator)();
    f.registrations.get(accelerator)();
    assert.equal(toggles, 1);
    release();
    await flush();
    pip = false;
    manager.refreshGlobalShortcut();
    assert.equal(f.registrations.size, 1);
    video = true;
    const { VIDEO_SHORTCUTS } = load('src/Common/VideoControls.ts');
    const videoKey = VIDEO_SHORTCUTS[0];
    short.state.preferences.shortcuts = {
        [videoKey.id]: 'Control+X',
        'app.toggle-menu': 'Control+X',
    };
    assert.equal(manager.handleInput(input()), false);
    video = false;
    assert.equal(manager.handleInput(input()), true);
    manager.dispose();
});

test('generic dispatcher has no knowledge of Provider, media or preference feature identities', () => {
    const source = readFileSync(
        path.resolve(__dirname, '../../src/Main/Manager/ShortcutManager.ts'),
        'utf8',
    );
    for (const pattern of [
        /ProviderManager/,
        /PreferenceManager/,
        /ViewerRuntime/,
        /short-form/,
        /kawaikara\.video/,
        /picture.in.picture/i,
        /banCurrent/,
    ])
        assert.doesNotMatch(source, pattern);
});
