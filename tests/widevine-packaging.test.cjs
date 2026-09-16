const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { findPackageDirectories } = require('../scripts/lib/packaged-apps.cjs');

function hook(name, enabled = true, evs = {}) {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../packaging', name), 'utf8'), {
    module, exports: module.exports, console: { log() {} },
    process: { env: { KAWAIKARA_VMP_SIGN: enabled ? '1' : '0' } },
    require(id) {
      assert.equal(id, '../scripts/lib/evs.cjs');
      return {
        signPackage: (directory) => { calls.push(['sign', directory]); evs.sign?.(directory); },
        verifyPackage: (directory) => { calls.push(['verify', directory]); evs.verify?.(directory); },
      };
    },
  });
  return { run: module.exports.default, calls };
}

test('Windows VMP is signed/verified only after final EXE editing and code signing', async () => {
  let executable = 'raw';
  let signedBytes;
  const evs = { sign() { signedBytes = executable; }, verify() { assert.equal(signedBytes, executable); } };
  const before = hook('after-pack.cjs', true, evs);
  const after = hook('after-sign.cjs', true, evs);
  const context = { electronPlatformName: 'win32', appOutDir: '/isolated/win-unpacked' };
  await before.run(context);
  assert.deepEqual(before.calls, []);
  executable = 'resource-edited-and-authenticode-signed';
  await after.run(context);
  assert.deepEqual(after.calls, [['sign', context.appOutDir], ['verify', context.appOutDir]]);
});

test('macOS VMP precedes code signing; afterSign only verifies without modifying the app', async () => {
  const before = hook('after-pack.cjs');
  const after = hook('after-sign.cjs');
  const context = { electronPlatformName: 'darwin', appOutDir: '/isolated/mac-arm64' };
  await before.run(context);
  await after.run(context);
  assert.deepEqual(before.calls, [['sign', context.appOutDir]]);
  assert.deepEqual(after.calls, [['verify', context.appOutDir]]);
});

test('update-test/local-dev opt-out skips both VMP hooks', async () => {
  for (const platform of ['darwin', 'win32']) {
    for (const name of ['after-pack.cjs', 'after-sign.cjs']) {
      const fixture = hook(name, false);
      await fixture.run({ electronPlatformName: platform, appOutDir: '/isolated/output' });
      assert.deepEqual(fixture.calls, []);
    }
  }
});

test('a final VMP signing or verification failure rejects packaging', async () => {
  for (const stage of ['sign', 'verify']) {
    const fixture = hook('after-sign.cjs', true, { [stage]() { throw new Error(`${stage} failed`); } });
    await assert.rejects(fixture.run({ electronPlatformName: 'win32', appOutDir: '/isolated/output' }), /failed/);
  }
});

function directoryFixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-vmp-discovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('final verifier discovers both macOS architectures, not nested helper apps', (t) => {
  const root = directoryFixture(t);
  for (const arch of ['mac', 'mac-arm64']) {
    mkdirSync(path.join(root, arch, 'Kawaikara Nightly.app', 'Contents', 'MacOS'), { recursive: true });
    mkdirSync(path.join(root, arch, 'Kawaikara Nightly.app', 'Contents', 'Frameworks', 'Helper.app', 'Contents', 'MacOS'), { recursive: true });
  }
  assert.deepEqual(findPackageDirectories(root, 'darwin').sort(), [path.join(root, 'mac'), path.join(root, 'mac-arm64')].sort());
});

test('final verifier distinguishes unpacked Windows application from installer EXEs', (t) => {
  const root = directoryFixture(t);
  writeFileSync(path.join(root, 'Kawaikara-Nightly-win-x64.exe'), 'fake installer');
  const unpacked = path.join(root, 'win-unpacked');
  mkdirSync(path.join(unpacked, 'resources'), { recursive: true });
  writeFileSync(path.join(unpacked, 'Kawaikara Nightly.exe'), 'fake application');
  writeFileSync(path.join(unpacked, 'resources', 'app.asar'), 'fake asar');
  assert.deepEqual(findPackageDirectories(root, 'win32'), [unpacked]);
});

test('an installer without an unpacked app cannot satisfy final verification', (t) => {
  const root = directoryFixture(t);
  writeFileSync(path.join(root, 'installer.exe'), 'fake installer');
  assert.deepEqual(findPackageDirectories(root, 'win32'), []);
});

test('release configuration and both publishing workflows retain the final VMP gates', () => {
  const config = readFileSync(path.join(__dirname, '../electron-builder.config.cjs'), 'utf8');
  assert.match(config, /afterPack: 'packaging\/after-pack\.cjs'/);
  assert.match(config, /afterSign: 'packaging\/after-sign\.cjs'/);
  for (const name of ['publish-development-channel.yaml', 'publish.yaml']) {
    const source = readFileSync(path.join(__dirname, '../.github/workflows', name), 'utf8');
    const verify = source.indexOf('name: Verify final Widevine VMP signatures');
    assert.ok(verify > 0 && verify < source.indexOf('name: Collect '));
    assert.match(source.slice(verify), /pnpm widevine:verify "builds\/.*\$\{\{ matrix\.output_os \}\}/);
  }
});
