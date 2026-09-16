#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const versions = process.argv.slice(2);
if (versions.length === 0) versions.push('3.0.0-nightly.1', '3.0.0-nightly.2');
if (!['darwin', 'win32'].includes(process.platform)) throw new Error('Build on macOS or Windows.');
for (const version of versions) {
  if (!/^\d+\.\d+\.\d+-nightly\.\d+$/.test(version)) throw new Error(`Invalid Nightly test version: ${version}`);
}
const env = {
  ...process.env,
  KAWAIKARA_BUILD_CHANNEL: 'nightly',
  KAWAIKARA_DISTRIBUTION_BUILD: '1',
  KAWAIKARA_UPDATE_TEST_BUILD: '1',
  KAWAIKARA_VMP_SIGN: '0',
  KAWAIKARA_REQUIRE_CODE_SIGNING: '0',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
};
// Never import distribution signing credentials into the deliberately weak
// test-signing configuration or publish anything from this workflow.
for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD']) delete env[key];
function run(args) {
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args[0]} failed (${result.status}).`);
}
run(['build']);
for (const version of versions) {
  env.KAWAIKARA_UPDATE_TEST_VERSION = version;
  run(['exec', 'electron-builder', '--config', 'electron-builder.test.config.cjs',
    process.platform === 'darwin' ? '--mac' : '--win',
    process.platform === 'darwin' ? `--${process.arch}` : '--x64', '--publish', 'never']);
  console.log(`Local test package: tests/Release/builds/${version}/${process.platform === 'darwin' ? 'mac' : 'win'}`);
}
