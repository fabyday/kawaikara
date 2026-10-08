// Manual live integration probe: the real compiled App/Provider/Plugin pipeline,
// with a temporary profile. No user cookies or existing application settings are changed.
const { app, BrowserWindow, webContents } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { resolveChzzkVideoContent } = require('../packages/builtin-sites/dist/Providers/Chzzk/Inject/VideoContent.js');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-effects-app-'));
const data = path.join(profile, 'tmp', 'kawaikara Dev', 'KawaiData');
const output = path.join(root, 'tmp', 'video-effects-verification');
fs.mkdirSync(data, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const nativeSource = path.join(root, 'dist', 'native');
if (fs.existsSync(nativeSource)) {
  const nativeTarget = path.join(profile, 'dist', 'native');
  fs.mkdirSync(nativeTarget, { recursive: true });
  for (const name of fs.readdirSync(nativeSource).filter(name=>/^kawaikara_windows_foreground(?:-[a-f0-9]+)?\.(node|json)$/.test(name))) {
    fs.copyFileSync(path.join(nativeSource,name),path.join(nativeTarget,name));
  }
}
fs.writeFileSync(path.join(data, 'preferences.json'), JSON.stringify({
  defaultSiteId: 'kawaikara.chzzk', openMenuOnStartup: false, graphicsMode: 'capture',
  automaticUpdates: false, logLevel: 'info', providerSettings: { 'kawaikara.chzzk': {
    // Allow pre-roll ads to finish naturally in this isolated GPU fixture.
    // Testing the independent ad-skip Plugin is outside this probe's scope.
    'plugins.ad-blocking': false,
    'plugins.upscaling': true, 'upscaling.engine': (process.env.EFFECT_ENGINES ?? 'anime4k').split(',')[0],
  } },
}));
app.setAppPath(profile);
// The fixture runs beside the user's original/dev windows. Native occlusion
// of this fixture must not turn a GPU integration check into a visibility test.
// This switch applies only to this test process, never the production App.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
process.argv[1] = root; // Protocol registration keeps the normal dev launch target.
const target = process.env.CHZZK_VIDEO_URL;
if (!/^https:\/\/chzzk\.naver\.com\/(live|video)\/[a-zA-Z0-9]+$/.test(target ?? '')) {
  throw Error('Set CHZZK_VIDEO_URL to the public live/VOD page under test.');
}
process.argv.push(`kawaikara://open?url=${encodeURIComponent(target)}`);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { console.error('Live App verification timed out'); app.exit(1); }, 240000);
require('../dist/main/main.js');

