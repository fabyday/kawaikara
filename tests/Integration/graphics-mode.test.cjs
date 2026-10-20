const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
function load(relative, imports = {}, bundle = true) {
    const file = path.join(root, relative);
    const loaded = new Module(file, module);
    loaded.paths = module.paths;
    loaded.require = (id) => (id in imports ? imports[id] : require(id));
    loaded._compile(
        buildSync({
            entryPoints: [file],
            bundle,
            packages: 'external',
            platform: 'node',
            format: 'cjs',
            write: false,
            define: {
                __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
                __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
                __KAWAIKARA_DISCORD_APP_ID__: '""',
                __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
            },
        }).outputFiles[0].text,
        file,
    );
    return loaded.exports;
}
const { PreferenceManager } = load('src/Main/Manager/PreferenceManager.ts');
const { readStartupGraphicsMode } = load(
    'src/Main/Functional/App/Preferences.ts',
);
const validation = load('src/Main/Functional/IPC/Validation.ts', {
    electron: {},
});
test('each persisted mode is the mode read before the next Electron startup', async () => {
    const directory = fs.mkdtempSync(
        path.join(getTestTempRoot(), 'kawaikara-mode-state-'),
    );
    try {
        const file = path.join(directory, 'preferences.json'),
            preferences = new PreferenceManager(file);
        await preferences.load();
        for (const mode of ['native', 'software', 'capture', 'native']) {
            await preferences.update({ graphicsMode: mode });
            assert.equal(readStartupGraphicsMode(file), mode);
            const reopened = new PreferenceManager(file);
            await reopened.load();
            assert.equal(reopened.get().graphicsMode, mode);
        }
        for (const legacy of [true, false]) {
            fs.writeFileSync(
                file,
                JSON.stringify({ enableGpuAcceleration: legacy }),
            );
            const reopened = new PreferenceManager(file);
            await reopened.load();
            assert.equal(
                readStartupGraphicsMode(file),
                reopened.get().graphicsMode,
            );
        }
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('IPC rejects unconfirmed changes and persists a valid mode before scheduling restart', async () => {
    const handlers = new Map(),
        calls = [];
    const { IPC_CHANNELS } = load('src/Common/IPC.ts');
    const { connectPreferencesIpc } = load('src/Main/Functional/IPC/PreferencesIpc.ts', {
        electron: {
            app: { relaunch: () => calls.push('restart'), quit() {} },
            ipcMain: {
                handle: (key, fn) => handlers.set(key, fn),
                removeHandler: key => handlers.delete(key),
            },
        },
    });
    const dispose = connectPreferencesIpc({
        preferences: {
            get: () => ({ graphicsMode: 'capture' }),
            update: async (patch) => {
                await new Promise((resolve) => setImmediate(resolve));
                calls.push('persisted');
                return patch;
            },
        },
    });
    const update = handlers.get(IPC_CHANNELS.preferences.update);
    for (const mode of ['native', 'software']) {
        await assert.rejects(
            update({}, { graphicsMode: mode }, {}),
            /restart confirmation/,
        );
    }
    await assert.rejects(
        update(
            {},
            { graphicsMode: 'invalid' },
            { restartForGraphicsChange: true },
        ),
        /supported graphics/,
    );
    assert.deepEqual(calls, []);
    assert.equal(
        (
            await update(
                {},
                { graphicsMode: 'software' },
                { restartForGraphicsChange: true },
            )
        ).graphicsMode,
        'software',
    );
    assert.deepEqual(calls, ['persisted']);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.deepEqual(calls, ['persisted', 'restart']);
    dispose();
});
