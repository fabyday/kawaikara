const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function load(file, exportName = 'DevelopmentConnection') {
    const loaded = new Module(file, module);
    loaded.paths = module.paths;
    loaded.require = id => id === 'electron' ? {
        app: { getLocale: () => 'en' },
        shell: { openExternal: () => { throw new Error('Must not launch a production app.'); } },
    } : Module.prototype.require.call(loaded, id);
    loaded._compile(buildSync({
        define: require('../../scripts/lib/build-definitions.cjs').createBuildDefinitions(path.resolve(__dirname, '../..'), {}),
        entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['electron'],
    }).outputFiles[0].text, file);
    return loaded.exports[exportName];
}
const Host = load(path.resolve(__dirname, '../../src/Main/Functional/ExternalApps/DevelopmentConnection.ts'));
const IconCache = load(path.resolve(__dirname, '../../src/Main/Functional/ExternalApps/ExternalAppIconCache.ts'), 'ExternalAppIconCache');
const appId = 'day.faby.kawai-downloader';
async function fixture(t) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'development-connection-'));
    const discovery = path.join(dir, 'tmp', 'development-connections');
    let approved = false;
    let prompts = 0;
    const authority = {
        register: async () => { if (!approved) prompts++; approved = true; return true; },
        registered: async () => approved,
        revoke: async () => { approved = false; },
    };
    const file = path.join(dir, 'host.json');
    let host = new Host(file, [appId], discovery, new IconCache(path.join(dir, 'icons.json'), bytes => bytes));
    await host.start(authority);
    const record = async () => JSON.parse(await readFile(path.join(discovery, (await readdir(discovery)).find(name => /^[a-f0-9-]{36}\.json$/.test(name))), 'utf8'));
    t.after(async () => { await host.dispose(); await rm(dir, { recursive: true, force: true }); });
    return {
        dir, discovery, authority, record, get host() { return host; }, get prompts() { return prompts; },
        restart: async () => { await host.dispose(); host = new Host(file, [appId], discovery, new IconCache(path.join(dir, 'icons.json'), bytes => bytes)); await host.start(authority); },
    };
}
async function post(record, route, credentials, extra = {}, headers = {}) {
    return fetch(record.endpoint + route, {
        method: 'POST', headers: { Authorization: `Bearer ${record.token}`, 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ appId, ...credentials, ...extra }),
    });
}
const identity = () => ({ clientId: randomUUID(), key: randomBytes(32).toString('hex') });

test('development handshake requires consent and rejects browser origins and unrelated clients', async t => {
    const f = await fixture(t);
    const record = await f.record();
    const peer = identity();
    assert.equal((await post(record, '/connect', peer, {}, { Origin: 'https://example.com' })).status, 403);
    assert.equal((await post(record, '/connect', peer, {}, { Authorization: 'Bearer wrong' })).status, 403);
    assert.equal(f.prompts, 0);
    assert.equal((await (await post(record, '/poll', peer)).json()).connected, false);
    assert.equal((await (await post(record, '/connect', peer)).json()).connected, true);
    assert.equal(f.prompts, 1);
    assert.equal(f.host.online(appId), true);
    assert.equal((await post(record, '/connect', identity())).status, 403);
    assert.equal((await (await post(record, '/poll', { ...peer, key: '0'.repeat(64) })).json()).connected, false);
    assert.equal((await post(record, '/connect', peer, { appId: 'arbitrary-app' })).status, 403);
});

