const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createWindowsUpdateSignatureVerifier,
  isAllowedSelfSignedSignerContinuation,
} = require('../src/Main/Functional/WindowsUpdateSignature.ts');

const currentPath = 'C:\\Program Files\\Kawaikara Nightly\\Kawaikara Nightly.exe';
const updatePath = 'C:\\Users\\test\\AppData\\Local\\kawaikara-nightly-updater\\installer.exe';
const thumbprint = '85491A290034EB9CD2C42D11A293D9B6D35588D8';

function identity(path, overrides = {}) {
  return {
    path,
    status: 'UnknownError',
    thumbprint,
    subject: 'CN=fabyday',
    chainValid: true,
    chainStatus: ['UntrustedRoot'],
    ...overrides,
  };
}

function inspection(currentOverrides = {}, updateOverrides = {}) {
  return {
    current: identity(currentPath, currentOverrides),
    update: identity(updatePath, updateOverrides),
  };
}

test('accepts only the same self-signed certificate as the installed application', () => {
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection(), currentPath, updatePath, ['fabyday'],
  ), true);
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection({}, { thumbprint: '95491A290034EB9CD2C42D11A293D9B6D35588D8' }),
    currentPath,
    updatePath,
    ['fabyday'],
  ), false);
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection({}, { subject: 'CN=attacker' }), currentPath, updatePath, ['fabyday'],
  ), false);
});

test('rejects damaged signatures and certificate errors beyond an untrusted root', () => {
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection({}, { status: 'HashMismatch' }), currentPath, updatePath, ['fabyday'],
  ), false);
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection({}, { chainValid: false, chainStatus: ['UntrustedRoot', 'NotTimeValid'] }),
    currentPath,
    updatePath,
    ['fabyday'],
  ), false);
  assert.equal(isAllowedSelfSignedSignerContinuation(
    inspection({}, { path: 'C:\\Temp\\different.exe' }), currentPath, updatePath, ['fabyday'],
  ), false);
});

test('keeps the default verifier result and uses continuity only as a narrow fallback', async () => {
  const messages = [];
  const logger = {
    info: (...values) => messages.push(['info', ...values]),
    warn: (...values) => messages.push(['warn', ...values]),
  };
  let inspections = 0;
  const acceptedNormally = createWindowsUpdateSignatureVerifier(
    async () => null,
    currentPath,
    logger,
    async () => { inspections += 1; return inspection(); },
  );
  assert.equal(await acceptedNormally(['fabyday'], updatePath), null);
  assert.equal(inspections, 0);

  const acceptedByContinuity = createWindowsUpdateSignatureVerifier(
    async () => 'untrusted root',
    currentPath,
    logger,
    async () => { inspections += 1; return inspection(); },
  );
  assert.equal(await acceptedByContinuity(['fabyday'], updatePath), null);
  assert.equal(inspections, 1);
  assert.equal(messages.some(([level]) => level === 'info'), true);

  const rejected = createWindowsUpdateSignatureVerifier(
    async () => 'invalid signature',
    currentPath,
    logger,
    async () => inspection({}, { status: 'HashMismatch' }),
  );
  assert.equal(await rejected(['fabyday'], updatePath), 'invalid signature');
});
