const baseConfig = require('./electron-builder.config.cjs');
const { dev } = require('./config/application-identities.json');

module.exports = {
  ...baseConfig,
  appId: dev.appId,
  productName: dev.productName,
  extraMetadata: {
    name: dev.packageName,
    productName: dev.productName,
  },
  directories: {
    ...baseConfig.directories,
    output: process.env.KAWAIKARA_DEV_OUTPUT_DIR ?? 'builds/dev/${os}/${arch}',
  },
  mac: {
    ...baseConfig.mac,
    // Local protocol testing does not need a distribution certificate.
    identity: null,
  },
  win: {
    ...baseConfig.win,
    executableName: dev.productName,
  },
  nsis: {
    ...baseConfig.nsis,
    guid: dev.nsisGuid,
    shortcutName: dev.productName,
    uninstallDisplayName: dev.productName,
    include: null,
  },
};
