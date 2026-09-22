const path = require('node:path');
const { execFileSync } = require('node:child_process');
const base = require('./electron-builder.config.cjs');

if (process.env.KAWAIKARA_UPDATE_TEST_BUILD !== '1' || process.env.KAWAIKARA_BUILD_CHANNEL !== 'nightly') {
  throw new Error('Use pnpm update:test:build; this configuration is exclusively for isolated Nightly tests.');
}
const version = process.env.KAWAIKARA_UPDATE_TEST_VERSION;
if (!/^\d+\.\d+\.\d+-nightly\.\d+$/.test(version || '')) throw new Error('Invalid test version.');
const productName = 'Kawaikara Nightly Update Test';
const appId = 'day.faby.kawaikara.nightly.update-test';

module.exports = {
  ...base,
  appId,
  productName,
  forceCodeSigning: false,
  protocols: [],
  artifactName: 'Kawaikara-Nightly-Update-Test-${version}-${os}-${arch}.${ext}',
  directories: { ...base.directories, output: `tests/Release/builds/${version}/\${os}` },
  extraMetadata: { name: 'kawaikara-nightly-update-test', productName, version },
  generateUpdatesFilesForAllChannels: false,
  publish: [{ provider: 'generic', url: `http://127.0.0.1:${process.env.KAWAIKARA_UPDATE_TEST_PORT || 18080}/`, channel: 'nightly' }],
  mac: { ...base.mac, identity: '-', target: [{ target: 'zip', arch: [process.arch] }], notarize: false },
  win: { ...base.win, target: [{ target: 'nsis', arch: ['x64'] }], verifyUpdateCodeSignature: false },
  nsis: {
    ...base.nsis,
    guid: 'e32ae1b6-9002-59be-941e-3a5c17874b2c',
    shortcutName: productName,
    uninstallDisplayName: productName,
    include: null,
  },
  afterSign(context) {
    if (context.electronPlatformName !== 'darwin') return;
    // BDIH's LOCAL TEST recipe. An identifier-only requirement is intentionally
    // weaker than release signing and MUST NEVER be imported by release config.
    execFileSync('codesign', [
      '--force', '--sign', '-', '--options', 'runtime',
      '--preserve-metadata=entitlements', '--requirements', `=designated => identifier "${appId}"`,
      path.join(context.appOutDir, `${productName}.app`),
    ], { stdio: 'inherit' });
  },
};
