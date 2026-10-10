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

const { requireExternalDownloaderSourceUrl } = loadSource(
    'src/Main/Platform/External/ExternalDownloader.ts',
    { electron: {} },
);

test('Kawaikara forwards safe HTTPS sources without deciding downloader support', () => {
    for (const url of [
        'https://www.youtube.com/watch?v=fixture',
        'https://laftel.net/item/12345',
        'https://netflix.com/watch/12345',
        'https://example.com/media/fixture',
    ]) {
        assert.equal(requireExternalDownloaderSourceUrl(url), url);
    }
});

test('Kawaikara rejects only unsafe or malformed transport values', () => {
    for (const url of [
        'not a url',
        'http://youtube.com/watch?v=fixture',
        'https://user:password@youtube.com/watch?v=fixture',
        'https://youtube.com:444/watch?v=fixture',
    ]) {
        assert.throws(
            () => requireExternalDownloaderSourceUrl(url),
            /safe HTTPS source URL/,
        );
    }
});

test('logging preferences keep hierarchy and validate recording scopes', () => {
    const { resolvePreferenceLogLevel } = loadSource(
        'src/Main/Functional/Logging/Logging.ts',
        { electron: { app: { isPackaged: true } } },
    );
    assert.deepEqual(
        ['error', 'warn', 'info', 'verbose', 'debug', 'all', 'none'].map(
            resolvePreferenceLogLevel,
        ),
        ['error', 'warn', 'info', 'verbose', 'debug', 'silly', false],
    );

    global.__KAWAIKARA_BUILD_CHANNEL__ = 'stable';
    global.__KAWAIKARA_DISTRIBUTION_BUILD__ = false;
    global.__KAWAIKARA_DISCORD_APP_ID__ = '';
    global.__KAWAIKARA_UPDATE_TEST_PROFILE__ = null;
    const { mergeValidatedPreferences } = loadSource(
        'src/Main/Functional/App/Preferences.ts',
    );
    assert.equal(mergeValidatedPreferences({}).logSources, 'all');
    assert.deepEqual(
        mergeValidatedPreferences({
            logLevel: 'all',
            logSources: [
                'updates',
                'unknown',
                'updates',
                'external-downloader',
            ],
        }),
        {
            ...mergeValidatedPreferences({}),
            logLevel: 'all',
            logSources: ['updates', 'external-downloader'],
        },
    );
});
