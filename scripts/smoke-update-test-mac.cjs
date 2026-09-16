#!/usr/bin/env node
const { spawn, execFileSync } = require('node:child_process');
const { cp, mkdir, mkdtemp, readFile, writeFile, readdir, link } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createLocalUpdateServer } = require('./local-update-server.cjs');

const root = path.resolve(__dirname, '../tests/Release');
const productName = 'Kawaikara Nightly Update Test';
const flags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (flags.some((flag) => !['--expect-signature-failure', '--manual', '--hold'].includes(flag))) throw new Error('Unknown flag.');
const expectFailure = flags.includes('--expect-signature-failure');
const manual = flags.includes('--manual');
const from = args[0] || '3.0.0-nightly.1';
const to = args[1] || '3.0.0-nightly.2';
const port = Number(process.env.KAWAIKARA_UPDATE_TEST_PORT || 18080);
for (const version of [from, to]) {
  if (!/^\d+\.\d+\.\d+-nightly\.\d+$/.test(version)) throw new Error(`Invalid test version: ${version}`);
}
if (args.length > 2 || from === to) throw new Error('Pass distinct from/to test versions.');
if (process.platform !== 'darwin') throw new Error('This smoke runner requires macOS; Windows uses the isolated NSIS installer.');

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (reason) { if (reason.code === 'ENOENT') return undefined; throw reason; }
}
async function main() {
  const fromOutput = path.join(root, 'builds', from, 'mac');
  const toOutput = path.join(root, 'builds', to, 'mac');
  const unpacked = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
  const oldApp = path.join(fromOutput, unpacked, `${productName}.app`);
  const newApp = path.join(toOutput, unpacked, `${productName}.app`);
  const requirement = '=identifier "day.faby.kawaikara.nightly.update-test"';
  for (const bundle of [oldApp, newApp]) {
    execFileSync('codesign', ['--verify', '--deep', '--strict', '--all-architectures', '-R', requirement, bundle]);
  }
  const runtimeFile = path.join(root, 'state/nightly/KawaiData/update-test-runtime.json');
  const existing = await readJson(runtimeFile);
  if (existing?.pid) {
    try {
      process.kill(existing.pid, 0);
      throw new Error('A previous test PID is still alive. Close the test app first; the runner never kills an unrelated process.');
    } catch (reason) { if (reason.code !== 'ESRCH') throw reason; }
  }
  await mkdir(path.join(root, 'apps'), { recursive: true });
  const runRoot = await mkdtemp(path.join(root, 'apps/mac-smoke-'));
  const appPath = path.join(runRoot, `${productName}.app`);
  const execPath = path.join(appPath, `Contents/MacOS/${productName}`);
  const feedRoot = path.join(runRoot, 'feed');
  await mkdir(feedRoot);
  // Hard-link immutable ZIPs/blockmaps to avoid copying another full Electron
  // runtime. Preserve the previous version's blockmap for differential updates.
  for (const output of [fromOutput, toOutput]) {
    for (const name of await readdir(output)) {
      if (/\.zip(?:\.blockmap)?$/.test(name)) await link(path.join(output, name), path.join(feedRoot, name));
    }
  }
  await cp(path.join(toOutput, 'nightly-mac.yml'), path.join(feedRoot, 'nightly-mac.yml'));
  // Node's default cp resolves framework symlinks to absolute build paths.
  // A relocatable macOS bundle must preserve their original relative targets.
  await cp(oldApp, appPath, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--all-architectures', '-R', requirement, appPath]);
  if (expectFailure) {
    // Restore the normal per-build ad-hoc requirement (CDHash-bound), which the
    // newer ZIP intentionally cannot satisfy. Never mutate either build artifact.
    execFileSync('codesign', ['--force', '--sign', '-', '--options', 'runtime',
      '--preserve-metadata=entitlements', appPath], { stdio: 'inherit' });
  }
  const preferencesFile = path.join(root, 'state/nightly/KawaiData/preferences.json');
  await mkdir(path.dirname(preferencesFile), { recursive: true });
  const preferences = await readJson(preferencesFile) || {};
  await writeFile(preferencesFile, JSON.stringify({ ...preferences, automaticUpdates: !manual, openMenuOnStartup: false }));
  // Reinstalling an old test build must also rewind its isolated ZIP baseline;
  // otherwise a previous smoke run's ZIP and this version's blockmap disagree.
  const cacheRoot = path.join(os.homedir(), 'Library/Caches/kawaikara-nightly-update-test-updater');
  const oldZip = (await readdir(fromOutput)).find((name) => name.endsWith(`-mac-${process.arch}.zip`));
  if (!oldZip) throw new Error('Missing old test ZIP.');
  await mkdir(cacheRoot, { recursive: true });
  await cp(path.join(fromOutput, oldZip), path.join(cacheRoot, 'update.zip'));
  const server = createLocalUpdateServer(feedRoot);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const startedAt = Date.now();
  let child;
  let sawOldRuntime = false;
  try {
    console.log(`Testing ${from} -> ${to}${expectFailure ? ' (expected signature rejection)' : ''}; installed test app: ${appPath}`);
    child = spawn(execPath, [], { stdio: 'inherit' });
    let spawnError;
    child.once('error', (reason) => { spawnError = reason; });
    const deadline = Date.now() + (manual ? 600_000 : 180_000);
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (!sawOldRuntime && (child.exitCode !== null || child.signalCode !== null)) {
        throw new Error(`The older test app exited before startup completed (${child.exitCode ?? child.signalCode}).`);
      }
      const runtime = await readJson(runtimeFile);
      if (runtime?.execPath === execPath && Date.parse(runtime.startedAt) >= startedAt) {
        if (runtime.version === from && runtime.pid === child.pid) sawOldRuntime = true;
        const status = await readJson(path.join(root, 'state/nightly/KawaiData/update-test-status.json'));
        if (expectFailure && sawOldRuntime && status?.pid === child.pid && Date.parse(status.updatedAt) >= startedAt
          && status.phase === 'error' && status.errorStage === 'install' && /signature|requirement/i.test(status.error)) {
          process.kill(child.pid, 0);
          console.log(`PASS: signature rejected at installation; old PID ${child.pid} remains alive.`);
          await writeFile(path.join(runRoot, 'result.json'), JSON.stringify({ from, to, runtime, status }, null, 2));
          if (flags.includes('--hold')) {
            console.log('Test app/server remain available for UI checks. Press Enter to stop them.');
            await new Promise((resolve) => { process.stdin.resume(); process.stdin.once('data', resolve); });
            process.stdin.pause();
          }
          return;
        }
        if (runtime.version === to && runtime.pid !== child.pid && sawOldRuntime) {
          if (expectFailure) throw new Error('An incompatible signature unexpectedly installed.');
          process.kill(runtime.pid, 0);
          try {
            process.kill(child.pid, 0);
            throw new Error('New version relaunched but the old process is still alive.');
          } catch (reason) { if (reason.code !== 'ESRCH') throw reason; }
          console.log(`PASS: old PID ${child.pid} replaced by relaunched PID ${runtime.pid}, version ${runtime.version}.`);
          await writeFile(path.join(runRoot, 'result.json'), JSON.stringify({ from, to, oldPid: child.pid, runtime }, null, 2));
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Update/relaunch timed out. Inspect the isolated logs under ${root}/state/nightly/KawaiData.`);
  } finally {
    // Only our own launched process or a verified relaunch at this exact test
    // executable is in scope. Never touch /Applications or production profiles.
    const runtime = await readJson(runtimeFile);
    if (runtime?.execPath === execPath && Date.parse(runtime.startedAt) >= startedAt) {
      try { process.kill(runtime.pid, 'SIGTERM'); } catch (reason) { if (reason.code !== 'ESRCH') throw reason; }
    }
    if (child?.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((reason) => { console.error(reason); process.exitCode = 1; });
