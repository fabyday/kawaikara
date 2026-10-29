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

test('generic callback transport delegates custom events and rejects invalid requests', async () => {
    const { ExternalAppCallbackServer } = loadSource('src/Main/Functional/ExternalApps/ExternalAppCallbackServer.ts');
    const server = new ExternalAppCallbackServer({ info() {}, warn() {}, error() {} });
    const seen = [];
    const callback = await server.createRequest({ onEvent(value, requestId) {
        if (value.requestId !== requestId || value.event !== 'editor.saved') throw new Error('Invalid editor event');
        seen.push(value);
        return true;
    } });
    const post = (body, token = callback.token, suffix = '') => fetch(callback.callbackUrl + suffix, {
        method: 'POST', headers: { authorization: `Bearer ${token}` }, body,
    });
    try {
        assert.equal((await post('{}', 'wrong')).status, 401);
        assert.equal((await post('{')).status, 400);
        assert.equal((await post(JSON.stringify({ requestId: 'other', event: 'editor.saved' }))).status, 400);
        assert.equal((await post('x'.repeat(65537))).status, 400);
        assert.equal((await post('{}', callback.token, '/host')).status, 403);
        const body = JSON.stringify({ requestId: callback.requestId, event: 'editor.saved' });
        assert.equal((await post(body)).status, 204);
        assert.equal((await post(body)).status, 204); // duplicate terminal delivery grace
        assert.equal(seen.length, 2);
        server.cancel(callback.requestId);
        assert.equal((await post(body)).status, 401);
    } finally { server.cancel(callback.requestId); }
    const hostOnly = await server.createRequest();
    try {
        assert.equal((await fetch(hostOnly.callbackUrl, {
            method: 'POST', headers: { authorization: `Bearer ${hostOnly.token}` }, body: '{}',
        })).status, 400);
    } finally { server.cancel(hostOnly.requestId); }
});

test('downloader event semantics belong to the Provider Bundle', () => {
    const { kawaiDownloaderIntegration: adapter } = loadSource('packages/builtin-sites/src/Functional/KawaiDownloaderAdapter.ts');
    const base = { requestId: 'fixture', timestamp: 'now' };
    assert.equal(adapter.onEvent({ ...base, event: 'download.progress' }, 'fixture'), false);
    assert.equal(adapter.onEvent({ ...base, event: 'download.completed' }, 'fixture'), true);
    assert.throws(() => adapter.onEvent({ ...base, event: 'editor.saved' }, 'fixture'));
    assert.throws(() => adapter.onEvent({ ...base, event: 'request.received' }, 'other'));
});

test('real kawai-downloader parses the unchanged handoff, acknowledges it and reads scoped cookies', {
    skip: !process.env.KAWAI_DOWNLOADER_SOURCE, timeout: 10000,
}, async () => {
    const { ExternalAppCallbackServer } = loadSource('src/Main/Functional/ExternalApps/ExternalAppCallbackServer.ts');
    const { kawaiDownloaderIntegration: adapter } = loadSource('packages/builtin-sites/src/Functional/KawaiDownloaderAdapter.ts');
    const { parseDownloaderDeepLink } = loadSource(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/ExternalProtocol.ts'));
    const { CompanionManager } = loadSource(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/Manager/CompanionManager.ts'));
    const logger = { info() {}, warn() {}, error() {} };
    const server = new ExternalAppCallbackServer(logger);
    const source = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    let acknowledged, reads = 0;
    const accepted = new Promise(resolve => { acknowledged = resolve; });
    const callback = await server.createRequest({
        host: { hasPermission: () => true, getUrl: () => source, getCookies: async permission => {
            assert.equal(permission, 'session'); reads++; return [];
        } },
        onEvent(value, id) {
            const terminal = adapter.onEvent(value, id);
            if (value.event === 'source.accepted') acknowledged();
            return terminal;
        },
    });
    try {
        const request = parseDownloaderDeepLink(adapter.createLaunchUrl({ action: 'open' }, { callback, getUrl: () => source, hasPermission: () => true }));
        assert.deepEqual(request.companion, callback);
        const client = new CompanionManager();
        client.acceptDeepLink(request);
        await accepted;
        assert.deepEqual(await client.requestCookies(callback.requestId, source), { format: 'records', cookies: [] });
        assert.equal(reads, 1);
    } finally { server.cancel(callback.requestId); }
});
