const { readFileSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadLocalEnvironment } = require('./lib/env.cjs');

const root = path.resolve(__dirname, '..');
loadLocalEnvironment(root);
const packagePath = path.join(root, 'package.json');
const channels = ['stable', 'staging', 'nightly'];
const requestedChannel = process.argv[2];
const publish = process.argv[3] || 'never';
if (!['never', 'always', 'onTag', 'onTagOrDraft'].includes(publish)) {
  throw new Error(`Unsupported publish mode: ${publish}`);
}

const originalPackage = readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(originalPackage);
const baseVersion = String(packageJson.version).split('-')[0];
const buildNumber = process.env.GITHUB_RUN_NUMBER || '0';
const tagVersion = process.env.GITHUB_REF_NAME?.startsWith('v')
  ? process.env.GITHUB_REF_NAME.slice(1)
  : undefined;
const channel =
  requestedChannel === 'auto'
    ? inferChannel(tagVersion)
    : requestedChannel;

if (!channels.includes(channel)) {
  throw new Error(`Channel must be one of: ${channels.join(', ')}`);
}
const releaseVersion =
  process.env.KAWAIKARA_RELEASE_VERSION ||
  tagVersion ||
  (channel === 'stable'
    ? baseVersion
    : `${baseVersion}-${channel}.${buildNumber}`);

validateVersion(channel, releaseVersion);
packageJson.version = releaseVersion;

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const environment = {
  ...process.env,
  KAWAIKARA_BUILD_CHANNEL: channel,
  KAWAIKARA_VMP_SIGN: '1',
};

try {
  authenticateWidevineFromEnvironment();
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  run(['build']);
  run([
    'exec',
    'electron-builder',
    '--config',
    'electron-builder.config.cjs',
    '--publish',
    publish,
  ]);
} finally {
  writeFileSync(packagePath, originalPackage);
}

function authenticateWidevineFromEnvironment() {
  const account = process.env.KAWAIKARA_EVS_ACCOUNT;
  const password = process.env.KAWAIKARA_EVS_PASSWORD;
  if (Boolean(account) !== Boolean(password)) {
    throw new Error(
      'Set both KAWAIKARA_EVS_ACCOUNT and KAWAIKARA_EVS_PASSWORD in .env.local.',
    );
  }
  if (account && password) run(['widevine:auth']);
}

function run(arguments_) {
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

function validateVersion(selectedChannel, version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${version}`);
  }
  const prerelease = version.split('-')[1]?.split('+')[0];
  if (selectedChannel === 'stable' && prerelease) {
    throw new Error('Stable releases cannot use a prerelease version.');
  }
  if (selectedChannel !== 'stable' && !prerelease?.startsWith(selectedChannel)) {
    throw new Error(
      `${selectedChannel} versions must use the -${selectedChannel}.N suffix.`,
    );
  }
}

function inferChannel(version) {
  if (!version) {
    throw new Error('The auto channel requires a v-prefixed release tag.');
  }
  if (version.includes('-nightly.')) return 'nightly';
  if (version.includes('-staging.')) return 'staging';
  return 'stable';
}
