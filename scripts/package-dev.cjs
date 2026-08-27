const {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
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
const stagingOutputDirectory = `${outputDirectory}.next`;
const legacyOutputDirectory = path.join(root, 'output_dist', 'dev');
const fileSystemRetryDelays =
  process.platform === 'win32' ? [250, 500, 1000, 2000, 4000, 8000] : [100, 250];
const windowsElectronBuilderAttempts = 3;

if (!platformFlag || !architectureFlag) {
  throw new Error(
    `Development packaging is not configured for ${process.platform}/${process.arch}.`,
  );
}

assertInvocationDirectoryIsSafe();
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
} else if (process.platform === 'win32') {
  launchDetached(applicationPath);
  console.log(
    'Kawaikara was launched so Windows can register the kawaikara:// protocol.',
  );
} else {
  console.log('Launch the application once to register the kawaikara:// protocol.');
}

function run(arguments_, environment = process.env) {
  runCommand(pnpm, arguments_, environment);
}

function assertInvocationDirectoryIsSafe() {
  const initialDirectory = resolveExistingPath(
    process.env.INIT_CWD || process.cwd(),
  );
  const managedDirectories = [
    outputDirectory,
    previousOutputDirectory,
    stagingOutputDirectory,
    legacyOutputDirectory,
  ];
  const containingDirectory = managedDirectories.find((directory) =>
    isPathSameOrInside(resolveExistingPath(directory), initialDirectory),
  );
  if (!containingDirectory) return;
  throw new Error(
    [
      'The terminal that invoked package:dev is inside a managed build output.',
      `Current terminal directory: ${initialDirectory}`,
      `Managed output: ${containingDirectory}`,
      `Change directory to ${root}, then run pnpm package:dev again.`,
    ].join('\n'),
  );
}

