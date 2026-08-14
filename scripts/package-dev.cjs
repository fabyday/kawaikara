const {
  existsSync,
  lstatSync,
  readdirSync,
  renameSync,
  rmSync,
} = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadLocalEnvironment } = require('./lib/env.cjs');

const root = path.resolve(__dirname, '..');
loadLocalEnvironment(root);
const developmentAppName = 'Kawaikara Dev';
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const platformFlag = {
  darwin: '--mac',
  linux: '--linux',
  win32: '--win',
}[process.platform];
const architectureFlag = {
  arm64: '--arm64',
  x64: '--x64',
}[process.arch];
const outputPlatform = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win',
}[process.platform];
const outputDirectory = path.join(
  root,
  'builds',
  'dev',
  outputPlatform ?? process.platform,
  process.arch,
);
const previousOutputDirectory = `${outputDirectory}.previous`;
const legacyOutputDirectory = path.join(root, 'output_dist', 'dev');

if (!platformFlag || !architectureFlag) {
  throw new Error(
    `Development packaging is not configured for ${process.platform}/${process.arch}.`,
  );
}

ensureDevelopmentAppIsStopped();
authenticateWidevineFromEnvironment();
run(['build:dev']);
const applicationPath = replaceDevelopmentBuild();

console.log(`Development application: ${applicationPath}`);

if (process.platform === 'darwin') {
  removeLegacyDevelopmentBuilds();
  runCommand('/usr/bin/open', [applicationPath]);
  console.log(
    'Kawaikara was opened once so macOS can register the kawaikara:// protocol.',
  );
} else {
  console.log('Launch the application once to register the kawaikara:// protocol.');
}

function run(arguments_, environment = process.env) {
  runCommand(pnpm, arguments_, environment);
}

function authenticateWidevineFromEnvironment() {
  const account = process.env.KAWAIKARA_EVS_ACCOUNT;
  const password = process.env.KAWAIKARA_EVS_PASSWORD;
  if (Boolean(account) !== Boolean(password)) {
    throw new Error(
      'Set both KAWAIKARA_EVS_ACCOUNT and KAWAIKARA_EVS_PASSWORD in .env.local.',
    );
  }
  if (!account || !password) {
    console.log(
      'No EVS credentials found in .env.local; Castlabs may ask for them during signing.',
    );
    return;
  }
  console.log('Authenticating Castlabs EVS with .env.local credentials…');
  run(['widevine:auth']);
}

function ensureDevelopmentAppIsStopped() {
  if (process.platform !== 'darwin') return;

  const result = spawnSync(
    '/usr/bin/pgrep',
    ['-f', '/Kawaikara Dev\\.app/Contents/MacOS/Kawaikara Dev$'],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  if (result.status === 0) {
    throw new Error(
      'Kawaikara Dev is running. Quit it completely, then run pnpm package:dev again.',
    );
  }
  // pgrep uses exit code 1 when no process matched.
  if (result.status !== 1) {
    throw new Error(`Could not check Kawaikara Dev process state (pgrep ${result.status}).`);
  }
}

function replaceDevelopmentBuild() {
  assertManagedOutputDirectory(outputDirectory);
  assertManagedOutputDirectory(previousOutputDirectory);

  if (existsSync(previousOutputDirectory)) {
    assertRegularDirectory(previousOutputDirectory);
    console.log(`Removing incomplete package backup: ${previousOutputDirectory}`);
    rmSync(previousOutputDirectory, { recursive: true, force: true });
  }

  const hadExistingBuild = existsSync(outputDirectory);
  if (hadExistingBuild) {
    assertRegularDirectory(outputDirectory);
    console.log(`Backing up existing development build: ${outputDirectory}`);
    renameSync(outputDirectory, previousOutputDirectory);
  }

  try {
    run(
      [
        'exec',
        'electron-builder',
        '--dir',
        platformFlag,
        architectureFlag,
        '--config',
        'electron-builder.dev.config.cjs',
        '--publish',
        'never',
      ],
      {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        KAWAIKARA_BUILD_CHANNEL: 'nightly',
        KAWAIKARA_VMP_SIGN: '1',
      },
    );

    const applicationPath = findApplication(outputDirectory);
    if (!applicationPath) {
      throw new Error(`Packaged application was not found in ${outputDirectory}.`);
    }

    if (hadExistingBuild) {
      assertRegularDirectory(previousOutputDirectory);
      console.log(`Replacing previous development build: ${outputDirectory}`);
      rmSync(previousOutputDirectory, { recursive: true, force: true });
    }
    return applicationPath;
  } catch (error) {
    if (existsSync(outputDirectory)) {
      assertRegularDirectory(outputDirectory);
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    if (hadExistingBuild && existsSync(previousOutputDirectory)) {
      assertRegularDirectory(previousOutputDirectory);
      renameSync(previousOutputDirectory, outputDirectory);
      console.error('Development packaging failed; the previous build was restored.');
    }
    throw error;
  }
}

function removeLegacyDevelopmentBuilds() {
  if (!existsSync(legacyOutputDirectory)) return;
  assertRegularDirectory(legacyOutputDirectory);

  const applications = findApplications(legacyOutputDirectory);
  const launchServices =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/' +
    'LaunchServices.framework/Support/lsregister';
  for (const application of applications) {
    console.log(`Unregistering legacy development application: ${application}`);
    const result = spawnSync(launchServices, ['-u', application], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Could not unregister legacy application: ${application}`);
    }
  }

  console.log(`Removing legacy development output: ${legacyOutputDirectory}`);
  rmSync(legacyOutputDirectory, { recursive: true, force: true });
}

function assertManagedOutputDirectory(directory) {
  const allowedDirectories = new Set([
    path.resolve(outputDirectory),
    path.resolve(previousOutputDirectory),
  ]);
  if (!allowedDirectories.has(path.resolve(directory))) {
    throw new Error(`Refusing to modify unmanaged output directory: ${directory}`);
  }
}

function assertRegularDirectory(directory) {
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`Refusing to replace a non-directory or symbolic link: ${directory}`);
  }
}

function runCommand(command, arguments_, environment = process.env) {
  const result = spawnSync(command, arguments_, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${arguments_.join(' ')} failed with exit code ${String(result.status)}.`,
    );
  }
}

function findApplication(directory) {
  return findApplications(directory)[0];
}

function findApplications(directory) {
  if (!existsSync(directory)) return [];
  assertRegularDirectory(directory);
  const applications = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (
      process.platform === 'darwin' &&
      entry.isDirectory() &&
      entry.name === `${developmentAppName}.app`
    ) {
      applications.push(entryPath);
      continue;
    }
    if (
      process.platform === 'win32' &&
      entry.isFile() &&
      entry.name === `${developmentAppName}.exe`
    ) {
      applications.push(entryPath);
      continue;
    }
    if (process.platform === 'linux' && entry.isFile() && entry.name === 'kawaikara') {
      applications.push(entryPath);
      continue;
    }
    if (entry.isDirectory()) {
      applications.push(...findApplications(entryPath));
    }
  }
  return applications;
}
