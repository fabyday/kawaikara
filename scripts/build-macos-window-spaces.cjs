const { mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, 'dist', 'native');
const outputPath = path.join(
  outputDirectory,
  'kawaikara_macos_window_spaces.node',
);

if (process.platform !== 'darwin') {
  // Never let a generated Mach-O add-on leak into a Windows/Linux package.
  rmSync(outputDirectory, { recursive: true, force: true });
  process.exit(0);
}

mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(
  'xcrun',
  [
    'clang++',
    '-bundle',
    '-undefined',
    'dynamic_lookup',
    '-std=c++17',
    '-fobjc-arc',
    '-arch',
    'arm64',
    '-arch',
    'x86_64',
    '-mmacosx-version-min=12.0',
    '-framework',
    'AppKit',
    '-o',
    outputPath,
    path.join(root, 'scripts', 'MacOSWindowSpaces.mm'),
  ],
  { cwd: root, encoding: 'utf8' },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'Native build failed.\n');
  process.exit(result.status ?? 1);
}

console.log(`Built universal macOS window-space bridge: ${outputPath}`);
