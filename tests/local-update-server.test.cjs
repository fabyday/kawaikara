const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocalUpdateServer, parseOptions } = require('../scripts/local-update-server.cjs');

test('serves electron-builder metadata and artifacts with HEAD and byte ranges', async (context) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-update-test-'));
  const metadata = 'version: 3.0.0-nightly.local.2\nfiles:\n  - url: Kawaikara-Nightly-win-x64.exe\n';
  const macMetadata = 'version: 3.0.0-nightly.local.2\nfiles:\n  - url: Kawaikara-Nightly-mac-arm64.zip\n';
  writeFileSync(path.join(root, 'nightly.yml'), metadata);
  writeFileSync(path.join(root, 'nightly-mac.yml'), macMetadata);
  writeFileSync(path.join(root, 'Kawaikara-Nightly-win-x64.exe'), '0123456789');
  writeFileSync(path.join(root, 'Kawaikara-Nightly-mac-arm64.zip'), 'zip bytes');
  const server = createLocalUpdateServer(root);
  context.after(() => {
    server.close();
    rmSync(root, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const info = await fetch(`${base}/nightly.yml`);
  assert.equal(info.status, 200);
  assert.equal(info.headers.get('cache-control'), 'no-store');
  assert.equal(await info.text(), metadata);

  const macInfo = await fetch(`${base}/nightly-mac.yml`);
  assert.equal(macInfo.status, 200);
  assert.equal(await macInfo.text(), macMetadata);
  const macArtifact = await fetch(`${base}/Kawaikara-Nightly-mac-arm64.zip`, {
    headers: { Range: 'bytes=0-2' },
  });
  assert.equal(macArtifact.status, 206);
  assert.equal(await macArtifact.text(), 'zip');

  const head = await fetch(`${base}/Kawaikara-Nightly-win-x64.exe`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal(head.headers.get('accept-ranges'), 'bytes');

  const range = await fetch(`${base}/Kawaikara-Nightly-win-x64.exe`, {
    headers: { Range: 'bytes=3-6' },
  });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 3-6/10');
  assert.equal(await range.text(), '3456');

  const suffix = await fetch(`${base}/Kawaikara-Nightly-win-x64.exe`, {
    headers: { Range: 'bytes=-3' },
  });
  assert.equal(suffix.status, 206);
  assert.equal(await suffix.text(), '789');

  const invalid = await fetch(`${base}/Kawaikara-Nightly-win-x64.exe`, {
    headers: { Range: 'bytes=10-20' },
  });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */10');

  assert.equal((await fetch(`${base}/%2e%2e%2fprivate.key`)).status, 404);
  assert.equal((await fetch(`${base}/.env.local`)).status, 404);
  assert.equal((await fetch(`${base}/nightly.yml`, { method: 'POST' })).status, 405);
});

test('requires an explicit artifact folder and valid port', () => {
  assert.deepEqual(parseOptions(['--root', 'builds/nightly/win']), {
    root: 'builds/nightly/win', port: 18080,
  });
  assert.throws(() => parseOptions([]), /--root/);
  assert.throws(() => parseOptions(['--root', '.', '--port', '65536']), /--port/);
});
