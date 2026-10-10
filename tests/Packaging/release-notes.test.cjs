const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { existsSync, mkdtempSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '../..');
function loadSource(relative, mocks = {}) {
    const filename = path.join(root, relative);
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
        external: Object.keys(mocks),
        define: {
            __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
            __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
            __KAWAIKARA_DISCORD_APP_ID__: '""',
            __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
        },
    }).outputFiles[0].text;
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    loaded._compile(code, filename);
    return loaded.exports;
}

const { selectLocalizedReleaseNotes: select } = loadSource(
    'src/Common/ReleaseNotes.ts',
);
const { normalizeReleaseNotes: normalize } = loadSource(
    'src/Main/Functional/Update/ApplicationUpdates.ts',
);
const { getClearAllProfilesConfirmationCopy: copy } = loadSource(
    'src/Main/Functional/Localization/Locale.ts',
);
const { VideoDirectoryHistory } = loadSource(
    'src/Common/VideoDirectoryHistory.ts',
);
const { createMpvViewHost } = loadSource(
    'src/Main/Functional/Video/MpvViewHost.ts',
);

test('real CHANGELOG release script produces locale-selectable notes for Nightly', () => {
    const output = path.join(
        mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-release-locales-')),
        'notes.md',
    );
    const version = '3.0.0-nightly.20260917.1.1.g01234567';
    const result = spawnSync(
        process.execPath,
        [
            path.join(root, 'scripts/channel-release.cjs'),
            'notes',
            'nightly',
            output,
        ],
        {
            cwd: root,
            encoding: 'utf8',
            env: {
                ...process.env,
                KAWAIKARA_RELEASE_VERSION: version,
                KAWAIKARA_SOURCE_SHA:
                    '0123456789abcdef0123456789abcdef01234567',
            },
        },
    );
    assert.equal(result.status, 0, result.stderr);
    const notes = readFileSync(output, 'utf8');
    const korean = select(normalize(notes), 'ko-KR');
    const english = select(normalize(notes), 'en-US');
    assert.ok(korean.startsWith(`### Kawaikara ${version}`));
    assert.ok(english.startsWith(`### Kawaikara ${version}`));
    assert.notEqual(korean, english);
    if (existsSync(path.join(root, 'CHANGELOG/3.0.0/PATCHNOTE.JA.MD'))) {
        assert.notEqual(select(normalize(notes), 'ja'), english);
    } else {
        assert.equal(
            select(normalize(notes), 'ja'),
            english,
            'missing optional JA file falls back to English',
        );
    }
    assert.ok(!korean.includes('## English'));
    assert.ok(!korean.includes('Source commit:'));
});