test('handoffs require acknowledgment; restarts reconnect without approval and revoke prevents resurrection', async t => {
    const f = await fixture(t);
    let record = await f.record();
    const peer = identity();
    await post(record, '/connect', peer);
    const link = 'kawai-downloader://open?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dtest';
    const opened = f.host.launch(appId, link);
    const poll = await (await post(record, '/poll', peer)).json();
    assert.equal(poll.requests[0].deepLink, link);
    await post(record, '/ack', peer, { id: poll.requests[0].id, accepted: true });
    await opened;
    await f.restart();
    record = await f.record();
    assert.equal(f.host.online(appId), false);
    assert.equal((await (await post(record, '/poll', peer)).json()).connected, true);
    assert.equal(f.prompts, 1);
    await f.authority.revoke(appId);
    await f.host.forget(appId);
    assert.equal((await (await post(record, '/poll', peer)).json()).connected, false);
    assert.equal(f.host.online(appId), false);
    await assert.rejects(f.host.launch(appId, link), /must be running/);
    assert.equal((await (await post(record, '/connect', peer)).json()).connected, false);
    await post(record, '/connect', { ...peer, key: randomBytes(32).toString('hex') });
    assert.equal(f.prompts, 2);
});

test('revocation while initial consent is pending cannot establish a connection', async t => {
    const f = await fixture(t);
    let approve;
    const register = f.authority.register;
    f.authority.register = async () => {
        await new Promise(resolve => { approve = resolve; });
        return register();
    };
    const connecting = post(await f.record(), '/connect', identity());
    while (!approve) await new Promise(resolve => setImmediate(resolve));
    await f.host.forget(appId);
    approve(true);
    assert.equal((await (await connecting).json()).connected, false);
    assert.equal(f.host.online(appId), false);
    assert.equal(await f.authority.registered(appId), false);
});

test('queued handoffs do not disclose a URL after resource permission is withdrawn', async t => {
    const f = await fixture(t);
    const record = await f.record();
    const peer = identity();
    await post(record, '/connect', peer);
    let allowed = true;
    const handedOff = f.host.launch(appId, 'kawai-downloader://open?url=secret', () => allowed);
    const rejected = assert.rejects(handedOff, /did not accept/);
    allowed = false;
    assert.deepEqual((await (await post(record, '/poll', peer)).json()).requests, []);
    await rejected;
});

test('an offline development application never falls back to native discovery', async () => {
    const create = load(path.resolve(__dirname, '../../src/Main/Functional/ExternalApps/ProviderAppAdapter.ts'), 'createProviderAppAdapter');
    const adapter = create({
        descriptor: { schemaVersion: 1, id: 'example.editor', name: 'Editor', revision: '1', permissions: [], actions: [{ id: 'edit', permissions: [] }] },
        protocol: 'example-editor', createLaunchUrl() { throw new Error('Must not serialize offline.'); },
    }, { createRequest() { throw new Error('Must not start callbacks offline.'); } }, {
        online: () => false, launch() { throw new Error('Must not launch offline.'); },
    });
    assert.equal(await adapter.discover(), undefined);
    assert.equal((await adapter.execute({ action: 'edit' }, {})).code, 'unavailable');
});

// Optional cross-repository contract test: point at the actual downloader checkout.
test('real downloader reconnects, accepts a source once and delivers offline revocation', {
    skip: !process.env.KAWAI_DOWNLOADER_SOURCE,
}, async t => {
    const Client = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/DevelopmentConnection.ts'));
    const f = await fixture(t);
    const received = [];
    const clientFile = path.join(f.dir, 'client.json');
    const iconBytes = await readFile(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'resources/app-icon.png'));
    const icon = { hash: createHash('sha256').update(iconBytes).digest('hex'), png: iconBytes.toString('base64') };
    let client = new Client(clientFile, url => received.push(url), f.discovery, async () => icon);
    t.after(() => client.dispose());
    await client.start();
    assert.equal((await client.connect()).state, 'connected');
    assert.equal(f.host.iconCache.snapshot()[appId], 'data:image/png;base64,' + icon.png);
    const link = 'kawai-downloader://open?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dtest';
    await f.host.launch(appId, link);
    assert.deepEqual(received, [link]);
    await client.dispose();
    await f.restart();
    client = new Client(clientFile, url => received.push(url), f.discovery);
    await client.start();
    assert.equal(client.status().state, 'connected');
    assert.equal(f.prompts, 1);
    await f.host.dispose();
    assert.equal((await client.disconnect()).state, 'disconnected');
    await client.dispose();
    await f.restart();
    // The initiator stays stopped: the receiver alone must consume the revocation.
    assert.equal(await f.authority.registered(appId), false);
    client = new Client(clientFile, url => received.push(url), f.discovery);
    await client.start();
    assert.equal(client.status().state, 'disconnected');
    assert.equal(f.host.online(appId), false);
    assert.equal(await f.authority.registered(appId), false);
});


