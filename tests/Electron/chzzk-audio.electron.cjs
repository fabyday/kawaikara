const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Deterministic CHZZK-style player state persistence; no network, account or real media.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
app.setPath(
    'userData',
    mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-chzzk-audio-')),
);
app.disableHardwareAcceleration();
const script = buildSync({
    stdin: {
        resolveDir: path.resolve(__dirname, '../..'),
        loader: 'ts',
        contents: `
  import {CHZZK_AD_SKIPPER_SCRIPT} from './packages/builtin-sites/src/Providers/Chzzk/Inject/PlaybackCompatibility';
  window.skipper=CHZZK_AD_SKIPPER_SCRIPT;`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
}).outputFiles[0].text;
const timeout = setTimeout(() => app.exit(1), 20000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: { backgroundThrottling: false },
        });
        for (const initiallyMuted of [false, true]) {
            await win.loadURL('data:text/html,<main id="player"></main>');
            await win.webContents.executeJavaScript(script);
            const result = await win.webContents.executeJavaScript(`(async()=>{
      const old=document.createElement('video');document.querySelector('main').append(old);
      old.muted=${initiallyMuted};old.volume=0.37;
      let source='https://tvetamovie.pstatic.net/ad.mp4',time=0,changes=0,saved=old.muted,next;
      Object.defineProperties(old,{currentSrc:{get:()=>source},duration:{get:()=>30},
        currentTime:{get:()=>time,set:value=>{time=value}},ended:{get:()=>false}});
      old.play=async()=>{};
      await new Promise(r=>setTimeout(r,20));
      const openNext=()=>{if(next)return;next=document.createElement('video');next.muted=saved;
        next.volume=0.37;old.replaceWith(next);};
      // Sites may copy the changed audio preference into the next player before
      // the ad observer restores the detached old element.
      old.addEventListener('volumechange',()=>{saved=old.muted;changes++;openNext();});
      (0,eval)(window.skipper);
      await new Promise(r=>setTimeout(r,120));openNext();
      source='blob:content';old.dispatchEvent(new Event('emptied'));
      await new Promise(r=>setTimeout(r,60));
      return {muted:next.muted,volume:next.volume,changes,time};
    })()`);
            assert.equal(
                result.muted,
                initiallyMuted,
                'Ad skipping must not leak temporary mute into the next broadcast',
            );
            assert.equal(result.volume, 0.37);
            assert.equal(
                result.changes,
                0,
                'Ad skipping must not overwrite user audio preferences',
            );
            assert.ok(result.time >= 10, 'Ad seeking must still run');
        }
        win.destroy();
        clearTimeout(timeout);
        console.log('CHZZK ad audio preservation passed');
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(timeout);
        app.exit(1);
    });
