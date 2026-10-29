const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const crypto = require('node:crypto');
function load(name, mocks = {}) {
    const filename = path.resolve(__dirname, '../../src', name),
        instance = new Module(filename, module);
    instance.paths = module.paths;
    instance.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(instance, id);
    instance._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            write: false,
            platform: 'node',
            format: 'cjs',
            external: Object.keys(mocks),
        }).outputFiles[0].text,
        filename,
    );
    return instance.exports;
}
const dir = 'Main/Functional/ExternalApps/Distribution/';
const { parseDistribution, selectDistributionTarget, distributionAction } =
    load(dir + 'Descriptor.ts');
const source = 'https://example.com/apps/kawaikara.manifest.json';
const artifact = { url: './app.dmg', format: 'dmg', sha256: 'a'.repeat(64) };
const base = {
    schemaVersion: 1,
    id: 'day.test.app',
    name: 'Test app',
    icon: './icon.png',
    guideUrl: './install#mac',
    connection: {
        protocolVersion: 1,
        transport: 'loopback',
        launchScheme: 'day.test.app',
    },
    targets: [
        { os: 'darwin', arch: 'universal', version: '1.0', artifact },
        {
            os: 'darwin',
            arch: 'arm64',
            version: '2.0',
            artifact: { ...artifact, url: './arm64.dmg' },
        },
        { os: 'linux', arch: 'x64', guideUrl: './linux' },
        {
            os: 'win32',
            arch: 'x64',
            artifact: { ...artifact, url: './setup.exe', format: 'exe' },
        },
    ],
};
test('manifest selects exact CPU, resolves host-neutral relative URLs, and separates action capabilities', () => {
    const parsed = parseDistribution(
        { ...base, command: 'ignored', permissions: ['ignored'] },
        source,
        'day.test.app',
    );
    assert.equal(parsed.icon, 'https://example.com/apps/icon.png');
    assert.equal(parsed.guideUrl, 'https://example.com/apps/install#mac');
    assert.equal('command' in parsed, false);
    assert.equal('permissions' in parsed, false);
    assert.equal(
        selectDistributionTarget(parsed, 'darwin', 'arm64').version,
        '2.0',
    );
    assert.equal(
        selectDistributionTarget(parsed, 'darwin', 'x64').version,
        '1.0',
    );
    for (const [platform, arch, action] of [
        ['darwin', 'arm64', 'install'],
        ['win32', 'x64', 'install'],
        ['linux', 'x64', 'guide'],
        ['linux', 'arm64', 'unsupported'],
    ])
        assert.equal(
            distributionAction(
                parsed,
                selectDistributionTarget(parsed, platform, arch),
            ),
            action,
        );
    assert.equal(
        distributionAction(parsed, {
            os: 'linux',
            arch: 'x64',
            artifact: { ...artifact, format: 'appimage' },
        }),
        'download',
    );
    assert.equal(
        distributionAction(parsed, {
            os: 'darwin',
            arch: 'arm64',
            artifact: { ...artifact, format: 'zip' },
        }),
        'download',
    );
});
test('invalid identities, versions, URLs, targets and checksums never produce a usable descriptor', () => {
    assert.throws(() => parseDistribution(base, source, 'day.other.app'));
    for (const patch of [
        { schemaVersion: 2 },
        { targets: {} },
        { targets: Array(65).fill(base.targets[0]) },
        { icon: 'file:///tmp/icon.png' },
        { icon: 'https://user:secret@example.com/a' },
        { targets: [{ os: ['darwin'], arch: 'arm64' }] },
        {
            targets: [
                {
                    os: 'darwin',
                    arch: 'arm64',
                    artifact: { ...artifact, sha256: 'no' },
                },
            ],
        },
        {
            connection: {
                protocolVersion: 1,
                transport: 'loopback',
                launchScheme: 'javascript',
            },
        },
    ])
        assert.throws(() => parseDistribution({ ...base, ...patch }, source));
});
test('public resources exclude private and mapped addresses, even with noncanonical IPv6 spelling', () => {
    const { isPublicAddress } = load(dir + 'PublicResource.ts');
    for (const ip of [
        '127.0.0.1',
        '10.1.2.3',
        '172.16.4.1',
        '192.168.1.2',
        '169.254.169.254',
        '100.64.0.1',
        '::1',
        '::ffff:127.0.0.1',
        'fc00::1',
        'fe80::1',
        '2001:0db8:0::1',
        '2002:7f00:1::',
        '2001::1',
        '3fff::1',
    ])
        assert.equal(isPublicAddress(ip), false, ip);
    for (const ip of [
        '1.1.1.1',
        '8.8.8.8',
        '2606:4700:4700::1111',
        '2001:4860:4860::8888',
    ])
        assert.equal(isPublicAddress(ip), true, ip);
});
test('network requests pin checked DNS, reject redirect-to-private and enforce streamed byte limits', async () => {
    let mode = 'redirect',
        calls = 0;
    const mocks = {
        'node:dns/promises': {
            lookup: async () => [{ address: '8.8.8.8', family: 4 }],
        },
        'node:https': {
            get: (url, options, callback) => {
                calls++;
                assert.equal(options.headers.Cookie, undefined);
                assert.equal(options.headers.Authorization, undefined);
                options.lookup(
                    url.hostname,
                    { all: true },
                    (err, addresses) => {
                        assert.equal(err, null);
                        assert.deepEqual(addresses, [
                            { address: '8.8.8.8', family: 4 },
                        ]);
                    },
                );
                const response = Readable.from([Buffer.alloc(100)]);
                response.statusCode = mode === 'redirect' ? 302 : 200;
                response.headers =
                    mode === 'redirect'
                        ? { location: 'https://127.0.0.1/private' }
                        : {};
                queueMicrotask(() => callback(response));
                return new EventEmitter();
            },
        },
    };
    const { openPublicResource, readPublicResource } = load(
        dir + 'PublicResource.ts',
        mocks,
    );
    await assert.rejects(
        openPublicResource(source, AbortSignal.timeout(2000)),
        /public internet/,
    );
    assert.equal(calls, 1);
    mode = 'buffer';
    await assert.rejects(readPublicResource(source, 10), /size limit/);
});
test('raster dimensions are bounded before native decoding', async () => {
    const { rasterDimensions } = load(dir + 'RasterBounds.ts');
    const png = await fs.readFile(
        path.resolve(__dirname, '../../resources/icons/app-kawaikara.png'),
    );
    assert.deepEqual(rasterDimensions(png), [540, 476]);
    const { normalizeDistributionIcon } = load(dir + 'Repository.ts', {
        electron: {
            nativeImage: {
                createFromBuffer: () =>
                    assert.fail('must reject before decoding'),
            },
        },
    });
    const bomb = Buffer.from(png);
    bomb.writeUInt32BE(50000, 16);
    assert.throws(() => normalizeDistributionIcon(bomb), /dimensions/);
    assert.throws(
        () => normalizeDistributionIcon(Buffer.from('<svg onload="run()"/>')),
        /raster/,
    );
});
test('source-scoped cache survives offline use, revalidates identity and preserves valid icons on image failure', async (t) => {
    const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'app-distribution-'),
    );
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const png = await fs.readFile(
        path.resolve(__dirname, '../../resources/icons/app-kawaikara.png'),
    );
    const electron = {
        nativeImage: {
            createFromBuffer: () => ({
                getSize: () => ({ width: 64, height: 64 }),
                isEmpty: () => false,
                resize: () => ({ toPNG: () => png }),
            }),
        },
    };
    const { DistributionRepository } = load(dir + 'Repository.ts', {
        electron,
    });
    let fail = false,
        iconFails = false;
    const read = async (url) => {
        if (fail) throw Error('offline');
        if (url.endsWith('png')) {
            if (iconFails) throw Error('image offline');
            return png;
        }
        return Buffer.from(JSON.stringify(base));
    };
    const repository = new DistributionRepository(directory, read);
    const first = await repository.load(source, base.id);
    assert.equal(first.cached, false);
    assert.match(first.icon, /^data:image\/png;base64,/);
    iconFails = true;
    const next = await repository.load(source, base.id);
    assert.equal(next.icon, first.icon);
    fail = true;
    const cached = await new DistributionRepository(directory, read).load(
        source,
        base.id,
    );
    assert.equal(cached.cached, true);
    assert.equal(cached.icon, first.icon);
    await assert.rejects(repository.load(source, 'different.app'));
    await assert.rejects(
        repository.load('https://elsewhere.example/manifest.json', base.id),
    );
});
test('catalog binds actions to immutable preview capabilities and blocks incompatible installers and overlapping dialogs', async () => {
    const { DistributionCatalog } = load(dir + 'Catalog.ts', {
        electron: { nativeImage: {} },
    });
    let finish;
    const calls = [];
    const catalog = new DistributionCatalog(
        {
            load: async () => ({
                descriptor: parseDistribution(base, source),
                cached: false,
            }),
        },
        async (url) => calls.push(url),
        async (preview, install) => {
            calls.push([preview.target.os, install]);
            return new Promise((resolve) => {
                finish = resolve;
            });
        },
        'darwin',
        'arm64',
    );
    const preview = await catalog.preview(source, base.id);
    assert.equal(calls.length, 0);
    await assert.rejects(catalog.act('wrong', 'install'), /expired/);
    const pending = catalog.act(preview.token, 'install');
    await assert.rejects(catalog.act(preview.token, 'install'), /progress/);
    finish('installer-opened');
    assert.equal(await pending, 'installer-opened');
    assert.deepEqual(calls, [['darwin', true]]);
    await catalog.act(preview.token, 'guide');
    assert.equal(calls[1], 'https://example.com/apps/install#mac');
    await assert.rejects(catalog.act(preview.token, 'run-shell'), /Unknown/);
    const linux = new DistributionCatalog(
        {
            load: async () => ({
                descriptor: parseDistribution(base, source),
                cached: false,
            }),
        },
        async () => {},
        () => assert.fail('unsupported installer'),
        'linux',
        'x64',
    );
    const manual = await linux.preview(source);
    await assert.rejects(linux.act(manual.token, 'install'), /Unsupported/);
});
test('installer checksum failure cannot launch OS handlers or leave unverified files', async (t) => {
    const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'distribution-install-'),
    );
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'app.zip'),
        data = Buffer.from('verified fixture');
    let marks = 0;
    const { prepareDistributionArtifact } = load(
        dir + 'Installer.ts',
        {
            electron: {
                app: { getPath: () => directory },
                dialog: {
                    showSaveDialog: async () => ({
                        filePath: target,
                        canceled: false,
                    }),
                },
                shell: {
                    openPath: () =>
                        assert.fail('manual download never launches'),
                },
            },
            './PublicResource': {
                openPublicResource: async () => Readable.from([data]),
            },
            'node:child_process': {
                execFile: (_cmd, _args, callback) => {
                    marks++;
                    callback(null, '', '');
                },
            },
        },
    );
    const preview = {
        descriptor: { id: base.id, name: base.name },
        sourceUrl: source,
        action: 'download',
        target: {
            os: process.platform,
            arch: process.arch,
            artifact: { ...artifact, format: 'zip' },
        },
    };
    await assert.rejects(
        prepareDistributionArtifact(preview, false, { download: 'Download' }),
        /checksum/,
    );
    assert.equal(marks, 0);
    assert.deepEqual(await fs.readdir(directory), []);
    preview.target.artifact.sha256 = crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
    assert.equal(
        await prepareDistributionArtifact(preview, false, {
            download: 'Download',
        }),
        'downloaded',
    );
    assert.deepEqual(await fs.readFile(target), data);
});

