const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
function load(relative) {
    const filename = path.resolve(__dirname, '../..', relative);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        id === 'electron'
            ? { app: { getLocale: () => 'en-US' } }
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
const { ExternalAppManager } = load('src/Main/Manager/ExternalAppManager.ts');
const { ExternalAppPermissions, validateExternalAppDescriptor } = load(
    'src/Main/Functional/ExternalApps/ExternalAppPermissions.ts',
);
const { createYouTubeDownloaderAdapter } = load(
    'src/Main/Functional/ExternalApps/YouTubeDownloaderAdapter.ts',
);
const { ProviderManager } = load('src/Main/Manager/ProviderManager.ts');
const { builtinBundle } = require('@kawaikara/builtin-sites');
const source = 'https://www.youtube.com/watch?v=fixture';
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function prompt(permissions) {
    for (let i = 0; i < 100; i++) {
        const state = await permissions.status();
        if (state.approval) return state.approval;
        await tick();
    }
    throw new Error('No consent prompt appeared');
}
function fixture() {
    const state = { installed: false, opened: true, error: undefined },
        calls = [];
    let prompts = 0;
    const permissions = new ExternalAppPermissions(undefined, () => {
        prompts++;
        void permissions
            .status()
            .then(({ approval }) =>
                permissions.decide(approval.id, ['source']),
            );
    });
    const apps = new ExternalAppManager(
        [
            createYouTubeDownloaderAdapter({
                getStatus: async () => ({
                    installed: state.installed,
                    version: '1.2.3',
                    appPath: '/private/app',
                }),
                open: async (url, host) => {
                    calls.push(url);
                    assert.equal(host.hasPermission('session'), false);
                    if (state.error) throw state.error;
                    return { opened: state.opened, requestId: 'job-1' };
                },
            }),
        ],
        permissions,
    );
    const sites = new ProviderManager(
        () => {
            throw new Error('No viewer should activate');
        },
        () => ({ siteBrowserProfiles: {}, browserProfiles: [] }),
        () => '',
        () => {},
        apps,
    );
    sites.registerBundle(builtinBundle);
    return { state, calls, apps, sites, permissions, prompts: () => prompts };
}
function custom(permissions) {
    const calls = [],
        hosts = [];
    const descriptor = {
        schemaVersion: 1,
        id: 'custom.app',
        name: 'Custom',
        revision: '1',
        permissions: [
            {
                id: 'url',
                kind: 'resource.url',
                origins: ['https://www.youtube.com'],
            },
            {
                id: 'cookies',
                kind: 'cookies.read',
                origins: ['https://www.youtube.com'],
            },
        ],
        actions: [
            { id: 'open', permissions: ['url'] },
            { id: 'signed-in', permissions: ['url', 'cookies'] },
            { id: 'about', permissions: [] },
        ],
    };
    const adapter = {
        descriptor,
        discover: async () => ({ version: '1' }),
        execute: async (request, host) => {
            calls.push(request);
            hosts.push(host);
            return { accepted: true };
        },
    };
    const apps = new ExternalAppManager([adapter], permissions);
    const resource = {
        provider: { id: 'test.youtube', name: 'YouTube' },
        url: source,
        isActive: () => true,
        readCookies: async () => [
            {
                name: 'SID',
                value: 'secret',
                domain: '.youtube.com',
                path: '/',
                secure: true,
                httpOnly: true,
            },
        ],
    };
    return { apps, adapter, resource, calls, hosts };
}

test('YouTube Provider registers a newly installed app, then invokes its own open action without media contracts', async () => {
    const f = fixture();
    assert.equal(
        (await f.sites.requestDownload('kawaikara.youtube', source)).result
            .code,
        'unavailable',
    );
    f.state.installed = true;
    const info = await f.apps.find('day.faby.kawai-downloader');
    assert.equal(info.name, 'kawai-downloader');
    assert.equal(info.id, 'day.faby.kawai-downloader');
    assert.equal(info.registered, false);
    assert.equal(info.appPath, undefined);
    assert.equal(f.prompts(), 0);
    assert.deepEqual(
        (await f.sites.requestDownload('kawaikara.youtube', source)).result,
        { accepted: true, requestId: 'job-1' },
    );
    assert.deepEqual(f.calls, [source]);
    assert.equal(f.prompts(), 1);
    await f.sites.requestDownload('kawaikara.youtube', source);
    assert.equal(f.prompts(), 1);
    f.state.installed = false;
    assert.equal(
        (await f.sites.requestDownload('kawaikara.youtube', source)).result
            .code,
        'unavailable',
    );
});

test('CHZZK preserves handoff and unrelated/unsafe URLs never reach the app', async () => {
    const f = fixture();
    f.state.installed = true;
    await f.sites.requestDownload(
        'kawaikara.chzzk',
        'https://chzzk.naver.com/video/123',
    );
    for (const url of [
        'https://evil.example/video',
        'http://www.youtube.com/watch?v=x',
        'https://user@www.youtube.com/watch?v=x',
        'https://www.youtube.com:444/watch?v=x',
    ])
        await assert.rejects(
            f.sites.requestDownload('kawaikara.youtube', url),
            /unavailable/,
        );
    assert.equal(f.calls.length, 1);
    f.state.error = new Error('launch failed');
    await assert.rejects(
        f.sites.requestDownload('kawaikara.youtube', source),
        /launch failed/,
    );
});

test('partial registration disables only required functions and rejects undeclared grants', async () => {
    const permissions = new ExternalAppPermissions(),
        f = custom(permissions);
    const run = f.apps.request('custom.app', { action: 'open' }, f.resource);
    const approval = await prompt(permissions);
    assert.throws(
        () => permissions.decide(approval.id, ['made-up']),
        /Undeclared/,
    );
    permissions.decide(approval.id, ['url']);
    assert.equal((await run).accepted, true);
    const info = await f.apps.find('custom.app');
    assert.deepEqual(
        info.actions.map((a) => [a.id, a.enabled]),
        [
            ['open', true],
            ['signed-in', false],
            ['about', true],
        ],
    );
    assert.equal(
        (
            await f.apps.request(
                'custom.app',
                { action: 'signed-in' },
                f.resource,
            )
        ).code,
        'permission-denied',
    );
    assert.equal(
        (await f.apps.request('custom.app', { action: 'unknown' }, f.resource))
            .code,
        'unsupported-action',
    );
    assert.equal(f.hosts[0].getUrl('url'), source);
    await assert.rejects(f.hosts[0].getCookies('cookies'), /permission denied/);
    await assert.rejects(f.hosts[0].getCookies('url'), /permission denied/);
    assert.equal(f.calls.length, 1);
});

test('cancel does not register; explicitly approving no grants creates a restricted registration', async () => {
    const permissions = new ExternalAppPermissions(),
        f = custom(permissions);
    let run = f.apps.register('custom.app', f.resource.provider);
    let approval = await prompt(permissions);
    permissions.decide(approval.id, undefined);
    assert.equal(await run, false);
    assert.equal((await permissions.status()).registrations.length, 0);
    run = f.apps.register('custom.app', f.resource.provider);
    approval = await prompt(permissions);
    permissions.decide(approval.id, []);
    assert.equal(await run, true);
    assert.equal(
        (await f.apps.request('custom.app', { action: 'about' })).accepted,
        true,
    );
    assert.equal(
        (await f.apps.request('custom.app', { action: 'open' }, f.resource))
            .code,
        'permission-denied',
    );
});

test('cookie reads are origin-, profile-resource- and revocation-scoped, including in-flight reads', async () => {
    const permissions = new ExternalAppPermissions(),
        f = custom(permissions);
    const registration = f.apps.register('custom.app', f.resource.provider);
    const approval = await prompt(permissions);
    permissions.decide(approval.id, ['url', 'cookies']);
    await registration;
    await permissions.configureProvider(f.adapter.descriptor, { providerId: f.resource.provider.id, enabled: true, grants: ['url'], cookies: { cookies: 'allow' } });
    assert.equal(
        (
            await f.apps.request(
                'custom.app',
                { action: 'open' },
                { ...f.resource, url: 'https://evil.example/' },
            )
        ).code,
        'permission-denied',
    );
    await f.apps.request('custom.app', { action: 'signed-in' }, f.resource);
    assert.equal((await f.hosts[0].getCookies('cookies'))[0].value, 'secret');
    let finish;
    await f.apps.request(
        'custom.app',
        { action: 'open' },
        {
            ...f.resource,
            readCookies: () => new Promise((resolve) => (finish = resolve)),
        },
    );
    const reading = f.hosts[1].getCookies('cookies');
    while (!finish) await tick();
    await permissions.revoke('custom.app');
    finish([{ value: 'secret' }]);
    await assert.rejects(reading, /permission denied/);
    assert.throws(() => f.hosts[0].getUrl('url'), /permission denied/);
    // Reapproving must not resurrect previously issued host handles.
    const again = f.apps.register('custom.app', f.resource.provider);
    const next = await prompt(permissions);
    permissions.decide(next.id, ['url', 'cookies']);
    await again;
    await assert.rejects(f.hosts[0].getCookies('cookies'), /permission denied/);
});

test('persisted consent survives restart, but changed adapter declarations require new review', async (t) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kawaikara-external-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'grants.json'),
        permissions = new ExternalAppPermissions(file),
        f = custom(permissions);
    const pending = f.apps.register('custom.app', f.resource.provider);
    const approval = await prompt(permissions);
    permissions.decide(approval.id, ['url']);
    await pending;
    const restored = new ExternalAppPermissions(file),
        next = custom(restored);
    assert.equal((await next.apps.find('custom.app')).registered, true);
    next.adapter.descriptor.revision = '2';
    const changed = new ExternalAppManager([next.adapter], restored);
    assert.equal((await changed.find('custom.app')).registered, false);
    const run = changed.register('custom.app');
    const review = await prompt(restored);
    restored.decide(review.id, ['url']);
    assert.equal(await run, true);
    assert.equal(readFileSync(file, 'utf8').includes('secret'), false);
});

