const path = require('node:path');
const { existsSync } = require('node:fs');
const { findPackageDirectories } = require('./lib/packaged-apps.cjs');
const {
  describeEvsRunner,
  resolveEvsRunner,
  runEvs,
  verifyPackage,
} = require('./lib/evs.cjs');
const { loadLocalEnvironment } = require('./lib/env.cjs');

const root = path.resolve(__dirname, '..');
loadLocalEnvironment(root);
const command = process.argv[2];

if (command === 'auth') {
  authenticate();
} else if (command === 'verify') {
  verifyPackages(process.argv[3]);
} else {
  throw new Error('Usage: node scripts/widevine.cjs <auth|verify [package-output-directory]>');
}

function authenticate() {
  const runner = resolveEvsRunner();
  console.log(`Using Castlabs EVS from ${describeEvsRunner(runner)}.`);
  const account =
    process.env.KAWAIKARA_EVS_ACCOUNT || process.env.ACCOUNT;
  const password =
    process.env.KAWAIKARA_EVS_PASSWORD ||
    process.env.PASSWD ||
    process.env.PASSWORD;
  const arguments_ = ['reauth'];
  if (account && password) {
    arguments_.push('--account-name', account, '--passwd', password);
  }
  const result = runEvs('castlabs_evs.account', arguments_, { runner });
  if (result.status !== 0) {
    throw new Error('Castlabs EVS authentication failed.');
  }
  console.log('Castlabs EVS authentication completed.');
}

function verifyPackages(requestedDirectory) {
  const platform = { darwin: 'mac', linux: 'linux', win32: 'win' }[
    process.platform
  ];
  const packageDirectory = requestedDirectory ? path.resolve(root, requestedDirectory) : path.join(
    root,
    'builds',
    'dev',
    platform ?? process.platform,
    process.arch,
  );
  if (!existsSync(packageDirectory)) {
    throw new Error(
      `Package output not found at ${packageDirectory}. Build the requested package first.`,
    );
  }
  const executableDirectories = findPackageDirectories(packageDirectory, process.platform);
  if (executableDirectories.length === 0) {
    throw new Error(`Packaged executable not found below ${packageDirectory}.`);
  }
  for (const executableDirectory of executableDirectories) {
    verifyPackage(executableDirectory);
    console.log(`Widevine VMP package verified: ${executableDirectory}`);
  }
}