test('authenticated icons are requested by hash, cached across restarts, invalidated and removed', async t => {
    const f = await fixture(t);
    let record = await f.record();
    const peer = identity();
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const iconHash = createHash('sha256').update(bytes).digest('hex');
    const png = bytes.toString('base64');
    assert.equal((await (await post(record, '/icon', peer, { iconHash, png })).json()).connected, false);
    assert.deepEqual(f.host.iconCache.snapshot(), {});
    assert.equal((await (await post(record, '/connect', peer, { iconHash })).json()).iconNeeded, true);
    assert.equal((await post(record, '/icon', peer, { iconHash: '0'.repeat(64), png })).status, 403);
    assert.equal((await post(record, '/icon', peer, { iconHash, png: Buffer.from('<svg/>').toString('base64') })).status, 403);
    assert.equal((await (await post(record, '/icon', peer, { iconHash, png })).json()).connected, true);
    assert.equal(f.host.iconCache.snapshot()[appId], 'data:image/png;base64,' + png);
    await f.restart(); record = await f.record();
    assert.equal((await (await post(record, '/poll', peer, { iconHash })).json()).iconNeeded, false);
    assert.equal((await (await post(record, '/poll', peer, { iconHash: 'a'.repeat(64) })).json()).iconNeeded, true);
    // Missing metadata from an older client does not delete the stored icon.
    await post(record, '/poll', peer);
    assert.ok(f.host.iconCache.snapshot()[appId]);
    await post(record, '/poll', peer, { iconHash: null });
    assert.deepEqual(f.host.iconCache.snapshot(), {});
    await post(record, '/icon', peer, { iconHash, png });
    await f.authority.revoke(appId); await f.host.forget(appId);
    assert.deepEqual(f.host.iconCache.snapshot(), {});
});

const crossRepo = { skip: !process.env.KAWAI_DOWNLOADER_SOURCE };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
    for (let i = 0; i < 100; i++) { if (await predicate()) return; await delay(50); }
    assert.fail('Connection state did not settle');
}
test('host revocation reaches a stopped client while the host remains stopped; manual reconnect uses fresh consent', crossRepo, async t => {
    const Client = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/DevelopmentConnection.ts'));
    const f = await fixture(t);
    const file = path.join(f.dir, 'client.json');
    let client = new Client(file, () => {}, f.discovery);
    t.after(() => client.dispose());
    await client.start(); // automatic first connection, still invokes authority approval
    assert.equal(client.status().state, 'connected');
    assert.equal(f.prompts, 1);
    await client.dispose();
    await f.host.forget(appId);
    await f.authority.revoke(appId);
    await f.host.dispose();
    client = new Client(file, () => {}, f.discovery);
    await client.start();
    assert.equal(client.status().state, 'disconnected');
    assert.equal(client.status().hostId, undefined);
    await f.restart();
    await delay(1800);
    assert.equal(client.status().state, 'disconnected');
    assert.equal(f.prompts, 1); // no automatic resurrection
    assert.equal((await client.connect()).state, 'connected');
    assert.equal(f.prompts, 2);
    await f.host.reconcile();
    assert.equal(await f.authority.registered(appId), true); // old tombstone cannot kill new key
});

