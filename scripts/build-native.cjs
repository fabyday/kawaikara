const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, 'dist', 'native');
const windowsManifestFileName = 'kawaikara_windows_foreground.json';
const windowsAddonPrefix = 'kawaikara_windows_foreground-';

if (process.platform === 'darwin') buildMacOSBridge();
else if (process.platform === 'win32') buildWindowsBridge();

function buildMacOSBridge() {
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    'kawaikara_macos_window_spaces.node',
  );
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
      path.join(
        root,
        'native',
        'darwin',
        'window-spaces',
        'MacOSWindowSpaces.mm',
      ),
    ],
    { cwd: root, encoding: 'utf8' },
  );
  finishBuild(result, outputPath, 'macOS window-space bridge');
}

function buildWindowsBridge() {
  if (process.arch !== 'x64') {
    throw new Error(
      `The Windows foreground-window bridge does not support ${process.arch}.`,
    );
  }

  const visualStudioPath = findVisualStudioPath();
  const vcVarsPath = path.join(
    visualStudioPath,
    'VC',
    'Auxiliary',
    'Build',
    'vcvars64.bat',
  );
  if (!existsSync(vcVarsPath)) {
    throw new Error(`Visual C++ environment was not found: ${vcVarsPath}`);
  }

  const sourcePath = path.join(
    root,
    'native',
    'win32',
    'monitoring',
    'WindowsForegroundWindow.cpp',
  );
  const buildHash = createHash('sha256')
    .update(readFileSync(sourcePath))
    .update(readFileSync(__filename))
    .update(process.arch)
    .digest('hex')
    .slice(0, 16);
  const outputFileName = `${windowsAddonPrefix}${buildHash}.node`;

  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, outputFileName);
  if (!existsSync(outputPath)) {
    compileWindowsBridge(vcVarsPath, sourcePath, outputPath, buildHash);
  }
  writeFileSync(
    path.join(outputDirectory, windowsManifestFileName),
    `${JSON.stringify({ file: outputFileName }, null, 2)}\n`,
    'utf8',
  );
  cleanupStaleWindowsBridges(outputFileName);
  console.log(`Built Windows foreground-window bridge: ${outputPath}`);
}

function compileWindowsBridge(vcVarsPath, sourcePath, outputPath, buildHash) {
  const intermediateDirectory = path.join(
    outputDirectory,
    `.windows-foreground-build-${process.pid}-${buildHash}`,
  );
  mkdirSync(intermediateDirectory, { recursive: true });
  const temporaryOutputPath = path.join(
    intermediateDirectory,
    path.basename(outputPath),
  );
  const objectPath = path.join(intermediateDirectory, 'WindowsForegroundWindow.obj');
  const importLibraryPath = path.join(
    intermediateDirectory,
    'WindowsForegroundWindow.lib',
  );
  const command = [
    `call "${vcVarsPath}" >nul &&`,
    'cl.exe',
    '/nologo',
    '/std:c++17',
    '/EHsc',
    '/LD',
    '/O2',
    '/DUNICODE',
    '/D_UNICODE',
    `/Fo:"${objectPath}"`,
    `"${sourcePath}"`,
    '/link',
    `/OUT:"${temporaryOutputPath}"`,
    `/IMPLIB:"${importLibraryPath}"`,
    'user32.lib',
    'shell32.lib',
  ].join(' ');
  try {
    const result = spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', command],
      { cwd: root, encoding: 'utf8', windowsVerbatimArguments: true },
    );
    finishBuild(
      result,
      temporaryOutputPath,
      'Windows foreground-window bridge',
    );
    renameSync(temporaryOutputPath, outputPath);
  } finally {
    rmSync(intermediateDirectory, { recursive: true, force: true });
  }
}

function cleanupStaleWindowsBridges(currentFileName) {
  for (const entry of readdirSync(outputDirectory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const legacyFile = entry.name === 'kawaikara_windows_foreground.node';
    const versionedFile =
      entry.name.startsWith(windowsAddonPrefix) && entry.name.endsWith('.node');
    if ((!legacyFile && !versionedFile) || entry.name === currentFileName) {
      continue;
    }
    const stalePath = path.join(outputDirectory, entry.name);
    try {
      rmSync(stalePath, { force: true });
    } catch (error) {
      if (!['EACCES', 'EBUSY', 'EPERM'].includes(error?.code)) throw error;
      console.warn(
        `Retained loaded native bridge until the next build: ${stalePath}`,
      );
    }
  }
}

function findVisualStudioPath() {
  const installerRoot = process.env['ProgramFiles(x86)'];
  const vsWherePath = installerRoot
    ? path.join(
        installerRoot,
        'Microsoft Visual Studio',
        'Installer',
        'vswhere.exe',
      )
    : undefined;
  if (vsWherePath && existsSync(vsWherePath)) {
    const result = spawnSync(
      vsWherePath,
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath',
      ],
      { encoding: 'utf8' },
    );
    const installationPath = result.stdout?.trim();
    if (result.status === 0 && installationPath) return installationPath;
  }

  const editions = ['Community', 'Professional', 'Enterprise', 'BuildTools'];
  const programRoots = [process.env.ProgramFiles, installerRoot].filter(Boolean);
  for (const programRoot of programRoots) {
    for (const year of ['2022', '2019']) {
      for (const edition of editions) {
        const candidate = path.join(
          programRoot,
          'Microsoft Visual Studio',
          year,
          edition,
        );
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error('Visual Studio C++ Build Tools were not found.');
}

function finishBuild(result, outputPath, label) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Native build failed.');
  }
  console.log(`Built ${label}: ${outputPath}`);
}