test('concurrent registration coalesces the same app and revoking a pending request prevents finalization', async () => {
    const permissions = new ExternalAppPermissions(),
        f = custom(permissions);
    const a = f.apps.register('custom.app', f.resource.provider),
        b = f.apps.register('custom.app', f.resource.provider);
    const approval = await prompt(permissions);
    permissions.decide(approval.id, ['url']);
    assert.deepEqual(await Promise.all([a, b]), [true, true]);
    assert.equal((await permissions.status()).approval, undefined);
    await permissions.revoke('custom.app');
    const c = f.apps.register('custom.app', f.resource.provider);
    await prompt(permissions);
    await permissions.revoke('custom.app');
    assert.equal(await c, false);
});

test('declarations cannot request wildcard cookie origins or undefined host operations', () => {
    const f = custom(new ExternalAppPermissions());
    for (const permission of [
        { id: 'bad', kind: 'cookies.read', origins: ['https://*.youtube.com'] },
        { id: 'bad', kind: 'shell.execute', origins: ['https://youtube.com'] },
    ]) {
        const descriptor = {
            ...f.adapter.descriptor,
            permissions: [permission],
            actions: [],
        };
        assert.throws(() => validateExternalAppDescriptor(descriptor));
    }
    assert.throws(
        () =>
            new ExternalAppManager(
                [f.adapter, f.adapter],
                new ExternalAppPermissions(),
            ),
        /unique/,
    );
});

