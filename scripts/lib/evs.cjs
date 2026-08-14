const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveEvsRunner() {
  const candidates = [];
  if (process.env.KAWAIKARA_EVS_PYTHON) {
    candidates.push({
      command: path.resolve(process.env.KAWAIKARA_EVS_PYTHON),
      prefix: [],
    });
  }
  candidates.push(
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    {
      command: 'conda',
      prefix: [
        'run',
        '--no-capture-output',
        '-n',
        process.env.KAWAIKARA_EVS_CONDA_ENV || 'vmp',
        'python',
      ],
    },
  );

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.command,
      [...candidate.prefix, '-c', 'import castlabs_evs'],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    if (!probe.error && probe.status === 0) return candidate;
  }

  throw new Error(
    'castlabs-evs was not found. Install it with `python3 -m pip install castlabs-evs` or set KAWAIKARA_EVS_PYTHON.',
  );
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
  resolveEvsRunner,
  runEvs,
  signPackage,
  verifyPackage,
};
