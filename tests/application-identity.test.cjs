const assert = require('node:assert/strict');
const { existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { after, test } = require('node:test');

const root = path.resolve(__dirname, '..');
const temporaryRoot = path.join(
  os.tmpdir(),
  `kawaikara-application-identity-${process.pid}`,
);

after(() => rmSync(temporaryRoot, { force: true, recursive: true }));

function loadReleaseConfig(channel) {
  const configPath = path.join(root, 'electron-builder.config.cjs');
  const previousChannel = process.env.KAWAIKARA_BUILD_CHANNEL;
  process.env.KAWAIKARA_BUILD_CHANNEL = channel;
  delete require.cache[configPath];
  try {
    return require(configPath);
  } finally {
    if (previousChannel === undefined) {
      delete process.env.KAWAIKARA_BUILD_CHANNEL;
    } else {
      process.env.KAWAIKARA_BUILD_CHANNEL = previousChannel;
    }
    delete require.cache[configPath];
  }
}

function loadDevelopmentConfig() {
  const basePath = path.join(root, 'electron-builder.config.cjs');
  const configPath = path.join(root, 'electron-builder.dev.config.cjs');
  const previousChannel = process.env.KAWAIKARA_BUILD_CHANNEL;
  process.env.KAWAIKARA_BUILD_CHANNEL = 'nightly';
  delete require.cache[basePath];
  delete require.cache[configPath];
  try {
    return require(configPath);
  } finally {
    if (previousChannel === undefined) {
      delete process.env.KAWAIKARA_BUILD_CHANNEL;
    } else {
      process.env.KAWAIKARA_BUILD_CHANNEL = previousChannel;
    }
    delete require.cache[basePath];
    delete require.cache[configPath];
  }
}

function loadUserDataPaths({
  channel,
  distribution,
  isPackaged,
  appData,
  initialUserData,
  appPath,
  updateTestProfile = null,
  platform = process.platform,
}) {
  const sourcePath = path.join(root, 'src/Main/Functional/UserDataPaths.ts');
  const events = [];
  const configuredPaths = new Map();
  const electronApp = {
    isPackaged,
    getAppPath() {
      events.push(['getAppPath']);
      return appPath;
    },
    getPath(name) {
      events.push(['getPath', name]);
      if (name === 'userData') return initialUserData;
      if (name === 'appData') return appData;
      throw new Error(`Unexpected Electron path: ${name}`);
    },
    setName(name) {
      events.push(['setName', name]);
    },
    setPath(name, value) {
      events.push(['setPath', name, value]);
      configuredPaths.set(name, value);
    },
  };
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = module.paths;
  loaded.require = (id) =>
    id === 'electron'
      ? { app: electronApp }
      : Module.prototype.require.call(loaded, id);
  const output = buildSync({
    entryPoints: [sourcePath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: ['electron'],
    define: {
      'process.platform': JSON.stringify(platform),
      __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify(channel),
      __KAWAIKARA_DISTRIBUTION_BUILD__: JSON.stringify(distribution),
      __KAWAIKARA_DISCORD_APP_ID__: '""',
      __KAWAIKARA_UPDATE_TEST_PROFILE__: JSON.stringify(updateTestProfile),
    },
  }).outputFiles[0].text;
  loaded._compile(output, sourcePath);
  return { exports: loaded.exports, events, configuredPaths };
}

test('release packages use separate package, executable, updater, and NSIS identities', () => {
  const identities = require('../config/application-identities.json');
  const channels = ['stable', 'staging', 'nightly'];
  const configs = channels.map((channel) => loadReleaseConfig(channel));

  for (const [index, channel] of channels.entries()) {
    const config = configs[index];
    const identity = identities[channel];
    assert.equal(config.appId, identity.appId);
    assert.equal(config.productName, identity.productName);
    assert.equal(config.extraMetadata.name, identity.packageName);
    assert.equal(config.extraMetadata.productName, identity.productName);
    assert.equal(config.win.executableName, identity.productName);
    assert.equal(config.nsis.guid, identity.nsisGuid);
    assert.equal(config.nsis.shortcutName, identity.productName);
    assert.equal(config.nsis.uninstallDisplayName, identity.productName);
    assert.equal(
      config.nsis.include,
      'packaging/nsis/installer-options.nsh',
    );
    if (config.nsis.include) {
      assert.ok(existsSync(path.join(root, config.nsis.include)));
    }
  }

  for (const key of ['appId', 'productName', 'packageName', 'nsisGuid']) {
    assert.equal(new Set(Object.values(identities).map((value) => value[key])).size, 4);
  }
  assert.notEqual(
    identities.nightly.nsisGuid,
    '237ce928-944e-5933-bb36-77de4ccdd88e',
    'Nightly must not reuse the installer record that pointed at Stable storage.',
  );

  const development = loadDevelopmentConfig();
  assert.equal(development.appId, identities.dev.appId);
  assert.equal(development.productName, identities.dev.productName);
  assert.equal(development.extraMetadata.name, identities.dev.packageName);
  assert.equal(development.win.executableName, identities.dev.productName);
  assert.equal(development.nsis.guid, identities.dev.nsisGuid);
  assert.equal(development.nsis.include, 'packaging/nsis/installer-options.nsh');
});

test('local pnpm start data stays under the repository tmp directory', () => {
  const appPath = path.join(temporaryRoot, 'repository');
  const appData = path.join(temporaryRoot, 'system-appdata');
  const loaded = loadUserDataPaths({
    channel: 'nightly',
    distribution: false,
    isPackaged: false,
    appData,
    initialUserData: path.join(appData, 'kawaikara'),
    appPath,
  });

  const expectedRoot = path.join(appPath, 'tmp', 'kawaikara Dev');
  assert.deepEqual(loaded.exports.getUserDataLayout(), {
    userRoot: expectedRoot,
    electron: path.join(expectedRoot, 'Electron'),
    kawaiData: path.join(expectedRoot, 'KawaiData'),
  });
  loaded.exports.configureUserDataPaths();
  assert.equal(
    loaded.configuredPaths.get('userData'),
    path.join(expectedRoot, 'Electron'),
  );
  assert.equal(loaded.configuredPaths.get('sessionData'), path.join(expectedRoot, 'Electron'));
  assert.ok(existsSync(path.join(expectedRoot, 'KawaiData')));
  assert.ok(loaded.events.some((event) => event[0] === 'setName' && event[1] === 'Kawaikara Dev'));
});

test('packaged Stable, Staging, Nightly, and Dev profiles never overlap', () => {
  const appData = path.join(temporaryRoot, 'packaged-appdata');
  const scenarios = [
    ['stable', true, 'Kawaikara'],
    ['staging', true, 'Kawaikara Staging'],
    ['nightly', true, 'Kawaikara Nightly'],
    ['nightly', false, 'Kawaikara Dev'],
  ];
  const roots = scenarios.map(([channel, distribution, productName]) => {
    const loaded = loadUserDataPaths({
      channel,
      distribution,
      isPackaged: true,
      appData,
      initialUserData: path.join(appData, productName),
      appPath: root,
    });
    assert.ok(
      loaded.events.some(
        (event) => event[0] === 'setName' && event[1] === productName,
      ),
    );
    return loaded.exports.getUserDataLayout().userRoot;
  });

  assert.deepEqual(roots, scenarios.map((scenario) => path.join(appData, scenario[2])));
  assert.equal(new Set(roots).size, scenarios.length);
});

test('Nightly migrates its former duplicated profile without touching Stable', () => {
  const appData = path.join(temporaryRoot, 'migration-appdata');
  const oldNightlyRoot = path.join(appData, 'Kawaikara Nightly Nightly');
  const stableRoot = path.join(appData, 'Kawaikara');
  mkdirSync(path.join(oldNightlyRoot, 'KawaiData'), { recursive: true });
  mkdirSync(stableRoot, { recursive: true });
  writeFileSync(path.join(oldNightlyRoot, 'KawaiData', 'preferences.json'), '{}');
  writeFileSync(path.join(stableRoot, 'stable-marker'), 'stable');

  const loaded = loadUserDataPaths({
    channel: 'nightly',
    distribution: true,
    isPackaged: true,
    appData,
    initialUserData: path.join(appData, 'Kawaikara Nightly'),
    appPath: root,
  });
  loaded.exports.configureUserDataPaths();

  const newNightlyRoot = path.join(appData, 'Kawaikara Nightly');
  assert.ok(existsSync(path.join(newNightlyRoot, 'KawaiData', 'preferences.json')));
  assert.equal(existsSync(oldNightlyRoot), false);
  assert.ok(existsSync(path.join(stableRoot, 'stable-marker')));
});

test('the isolated update test profile remains authoritative', () => {
  const stateRoot = path.join(temporaryRoot, 'update-test-state');
  const loaded = loadUserDataPaths({
    channel: 'nightly',
    distribution: true,
    isPackaged: true,
    appData: path.join(temporaryRoot, 'ignored-appdata'),
    initialUserData: path.join(temporaryRoot, 'ignored-userdata'),
    appPath: root,
    updateTestProfile: { stateRoot, feedUrl: 'http://127.0.0.1:18080/' },
  });

  assert.equal(loaded.exports.getUserDataLayout().userRoot, stateRoot);
  assert.equal(loaded.events.some((event) => event[0] === 'setName'), false);
});

test('packaged Windows uses the saved data root without migrating or deleting the old profile', () => {
  const appData = path.join(temporaryRoot, 'custom-location-appdata');
  const customRoot = path.join(temporaryRoot, 'custom-location', 'Kawaikara Nightly');
  // Windows paths are resolved by Main with Win32 semantics, including on non-Windows CI.
  const windowsRoot = process.platform === 'win32' ? customRoot : 'D:\\Profiles\\Kawaikara Nightly';
  mkdirSync(path.join(appData, 'Kawaikara Installations'), { recursive: true });
  writeFileSync(path.join(appData, 'Kawaikara Installations/day.faby.kawaikara.nightly.ini'),
    Buffer.from(`\ufeff[storage]\r\nroot=${windowsRoot}\r\n`, 'utf16le'));
  const parameters = {
    channel: 'nightly', distribution: true, isPackaged: true, platform: 'win32',
    appData, initialUserData: path.join(appData, 'Kawaikara Nightly'), appPath: root,
  };
  assert.equal(loadUserDataPaths(parameters).exports.getUserDataLayout().userRoot, windowsRoot);
  assert.equal(loadUserDataPaths({ ...parameters, platform: 'darwin' }).exports.getUserDataLayout().userRoot,
    path.join(appData, 'Kawaikara Nightly'));
  assert.equal(loadUserDataPaths({ ...parameters, updateTestProfile: { stateRoot: 'isolated-test' } }).exports.getUserDataLayout().userRoot,
    'isolated-test');
  assert.equal(loadUserDataPaths({ ...parameters, distribution: false, isPackaged: false }).exports.getUserDataLayout().userRoot,
    path.join(root, 'tmp', 'kawaikara Dev'));
  if (process.platform === 'win32') {
    const legacyRoot = path.join(appData, 'Kawaikara Nightly Nightly');
    mkdirSync(legacyRoot, { recursive: true });
    writeFileSync(path.join(legacyRoot, 'retained'), 'original data');
    const loaded = loadUserDataPaths(parameters);
    loaded.exports.configureUserDataPaths();
    assert.ok(existsSync(path.join(customRoot, 'Electron')));
    assert.ok(existsSync(path.join(customRoot, 'KawaiData')));
    assert.ok(existsSync(path.join(legacyRoot, 'retained')));
  }
});