test('authenticated callback host API returns cookies only for the exact live request and grant', async () => {
    const { ExternalDownloaderCallbackServer } = load(
        'src/Main/Functional/External/ExternalDownloaderCallback.ts',
    );
    const server = new ExternalDownloaderCallbackServer({
        info() {},
        warn() {},
        error() {},
    });
    const permissions = new ExternalAppPermissions(),
        f = custom(permissions);
    const run = f.apps.register('custom.app', f.resource.provider);
    const approval = await prompt(permissions);
    permissions.decide(approval.id, ['url', 'cookies']);
    await run;
    await permissions.configureProvider(f.adapter.descriptor, { providerId: f.resource.provider.id, enabled: true, grants: ['url'], cookies: { cookies: 'allow' } });
    await f.apps.request('custom.app', { action: 'open' }, f.resource);
    const callback = await server.createRequest(f.hosts[0]);
    const call = (token, permission = 'cookies') =>
        fetch(callback.callbackUrl + '/host', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ method: 'cookies.read', permission }),
        });
    try {
        assert.equal((await call('wrong')).status, 401);
        assert.equal((await call(callback.token, 'url')).status, 403);
        assert.equal(
            (await (await call(callback.token)).json())[0].value,
            'secret',
        );
        await permissions.revoke('custom.app');
        assert.equal((await call(callback.token)).status, 403);
    } finally {
        server.cancel(callback.requestId);
    }
});

