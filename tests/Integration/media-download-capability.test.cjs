const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(relative, mocks = {}) {
    const filename = path.resolve(__dirname, '../..', relative);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
        external: Object.keys(mocks),
    }).outputFiles[0].text;
    loaded._compile(code, filename);
    return loaded.exports;
}

test('the authenticated loopback callback logs companion lifecycle events', async () => {
    const { ExternalDownloaderCallbackServer } = loadSource(
        'src/Main/Functional/External/ExternalDownloaderCallback.ts',
    );
    const records = [];
    const logger = Object.fromEntries(
        ['error', 'info', 'warn'].map((level) => [
            level,
            (...values) => records.push({ level, values }),
        ]),
    );
    const callbackServer = new ExternalDownloaderCallbackServer(logger);
    const callback = await callbackServer.createRequest();
    const response = await fetch(callback.callbackUrl, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${callback.token}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            event: 'download.progress',
            requestId: callback.requestId,
            timestamp: new Date().toISOString(),
            progress: 0.55,
            stage: 'running',
            message: 'Downloading',
        }),
    });
    assert.equal(response.status, 204);
    assert.equal(
        records.some(
            (record) =>
                record.level === 'info' &&
                record.values[0] === 'External download progress.',
        ),
        true,
    );

    const unauthorized = await fetch(callback.callbackUrl, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
        body: '{}',
    });
    assert.equal(unauthorized.status, 401);
    callbackServer.cancel(callback.requestId);
});
