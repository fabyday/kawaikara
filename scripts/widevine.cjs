const path = require('node:path');
const { existsSync, readdirSync } = require('node:fs');
const {
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
  verifyDevelopmentPackage();
} else {
  throw new Error('Usage: node scripts/widevine.cjs <auth|verify>');
}

function authenticate() {
  const runner = resolveEvsRunner();
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

function verifyDevelopmentPackage() {
  const platform = { darwin: 'mac', linux: 'linux', win32: 'win' }[
    process.platform
  ];
  const packageDirectory = path.join(
    root,
    'builds',
    'dev',
    platform ?? process.platform,
    process.arch,
  );
  if (!existsSync(packageDirectory)) {
    throw new Error(
      `Development package not found at ${packageDirectory}. Run \`pnpm package:dev\` first.`,
    );
  }
  const executableDirectory = findExecutableDirectory(packageDirectory);
  if (!executableDirectory) {
    throw new Error(`Packaged executable not found below ${packageDirectory}.`);
  }
  verifyPackage(executableDirectory);
  console.log(`Widevine VMP package verified: ${executableDirectory}`);
}

function findExecutableDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (
      (process.platform === 'darwin' &&
        entry.isDirectory() &&
        entry.name === 'Kawaikara Dev.app') ||
      (process.platform === 'win32' &&
        entry.isFile() &&
        entry.name === 'Kawaikara Dev.exe') ||
      (process.platform === 'linux' &&
        entry.isFile() &&
        entry.name === 'kawaikara')
    ) {
      return directory;
    }
    if (entry.isDirectory()) {
      const nested = findExecutableDirectory(entryPath);
      if (nested) return nested;
    }
  }
  return undefined;
}
