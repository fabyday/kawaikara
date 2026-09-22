const { existsSync, readFileSync } = require('node:fs');
const applicationIdentities = require('./config/application-identities.json');

const RELEASE_CHANNELS = ['stable', 'staging', 'nightly'];

const mpvResourceDirectory =
  'node_modules/electron-mpv-video/native/mpv-addon/build/Release';
const mpvExtraResources = existsSync(mpvResourceDirectory)
  ? [
      {
        from: mpvResourceDirectory,
        to: 'mpv',
        filter: ['*.node', '*.dll', '*.dylib'],
      },
    ]
  : [];
const macOSWindowSpacesAddon =
  'dist/native/kawaikara_macos_window_spaces.node';
const macOSWindowSpacesExtraResources =
  process.platform === 'darwin' && existsSync(macOSWindowSpacesAddon)
    ? [
        {
          from: macOSWindowSpacesAddon,
          to: `native/${macOSWindowSpacesAddon.split('/').at(-1)}`,
        },
      ]
    : [];
const windowsForegroundManifest =
  'dist/native/kawaikara_windows_foreground.json';
const windowsForegroundExtraResources = resolveWindowsForegroundResources();

function resolveWindowsForegroundResources() {
  if (process.platform !== 'win32') return [];
  if (!existsSync(windowsForegroundManifest)) {
    const legacyAddon = 'dist/native/kawaikara_windows_foreground.node';
    return existsSync(legacyAddon)
      ? [{ from: legacyAddon, to: `native/${legacyAddon.split('/').at(-1)}` }]
      : [];
  }
  const manifest = JSON.parse(readFileSync(windowsForegroundManifest, 'utf8'));
  if (
    typeof manifest.file !== 'string' ||
    !/^kawaikara_windows_foreground-[a-f0-9]{16}\.node$/.test(manifest.file)
  ) {
    throw new Error(`Invalid Windows native manifest: ${windowsForegroundManifest}`);
  }
  const addon = `dist/native/${manifest.file}`;
  if (!existsSync(addon)) {
    throw new Error(`Windows native addon selected by manifest is missing: ${addon}`);
  }
  return [
    {
      from: windowsForegroundManifest,
      to: `native/${windowsForegroundManifest.split('/').at(-1)}`,
    },
    { from: addon, to: `native/${manifest.file}` },
  ];
}

const channel = process.env.KAWAIKARA_BUILD_CHANNEL || 'nightly';
if (!RELEASE_CHANNELS.includes(channel)) {
  throw new Error(`Unknown KAWAIKARA_BUILD_CHANNEL: ${channel}`);
}

const updateChannel = channel === 'stable' ? 'latest' : channel;
const channelIdentity = applicationIdentities[channel];
const nsisIdentityMigrationInclude = channel === 'nightly'
  ? 'packaging/nsis/nightly-identity-migration.nsh'
  : undefined;
const artifactProductName = channelIdentity.productName.replace(/\s+/g, '-');
const defaultPublishRepositories = {
  stable: 'fabyday/kawaikara',
  staging: 'Kawaikara/kawaikara-staging',
  nightly: 'Kawaikara/kawaikara-nightly',
};
const publishRepository =
  process.env.KAWAIKARA_PUBLISH_REPOSITORY ||
  defaultPublishRepositories[channel];
const [publishOwner, publishRepo, ...unexpectedRepositoryParts] =
  publishRepository.split('/');
if (!publishOwner || !publishRepo || unexpectedRepositoryParts.length > 0) {
  throw new Error(
    `KAWAIKARA_PUBLISH_REPOSITORY must use owner/repo format: ${publishRepository}`,
  );
}

module.exports = {
  appId: channelIdentity.appId,
  productName: channelIdentity.productName,
  // NSIS one-click uses package.json's `name`, not productName, for its
  // installation directory and updater cache. Keep those namespaces separate.
  extraMetadata: {
    name: channelIdentity.packageName,
    productName: channelIdentity.productName,
  },
  // Release packages must never silently fall back to Electron's invalid
  // linker-only ad-hoc signature. Local builds can still omit a certificate.
  forceCodeSigning: process.env.KAWAIKARA_REQUIRE_CODE_SIGNING === '1',
  asar: true,
  // The in-app Bundle development host launches esbuild's platform binary.
  // Executables cannot run from inside app.asar.
  asarUnpack: [
    'node_modules/@esbuild/**/*',
    'node_modules/esbuild/**/*',
  ],
  files: ['dist/**/*', '!dist/native/**/*'],
  extraResources: [
    ...mpvExtraResources,
    ...macOSWindowSpacesExtraResources,
    ...windowsForegroundExtraResources,
  ],
  electronDownload: {
    mirror: 'https://github.com/castlabs/electron-releases/releases/download/',
  },
  directories: {
    buildResources: 'resources',
    // Keep both macOS architectures together so electron-builder can merge
    // them into one updater metadata file. The unpacked apps remain separated
    // as mac/ and mac-arm64/ within this platform directory.
    output: `builds/${channel}/\${os}`,
  },
  afterPack: 'packaging/after-pack.cjs',
  afterSign: 'packaging/after-sign.cjs',
  protocols: [
    {
      name: 'Kawaikara URL',
      schemes: ['kawaikara'],
    },
  ],
  // GitHub already groups assets under a versioned Release, so repeating the
  // long prerelease version in every filename makes the platform difficult to
  // scan. Keep the exact version in the Release/tag and make downloads concise.
  artifactName: `${artifactProductName}-\${os}-\${arch}.\${ext}`,
  generateUpdatesFilesForAllChannels: true,
  electronUpdaterCompatibility: '>=2.16',
  publish: [
    {
      provider: 'github',
      owner: publishOwner,
      repo: publishRepo,
      channel: updateChannel,
      releaseType: channel === 'stable' ? 'release' : 'prerelease',
    },
  ],
  mac: {
    category: 'public.app-category.entertainment',
    icon: 'resources/icons/app-kawaikara-mac.png',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
  },
  win: {
    icon: 'resources/icons/kawaikara.ico',
    executableName: channelIdentity.productName,
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ],
  },
  nsis: {
    // Nightly intentionally uses a new installer identity so machines affected
    // by the former shared `kawaikara` folder do not reuse it.
    guid: channelIdentity.nsisGuid,
    shortcutName: channelIdentity.productName,
    uninstallDisplayName: channelIdentity.productName,
    ...(nsisIdentityMigrationInclude
      ? { include: nsisIdentityMigrationInclude }
      : {}),
  },
  linux: {
    category: 'AudioVideo',
    icon: 'resources/icons/app-kawaikara.png',
    target: [{ target: 'AppImage', arch: ['x64', 'arm64'] }],
  },
};
