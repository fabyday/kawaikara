const path = require('node:path');
const { existsSync, readdirSync } = require('node:fs');

// Find unpacked application directories, not installer EXEs or helper apps.
// Stop at the package boundary and do not traverse framework symlinks.
function findPackageDirectories(directory, platform) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const hasApplication = platform === 'darwin'
    ? entries.some((entry) => entry.isDirectory() && entry.name.endsWith('.app') &&
        existsSync(path.join(directory, entry.name, 'Contents', 'MacOS')))
    : entries.some((entry) => entry.isFile() &&
        (platform === 'win32' ? entry.name.endsWith('.exe') : entry.name === 'kawaikara')) &&
      existsSync(path.join(directory, 'resources', 'app.asar'));
  if (hasApplication) return [directory];
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .flatMap((entry) => findPackageDirectories(path.join(directory, entry.name), platform));
}

module.exports = { findPackageDirectories };
