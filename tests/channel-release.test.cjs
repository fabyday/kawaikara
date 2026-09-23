const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/channel-release.cjs');
const sourceSha = '0123456789abcdef0123456789abcdef01234567';

function resolve(channel, environment = {}) {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-release-'));
  const output = path.join(outputDirectory, 'github-output');
  const result = spawnSync(process.execPath, [script, 'resolve', channel], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: output,
      KAWAIKARA_BASE_VERSION: '3.0.0',
      KAWAIKARA_SOURCE_SHA: sourceSha,
      ...environment,
    },
  });
  return {
    result,
    values: result.status === 0 ? JSON.parse(result.stdout) : undefined,
    outputs: result.status === 0 ? readFileSync(output, 'utf8') : '',
  };
}

test('Staging uses a short sequence scoped to the base version', () => {
  const { result, values, outputs } = resolve('staging', {
    KAWAIKARA_STAGING_NUMBER: '7',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(values.version, '3.0.0-staging.7');
  assert.equal(values.tag, 'v3.0.0-staging.7');
  assert.equal(values.staging_number, '7');
  assert.match(outputs, /^version=3\.0\.0-staging\.7$/m);
});

test('Staging refuses to create an ambiguous tag without a positive sequence', () => {
  for (const value of ['', '0', '-1', 'beta']) {
    const { result } = resolve('staging', { KAWAIKARA_STAGING_NUMBER: value });
    assert.notEqual(result.status, 0);
  }
});

test('Nightly retains date, run, attempt, and source identifiers', () => {
  const { result, values } = resolve('nightly', {
    GITHUB_RUN_NUMBER: '12',
    GITHUB_RUN_ATTEMPT: '2',
    KAWAIKARA_RELEASE_DATE: '20260923',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(values.version, '3.0.0-nightly.20260923.12.2.g01234567');
  assert.equal(values.tag, 'v3.0.0-nightly.20260923.12.2.g01234567');
});

test('Staging publishing validates the short sequence tag format', () => {
  const workflow = readFileSync(
    path.join(root, '.github/workflows/publish-release-draft.yaml'),
    'utf8',
  );
  assert.match(workflow, /staging\\\.\[1-9\]\[0-9\]\*/);
  assert.doesNotMatch(workflow, /staging.*\\\.g\[0-9a-f\]/);
});
