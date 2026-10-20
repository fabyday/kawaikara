const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { createBuildDefinitions } = require('../../scripts/lib/build-definitions.cjs');

function fixture({ clientId = 'public-app-id', login, clearActivity, fetchPage, links = {} } = {}) {
    let now = 0;
    let locale = 'en';
    let requests = 0;
    const clients = [];
    const opened = [];
    const languages = [];
    const warnings = [];
    class Client extends EventEmitter {
        activities = [];
        destroyed = 0;
        cleared = 0;
        logins = 0;
        constructor() { super(); clients.push(this); }
        async login() { this.logins++; await login?.(); }
        async setActivity(activity) { this.activities.push(activity); }
        async clearActivity() { this.cleared++; await clearActivity?.(); }
        async destroy() { this.destroyed++; }
    }
    const mocks = {
        electron: { app: { getLocale: () => 'en-US' } },
        'discord-rpc': { Client },
        '../../Platform/DefaultBrowser': { openInDefaultBrowser: async url => opened.push(url) },
        '../Localization/Locale': {
            getLocaleMessages: language => {
                languages.push(language);
                return { presence: { details: 'details', watching: 'watching', viewer: 'viewer' }, app: { title: 'Kawaikara', discord: 'Discord' } };
            },
        },
    };
    const code = buildSync({
        entryPoints: [path.resolve(__dirname, '../../src/Main/Manager/SocialManager.ts')],
        bundle: true, platform: 'node', format: 'cjs', write: false,
        external: Object.keys(mocks),
        define: createBuildDefinitions(path.resolve(__dirname, '../..'), {
            DISCORD_APP_ID: clientId, ...links,
        }),
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require: id => { assert.ok(id in mocks, `Unexpected dependency ${id}`); return mocks[id]; },
        console: { info() {}, warn: (...args) => warnings.push(args) },
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [now])); }
            static now() { return now; }
        },
        AbortSignal,
        fetch: async (...args) => {
            requests++;
            return fetchPage ? fetchPage(...args) : { ok: true, text: async () => '{"isLiveNow":true}' };
        },
    });
    return {
        manager: new module.exports.SocialManager(() => locale), clients, opened, languages, warnings,
        advance: milliseconds => { now += milliseconds; },
        setLocale: value => { locale = value; },
        requests: () => requests,
    };
}

test('one social entry point opens canonical links and rejects arbitrary destinations', async () => {
    const f = fixture();
    for (const id of ['website', 'github', 'discord', 'developerYouTube']) await f.manager.openLink(id);
    assert.deepEqual(f.opened, [
        'https://kawaikara.github.io/', 'https://github.com/fabyday/kawaikara',
        'https://discord.gg/JJs974BX45', 'https://www.youtube.com/@molera1708/live',
    ]);
    await assert.rejects(f.manager.openLink('https://example.com'), /Unknown application link/);
    await assert.rejects(f.manager.openLink('__proto__'), /Unknown application link/);
    assert.equal(f.opened.length, 4);
});

test('live lookups coalesce concurrent Views and refresh after the live TTL', async () => {
    let complete;
    const f = fixture({ fetchPage: () => new Promise(resolve => { complete = resolve; }) });
    const first = f.manager.getDeveloperYouTubeStatus();
    const second = f.manager.getDeveloperYouTubeStatus();
    assert.equal(f.requests(), 1);
    complete({ ok: true, text: async () => '{"isLiveNow":true}' });
    const status = await first;
    assert.equal(await second, status);
    assert.equal(status.isLive, true);
    f.advance(59_999);
    assert.equal(await f.manager.getDeveloperYouTubeStatus(), status);
    assert.equal(f.requests(), 1);
    f.advance(1);
    const refreshed = f.manager.getDeveloperYouTubeStatus();
    assert.equal(f.requests(), 2);
    complete({ ok: true, text: async () => '{"isUpcoming":true}' });
    assert.equal((await refreshed).isLive, false);
});

