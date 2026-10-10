const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
function load(relative, imports = {}, bundle = true) {
    const file = path.join(root, relative);
    const loaded = new Module(file, module);
    loaded.paths = module.paths;
    loaded.require = (id) => (id in imports ? imports[id] : require(id));
    loaded._compile(
        buildSync({
            entryPoints: [file],
            bundle,
            packages: 'external',
            platform: 'node',
            format: 'cjs',
            write: false,
            define: {
                __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
                __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
                __KAWAIKARA_DISCORD_APP_ID__: '""',
                __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
            },
        }).outputFiles[0].text,
        file,
    );
    return loaded.exports;
}
const validation = load('src/Main/Functional/App/IPCValidation.ts', {
    electron: {},
});

test('invalid explicit modes cannot silently change the saved mode without a restart', () => {
    for (const value of ['invalid', null, undefined, true, {}]) {
        assert.throws(
            () => validation.readRequestedGraphicsMode({ graphicsMode: value }),
            /supported graphics mode/,
        );
    }
    assert.equal(
        validation.readRequestedGraphicsMode({ appTheme: 'dark' }),
        undefined,
    );
});

test('startup respects GPU driver policy, capture overlays, and forced software override', () => {
    const source = fs.readFileSync(
        path.join(
            root,
            'src/Main/Functional/App/ApplicationPreInitialization.ts',
        ),
        'utf8',
    );
    const code = buildSync({
        stdin: { contents: source, loader: 'ts' },
        bundle: false,
        platform: 'node',
        format: 'cjs',
        write: false,
    }).outputFiles[0].text;
    const graphicsCode = buildSync({
        entryPoints: [path.join(root, 'src/Main/Platform/Graphics.ts')],
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'cjs',
        write: false,
    }).outputFiles[0].text;
    for (const platform of ['win32', 'darwin', 'linux'])
        for (const mode of ['native', 'capture', 'software']) {
            const switches = new Map([['disable-features', 'ExistingFeature']]);
            let disabled = false;
            const process = { platform, env: { MPV_HWDEC: 'no' } };
            const app = {
                disableHardwareAcceleration() {
                    disabled = true;
                },
                commandLine: {
                    appendSwitch: (name, value = '') =>
                        switches.set(name, value),
                    removeSwitch: (name) => switches.delete(name),
                    getSwitchValue: (name) => switches.get(name) || '',
                },
            };
            const graphics = {
                module: { exports: {} },
                process,
                require: () => ({ app }),
            };
            vm.runInNewContext(graphicsCode, graphics);
            const context = {
                exports: {},
                module: { exports: {} },
                process,
                require: (id) =>
                    id === 'electron'
                        ? { app }
                        : id === '../../Platform/Graphics'
                          ? graphics.module.exports
                          : id === './Preferences'
                            ? { readStartupGraphicsMode: () => mode }
                            : {},
            };
            vm.runInNewContext(code, context);
            const configure = context.module.exports.configureGraphics;
            configure('fixture', { info() {} });
            assert.equal(disabled, mode === 'software');
            assert.equal(process.env.MPV_HWDEC, 'no');
            assert.equal(switches.has('ignore-gpu-blocklist'), false);
            assert.equal(switches.has('enable-gpu-rasterization'), false);
            assert.equal(switches.has('enable-zero-copy'), false);
            assert.equal(
                switches.has('disable_direct_composition_video_overlays'),
                platform === 'win32' && mode === 'capture',
            );
            assert.equal(
                switches.get('disable-features'),
                platform === 'darwin' && mode === 'capture'
                    ? 'ExistingFeature,avfoundation-overlays'
                    : 'ExistingFeature',
            );
            process.env.KAWAIKARA_FORCE_SOFTWARE_RENDERING = '1';
            disabled = false;
            configure('fixture', { info() {} });
            assert.equal(disabled, true);
        }
});