const snapshot = `(() => {
  const describe=v=>v&&({width:v.videoWidth,height:v.videoHeight,
    ready:v.readyState,paused:v.paused,seeking:v.seeking,time:v.currentTime,
    network:v.networkState,error:v.error?.code??null,
    buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)]),
    decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames,
    protected:!!v.mediaKeys,rect:{width:v.clientWidth,height:v.clientHeight}});
  const videos=Array.from(document.querySelectorAll('video')).map(describe);
  // Use exactly the Provider's target selection, not an unrelated ad video.
  const targetVideo=describe((${resolveChzzkVideoContent.toString()})().video);
  const canvases=Array.from(document.querySelectorAll('[data-kawaikara-video-effect]')).map(c=>{
    const r=c.getBoundingClientRect(),s=getComputedStyle(c),p=c.parentElement;
    return {id:c.dataset.kawaikaraVideoEffect,width:c.width,height:c.height,hidden:c.hidden,
      display:s.display,visibility:s.visibility,pointerEvents:s.pointerEvents,zIndex:s.zIndex,
      rect:{x:r.x,y:r.y,width:r.width,height:r.height},
      parentPosition:p&&getComputedStyle(p).position};
  });
  return {videos,targetVideo,canvases,statuses:Array.from(window.__kawaikaraEffectStatus??[]),
    registrations:window.__kawaikaraEffects?.size??0,hidden:document.hidden};
})()`;
app.whenReady().then(async () => {
  let site, overlay, initial;
  // Show only this fixture's window. A minimized/occluded document deliberately
  // suspends effects and cannot be used to assert visible presentation.
  const reveal = () => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || !window.contentView.children.some(view=>view.webContents===site)) continue;
      if (window.isMinimized()) window.restore();
      window.show();
      window.moveTop();window.focus();site.focus();
    }
  };
  const playing=result=>result?.targetVideo?.width && result.targetVideo.ready>=2 && !result.targetVideo.paused;
  for (let i=0;i<180;i++) {
    await wait(500);
    const all=webContents.getAllWebContents().filter(w=>!w.isDestroyed());
    site=all.find(w=>w.getURL()===target);
    overlay=all.find(w=>/\/renderer\/index\.html$/.test(w.getURL()));
    if (!site || !overlay) continue;
    site.setAudioMuted(true);
    reveal();
    initial=await site.executeJavaScript(snapshot);
    if (playing(initial)) break;
  }
  console.log('App source', JSON.stringify(initial));
  assert.ok(playing(initial), 'Provider-selected stream must be playing (not an ad)');
  const saved=await overlay.executeJavaScript('window.kawaikara.preferences.get()');
  const select = async (engine, graph={}) => {
    await overlay.executeJavaScript(`window.kawaikara.preferences.update(${JSON.stringify({providerSettings:{
      ...saved.providerSettings,'kawaikara.chzzk':{...saved.providerSettings['kawaikara.chzzk'],
        'plugins.upscaling':true,'upscaling.engine':engine,...graph},
    }})})`);
  };
  const statusFor=(result,engine)=>result.statuses.find(([id])=>id.split(':').includes(`upscaler.${engine}`))?.[1];
  const unsupportedReal=result=>result.targetVideo?.width*result.targetVideo?.height>640*360;
  const settled=async engine => {
    let result;
    // Ads, adaptive quality changes, and cold shader compilation are not timed
    // by a fixed sleep. Wait for real presentation or a legitimate fallback.
    for (let sample=0; sample<60; sample++) {
      reveal();
      await wait(500);
      result=await site.executeJavaScript(snapshot);
      const state=statusFor(result,engine);
      if (playing(result) && (engine==='realesrgan' && unsupportedReal(result)
        ? state?.state==='fallback' : state?.state==='applied' && state.presentedFrames>120)) return result;
      if (sample%10===9) console.log('App sample',engine,JSON.stringify(result));
    }
    // Distinguish source/CDN stalls from effect failures without claiming a pass.
    await overlay.executeJavaScript(`window.kawaikara.preferences.update(${JSON.stringify({providerSettings:{
      ...saved.providerSettings,'kawaikara.chzzk':{...saved.providerSettings['kawaikara.chzzk'],'plugins.upscaling':false},
    }})})`);
    await wait(3000);const afterOff=await site.executeJavaScript(snapshot);
    console.log('App source after failed effect OFF',JSON.stringify(afterOff));
    fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({engine,before:result,afterOff},null,2));
    throw Error(`${engine} did not settle: ${JSON.stringify(result)}`);
  };
  const results=[];
  for (const engine of (process.env.EFFECT_ENGINES ?? 'anime4k,websr,fsr1,realesrgan').split(',')) {
    await select(engine);
    const result=await settled(engine);
    console.log('App engine',engine,JSON.stringify(result));
    results.push({engine,...result});
    const state=statusFor(result,engine);
    if (engine==='realesrgan' && unsupportedReal(result)) {
      assert.equal(state?.state,'fallback','Unsupported Real-ESRGAN input must fall back');
      assert.equal(result.canvases.length,0,'Fallback must remove the output canvas');
    } else {
      assert.equal(state?.state,'applied',`${engine} must present real processed frames`);
      assert.ok(state.presentedFrames>30,`${engine} must continue beyond a single frame`);
      assert.equal(result.canvases.length,1,'One active output surface');
      assert.equal(result.canvases[0].hidden,false,'Processed output must be visible');
      assert.equal(result.canvases[0].pointerEvents,'none','Player controls must remain interactive');
    }
    // This captures the real compositor output, for manual visual comparison.
    fs.writeFileSync(path.join(output,`${engine}.png`),(await site.capturePage()).toPNG());
  }
  const graphs=[];
  if(process.env.EFFECT_GRAPH_COMPARISON==='1'){
    for(const [restore,denoise,quality] of [['off','off','high'],['soft','light','high'],['detail','medium','high'],['strong','light','high'],['strong','light','balanced']]){
      await select('anime4k',{'upscaling.anime4k.restore':restore,'upscaling.anime4k.denoise':denoise,'upscaling.anime4k.quality':quality});
      const result=await settled('anime4k');
      assert.equal(result.registrations,1);assert.equal(result.canvases.length,1);assert.equal(result.canvases[0].hidden,false);
      graphs.push({restore,denoise,quality,...result});
      console.log('App graph',restore,denoise,quality,JSON.stringify(result));
      fs.writeFileSync(path.join(output,`anime4k-${restore}-${denoise}-${quality}.png`),(await site.capturePage()).toPNG());
    }
  }
  // Check ON -> OFF with an actively rendering engine, not the Real-ESRGAN
  // fallback that intentionally has no output surface already.
  await select('fsr1');
  const beforeDisable=await settled('fsr1');
  await overlay.executeJavaScript(`window.kawaikara.preferences.update(${JSON.stringify({providerSettings:{
    ...saved.providerSettings,'kawaikara.chzzk':{...saved.providerSettings['kawaikara.chzzk'],'plugins.upscaling':false},
  }})})`);
  await wait(500);
  const disabled=await site.executeJavaScript(snapshot);
  assert.equal(disabled.registrations,0,'OFF must release the effect registration');
  assert.equal(disabled.canvases.length,0,'OFF must remove all processed output');
  assert.equal(disabled.statuses.length,0,'OFF must remove diagnostics for retired engines');
  assert.ok(playing(disabled),'Original playback must continue');
  assert.ok(disabled.targetVideo.decodedFrames>beforeDisable.targetVideo.decodedFrames,'Original video must continue decoding after OFF');
  fs.writeFileSync(path.join(output,'latest.json'),JSON.stringify({target,results,graphs,disabled},null,2));
  console.log('Live App evidence',output);
  clearTimeout(deadline); app.quit();
}).catch(error=>{console.error(error);clearTimeout(deadline);app.exit(1)});
