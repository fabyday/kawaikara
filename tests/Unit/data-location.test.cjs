const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const {
    resolveWindowsDataRootSelection,
} = require('../../src/Main/Platform/Windows/DataLocation.ts');
const product = 'Kawaikara Nightly',
    executable = 'C:\\Apps\\Kawaikara Nightly\\app.exe',
    active = 'C:\\Profiles\\Kawaikara Nightly';

test('folder picker and manual entry resolve the same channel root without nesting it twice', () => {
    for (const entry of ['D:\\새 폴더', 'D:\\새 폴더\\Kawaikara Nightly']) {
        assert.equal(
            resolveWindowsDataRootSelection(entry, product, executable, active),
            'D:\\새 폴더\\Kawaikara Nightly',
        );
    }
    for (const entry of [
        'relative',
        '\\\\host\\folder',
        'D:\\bad\nfolder',
        'C:\\Apps',
        `${active}\\child`,
    ]) {
        assert.throws(() =>
            resolveWindowsDataRootSelection(entry, product, executable, active),
        );
    }
});

const compiled = buildSync({
    entryPoints: [
        path.resolve(
            __dirname,
            '../../src/Main/Manager/ApplicationDataManager.ts',
        ),
    ],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['electron', '../Functional/App/UserDataPaths'],
}).outputFiles[0].text;
function managerFixture({ supported = true, answer = 1, fail = false } = {}) {
    const calls = [],
        timers = [],
        module = { exports: {} };
    vm.runInNewContext(compiled, {
        module,
        exports: module.exports,
        setTimeout: (fn) => timers.push(fn),
        process,
        console,
        require(id) {
            if (id === 'electron')
                return {
                    app: {
                        getLocale: () => 'ko-KR',
                        relaunch: () => calls.push('relaunch'),
                        quit: () => calls.push('quit'),
                    },
                    dialog: {
                        showMessageBox: async (options) => {
                            calls.push(options);
                            return { response: answer };
                        },
                        showOpenDialog: async (options) => {
                            calls.push(options);
                            return { canceled: true, filePaths: [] };
                        },
                    },
                };
            if (id === '../Functional/App/UserDataPaths')
                return {
                    getApplicationDataLocation: () =>
                        supported
                            ? { currentPath: active, canChange: true }
                            : undefined,
                    resolveApplicationDataLocation: (input) =>
                        resolveWindowsDataRootSelection(
                            input,
                            product,
                            executable,
                            active,
                        ),
                    saveApplicationDataLocation: async (target) => {
                        if (fail) throw new Error('locked');
                        calls.push(['save', target]);
                    },
                };
            return require(id);
        },
    });
    return {
        manager: new module.exports.ApplicationDataManager({}),
        calls,
        timers,
    };
}
test('native confirmation defaults to cancel; cancel and failures never change root or restart', async () => {
    for (const options of [{ answer: 0 }, { fail: true }]) {
        const { manager, calls, timers } = managerFixture(options);
        if (options.fail)
            await assert.rejects(
                manager.changeLocation('D:\\Data', 'ko-KR'),
                /저장하지 못/,
            );
        else
            assert.equal(
                (await manager.changeLocation('D:\\Data', 'ko-KR')).status,
                'cancelled',
            );
        assert.equal(calls[0].defaultId, 0);
        assert.equal(calls[0].cancelId, 0);
        assert.equal(timers.length, 0);
        assert.equal(
            calls.some((call) => Array.isArray(call) && call[0] === 'save'),
            false,
        );
    }
});
test('confirmed change saves the exact shown path then schedules one normal restart', async () => {
    const { manager, calls, timers } = managerFixture();
    assert.equal(
        (await manager.changeLocation('D:\\Data', 'ko-KR')).status,
        'restarting',
    );
    assert.ok(calls[0].detail.startsWith('D:\\Data\\Kawaikara Nightly\n'));
    assert.deepEqual(calls[1], ['save', 'D:\\Data\\Kawaikara Nightly']);
    await assert.rejects(
        manager.changeLocation('D:\\Other', 'ko-KR'),
        /진행 중/,
    );
    assert.equal(timers.length, 1);
    timers[0]();
    assert.deepEqual(calls.slice(-2), ['relaunch', 'quit']);
});
test('macOS capability is absent and native picker/apply cannot be bypassed by IPC', async () => {
    const { manager, calls } = managerFixture({ supported: false });
    assert.equal(manager.getLocation(), undefined);
    await assert.rejects(manager.selectLocation('ko-KR'), /Windows/);
    await assert.rejects(
        manager.changeLocation('D:\\Data', 'ko-KR'),
        /Windows/,
    );
    assert.equal(calls.length, 0);
});
