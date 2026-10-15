const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function fixture(whenReady, updateProfile) {
    const calls = [];
    const managersReached = new Error('fixture reached manager construction');
    const mocks = {
        '../../Manager/WebExtensionManager': {},
        electron: {
            app: { getPath: (name) => `/fixture/${name}` },
            components: { WIDEVINE_CDM_ID: 'fixture-widevine', whenReady },
        },
        '@kawaikara/builtin-sites': {},
        'node:fs/promises': { rm: async () => {} },
        '../../../Common/BuildConfig': { UPDATE_TEST_PROFILE: updateProfile },
        '../../Platform/Presentation': {
            restoreApplicationPresentation: async () =>
                calls.push('presentation'),
        },
        './UserDataPaths': {
            initializeUserDataLayout: async () => calls.push('data'),
            getUserDataLayout: () => ({}),
            getKawaiDataPath: (...parts) => parts.join('/'),
        },
        '../../DependencyInjection/ApplicationManagers': {
            createApplicationManagerContainer: () => {
                calls.push('managers');
                throw managersReached;
            },
        },
    };
    const filename = path.resolve(
        __dirname,
        '../../src/Main/Functional/App/ApplicationInitialization.ts',
    );
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        external: Object.keys(mocks),
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        require: (id) => {
            assert.ok(
                Object.hasOwn(mocks, id),
                `Unexpected startup dependency: ${id}`,
            );
            return mocks[id];
        },
    });
    return {
        calls,
        managersReached,
        start: () =>
            module.exports.initializeApplication({
                applicationLog: { info() {}, warn() {} },
            }),
    };
}

test('application startup waits for Electron Widevine readiness before constructing managers', async () => {
    const requested = [];
    let ready;
    const pending = new Promise((resolve) => {
        ready = resolve;
    });
    const app = fixture((ids) => {
        requested.push([...ids]);
        return pending;
    });
    const finished = assert.rejects(
        app.start(),
        (error) => error === app.managersReached,
    );
    await new Promise(setImmediate);
    assert.deepEqual(app.calls, ['data', 'presentation']);
    assert.deepEqual(requested, [['fixture-widevine']]);
    ready();
    await finished;
    assert.deepEqual(app.calls, ['data', 'presentation', 'managers']);
});

test('Electron component failure reaches startup without constructing managers', async () => {
    const failure = new Error('component unavailable');
    const app = fixture(async () => {
        throw failure;
    });
    await assert.rejects(app.start(), (error) => error === failure);
    assert.deepEqual(app.calls, ['data', 'presentation']);
});

test('isolated update profiles skip Electron component initialization', async () => {
    const app = fixture(
        () => assert.fail('update fixtures must not install Widevine'),
        {},
    );
    await assert.rejects(app.start(), (error) => error === app.managersReached);
    assert.deepEqual(app.calls, ['data', 'presentation', 'managers']);
});