test('host can manually invite a discovered app with automatic discovery disabled on both sides', crossRepo, async t => {
    const Client = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/DevelopmentConnection.ts'));
    const f = await fixture(t);
    await f.host.setAutomatic(false);
    const file = path.join(f.dir, 'client.json');
    let client = new Client(file, () => {}, f.discovery);
    t.after(() => client.dispose());
    await client.start();
    assert.equal(client.status().state, 'disconnected');
    await client.setAutomatic(false);
    await client.dispose();
    client = new Client(file, () => {}, f.discovery);
    await client.start();
    assert.equal(client.status().automatic, false);
    const candidates = await f.host.candidates();
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].appId, appId);
    assert.equal('token' in candidates[0], false);
    await assert.rejects(f.host.connect(randomUUID()), /unavailable/);
    await f.host.connect(candidates[0].clientId);
    await until(() => client.status().state === 'connected');
    assert.equal(f.prompts, 1);
    assert.deepEqual(await f.host.candidates(), []);
    await f.restart();
    assert.equal(f.host.automatic, false);
});

test('automatic discovery never chooses arbitrarily among multiple running hosts', crossRepo, async t => {
    const Client = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/DevelopmentConnection.ts'));
    const f = await fixture(t);
    let prompts = 0;
    const other = new Host(path.join(f.dir, 'other.json'), [appId], f.discovery);
    await other.start({ register: async () => { prompts++; return true; }, registered: async () => false, revoke: async () => {} });
    t.after(() => other.dispose());
    const client = new Client(path.join(f.dir, 'client.json'), () => {}, f.discovery);
    t.after(() => client.dispose());
    await client.start();
    assert.equal(client.status().state, 'selectHost');
    assert.equal(f.prompts + prompts, 0);
    const options = await client.connect();
    assert.equal(options.hosts.length, 2);
    assert.equal((await client.connect(options.hosts[0])).state, 'connected');
    assert.equal(f.prompts + prompts, 1);
});

test('local distribution shortcut uses installed transport; development pairing is explicit', () => {
    const scripts = require('../../package.json').scripts;
    assert.match(scripts['dev:external:local'], /KAWAIKARA_EXTERNAL_APP_MODE=installed/);
    assert.match(scripts['dev:external:development'], /KAWAIKARA_EXTERNAL_APP_MODE=development/);
    assert.match(scripts['dev:external:install-test'], /KAWAIKARA_EXTERNAL_APP_MODE=installed/);
    assert.match(scripts['dev:external:local'], /KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST=/);
});


test('downloader target selection pairs only the selected DEV checkout and never wakes installed Kawaikara', {
    skip: !process.env.KAWAI_DOWNLOADER_SOURCE,
}, async t => {
    const Client = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/DevelopmentConnection.ts'));
    const Selection = load(path.join(process.env.KAWAI_DOWNLOADER_SOURCE, 'src/Main/KawaikaraConnection.ts'), 'KawaikaraConnection');
    const selected = await fixture(t), other = await fixture(t);
    await writeFile(path.join(selected.dir, 'package.json'), JSON.stringify({ name: 'kawaikara' }));
    let wakes = 0;
    const received = [];
    const create = () => new Selection(path.join(selected.dir, 'downloader-profile'), false,
        (file, directory) => new Client(file, url => received.push(url), directory), async () => { wakes++; });
    let connection = create();
    t.after(() => connection.dispose());
    await connection.start();
    assert.equal(connection.status().requiresDirectory, true);
    assert.equal(await connection.open(), false);
    await connection.selectCheckout(selected.dir);
    assert.equal((await connection.connect()).state, 'connected');
    assert.equal(selected.host.online(appId), true);
    assert.equal(other.host.online(appId), false);
    const link = 'kawai-downloader://open?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dtarget-test';
    await selected.host.launch(appId, link);
    assert.deepEqual(received, [link]);
    await connection.dispose();
    connection = create();
    await connection.start();
    assert.equal((await connection.connect()).state, 'connected');
    assert.equal(selected.prompts, 1);
    await selected.host.dispose();
    assert.equal(await connection.open(), false);
    assert.equal(wakes, 0);
    assert.equal(other.host.online(appId), false);
});