function resolveExistingPath(value) {
  const resolved = path.resolve(value);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function isPathSameOrInside(rootPath, candidatePath) {
  const relation = path.relative(rootPath, candidatePath);
  return relation === '' || (
    relation !== '..' &&
    !relation.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relation)
  );
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
  if (process.platform === 'win32') {
    const executableName = `${developmentAppName}.exe`;
    const result = spawnSync(
      'tasklist.exe',
      ['/FI', `IMAGENAME eq ${executableName}`, '/FO', 'CSV', '/NH'],
      { cwd: root, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `Could not check Kawaikara Dev process state (tasklist ${result.status}).`,
      );
    }
    const isRunning = result.stdout
      .split(/\r?\n/)
      .some((line) => line.startsWith(`"${executableName}"`));
    if (isRunning) {
      throw new Error(
        'Kawaikara Dev is running. Quit it completely, then run pnpm package:dev again.',
      );
    }

    const matchingProcesses = findWindowsProcessesUsingDirectories([
      outputDirectory,
      previousOutputDirectory,
      stagingOutputDirectory,
    ]);
    if (matchingProcesses.length > 0) {
      throw new Error(
        [
          'A process is still using the development package output.',
          'Close Kawaikara Dev and any terminal or tool opened inside builds/dev, then run pnpm package:dev again.',
          '',
          formatWindowsProcesses(matchingProcesses),
        ].join('\n'),
      );
    }
    return;
  }

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
  assertManagedOutputDirectory(stagingOutputDirectory);

  if (process.platform === 'win32') {
    return replaceDevelopmentBuildOnWindows();
  }

  if (existsSync(previousOutputDirectory)) {
    assertRegularDirectory(previousOutputDirectory);
    console.log(`Removing incomplete package backup: ${previousOutputDirectory}`);
    removeManagedDirectory(previousOutputDirectory, 'remove incomplete package backup');
  }

  const hadExistingBuild = existsSync(outputDirectory);
  if (hadExistingBuild) {
    assertRegularDirectory(outputDirectory);
    console.log(`Backing up existing development build: ${outputDirectory}`);
    renameManagedDirectory(
      outputDirectory,
      previousOutputDirectory,
      'back up existing development build',
    );
  }

  try {
    runElectronBuilder();

    const applicationPath = findApplication(outputDirectory);
    if (!applicationPath) {
      throw new Error(`Packaged application was not found in ${outputDirectory}.`);
    }

    if (hadExistingBuild) {
      assertRegularDirectory(previousOutputDirectory);
      console.log(`Replacing previous development build: ${outputDirectory}`);
      removeManagedDirectory(previousOutputDirectory, 'remove previous development build');
    }
    return applicationPath;
  } catch (error) {
    if (existsSync(outputDirectory)) {
      assertRegularDirectory(outputDirectory);
      removeManagedDirectory(outputDirectory, 'remove failed development build');
    }
    if (hadExistingBuild && existsSync(previousOutputDirectory)) {
      assertRegularDirectory(previousOutputDirectory);
      renameManagedDirectory(
        previousOutputDirectory,
        outputDirectory,
        'restore previous development build',
      );
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
  retryFileSystemOperation(
    'remove legacy development output',
    legacyOutputDirectory,
    () => {
      rmSync(legacyOutputDirectory, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200,
      });
    },
  );
}

function replaceDevelopmentBuildOnWindows() {
  if (existsSync(stagingOutputDirectory)) {
    assertRegularDirectory(stagingOutputDirectory);
    console.log(`Removing incomplete package staging directory: ${stagingOutputDirectory}`);
    removeManagedDirectory(stagingOutputDirectory, 'remove incomplete package staging directory');
  }

  runElectronBuilderWithRetries(stagingOutputDirectory);

  const applicationPath = findApplication(stagingOutputDirectory);
  if (!applicationPath) {
    throw new Error(`Packaged application was not found in ${stagingOutputDirectory}.`);
  }

  console.log(`Replacing development build contents: ${outputDirectory}`);
  replaceManagedDirectoryContents(stagingOutputDirectory, outputDirectory);
  return findApplication(outputDirectory) ?? applicationPath.replace(
    stagingOutputDirectory,
    outputDirectory,
  );
}

function runElectronBuilder(packageOutputDirectory = outputDirectory) {
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
      KAWAIKARA_DEV_OUTPUT_DIR: path.relative(root, packageOutputDirectory),
      KAWAIKARA_VMP_SIGN: '1',
    },
  );
}

function runElectronBuilderWithRetries(packageOutputDirectory) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      runElectronBuilder(packageOutputDirectory);
      return;
    } catch (error) {
      if (process.platform !== 'win32' || attempt >= windowsElectronBuilderAttempts) {
        throw error;
      }

      console.warn(
        [
          `electron-builder failed on Windows (attempt ${attempt}/${windowsElectronBuilderAttempts}).`,
          'Cleaning the staging output and retrying after Windows releases package files.',
        ].join(' '),
      );
      if (existsSync(packageOutputDirectory)) {
        removeManagedDirectory(packageOutputDirectory, 'remove failed package staging directory');
      }
      sleepSync(fileSystemRetryDelays[Math.min(attempt + 1, fileSystemRetryDelays.length - 1)]);
    }
  }
}

function assertManagedOutputDirectory(directory) {
  const allowedDirectories = new Set([
    path.resolve(outputDirectory),
    path.resolve(previousOutputDirectory),
    path.resolve(stagingOutputDirectory),
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

function removeManagedDirectory(directory, action) {
  assertManagedOutputDirectory(directory);
  assertRegularDirectory(directory);
  retryFileSystemOperation(action, directory, () => {
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    });
  });
}

function renameManagedDirectory(source, destination, action) {
  assertManagedOutputDirectory(source);
  assertManagedOutputDirectory(destination);
  assertRegularDirectory(source);
  retryFileSystemOperation(action, source, () => {
    renamePath(source, destination);
  });
}

function replaceManagedDirectoryContents(source, destination) {
  assertManagedOutputDirectory(source);
  assertManagedOutputDirectory(destination);
  assertRegularDirectory(source);

  if (!existsSync(destination)) {
    mkdirSync(destination, { recursive: true });
  } else {
    assertRegularDirectory(destination);
    for (const entry of readdirSync(destination, { withFileTypes: true })) {
      const entryPath = path.join(destination, entry.name);
      retryFileSystemOperation(`remove old package entry ${entry.name}`, entryPath, () => {
        rmSync(entryPath, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 200,
        });
      });
    }
  }

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    retryFileSystemOperation(`move new package entry ${entry.name}`, sourcePath, () => {
      renamePath(sourcePath, destinationPath);
    });
  }

  removeManagedDirectory(source, 'remove package staging directory');
}

