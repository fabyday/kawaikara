const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(relative) {
  const filename = path.resolve(__dirname, '..', relative);
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
    'src/Main/Functional/Preferences.ts',
  );
  const preferences = mergeValidatedPreferences({});
  assert.equal(preferences.kawaiShortcutEnabled, true);
  assert.equal(preferences.kawaiShortcutDelaySeconds, 1);
});

test('Kawai Shortcut delay is finite, rounded to tenths, and bounded', () => {
  const { mergeValidatedPreferences } = loadSource(
    'src/Main/Functional/Preferences.ts',
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

test('Kawai Shortcut assigns one numeric key to each of the first ten sites', () => {
  const {
    getKawaiShortcutIndex,
    getKawaiShortcutKey,
  } = loadSource('src/Common/KawaiShortcut.ts');
  assert.deepEqual(
    Array.from({ length: 10 }, (_value, index) => getKawaiShortcutKey(index)),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  );
  assert.deepEqual(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
      .map(getKawaiShortcutIndex),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});