test('registry has no media/download contract or built-in resource implementation', () => {
    const source = readFileSync(
        path.resolve(__dirname, '../../src/Main/Manager/ExternalAppManager.ts'),
        'utf8',
    );
    assert.doesNotMatch(
        source,
        /YouTube|Downloader|media\.download|cookies\.get|from ['"]electron|Platform\//,
    );
});

test('cookies ask per use, remember per Provider, and denial preserves URL handoff', async () => {
    const permissions = new ExternalAppPermissions(), f = custom(permissions);
    const opening = f.apps.request('custom.app', { action: 'open' }, f.resource);
    permissions.decide((await prompt(permissions)).id, ['url', 'cookies']);
    assert.equal((await opening).accepted, true);
    const first = f.hosts[0].getCookies('cookies');
    const firstPrompt = await prompt(permissions);
    assert.equal(firstPrompt.provider.id, f.resource.provider.id);
    assert.equal(firstPrompt.cookiePermission, 'cookies');
    permissions.decide(firstPrompt.id, ['cookies']);
    assert.equal((await first)[0].value, 'secret');
    const denied = f.hosts[0].getCookies('cookies');
    permissions.decide((await prompt(permissions)).id, undefined);
    await assert.rejects(denied, /permission denied/);
    assert.equal(f.hosts[0].getUrl('url'), source);
    const remembered = f.hosts[0].getCookies('cookies');
    permissions.decide((await prompt(permissions)).id, ['cookies'], true);
    await remembered;
    assert.equal((await f.hosts[0].getCookies('cookies'))[0].value, 'secret');
    assert.equal((await permissions.status()).approval, undefined);
    const other = { ...f.resource, provider: { id: 'another.provider', name: 'Another' } };
    const second = f.apps.request('custom.app', { action: 'open' }, other);
    const registration = await prompt(permissions);
    assert.equal(registration.provider.id, 'another.provider');
    assert.equal(registration.cookiePermission, undefined);
    permissions.decide(registration.id, ['url']);
    assert.equal((await second).accepted, true);
    await assert.rejects(f.hosts[1].getCookies('cookies'), /permission denied/);
    await permissions.configureProvider(f.adapter.descriptor, { providerId: f.resource.provider.id, enabled: false, grants: ['url'], cookies: { cookies: 'allow' } });
    assert.equal(f.hosts[1].getUrl('url'), source, 'Changing another Provider must not revoke this live resource');
    assert.equal((await f.apps.request('custom.app', { action: 'about' }, f.resource)).code, 'permission-denied');
    await assert.rejects(f.hosts[0].getCookies('cookies'), /permission denied/);
    assert.equal((await f.apps.request('custom.app', { action: 'open' }, other)).accepted, true);
});

test('Provider policy persists, settings changes cancel cookie prompts, legacy grants cannot share cookies', async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'provider-policy-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'apps.json');
    const permissions = new ExternalAppPermissions(file), f = custom(permissions);
    const registering = f.apps.register('custom.app', f.resource.provider);
    permissions.decide((await prompt(permissions)).id, ['url', 'cookies']);
    await registering;
    await f.apps.request('custom.app', { action: 'open' }, f.resource);
    const read = assert.rejects(f.hosts[0].getCookies('cookies'), /permission denied/);
    await prompt(permissions);
    await permissions.configureProvider(f.adapter.descriptor, { providerId: f.resource.provider.id, enabled: true, grants: ['url'], cookies: { cookies: 'deny' } });
    await read;
    const restored = new ExternalAppPermissions(file), g = custom(restored);
    assert.equal((await g.apps.request('custom.app', { action: 'open' }, g.resource)).accepted, true);
    await assert.rejects(g.hosts[0].getCookies('cookies'), /permission denied/);
    await restored.configureProvider(g.adapter.descriptor, { providerId: g.resource.provider.id, enabled: true, grants: ['url'], cookies: { cookies: 'allow' } });
    const reloaded = new ExternalAppPermissions(file), h = custom(reloaded);
    await h.apps.request('custom.app', { action: 'open' }, h.resource);
    assert.equal((await h.hosts[0].getCookies('cookies'))[0].value, 'secret');
    const unscoped = { ...h.resource, provider: undefined };
    await h.apps.request('custom.app', { action: 'open' }, unscoped);
    await assert.rejects(h.hosts[1].getCookies('cookies'), /permission denied/);
});