function retryFileSystemOperation(action, directory, operation) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      operation();
      return;
    } catch (error) {
      if (
        attempt >= fileSystemRetryDelays.length ||
        !isRetriableFileSystemError(error)
      ) {
        throw createPackageOutputAccessError(action, directory, error);
      }
      sleepSync(fileSystemRetryDelays[attempt]);
    }
  }
}

function renamePath(source, destination) {
  try {
    renameSync(source, destination);
    return;
  } catch (error) {
    if (process.platform !== 'win32' || !isRetriableFileSystemError(error)) {
      throw error;
    }

    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '& { param($source, $destination) Move-Item -LiteralPath $source -Destination $destination -Force }',
        source,
        destination,
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const fallbackError = new Error(
        [
          `PowerShell Move-Item fallback failed with exit code ${String(result.status)}.`,
          result.stderr.trim(),
        ]
          .filter(Boolean)
          .join('\n'),
        { cause: error },
      );
      fallbackError.code = error.code;
      fallbackError.path = error.path;
      fallbackError.dest = error.dest;
      fallbackError.syscall = error.syscall;
      throw fallbackError;
    }
  }
}

function isRetriableFileSystemError(error) {
  return ['EACCES', 'EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error?.code);
}

function createPackageOutputAccessError(action, directory, error) {
  if (process.platform !== 'win32' || !isRetriableFileSystemError(error)) {
    return error;
  }

  const details = [
    `Could not ${action}: ${directory}`,
    'Windows denied access while replacing the development package output.',
    'Close Kawaikara Dev, Explorer windows opened inside builds/dev, terminals with that folder as the current directory, and antivirus scans if they are holding the folder.',
    `Original error: ${error.code ?? 'UNKNOWN'} ${error.syscall ?? ''} ${
      error.path ?? directory
    }${error.dest ? ` -> ${error.dest}` : ''}`.trim(),
  ];
  return new Error(details.join('\n'), { cause: error });
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function findWindowsProcessesUsingDirectories(directories) {
  const normalizedDirectories = directories.map((directory) =>
    path.resolve(directory).toLowerCase(),
  );
  const command = [
    '$ErrorActionPreference = "Stop";',
    'Get-CimInstance Win32_Process |',
    'Select-Object ProcessId,Name,ExecutablePath,CommandLine |',
    'ConvertTo-Json -Compress',
  ].join(' ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
  );
  if (result.error || result.status !== 0 || !result.stdout.trim()) return [];

  let processes;
  try {
    const parsed = JSON.parse(result.stdout);
    processes = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }

  return processes.filter((process_) => {
    const haystack = [
      process_.ExecutablePath ?? '',
      process_.CommandLine ?? '',
    ]
      .join('\n')
      .toLowerCase();
    return normalizedDirectories.some((directory) => haystack.includes(directory));
  });
}

function formatWindowsProcesses(processes) {
  return processes
    .map((process_) => {
      const executablePath = process_.ExecutablePath || process_.CommandLine || process_.Name;
      return `- ${process_.Name} (${process_.ProcessId}): ${executablePath}`;
    })
    .join('\n');
}

function runCommand(command, arguments_, environment = process.env) {
  const result = spawnSync(command, arguments_, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    // Windows package-manager shims are .cmd files and need cmd.exe.
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${arguments_.join(' ')} failed with exit code ${String(result.status)}.`,
    );
  }
}

function launchDetached(application) {
  const child = spawn(application, [], {
    cwd: path.dirname(application),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
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
