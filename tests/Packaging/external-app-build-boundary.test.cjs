const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const { createBuildDefinitions } = require('../../scripts/lib/build-definitions.cjs');
const makeConfig = require('../../webpack.config.cjs');
const root = path.resolve(__dirname, '../..');

test('actual main bundles omit external-app test transport and fixture override in Stable', async t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-external-build-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    for (const channel of ['stable', 'nightly']) {
        const config = makeConfig({}, { mode: 'production' }).find(c => c.name === 'main');
        config.output = { ...config.output, path: path.join(temp, channel) };
        config.plugins = [new webpack.DefinePlugin(createBuildDefinitions(root, {
            KAWAIKARA_BUILD_CHANNEL: channel,
            KAWAIKARA_DISTRIBUTION_BUILD: '1',
        }))];
        const compiler = webpack(config);
        let result;
        try {
            result = await new Promise((resolve, reject) => compiler.run((error, stats) => {
                if (error) return reject(error);
                if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
                resolve(stats);
            }));
        } finally {
            await new Promise((resolve, reject) => compiler.close(e => e ? reject(e) : resolve()));
        }
        const code = fs.readFileSync(path.join(config.output.path, 'main.js'), 'utf8');
        for (const marker of ['development-connections', 'external-app-icons-development.json', 'external-apps-development.json', 'KAWAIKARA_EXTERNAL_APP_MODE', 'KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST', 'KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY']) {
            assert.equal(code.includes(marker), channel !== 'stable', `${channel}: ${marker}`);
        }
        const modules = JSON.stringify(result.toJson({ all: false, modules: true, nestedModules: true }));
        for (const name of ['DevelopmentConnectionFactory.ts', 'DevelopmentConnection.ts', 'Distribution/LocalTesting.ts']) {
            assert.equal(modules.includes(name), channel !== 'stable', `${channel}: ${name}`);
        }
    }
});

test('OS-specific installed paths and repository-local test paths stay separate', () => {
    const { buildSync } = require('esbuild');
    const vm = require('node:vm');
    const filename = path.join(root, 'src/Main/Functional/ExternalApps/ConnectionDirectories.ts');
    const cases = [
        { platform: 'darwin', home: '/Users/test', env: {}, expected: '/Users/test/Library/Application Support/Kawaikara/connections/v1' },
        { platform: 'linux', home: '/home/test', env: {}, expected: '/home/test/.local/state/kawaikara/connections/v1' },
        { platform: 'linux', home: '/home/test', env: { XDG_STATE_HOME: '/state' }, expected: '/state/kawaikara/connections/v1' },
        { platform: 'win32', home: 'C:/Users/test', env: {}, expected: 'C:/Users/test/AppData/Local/Kawaikara/connections/v1' },
        { platform: 'win32', home: 'C:/Users/test', env: { LOCALAPPDATA: 'D:/Local' }, expected: 'D:/Local/Kawaikara/connections/v1' },
    ];
    for (const channel of ['stable', 'staging', 'nightly']) {
        for (const item of cases) {
            const paths = item.platform === 'win32' ? path.win32 : path.posix;
            const repo = item.platform === 'win32' ? 'D:/Source/Kawaikara' : '/source/kawaikara';
            const testRoot = paths.join(repo, 'tmp', 'kawaikara Dev', 'development-connections');
            const definitions = createBuildDefinitions(repo, { KAWAIKARA_BUILD_CHANNEL: channel });
            definitions.__KAWAIKARA_EXTERNAL_APP_TEST_DIRECTORY__ = JSON.stringify(channel === 'stable' ? null : testRoot);
            const code = buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false, minify: true, define: definitions }).outputFiles[0].text;
            const module = { exports: {} };
            const env = { ...item.env };
            vm.runInNewContext(code, { module, exports: module.exports, process: { platform: item.platform, env }, require: id => id === 'node:os' ? { homedir: () => item.home } : require(id) });
            const directory = module.exports.externalAppConnectionDirectory;
            assert.equal(directory(), paths.normalize(item.expected));
            if (channel === 'stable') {
                assert.throws(() => directory(true), /unavailable/);
                assert.ok(!code.includes('development-connections'));
                assert.ok(!code.includes('KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY'));
            } else {
                assert.equal(directory(true), testRoot);
                env.KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY = paths.join(repo, 'isolated');
                assert.equal(directory(true), paths.join(repo, 'isolated'));
                env.KAWAIKARA_EXTERNAL_APP_CONNECTION_DIRECTORY = 'relative';
                assert.throws(() => directory(true), /absolute/);
            }
        }
    }
});
