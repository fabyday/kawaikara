// Native libmpv seek probe using a generated silent fixture, never user media.
const { app } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { mkdtempSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-seek-'));
app.setPath('userData', profile);
const fixture = path.join(profile, 'silent-long-gop.mp4');
const generated = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=10', '-f', 'lavfi', '-i', 'anullsrc',
  '-t', '40', '-c:v', 'mpeg4', '-g', '100', '-c:a', 'aac', '-shortest', fixture], { encoding: 'utf8' });
if (generated.status !== 0) throw new Error(`ffmpeg fixture failed: ${generated.stderr || generated.error}`);
const filename = path.resolve(__dirname, '../src/Renderer/View/Video/Playback/MpvSeekQueue.ts');
const loaded = new Module(filename, module);
loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
  platform: 'node', format: 'cjs' }).outputFiles[0].text, filename);
const { MpvSeekQueue } = loaded.exports;
const nativeRoot = path.dirname(require.resolve('electron-mpv-video/package.json'));
const { MpvPlayer } = require(path.join(nativeRoot, 'native/mpv-addon/build/Release/mpv_addon.node'));
let native, pump;
const watchdog = setTimeout(() => { console.error('Native seek probe timed out'); app.exit(1); }, 25000);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  native = new MpvPlayer({ mode: 'software' });
  native.setVolume(0);
  const events = [], calls = [], failures = [];
  let loadedFile = false, playing = false, time = 0;
  const player = new EventTarget();
  Object.assign(player, {
    async pause() { calls.push('pause'); native.pause(); },
    async play() { calls.push('play'); native.play(); },
    async seek(seconds) { calls.push(seconds); native.seek(seconds); },
  });
  pump = setInterval(() => {
    native.renderFrame(160, 90);
    for (const detail of native.pollEvents()) {
      if (detail.type === 'file-loaded') loadedFile = true;
      if (detail.name === 'pause') playing = !detail.data;
      if (detail.name === 'time-pos') time = detail.data;
      if (['seek', 'playback-restart'].includes(detail.type)) events.push(detail.type);
      player.dispatchEvent(new CustomEvent('mpv-event', { detail }));
    }
  }, 10);
  native.open(fixture);
  while (!loadedFile) await wait(20);
  native.play(); await wait(400);
  const queue = new MpvSeekQueue(() => player, () => playing, () => true, error => failures.push(String(error)));
  queue.request(10, true);
  await wait(30);
  queue.request(20, true);
  queue.request(30, true);
  queue.request(30, false);
  for (let i = 0; i < 300 && !calls.includes('play') && !failures.length; i++) await wait(20);
  assert.deepEqual(failures, []);
  assert.equal(calls.filter(value => value === 'play').length, 1);
  assert.equal(calls.filter(value => value === 30).length, 1);
  assert.ok(events.includes('seek') && events.includes('playback-restart'));
  const firstTime = time;
  await wait(500);
  assert.ok(time > firstTime, `Playback must advance after seek: ${firstTime} -> ${time}`);
  assert.ok(time >= 29 && time < 33, `Final target: ${time}`);
  console.log('Native long-GOP seek probe passed', { calls, events, firstTime, time });
  queue.cancel(); clearInterval(pump); native.destroy(); native = undefined;
  clearTimeout(watchdog); app.exit(0);
}).catch(error => {
  console.error(error); clearInterval(pump); native?.destroy(); clearTimeout(watchdog); app.exit(1);
});
