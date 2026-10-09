const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** Convert the existing banner to the native installer's embedded bitmap at packaging time. */
function writeInstallerBranding(projectRoot, resourcesDirectory) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const destination = path.join(resourcesDirectory, 'generated', 'installer-banner.bmp');
  const result = spawnSync(require('electron'), [path.join(__dirname, 'installer-banner.electron.cjs'),
    path.join(projectRoot, 'imgs', 'kawaikara.jpg'), destination],
  { env: environment, windowsHide: true, encoding: 'utf8', timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`Installer banner conversion failed: ${result.error || result.stderr}`);
  return destination;
}

module.exports = { writeInstallerBranding };
