const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { existsSync, readdirSync } = require('node:fs');

const supported =
  (process.platform === 'win32' && process.arch === 'x64') ||
  (process.platform === 'darwin' && process.arch === 'arm64');

if (!supported) {
  console.log(
    `[electron-mpv-video] Native setup skipped for ${process.platform}-${process.arch}; Chromium fallback remains available.`,
  );
  process.exit(0);
}

const packageDirectory = path.dirname(
  require.resolve('electron-mpv-video/package.json'),
);
const releaseDirectory = path.join(
  packageDirectory,
  'native',
  'mpv-addon',
  'build',
  'Release',
);
const addonPath = path.join(releaseDirectory, 'mpv_addon.node');
const runtimeExtension = process.platform === 'win32' ? '.dll' : '.dylib';
if (
  existsSync(addonPath) &&
  existsSync(releaseDirectory) &&
  readdirSync(releaseDirectory).some((name) =>
    name.toLowerCase().endsWith(runtimeExtension),
  )
) {
  console.log('[electron-mpv-video] Existing native runtime is ready.');
  process.exit(0);
}
const packageManagerEntry = process.env.npm_execpath;
if (!packageManagerEntry) {
  throw new Error(
    'The package manager entry point is unavailable. Run this script through pnpm install.',
  );
}

console.log(
  '[electron-mpv-video] Running the dependency\'s official build:native script without patching its package.',
);
const result = spawnSync(
  process.execPath,
  [packageManagerEntry, '--dir', packageDirectory, 'run', 'build:native'],
  { stdio: 'inherit', env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
