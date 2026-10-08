const path = require('node:path');
const { writeInstallerLocales } = require('./installer-locales.cjs');

/** Prepare native installer copy before NSIS compilation, including local Dev packages. */
exports.default = async function beforePack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const root = context.packager.projectDir;
  writeInstallerLocales(root, path.resolve(root, context.packager.config.directories.buildResources));
};