for (const [name, ttl, response] of [
    ['offline', 10_000, { ok: true, text: async () => '{"playabilityStatus":{"status":"LIVE_STREAM_OFFLINE"}}' }],
    ['error', 30_000, { ok: false, status: 503 }],
]) {
    test(`${name} status uses its own retry TTL`, async () => {
        const f = fixture({ fetchPage: async () => response });
        const status = await f.manager.getDeveloperYouTubeStatus();
        assert.equal(status.isLive, false);
        assert.equal(Boolean(status.error), name === 'error');
        f.advance(ttl - 1);
        assert.equal(await f.manager.getDeveloperYouTubeStatus(), status);
        assert.equal(f.requests(), 1);
        f.advance(1);
        await f.manager.getDeveloperYouTubeStatus();
        assert.equal(f.requests(), 2);
    });
}

test('Presence starts once, reads current locale, shares URLs, and cleans up once', async () => {
    const f = fixture();
    await Promise.all([f.manager.start(), f.manager.start()]);
    assert.equal(f.clients.length, 1);
    const client = f.clients[0];
    assert.equal(client.logins, 1);
    f.setLocale('ko');
    client.emit('ready');
    assert.deepEqual(f.languages, ['ko']);
    await f.manager.openLink('website');
    await f.manager.openLink('discord');
    assert.deepEqual(Array.from(client.activities[0].buttons, button => button.url), f.opened);
    await Promise.all([f.manager.dispose(), f.manager.dispose()]);
    client.emit('ready');
    assert.equal(client.activities.length, 1);
    assert.equal(client.cleared, 1);
    assert.equal(client.destroyed, 1);
});

test('empty Discord ID leaves links and live status usable without an RPC client', async () => {
    const f = fixture({ clientId: '' });
    await f.manager.start();
    await f.manager.openLink('website');
    assert.equal((await f.manager.getDeveloperYouTubeStatus()).isLive, true);
    await f.manager.dispose();
    assert.equal(f.clients.length, 0);
});

test('closing during login ignores late readiness and destroys even when clearing fails', async () => {
    let finish;
    const f = fixture({ login: () => new Promise(resolve => { finish = resolve; }), clearActivity: async () => { throw new Error('Discord closed'); } });
    const pending = f.manager.start();
    await Promise.resolve();
    const client = f.clients[0];
    await f.manager.dispose();
    client.emit('ready');
    finish();
    await pending;
    assert.equal(client.activities.length, 0);
    assert.equal(client.destroyed, 1);
});

test('failed Discord login is nonfatal, releases the client, and allows retry', async () => {
    const f = fixture({ login: async () => { throw new Error('Discord is offline'); } });
    await f.manager.start();
    assert.equal(f.clients[0].destroyed, 1);
    await f.manager.start();
    assert.equal(f.clients.length, 2);
    assert.equal(f.clients[1].destroyed, 1);
});


test('build-time link overrides are shared by browser actions, Presence, and live lookup', async () => {
    const fetched = [];
    const f = fixture({
        links: {
            KAWAIKARA_WEBSITE_URL: 'https://example.com/project',
            KAWAIKARA_GITHUB_URL: 'https://example.com/source',
            KAWAIKARA_DISCORD_INVITE_URL: 'https://example.com/community',
            KAWAIKARA_DEVELOPER_YOUTUBE_URL: 'https://www.youtube.com/@example/live',
        },
        fetchPage: async url => { fetched.push(url); return { ok: true, text: async () => '{}' }; },
    });
    for (const id of ['website', 'github', 'discord', 'developerYouTube']) await f.manager.openLink(id);
    assert.deepEqual(f.opened, [
        'https://example.com/project', 'https://example.com/source',
        'https://example.com/community', 'https://www.youtube.com/@example/live',
    ]);
    await f.manager.start();
    f.clients[0].emit('ready');
    assert.deepEqual(Array.from(f.clients[0].activities[0].buttons, button => button.url), [f.opened[0], f.opened[2]]);
    await f.manager.getDeveloperYouTubeStatus();
    assert.deepEqual(fetched, [f.opened[3]]);
    await f.manager.dispose();
});
