const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    readdirSync,
    existsSync,
} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const {
    resolveWindowsDataRootSelection,
    writeWindowsDataRoot,
    readWindowsDataRoot,
} = require('../../src/Main/Platform/Windows/DataLocation.ts');
const product = 'Kawaikara Nightly',
    executable = 'C:\\Apps\\Kawaikara Nightly\\app.exe',
    active = 'C:\\Profiles\\Kawaikara Nightly';

test('path changes preserve old data and can reopen an existing root without replacing its files', async (t) => {
    if (process.platform !== 'win32')
        return t.skip('Real Windows path filesystem semantics');
    const fixture = mkdtempSync(
        path.join(getTestTempRoot(), 'kawaikara-data-location-'),
    );
    const appData = path.join(fixture, 'appData'),
        old = path.join(fixture, 'old', product),
        target = path.join(fixture, 'new', product);
    const install = path.join(fixture, 'install');
    mkdirSync(install, { recursive: true });
    mkdirSync(old, { recursive: true });
    writeFileSync(path.join(old, 'retain'), 'old');
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, 'retain'), 'new');
    const exe = path.join(install, 'app.exe');
    await writeWindowsDataRoot(
        appData,
        'day.faby.kawaikara.nightly',
        target,
        old,
        exe,
    );
    assert.equal(
        readWindowsDataRoot(
            appData,
            'day.faby.kawaikara.nightly',
            product,
            exe,
        ),
        target,
    );
    assert.equal(readFileSync(path.join(old, 'retain'), 'utf8'), 'old');
    assert.equal(readFileSync(path.join(target, 'retain'), 'utf8'), 'new');
    assert.deepEqual(readdirSync(target), ['retain']);
    await assert.rejects(
        writeWindowsDataRoot(
            appData,
            'day.faby.kawaikara.nightly',
            path.join(old, 'child', product),
            old,
            exe,
        ),
        /overlap/i,
    );
    assert.equal(
        existsSync(path.join(old, 'child')),
        false,
        'Reject overlapping roots before creating any folders',
    );
    assert.equal(
        readWindowsDataRoot(
            appData,
            'day.faby.kawaikara.nightly',
            product,
            exe,
        ),
        target,
    );
});

test('new auto-advance default avoids built-in provider navigation shortcuts; custom overrides stay explicit', () => {
    const {
        SHORT_FORM_VIDEO_SHORTCUTS,
    } = require('../../src/Common/ShortFormVideo.ts');
    const selected = SHORT_FORM_VIDEO_SHORTCUTS.find(
        (entry) => entry.id === 'short-form-video.toggle-auto-advance',
    );
    assert.equal(selected.defaultKey, 'CommandOrControl+Alt+N');
    const directory = path.resolve(
        __dirname,
        '../../packages/builtin-sites/src/Providers',
    );
    for (const provider of readdirSync(directory)) {
        const file = path.join(directory, provider, 'manifest.json');
        if (!existsSync(file)) continue;
        const manifest = JSON.parse(readFileSync(file, 'utf8'));
        assert.notEqual(
            manifest.contributes?.shortcut?.defaultKey?.replace(
                'Control',
                'CommandOrControl',
            ),
            selected.defaultKey,
        );
    }
});

test('an empty data root activates the packaged built-in bundle without copying its code there', async () => {
    const Module = require('node:module');
    const { builtinBundle } = require('@kawaikara/builtin-sites');
    const filename = path.resolve(
        __dirname,
        '../../src/Main/Manager/BundleManager.ts',
    );
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
            external: ['electron', 'extract-zip', '@kawaikara/site-api'],
            define: {
                __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
                __KAWAIKARA_DISTRIBUTION_BUILD__: 'true',
                __KAWAIKARA_DISCORD_APP_ID__: '""',
                __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
            },
        }).outputFiles[0].text,
        filename,
    );
    const empty = mkdtempSync(
        path.join(getTestTempRoot(), 'kawaikara-empty-data-'),
    );
    const directory = path.join(empty, 'KawaiData', 'Bundles'),
        registered = [];
    const manager = new loaded.exports.BundleManager(
        { registerBundle: (bundle) => registered.push(bundle) },
        directory,
    );
    manager.installBundled(builtinBundle);
    await manager.loadInstalled();
    assert.deepEqual(registered, [builtinBundle]);
    assert.equal(manager.list()[0].source, 'built-in');
    assert.equal(manager.list()[0].status, 'active');
    assert.deepEqual(
        readdirSync(directory),
        [],
        'Built-in code must remain in the application package',
    );
});
