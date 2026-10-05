const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Windows SDK is pinned to a release asset and SHA-256, never latest', () => {
  const lock = JSON.parse(read('scripts/windows-libmpv.lock.json'));
  assert.match(lock.sha256, /^[a-f0-9]{64}$/);
  assert.ok(lock.url.includes(`/releases/download/${lock.version}/`));
  assert.ok(!lock.url.includes('-v3-'));
  const script = read('scripts/setup-windows-libmpv.ps1');
  assert.doesNotMatch(script, /api\.github\.com|Invoke-RestMethod|Authorization|MaximumRetryCount/);
  assert.match(script, /if \(-not \(Test-Path -LiteralPath \$archivePath -PathType Leaf\)\)/);
  assert.ok(script.indexOf('Get-FileHash') < script.indexOf('& 7z.exe'));
  assert.match(script, /if \(\$actualHash -ne \$sdkLock.sha256\)/);
  assert.match(script, /No automatic retry was attempted/);
});

for (const workflow of ['publish.yaml', 'publish-development-channel.yaml']) {
  test(`${workflow} restores an exact cache and saves only after successful SDK validation`, () => {
    const source = read(`.github/workflows/${workflow}`);
    const restore = source.indexOf('uses: actions/cache/restore@v4');
    const install = source.indexOf('run: ./scripts/setup-windows-libmpv.ps1');
    const save = source.indexOf('uses: actions/cache/save@v4');
    assert.ok(restore >= 0 && restore < install && install < save);
    const cacheSection = source.slice(restore, source.indexOf('- run: pnpm install', save));
    assert.match(cacheSection, /hashFiles\('scripts\/windows-libmpv.lock.json'\)/);
    assert.doesNotMatch(cacheSection, /restore-keys|always\(\)|continue-on-error/);
    assert.match(cacheSection, /cache-hit != 'true'/);
  });
}
