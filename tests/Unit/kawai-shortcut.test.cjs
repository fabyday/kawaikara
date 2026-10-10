const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const vm = require('node:vm');

function loadSource(relative) {
    const filename = path.resolve(__dirname, '../..', relative);
    const result = buildSync({
        entryPoints: [filename],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        define: {
            __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify('nightly'),
            __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
            __KAWAIKARA_DISCORD_APP_ID__: JSON.stringify(''),
            __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
        },
    });
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded._compile(result.outputFiles[0].text, filename);
    return loaded.exports;
}

test('Kawai Shortcut preferences are enabled with a one second default', () => {
    const { mergeValidatedPreferences } = loadSource(
        'src/Main/Functional/App/Preferences.ts',
    );
    const preferences = mergeValidatedPreferences({});
    assert.equal(preferences.kawaiShortcutEnabled, true);
    assert.equal(preferences.kawaiShortcutDelaySeconds, 1);
    assert.equal(preferences.kawaiShortcutUnlimitedWait, false);
    assert.equal(
        mergeValidatedPreferences({ kawaiShortcutUnlimitedWait: true })
            .kawaiShortcutUnlimitedWait,
        true,
    );
    assert.equal(
        mergeValidatedPreferences({ kawaiShortcutUnlimitedWait: 'true' })
            .kawaiShortcutUnlimitedWait,
        false,
    );
});

test('Kawai Shortcut delay is finite, rounded to tenths, and bounded', () => {
    const { mergeValidatedPreferences } = loadSource(
        'src/Main/Functional/App/Preferences.ts',
    );
    assert.equal(
        mergeValidatedPreferences({ kawaiShortcutDelaySeconds: 1.26 })
            .kawaiShortcutDelaySeconds,
        1.3,
    );
    assert.equal(
        mergeValidatedPreferences({ kawaiShortcutDelaySeconds: -4 })
            .kawaiShortcutDelaySeconds,
        0.1,
    );
    assert.equal(
        mergeValidatedPreferences({ kawaiShortcutDelaySeconds: 12 })
            .kawaiShortcutDelaySeconds,
        5,
    );
    for (const value of [NaN, Infinity, null, '1']) {
        assert.equal(
            mergeValidatedPreferences({ kawaiShortcutDelaySeconds: value })
                .kawaiShortcutDelaySeconds,
            1,
        );
    }
});

test('Escape cancels an active selection but Tab closes the menu in a single press', () => {
    const source = buildSync({
        entryPoints: [
            path.resolve(
                __dirname,
                '../../src/Renderer/View/Menu/Hooks/useOverlayEvents.ts',
            ),
        ],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        external: ['react'],
    }).outputFiles[0].text;
    let requestClose,
        closed = 0,
        category = 'video';
    const active = { current: true },
        module = { exports: {} };
    const api = new Proxy(
        {},
        {
            get: (_, key) =>
                key === 'onRequestClose'
                    ? (handler) => {
                          requestClose = handler;
                          return () => {};
                      }
                    : String(key).startsWith('on')
                      ? () => () => {}
                      : async () => [],
        },
    );
    vm.runInNewContext(source, {
        module,
        exports: module.exports,
        require: () => ({ useEffect: (fn) => fn() }),
        window: {
            clearTimeout: () => {},
            kawaikara: {
                sites: api,
                preferences: api,
                application: api,
                overlay: api,
                media: api,
            },
        },
    });
    const options = new Proxy(
        {
            localization: undefined,
            view: 'menu',
            viewRef: { current: 'menu' },
            updateStateRef: {},
            kawaiShortcutActiveRef: active,
            shortcutHighlightTimer: {},
            beginMenuClose: () => {
                closed++;
            },
            setShortcutTargetCategory: (value) => (category = value),
        },
        {
            get: (value, key) =>
                key in value
                    ? value[key]
                    : /Ref$|Timer$/.test(String(key))
                      ? {}
                      : () => {},
        },
    );
    module.exports.useOverlayEvents(options);
    requestClose('back');
    assert.equal(closed, 0);
    assert.equal(active.current, false);
    assert.equal(category, undefined);
    active.current = true;
    requestClose('toggle');
    assert.equal(closed, 1);
});

test('Kawai Shortcut assigns one numeric key to each of the first ten sites', () => {
    const { getKawaiShortcutIndex, getKawaiShortcutKey } = loadSource(
        'src/Common/KawaiShortcut.ts',
    );
    assert.deepEqual(
        Array.from({ length: 10 }, (_value, index) =>
            getKawaiShortcutKey(index),
        ),
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    );
    assert.deepEqual(
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
            getKawaiShortcutIndex,
        ),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
});
