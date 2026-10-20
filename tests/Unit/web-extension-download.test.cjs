const { asViewerRuntime } = require('../Helpers/ViewerRuntime.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function createAdapter(open) {
    let bridgeOptions;
    const calls = [];
    const mocks = {
        electron: {
            app: {
                getName: () => 'Test',
                getVersion: () => '0.1.0',
                getAppPath: () => '/test',
                isPackaged: false,
                focus: () => {},
            },
        },
        '../Functional/Localization/Locale': {},
        '../Functional/ExternalApps/WebExtensionBridge': {
            WebExtensionBridge: class {
                constructor(options) {
                    bridgeOptions = options;
                }
                connectionStatus() {
                    return {
                        connected: false,
                        useDevelopment: true,
                        client: '',
                    };
                }
                async dispose() {}
                async revoke() {}
            },
        },
    };
    const filename = path.resolve(
        __dirname,
        '../../src/Main/Manager/WebExtensionManager.ts',
    );
    const loaded = new Module(filename, module);
    loaded.require = (id) =>
        mocks[id] ?? Module.prototype.require.call(loaded, id);
    loaded._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            write: false,
            platform: 'node',
            format: 'cjs',
            external: Object.keys(mocks),
            define: {
                __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify('nightly'),
                __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
            },
        }).outputFiles[0].text,
        filename,
    );
    const sites = {
        listWebExtensionProviders: () => [
            {
                id: 'third-party.provider',
                actionDefinitions: {
                    'custom-download-id': { handler: 'download' },
                },
            },
        ],
        subscribeWebExtensions: () => () => {},
        load: async (id) => calls.push(['load', id]),
    };
    const windows = {
        showPreferencesOverlay: () => calls.push(['preferences']),
        queueYouTubeDownloader: (url) => calls.push(['queue', url]),
        hideOverlay: () => calls.push(['hideOverlay']),
        focusViewer: () => calls.push(['focusViewer']),
    };
    const manager = new loaded.exports.WebExtensionManager(
        'unused',
        sites,
        asViewerRuntime(windows),
        {
            open: async (url) => {
                calls.push(['open', url]);
                return open();
            },
        },
    );
    return {
        calls,
        manager,
        confirm: (detail) => bridgeOptions.confirm(detail),
        invoke: (url) =>
            bridgeOptions.execute(
                'third-party.provider',
                'custom-download-id',
                url,
                {},
            ),
    };
}

const source = 'https://www.youtube.com/watch?v=fixture';

test('Provider browser download hands the URL to the companion without stealing focus', async () => {
    const adapter = createAdapter(async () => ({ opened: true }));
    await adapter.invoke(source);
    assert.deepEqual(adapter.calls, [['open', source]]);
});

test('missing companion opens and focuses the desktop downloader setup', async () => {
    const adapter = createAdapter(async () => ({ opened: false }));
    await adapter.invoke(source);
    assert.deepEqual(adapter.calls, [
        ['open', source],
        ['queue', source],
        ['hideOverlay'],
        ['load', 'kawaikara.video'],
        ['focusViewer'],
    ]);
});

test('companion launch errors propagate to the browser without switching windows', async () => {
    const adapter = createAdapter(async () => {
        throw new Error('launch failed');
    });
    await assert.rejects(adapter.invoke(source), /launch failed/);
    assert.deepEqual(adapter.calls, [['open', source]]);
});

test('approval uses trusted app popup, validates request ID, and disposal rejects pending requests', async (t) => {
    const adapter = createAdapter(async () => ({ opened: true }));
    t.after(() => adapter.manager.dispose());
    const pending = adapter.confirm('Enable 2 Providers');
    assert.deepEqual(adapter.calls, [['preferences']]);
    const approval = adapter.manager.status().approval;
    assert.equal(approval.detail, 'Enable 2 Providers');
    assert.throws(() => adapter.manager.decide('wrong-id', true), /expired/);
    adapter.manager.decide(approval.id, true);
    assert.equal(await pending, true);
    assert.equal(adapter.manager.status().approval, undefined);
    const abandoned = adapter.confirm('Another request');
    await adapter.manager.dispose();
    assert.equal(await abandoned, false);
});
