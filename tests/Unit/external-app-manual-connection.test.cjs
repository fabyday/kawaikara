const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: ['src/Main/Functional/ExternalApps/ManualConnection.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['electron'] }).outputFiles[0].text;
function fixture(platform, selection, directory = false, fail = false) {
    const calls = [];
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports, process: { platform },
        require(id) {
            if (id === 'electron') return { dialog: { showOpenDialog: async () => selection } };
            if (id === 'node:fs/promises') return {
                realpath: async p => p,
                stat: async () => ({ isDirectory: () => directory, isFile: () => !directory }),
                access: async () => {},
            };
            if (id === 'node:child_process') return {
                execFile(file, args, callback) { calls.push({ file, args }); callback(null, '', ''); },
                spawn(file, args, options) {
                    calls.push({ file, args, options });
                    const child = new EventEmitter(); child.unref = () => calls.push('unref');
                    queueMicrotask(() => child.emit(fail ? 'error' : 'spawn', new Error('launch failed')));
                    return child;
                },
            };
            return require(id);
        },
    });
    return { launch: module.exports.launchManualConnection, calls };
}
test('canceling the picker launches nothing', async () => {
    const f = fixture('darwin', { canceled: true, filePaths: [] });
    await f.launch(); assert.equal(f.calls.length, 0);
});
test('macOS opens exactly the selected application bundle', async () => {
    const f = fixture('darwin', { filePaths: ['/Apps/My App.app'] }, true);
    await f.launch(); assert.equal(f.calls[0].file, '/usr/bin/open');
    assert.deepEqual(Array.from(f.calls[0].args), ['-a', '/Apps/My App.app']);
});
test('macOS rejects documents rather than dispatching their default app', async () => {
    const f = fixture('darwin', { filePaths: ['/tmp/file.txt'] });
    await assert.rejects(f.launch()); assert.equal(f.calls.length, 0);
});
test('Windows rejects script files', async () => {
    const f = fixture('win32', { filePaths: ['C:/app.cmd'] });
    await assert.rejects(f.launch()); assert.equal(f.calls.length, 0);
});
test('Windows launches selected executable with no shell or extra arguments', async () => {
    const f = fixture('win32', { filePaths: ['C:/Apps/App.exe'] });
    await f.launch(); assert.equal(f.calls[0].options.shell, false);
    assert.equal(f.calls[0].args.length, 0); assert.equal(f.calls[1], 'unref');
});
test('Linux launch failure is returned instead of reporting connection success', async () => {
    const f = fixture('linux', { filePaths: ['/opt/app'] }, false, true);
    await assert.rejects(f.launch(), /launch failed/);
});
