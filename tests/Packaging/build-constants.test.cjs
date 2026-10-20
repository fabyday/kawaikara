const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const webpack = require('webpack');
const { createBuildDefinitions } = require('../../scripts/lib/build-definitions.cjs');
const makeConfig = require('../../webpack.config.cjs');
const root = path.resolve(__dirname, '../..');

test('build definitions validate channels and test ports without embedding unrelated environment values', () => {
    assert.throws(() => createBuildDefinitions(root, { KAWAIKARA_BUILD_CHANNEL: 'other' }));
    for (const port of ['0', '65536', 'NaN', '1.5']) {
        assert.throws(() => createBuildDefinitions(root, {
            KAWAIKARA_UPDATE_TEST_BUILD: '1', KAWAIKARA_UPDATE_TEST_PORT: port,
        }));
    }
    const values = createBuildDefinitions(root, { PRIVATE_TOKEN: 'never-embed-this' });
    assert.equal(values.__KAWAIKARA_BUILD_CHANNEL__, '"nightly"');
    assert.equal(values.__KAWAIKARA_DISTRIBUTION_BUILD__, 'false');
    assert.equal(values.__KAWAIKARA_UPDATE_TEST_PROFILE__, 'null');
    assert.ok(!JSON.stringify(values).includes('never-embed-this'));
    assert.equal(createBuildDefinitions(root, {
        KAWAIKARA_UPDATE_TEST_BUILD: '1', DISCORD_APP_ID: 'public-id',
    }).__KAWAIKARA_DISCORD_APP_ID__, '""');
});

test('public social links use defaults and reject invalid build overrides', () => {
    const values = createBuildDefinitions(root, {});
    const links = JSON.parse(values.__KAWAIKARA_SOCIAL_LINKS__);
    assert.deepEqual(Object.keys(links).sort(), ['developerYouTube', 'discord', 'github', 'website']);
    for (const value of Object.values(links)) assert.equal(new URL(value).protocol, 'https:');
    for (const key of ['KAWAIKARA_WEBSITE_URL', 'KAWAIKARA_GITHUB_URL', 'KAWAIKARA_DISCORD_INVITE_URL', 'KAWAIKARA_DEVELOPER_YOUTUBE_URL']) {
        for (const value of ['', 'not-a-url', 'javascript:alert(1)', 'file:///tmp/test', 'http://example.com', 'https://user:pass@example.com']) {
            assert.throws(() => createBuildDefinitions(root, { [key]: value }), error => error.message.includes(key));
        }
    }
});

test('production bundles remove other build branches and their dependencies on every target', async (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-build-constants-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const entry = path.join(temp, 'entry.ts');
    for (const name of ['stable', 'staging', 'nightly', 'distribution', 'development', 'updateTest']) {
        fs.writeFileSync(path.join(temp, `${name}.ts`),
            `globalThis.__buildProbeResults.push('BUILD_PROBE_${name}');`);
    }
    const runtimeFile = path.join(temp, 'runtime-addon.cjs');
    fs.writeFileSync(runtimeFile, "module.exports = 'runtime-addon-loaded';");
    fs.writeFileSync(entry, `
        import { createRequire } from 'node:module';
        globalThis.__buildProbeAddon = createRequire(globalThis.__buildProbeModule)(globalThis.__buildProbeModule);
        globalThis.__buildProbeResults = [];
        globalThis.__buildProbeWebsite = __KAWAIKARA_SOCIAL_LINKS__.website;
        if (__KAWAIKARA_BUILD_CHANNEL__ === 'stable') require('./stable');
        if (__KAWAIKARA_BUILD_CHANNEL__ === 'staging') require('./staging');
        if (__KAWAIKARA_BUILD_CHANNEL__ === 'nightly') require('./nightly');
        if (__KAWAIKARA_DISTRIBUTION_BUILD__) require('./distribution');
        else require('./development');
        if (__KAWAIKARA_UPDATE_TEST_PROFILE__) {
            require('./updateTest');
            globalThis.__buildProbeFeed = __KAWAIKARA_UPDATE_TEST_PROFILE__.feedUrl;
        }
        if (globalThis.__buildProbeInput) globalThis.__buildProbeResults.push('RUNTIME_INPUT');
    `);
    const cases = [
        ...['stable', 'staging', 'nightly'].map(channel => ({ channel, distribution: true, updateTest: false })),
        { channel: 'nightly', distribution: false, updateTest: false },
        { channel: 'nightly', distribution: true, updateTest: true },
    ];
    for (const build of cases) {
        const environment = {
            KAWAIKARA_BUILD_CHANNEL: build.channel,
            KAWAIKARA_DISTRIBUTION_BUILD: build.distribution ? '1' : '0',
            KAWAIKARA_UPDATE_TEST_BUILD: build.updateTest ? '1' : '0',
            KAWAIKARA_UPDATE_TEST_PORT: '18081',
            KAWAIKARA_WEBSITE_URL: 'https://example.com/build-fixture',
        };
        const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
        let configs;
        try {
            Object.assign(process.env, environment);
            configs = makeConfig({}, { mode: 'production' });
        } finally {
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        }
        for (const config of configs) {
            config.entry = entry;
            config.output = { ...config.output, path: path.join(temp, config.name), filename: 'probe.js' };
            // Keep the actual build definitions; HTML generation is unrelated to this probe.
            config.plugins = config.plugins.filter(plugin => plugin instanceof webpack.DefinePlugin);
            assert.equal(config.plugins.length, 1, `${config.name} must define build constants`);
        }
        const compiler = webpack(configs);
        try {
            await new Promise((resolve, reject) => compiler.run((error, stats) => {
                if (error) return reject(error);
                if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
                resolve();
            }));
        } finally {
            await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
        }
        const expected = [build.channel, build.distribution ? 'distribution' : 'development'];
        if (build.updateTest) expected.push('updateTest');
        for (const config of configs) {
            const code = fs.readFileSync(path.join(config.output.path, 'probe.js'), 'utf8');
            const label = `${config.name} ${JSON.stringify(build)}`;
            const markers = [...code.matchAll(/BUILD_PROBE_(\w+)/g)].map(match => match[1]).sort();
            assert.deepEqual(markers, [...expected].sort(), label);
            assert.ok(!code.includes('__KAWAIKARA_'), label);
            for (const input of [false, true]) {
                const context = { __buildProbeInput: input, __buildProbeModule: runtimeFile, require };
                vm.runInNewContext(code, context);
                assert.equal(context.__buildProbeAddon, 'runtime-addon-loaded', label);
                assert.equal(context.__buildProbeWebsite, 'https://example.com/build-fixture', label);
                assert.deepEqual(Array.from(context.__buildProbeResults), [
                    ...expected.map(name => `BUILD_PROBE_${name}`), ...(input ? ['RUNTIME_INPUT'] : []),
                ], label);
                assert.equal(context.__buildProbeFeed, build.updateTest ? 'http://127.0.0.1:18081/' : undefined);
            }
        }
    }
});
