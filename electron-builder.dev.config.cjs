const baseConfig = require('./electron-builder.config.cjs');

module.exports = {
  ...baseConfig,
  appId: 'day.faby.kawaikara.dev',
  productName: 'Kawaikara Dev',
  extraMetadata: {
    productName: 'Kawaikara Dev',
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
};