test('explicit local fixture reads only its configured loopback origin; production remains public-only', async () => {
    const { localDistributionTest } = load(dir + 'LocalTesting.ts');
    assert.equal(localDistributionTest(), undefined);
    for (const url of ['http://localhost:8000/a', 'http://192.168.1.2:8000/a', 'http://127.0.0.1/a', 'https://127.0.0.1:8000/a', 'http://user@127.0.0.1:8000/a'])
        assert.throws(() => localDistributionTest(`day.test.app=${url}`));
    const { createServer } = require('node:http');
    const server = createServer((req, res) => {
        if (req.url === '/redirect') { res.writeHead(302, { location: 'http://127.0.0.1:9/private' }); res.end(); return; }
        res.end(JSON.stringify(base));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const sourceUrl = `http://127.0.0.1:${server.address().port}/manifest.json`;
        const config = localDistributionTest(`day.test.app=${sourceUrl}`);
        const { readPublicResource } = load(dir + 'PublicResource.ts');
        await assert.rejects(readPublicResource(sourceUrl, 16384));
        const bytes = await readPublicResource(sourceUrl, 16384, config.origin);
        const parsed = parseDistribution(JSON.parse(bytes), sourceUrl, config.appId, config.origin);
        assert.equal(parsed.icon, `${config.origin}/icon.png`);
        assert.equal(parsed.targets[0].artifact.url, `${config.origin}/app.dmg`);
        assert.throws(() => parseDistribution(JSON.parse(bytes), sourceUrl, 'other.app', config.origin));
        await assert.rejects(readPublicResource(`${config.origin}/redirect`, 16384, config.origin));
        await assert.rejects(readPublicResource(sourceUrl, 1, config.origin), /size limit/);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('companion target is independent of host packaging and never silently falls back', () => {
    const { useDevelopmentExternalApps } = load('Main/Functional/ExternalApps/ConnectionMode.ts');
    assert.equal(useDevelopmentExternalApps(true), false);
    assert.equal(useDevelopmentExternalApps(false, 'installed'), false);
    assert.equal(useDevelopmentExternalApps(false, 'development'), true);
    assert.equal(useDevelopmentExternalApps(false), true);
    assert.throws(() => useDevelopmentExternalApps(true, 'development'));
    assert.throws(() => useDevelopmentExternalApps(false, 'typo'));
});

test('Provider manifests belong to declared apps and accept only bounded HTTPS sources', () => {
    const { validateExternalAppManifests } = load('Main/Functional/Bundle/Provider/ExternalAppDescriptors.ts');
    const metadata = { externalApps: ['day.test.app'], externalAppManifests: { 'day.test.app': source } };
    assert.doesNotThrow(() => validateExternalAppManifests(metadata));
    assert.throws(() => validateExternalAppManifests({ ...metadata, externalApps: [] }));
    for (const value of ['http://127.0.0.1:8000/a', 'file:///tmp/a.json', 'https://user:pass@example.com/a', 'https://example.com:444/a'])
        assert.throws(() => validateExternalAppManifests({ ...metadata, externalAppManifests: { 'day.test.app': value } }));
});

test('local fixture helper hashes the chosen artifact and serves no other files', async () => {
    const { createFixture } = require('../../scripts/serve-external-app-fixture.cjs');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kawaikara-fixture-'));
    const bytes = Buffer.from('fixture artifact, never executable');
    const file = path.join(directory, 'app.dmg');
    await fs.writeFile(file, bytes);
    const { server, manifest } = await createFixture({ artifact: file, os: 'darwin', arch: 'arm64' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
        assert.equal(manifest.targets[0].artifact.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
        assert.deepEqual(await (await fetch(origin+'/kawaikara.manifest.json')).json(), manifest);
        assert.equal(await (await fetch(origin+'/artifact.dmg')).text(), bytes.toString());
        assert.equal((await fetch(origin+'/../package.json')).status,404);
        assert.equal((await fetch(origin+'/artifact.dmg',{method:'POST'})).status,405);
    } finally { await new Promise(resolve=>server.close(resolve)); await fs.rm(directory,{recursive:true,force:true}); }
});
