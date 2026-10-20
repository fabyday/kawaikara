const path = require('node:path');

/** Resolve build-only literals once; never define the entire process.env object. */
function createBuildDefinitions(root, environment = process.env) {
  const channel = environment.KAWAIKARA_BUILD_CHANNEL || 'nightly';
  if (!['stable', 'staging', 'nightly'].includes(channel)) {
    throw new Error(`Unknown KAWAIKARA_BUILD_CHANNEL: ${channel}`);
  }
  const updateTest = environment.KAWAIKARA_UPDATE_TEST_BUILD === '1';
  const testPort = Number(environment.KAWAIKARA_UPDATE_TEST_PORT || 18080);
  if (updateTest && (!Number.isInteger(testPort) || testPort < 1 || testPort > 65535)) {
    throw new Error('Invalid KAWAIKARA_UPDATE_TEST_PORT.');
  }
  return {
    __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify(channel),
    __KAWAIKARA_DISTRIBUTION_BUILD__: JSON.stringify(
      environment.KAWAIKARA_DISTRIBUTION_BUILD === '1',
    ),
    __KAWAIKARA_DISCORD_APP_ID__: JSON.stringify(
      updateTest ? '' : environment.DISCORD_APP_ID || '',
    ),
    __KAWAIKARA_UPDATE_TEST_PROFILE__: JSON.stringify(updateTest ? {
      stateRoot: path.join(root, 'tests/Release/state/nightly'),
      feedUrl: `http://127.0.0.1:${testPort}/`,
    } : null),
  };
}

module.exports = { createBuildDefinitions };
