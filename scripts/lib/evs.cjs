const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveEvsRunner() {
  const candidates = [];
  const candidateKeys = new Set();
  const addCandidate = (candidate) => {
    const key = `${candidate.command}\0${candidate.prefix.join('\0')}`;
    if (candidateKeys.has(key)) return;
    candidateKeys.add(key);
    candidates.push(candidate);
  };
  if (process.env.KAWAIKARA_EVS_PYTHON) {
    addCandidate({
      command: path.resolve(process.env.KAWAIKARA_EVS_PYTHON),
      prefix: [],
      label: 'KAWAIKARA_EVS_PYTHON',
    });
  }
  if (process.env.KAWAIKARA_EVS_CONDA_ENV) {
    addCandidate({
      command: 'conda',
      prefix: [
        'run',
        '--no-capture-output',
        '-n',
        process.env.KAWAIKARA_EVS_CONDA_ENV,
        'python',
      ],
      label: `Conda environment ${process.env.KAWAIKARA_EVS_CONDA_ENV}`,
    });
  }

  for (const environmentPath of [
    process.env.VIRTUAL_ENV,
    process.env.CONDA_PREFIX,
    path.resolve(__dirname, '../../.venv-evs'),
    path.resolve(__dirname, '../../.venv'),
  ]) {
    if (!environmentPath) continue;
    addCandidate({
      command: path.join(
        environmentPath,
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
      ),
      prefix: [],
      label: `Python environment ${environmentPath}`,
    });
  }

  // `vmp` is the conventional environment name used by the Castlabs setup
  // guide and this repository's .env.example. Probe it automatically so a
  // working installation is not missed merely because the optional override
  // was omitted from .env.local.
  addCandidate({
    command: 'conda',
    prefix: ['run', '--no-capture-output', '-n', 'vmp', 'python'],
    label: 'Conda environment vmp',
  });

  for (const command of [
    'python3.13',
    'python3.12',
    'python3.11',
    'python3.10',
    'python3.9',
    'python3',
    'python',
  ]) {
    addCandidate({ command, prefix: [], label: command });
  }

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.command,
      [...candidate.prefix, '-c', 'import castlabs_evs'],
      { encoding: 'utf8', stdio: 'pipe', timeout: 15_000 },
    );
    if (!probe.error && probe.status === 0) return candidate;
  }

  throw new Error(
    [
      'castlabs-evs was not found in any discovered Python environment.',
      'Create a `vmp` Conda environment, set KAWAIKARA_EVS_CONDA_ENV, or set KAWAIKARA_EVS_PYTHON to an environment where `import castlabs_evs` succeeds.',
    ].join(' '),
  );
}

function describeEvsRunner(runner) {
  return runner.label ?? [runner.command, ...runner.prefix].join(' ');
}

function runEvs(moduleName, arguments_, options = {}) {
  const runner = options.runner ?? resolveEvsRunner();
  const result = spawnSync(
    runner.command,
    [...runner.prefix, '-m', moduleName, ...arguments_],
    {
      cwd: options.cwd,
      env: process.env,
      encoding: options.capture ? 'utf8' : undefined,
      stdio: options.capture ? 'pipe' : 'inherit',
    },
  );
  if (result.error) throw result.error;
  return {
    runner,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function verifyPackage(packageDirectory, options = {}) {
  const result = runEvs(
    'castlabs_evs.vmp',
    ['verify-pkg', packageDirectory],
    options,
  );
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Widevine VMP verification failed for ${packageDirectory}.`);
  }
  return result;
}

function signPackage(packageDirectory) {
  const runner = resolveEvsRunner();
  console.log(`Using Castlabs EVS from ${describeEvsRunner(runner)}.`);
  const existing = verifyPackage(packageDirectory, {
    allowFailure: true,
    capture: true,
    runner,
  });
  if (existing.status === 0) {
    console.log(`Widevine VMP signature is already valid: ${packageDirectory}`);
    return;
  }

  console.log(`Signing Widevine VMP package: ${packageDirectory}`);
  const arguments_ = [];
  if (process.env.CI || process.env.KAWAIKARA_EVS_NONINTERACTIVE === '1') {
    arguments_.push('--no-ask');
  }
  arguments_.push('sign-pkg', packageDirectory);
  const signed = runEvs('castlabs_evs.vmp', arguments_, { runner });
  if (signed.status !== 0) {
    throw new Error(
      'Widevine VMP signing failed. Run `pnpm widevine:auth` and try again.',
    );
  }
  verifyPackage(packageDirectory, { runner });
  console.log('Widevine VMP signing and verification completed.');
}

module.exports = {
  describeEvsRunner,
  resolveEvsRunner,
  runEvs,
  signPackage,
  verifyPackage,
};