test('a Provider cannot discover or dispatch an undeclared external app', async () => {
    const { dispatchProviderDownload } = load('src/Main/Functional/Bundle/Provider/ProviderDownloads.ts');
    const permissions = new ExternalAppPermissions(), f = custom(permissions);
    const metadata = { id: 'test.youtube', title: 'YouTube', permissions: ['web-extension'], address: { hosts: ['youtube.com'] }, externalApps: [], webExtension: { actionDefinitions: { download: { handler: 'download' } } } };
    for (const operation of ['find', 'request']) {
        const registration = { metadata, constructor: { onDownload: (_url, context) => context.externalApps[operation]('custom.app', { action: 'open' }) } };
        await assert.rejects(dispatchProviderDownload(registration, source, f.apps, () => true, () => 'test'), /Undeclared/);
    }
    assert.equal((await permissions.status()).approval, undefined);
    assert.equal(f.calls.length, 0);
});

test('remembering cookies does not overwrite another Provider policy edited during the prompt', async () => {
    const permissions = new ExternalAppPermissions(), f = custom(permissions);
    const register = f.apps.register('custom.app', f.resource.provider);
    permissions.decide((await prompt(permissions)).id, ['url', 'cookies']);
    await register;
    await permissions.configureProvider(f.adapter.descriptor, { providerId: 'other', enabled: true, grants: ['url'], cookies: { cookies: 'deny' } });
    await f.apps.request('custom.app', { action: 'open' }, f.resource);
    const read = f.hosts[0].getCookies('cookies');
    const consent = await prompt(permissions);
    await permissions.configureProvider(f.adapter.descriptor, { providerId: 'other', enabled: false, grants: [], cookies: { cookies: 'deny' } });
    permissions.decide(consent.id, ['cookies'], true);
    assert.equal((await read)[0].value, 'secret');
    const record = await permissions.get(f.adapter.descriptor);
    assert.equal(record.providers.find(item => item.providerId === 'other').enabled, false);
    assert.equal(record.providers.find(item => item.providerId === f.resource.provider.id).cookies.cookies, 'allow');
});


for (const legacyId of ['yt-downloader', 'com.ytdownloader.app']) test(`retired ${legacyId} grants cannot transfer to the canonical app identity`, async t => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'downloader-identity-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'apps.json');
    const permissions = new ExternalAppPermissions(file);
    const adapter = createYouTubeDownloaderAdapter({ getStatus: async () => ({ installed: true }), open: async () => { throw new Error('Must not launch before new consent'); } });
    const old = { ...adapter.descriptor, id: legacyId, name: 'YT Downloader' };
    const saving = permissions.register(old);
    permissions.decide((await prompt(permissions)).id, ['source']);
    await saving;
    const restored = new ExternalAppPermissions(file);
    const apps = new ExternalAppManager([adapter], restored);
    assert.equal(await apps.find(legacyId), undefined);
    assert.equal((await apps.find('day.faby.kawai-downloader')).registered, false);
    const opening = apps.request('day.faby.kawai-downloader', { action: 'open' });
    const approval = await prompt(restored);
    assert.equal(approval.descriptor.id, 'day.faby.kawai-downloader');
    assert.equal(approval.descriptor.name, 'kawai-downloader');
    restored.decide(approval.id, undefined);
    assert.equal((await opening).code, 'permission-denied');
});
