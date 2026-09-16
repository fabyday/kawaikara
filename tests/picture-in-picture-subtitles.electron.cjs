// Real Chromium DOM probe. This process uses a fresh, isolated profile and never
// imports the application entry point, registers protocols, or starts Widevine/mpv.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-pip-subtitles-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara PiP Subtitle Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const filename = path.resolve(__dirname, '../src/Main/Inject/PictureInPictureSubtitles.ts');
const loaded = new Module(filename, module);
loaded.paths = module.paths;
loaded._compile(buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  minify: process.argv.includes('--minified'),
}).outputFiles[0].text, filename);
const { createPictureInPictureSubtitleScript } = loaded.exports;
let stage = 'initial DOM captions';
const watchdog = setTimeout(() => {
  console.error(`Subtitle Chromium probe timed out at: ${stage}`);
  app.exit(1);
}, 30000);

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ width: 600, height: 400, show: false, webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false,
  } });
  const execute = (source) => win.webContents.mainFrame.executeJavaScript(source, true);
  const apply = (scale, extra = {}) => execute(createPictureInPictureSubtitleScript({
    id: 'probe', overlaySelectors: ['.caption', 'invalid['], scale, ...extra,
  }));
  const size = (id) => execute(`parseFloat(getComputedStyle(document.getElementById(${JSON.stringify(id)})).fontSize)`);
  const flush = () => execute('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <style>body *{visibility:hidden!important}.caption{font-size:20px;line-height:24px}
    .small{font-size:12px;line-height:16px}#other{font-size:28px}.responsive{font-size:2vw}</style>
    <video id="video"></video><video id="other-video"></video>
    <div id="caption" class="caption">Parent text <span id="small" class="small">Small</span>
    <span id="inherited">Inherited</span><span id="styled" style="font-size:18px!important;line-height:22px!important;color:red">Styled</span></div>
    <p id="other">Unrelated text</p><div id="responsive" class="caption responsive">Responsive</div>
    <div id="shadow-host"></div>
  `)}`);
  await execute(`window.__kawaikaraUnifiedPictureInPicture={video:document.getElementById('video')};
    window.originalStyled=document.getElementById('styled').getAttribute('style');
    const shadow=document.getElementById('shadow-host').attachShadow({mode:'open'});
    shadow.innerHTML='<style>.caption{font-size:22px;line-height:26px}</style><div class="caption" id="shadow-caption">Shadow text</div>';`);
  const baseResponsive = await size('responsive');
  await apply(1.5);
  assert.equal(await size('caption'), 30);
  assert.equal(await size('small'), 18);
  assert.equal(await size('inherited'), 30, 'nested inherited fonts must not scale twice');
  assert.equal(await size('styled'), 27);
  assert.equal(await size('other'), 28, 'unrelated text must remain untouched');
  assert.equal(await execute(`parseFloat(getComputedStyle(document.getElementById('shadow-host').shadowRoot.getElementById('shadow-caption')).fontSize)`), 33);
  assert.equal(await execute(`getComputedStyle(document.getElementById('small')).visibility`), 'visible');
  assert.equal(await execute(`getComputedStyle(document.getElementById('other')).visibility`), 'hidden');
  assert.ok(Math.abs(await size('responsive') - baseResponsive * 1.5) < 0.1);
  await apply(1.5);
  await flush();
  assert.equal(await size('caption'), 30, 'repeat updates must be absolute, not compounded');
  assert.equal(await size('small'), 18);

  await execute(`const node=document.createElement('span');node.id='new-caption';node.textContent='New cue';document.getElementById('caption').appendChild(node);`);
  await flush();
  assert.equal(await size('new-caption'), 30, 'SPA-created captions must use the current scale');
  await execute(`document.getElementById('styled').style.setProperty('font-size','40px','important');
    document.getElementById('styled').style.color='blue';`);
  await flush();
  assert.equal(await size('styled'), 60, 'site-originated font changes become the new base');
  await apply(0.5);
  assert.equal(await size('caption'), 10);
  assert.equal(await size('styled'), 20);
  await apply(1);
  assert.equal(await size('caption'), 20);
  assert.equal(await size('styled'), 40);
  assert.equal(await execute(`document.getElementById('caption').style.getPropertyValue('font-size')`), '', '100% leaves fonts unmodified, but App positioning stays active');
  await apply(1.5);
  assert.equal(await execute(`document.getElementById('video').hasAttribute('data-kawaikara-subtitles-probe')`), true);
  assert.equal(await execute(`document.getElementById('other-video').hasAttribute('data-kawaikara-subtitles-probe')`), false);
  assert.match(await execute(`document.querySelector('[data-kawaikara-subtitle-style]').textContent`), /video\[data-kawaikara-subtitles-probe\]::cue/);

  await execute(`const host=document.createElement('div');document.body.appendChild(host);
    window.lateShadow=host.attachShadow({mode:'open'});
    lateShadow.innerHTML='<style>.caption{font-size:16px}</style><span class="caption" id="late">Late shadow cue</span>';
    const replacement=document.createElement('video');replacement.id='replacement-video';document.body.appendChild(replacement);
    window.__kawaikaraUnifiedPictureInPicture.video=replacement;
    document.dispatchEvent(new Event('kawaikara:picture-in-picture-transition'));`);
  await flush();
  assert.equal(await execute(`parseFloat(getComputedStyle(lateShadow.getElementById('late')).fontSize)`), 24);
  assert.equal(await execute(`document.getElementById('video').hasAttribute('data-kawaikara-subtitles-probe')`), false);
  assert.equal(await execute(`document.getElementById('replacement-video').hasAttribute('data-kawaikara-subtitles-probe')`), true);
  win.setContentSize(800, 500);
  await flush();
  assert.ok(Math.abs(await size('responsive') - await execute('innerWidth * 0.02 * 1.5')) < 0.1, 'viewport changes remeasure unscaled typography');

  await execute(createPictureInPictureSubtitleScript({ id: 'probe' }));
  await execute(createPictureInPictureSubtitleScript({ id: 'probe' }));
  assert.equal(await size('caption'), 20);
  assert.equal(await size('small'), 12);
  assert.equal(await size('inherited'), 20);
  assert.equal(await size('styled'), 40);
  assert.equal(await execute(`document.getElementById('caption').hasAttribute('style')`), false);
  assert.equal(await execute(`document.getElementById('styled').style.getPropertyPriority('font-size')`), 'important');
  assert.equal(await execute(`document.getElementById('styled').style.color`), 'blue');
  assert.equal(await execute(`document.querySelectorAll('[data-kawaikara-subtitle-style]').length`), 0);
  assert.equal(await execute(`Object.keys(window.__kawaikaraPictureInPictureSubtitles ?? {}).length`), 0);
  assert.equal(await execute(`lateShadow.querySelectorAll('[data-kawaikara-subtitle-style]').length`), 0);
  assert.equal(await execute(`document.getElementById('replacement-video').hasAttribute('data-kawaikara-subtitles-probe')`), false);
  await execute(`document.getElementById('caption').appendChild(document.createTextNode('After exit'));`);
  await flush();
  assert.equal(await size('caption'), 20, 'observers must stay stopped after disposal');
  await execute(`new Promise(resolve => {
    const iframe=document.createElement('iframe');iframe.id='player-frame';
    iframe.srcdoc='<style>.caption{font-size:13px}</style><video id="child-video"></video><div class="caption"><span id="explicit">Selected cue</span><span id="unchanged">Other text</span></div>';
    iframe.onload=resolve;document.body.appendChild(iframe);
  })`);
  const child = win.webContents.mainFrame.frames[0];
  await child.executeJavaScript(`window.__kawaikaraUnifiedPictureInPicture={video:document.getElementById('child-video')}`, true);
  await child.executeJavaScript(createPictureInPictureSubtitleScript({
    id: 'child', scale: 2, overlaySelectors: ['.caption'], textSelectors: ['#explicit'], nativeCues: false,
  }), true);
  assert.equal(await child.executeJavaScript(`parseFloat(getComputedStyle(document.getElementById('explicit')).fontSize)`), 26);
  assert.equal(await child.executeJavaScript(`parseFloat(getComputedStyle(document.getElementById('unchanged')).fontSize)`), 13);
  assert.equal(await size('caption'), 20, 'iframe-scoped scripts cannot resize host captions');
  assert.equal(await child.executeJavaScript(`document.getElementById('child-video').hasAttribute('data-kawaikara-subtitles-child')`), false);
  await child.executeJavaScript(createPictureInPictureSubtitleScript({ id: 'child' }), true);
  assert.equal(await child.executeJavaScript(`parseFloat(getComputedStyle(document.getElementById('explicit')).fontSize)`), 13);

  stage = '200% video-relative positioning';
  // Reproduce cached YouTube-like window coordinates, nowrap, and stale widths.
  // A real canvas video supplies decoded dimensions for letterbox bounds.
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <style>body{margin:0}#layout-video{position:fixed;left:40px;top:40px;width:400px;height:300px;object-fit:contain}
    .ytp-caption-window-container{position:absolute;left:7px;top:5px;width:100px;height:300px;overflow:hidden}
    .caption-window{position:absolute;left:130px;top:240px;width:90px;white-space:nowrap;transform:translate(-25px,12px);translate:calc(3px + 1%) 7px;text-align:left;overflow:hidden}
    .ytp-caption-segment{font-size:20px;line-height:24px;white-space:nowrap;background:black;color:white}
    .bottom-caption{position:fixed;left:20px;bottom:35px;width:90px;white-space:nowrap;transform:translate(-30px,-11px);translate:9px 6px;font-size:20px;line-height:24px;text-align:left}
    #unrelated-layout{position:absolute;left:11px;top:12px;width:50px;text-align:left;white-space:nowrap}</style>
    <video id="layout-video" muted></video><video id="unselected-video"></video>
    <div class="ytp-caption-window-container" id="layout-root"><div class="caption-window" id="layout-window"><span class="ytp-caption-segment" id="layout-text">Centered caption</span></div></div>
    <div class="bottom-caption" id="bottom-caption">Bottom anchored</div>
    <div id="unrelated-layout">Outside caption</div>
  `)}`);
  await execute(`new Promise(async (resolve, reject) => {
    const video=document.getElementById('layout-video');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    canvas.getContext('2d').fillRect(0,0,640,360);
    window.layoutStream=canvas.captureStream(1);video.srcObject=layoutStream;
    try { await video.play(); resolve(); } catch(error) { reject(error); }
  })`);
  await execute(`window.__kawaikaraUnifiedPictureInPicture={video:document.getElementById('layout-video')};
    window.originalLayouts={};
    for(const id of ['layout-root','layout-window','layout-text','bottom-caption','unrelated-layout']) originalLayouts[id]=document.getElementById(id).getAttribute('style');
    window.originalWindowTop=document.getElementById('layout-window').getBoundingClientRect().top;
    window.originalWindowTranslation=getComputedStyle(document.getElementById('layout-window')).translate;
    window.originalBottom=document.getElementById('bottom-caption').getBoundingClientRect().bottom;
    const track=document.getElementById('layout-video').addTextTrack('subtitles','Test','en');track.mode='showing';
    window.nativeCue=new VTTCue(0,3600,'Native caption');nativeCue.align='left';nativeCue.position=20;
    window.hasNativePositionAlign='positionAlign' in nativeCue;
    if(hasNativePositionAlign) nativeCue.positionAlign='line-left';nativeCue.size=40;nativeCue.line=3;track.addCue(nativeCue);
    window.nativeTrack=track;
    window.verticalCue=new VTTCue(0,3600,'Vertical');verticalCue.vertical='rl';verticalCue.align='start';verticalCue.position=20;track.addCue(verticalCue);
    window.regionCue=null;
    if(typeof VTTRegion==='function') { regionCue=new VTTCue(0,3600,'Region');regionCue.region=new VTTRegion();regionCue.align='left';regionCue.position=20;track.addCue(regionCue); }
    window.unselectedCue=new VTTCue(0,3600,'Unselected');unselectedCue.align='left';unselectedCue.position=20;
    const otherTrack=document.getElementById('unselected-video').addTextTrack('subtitles');otherTrack.mode='showing';otherTrack.addCue(unselectedCue);`);
  await flush();
  const layoutApply = (scale, extra = {}) => execute(createPictureInPictureSubtitleScript({
    id: 'layoutprobe', scale, overlaySelectors: ['.ytp-caption-window-container','.caption-window','.ytp-caption-segment','.bottom-caption'], ...extra,
  }));
  const geometry = () => execute(`(() => {
    const root=document.getElementById('layout-root'),box=root.getBoundingClientRect();
    const text=document.getElementById('layout-text'),range=document.createRange();range.selectNodeContents(text);
    const line=range.getBoundingClientRect();
    return {center:box.left+box.width/2,width:box.width,left:box.left,right:box.right,top:box.top,bottom:box.bottom,
      textCenter:line.left+line.width/2,textLeft:line.left,textRight:line.right,textHeight:line.height,
      textAlign:getComputedStyle(text).textAlign,windowPosition:getComputedStyle(document.getElementById('layout-window')).position,
      windowTop:document.getElementById('layout-window').getBoundingClientRect().top,
      font:parseFloat(getComputedStyle(text).fontSize)};
  })()`);
  await layoutApply(2);
  await flush();
  let box = await geometry();
  assert.equal(box.font, 40);
  assert.ok(Math.abs(box.center - 240) < 1, 'caption box must center on the displayed image, not cached site coordinates');
  assert.ok(Math.abs(box.textCenter - box.center) < 1, '200% glyphs must also be centered');
  assert.ok(box.left >= 40 && box.right <= 440);
  assert.equal(box.top, 5, 'App must not move the outer caption layer vertically');
  assert.equal(box.windowTop, await execute('originalWindowTop'), 'nested top anchor and both vertical translations are preserved at 200%');
  assert.equal(await execute(`getComputedStyle(document.getElementById('layout-root')).height`), '300px', 'site-owned vertical container dimensions are retained');
  assert.equal(await execute(`document.getElementById('layout-root').style.top`), '', 'App does not override top');
  assert.equal(await execute(`document.getElementById('layout-root').style.bottom`), '', 'App does not invent a bottom anchor');
  assert.equal(box.textAlign, 'center');
  assert.equal(box.windowPosition, 'absolute', 'nested windows keep the site positioning model');
  const bottomGeometry = () => execute(`(() => {const element=document.getElementById('bottom-caption'),rect=element.getBoundingClientRect();
    return {center:rect.left+rect.width/2,bottom:rect.bottom,top:rect.top,height:rect.height};})()`);
  assert.ok(Math.abs((await bottomGeometry()).center - 240) < 1);
  assert.equal((await bottomGeometry()).bottom, await execute('originalBottom'), 'existing bottom anchor and vertical transforms remain intact');
  const enlargedTop = (await bottomGeometry()).top;
  await layoutApply(1);
  assert.equal((await bottomGeometry()).bottom, await execute('originalBottom'), '100% also preserves the bottom anchor');
  assert.ok((await bottomGeometry()).top > enlargedTop, 'bottom-anchored captions grow upward instead of moving to an App baseline');
  await layoutApply(2);
  assert.equal(await execute(`getComputedStyle(document.getElementById('unrelated-layout')).textAlign`), 'left');
  assert.equal(await execute(`nativeCue.align`), 'center');
  assert.equal(await execute(`nativeCue.position`), 50);
  assert.equal(await execute(`nativeCue.size`), 92);
  assert.equal(await execute(`nativeCue.line`), 3, 'native vertical/speaker placement is preserved');
  assert.equal(await execute(`verticalCue.align`), 'start');
  assert.equal(await execute(`regionCue?.position ?? 20`), 20);
  assert.equal(await execute(`unselectedCue.align`), 'left');

  stage = 'long-caption wrapping';
  await execute(`document.getElementById('layout-text').textContent='A long caption that must wrap when font size reaches two hundred percent, including SuperLongUnbrokenCaptionWordThatWouldOtherwiseOverflow';`);
  await flush();
  box = await geometry();
  assert.ok(box.textLeft >= box.left - 1 && box.textRight <= box.right + 1, 'nowrap and unbroken words must not overflow horizontally');
  assert.ok(box.textHeight > 40, 'large captions wrap onto multiple lines');
  assert.equal(box.windowTop, await execute('originalWindowTop'), 'wrapping does not replace the existing vertical anchor');
  await layoutApply(2);
  assert.ok(Math.abs((await geometry()).center - 240) < 1, 'repeated updates must not compound offsets');
  stage = 'video resize and native cue changes';
  await execute(`document.getElementById('layout-video').style.left='80px';document.getElementById('layout-video').style.width='300px';
    document.getElementById('layout-video').dispatchEvent(new Event('resize'));
    document.getElementById('layout-window').style.color='rgb(0, 0, 255)';
    document.getElementById('layout-window').style.top='80px';
    window.newNativeCue=new VTTCue(0,3600,'New native cue');newNativeCue.align='right';newNativeCue.position=80;nativeTrack.addCue(newNativeCue);`);
  await flush();
  box = await geometry();
  assert.ok(Math.abs(box.center - 230) < 1, 'video geometry changes recenter captions');
  assert.equal(box.windowTop, 104, 'live site changes to top remain authoritative, including original Y translations');
  assert.equal((await bottomGeometry()).bottom, await execute('originalBottom'), 'video resize does not reset vertical placement');
  assert.equal(await execute(`newNativeCue.align`), 'center', 'cuechange/addition receives automatic alignment');
  stage = 'caption layout restoration';
  await execute(createPictureInPictureSubtitleScript({ id: 'layoutprobe' }));
  assert.equal(await execute(`document.getElementById('layout-root').getAttribute('style')`), null);
  assert.equal(await execute(`document.getElementById('layout-text').getAttribute('style')`), null);
  assert.equal(await execute(`document.getElementById('bottom-caption').getAttribute('style')`), null);
  assert.equal(await execute(`document.getElementById('layout-window').style.color`), 'rgb(0, 0, 255)', 'unrelated live site changes survive cleanup');
  assert.equal(await execute(`getComputedStyle(document.getElementById('layout-window')).position`), 'absolute');
  assert.equal(await execute(`getComputedStyle(document.getElementById('layout-window')).whiteSpace`), 'nowrap');
  assert.equal(await execute(`document.getElementById('layout-window').style.top`), '80px', 'site-written vertical position survives cleanup');
  assert.equal(await execute(`getComputedStyle(document.getElementById('layout-window')).translate`), await execute('originalWindowTranslation'), 'original calc()/percentage X and vertical translation are restored');
  assert.equal(await execute(`nativeCue.align`), 'left');
  assert.equal(await execute(`nativeCue.position`), 20);
  assert.equal(await execute(`hasNativePositionAlign ? nativeCue.positionAlign : 'unsupported'`),
    await execute(`hasNativePositionAlign ? 'line-left' : 'unsupported'`));
  assert.equal(await execute(`nativeCue.size`), 40);
  assert.equal(await execute(`newNativeCue.align`), 'right');
  await layoutApply(2, { layout: 'preserve' });
  assert.equal(await execute(`getComputedStyle(document.getElementById('layout-window')).position`), 'absolute', 'custom Provider positioning can opt out');
  assert.equal(await execute(`nativeCue.align`), 'left');
  await execute(createPictureInPictureSubtitleScript({ id: 'layoutprobe' }));
  await execute(`layoutStream.getTracks().forEach(track=>track.stop())`);

  stage = 'YouTube rolling captions and Provider alignment';
  win.setContentSize(640, 480);
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <style>body{margin:0}video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain}
    .ytp-caption-window-container{position:fixed;inset:0;overflow:hidden}
    .caption-window{position:absolute;left:170px;bottom:2px;width:240px;height:24px;overflow:hidden;transform:translate(17px,10px)}
    .caption-lines{transform:translateY(-48px)}.line{display:block;font:20px/24px sans-serif;color:white;background:rgb(0 0 0 / 65%)}</style>
    <video id="rolling-video" muted></video><div class="ytp-caption-window-container" id="rolling-layer">
    <div class="caption-window ytp-caption-window-bottom" id="rolling-window"><div class="caption-lines" id="rolling-lines">
    <div class="line"><span class="ytp-caption-segment">Previous one</span></div>
    <div class="line"><span class="ytp-caption-segment">Previous two</span></div>
    <div class="line"><span class="ytp-caption-segment">Current sentence</span></div>
    </div></div></div>
  `)}`);
  await execute(`new Promise(resolve => {
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    const context=canvas.getContext('2d');context.fillStyle='#243244';context.fillRect(0,0,160,90);
    window.rollingStream=canvas.captureStream(5);
    const video=document.getElementById('rolling-video');video.srcObject=rollingStream;
    video.onloadeddata=()=>video.play().then(resolve);
  })`);
  await execute(`window.__kawaikaraUnifiedPictureInPicture={video:document.getElementById('rolling-video')};
    window.rollingNativeCue=new VTTCue(0,3600,'Native companion');rollingNativeCue.line=3;
    window.nativeBottomSupported=typeof rollingNativeCue.lineAlign==='string';
    window.originalNativeLineAlign=rollingNativeCue.lineAlign;
    window.rollingTrack=document.getElementById('rolling-video').addTextTrack('subtitles');
    rollingTrack.mode='showing';rollingTrack.addCue(rollingNativeCue);`);
  const { YouTubeProvider } = require('../packages/builtin-sites/dist/Providers/YouTube/Provider.js');
  let youtubeOptions;
  new YouTubeProvider({}).createPictureInPictureSubtitleController({ url: 'https://www.youtube.com/watch?v=fixture',
    createDomSubtitleController(options) { youtubeOptions = options; return { setScale() {}, dispose() {} }; },
  });
  const rollingApply = scale => execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'rollingprobe', scale }));
  const rollingGeometry = () => execute(`(() => {
    const box=document.getElementById('rolling-window'),rect=box.getBoundingClientRect(),css=getComputedStyle(box);
    const text=document.querySelector('#rolling-lines .ytp-caption-segment'),lines=document.getElementById('rolling-lines');
    return {center:rect.left+rect.width/2,bottom:rect.bottom,top:rect.top,height:rect.height,
      baseHeight:box.clientHeight,overflowY:css.overflowY,font:parseFloat(getComputedStyle(text).fontSize),
      rows:lines.children.length,scrollTransform:getComputedStyle(lines).transform,
      internalStyle:lines.getAttribute('style'),layerHeight:document.getElementById('rolling-layer').clientHeight};
  })()`);
  const originalRolling = await rollingGeometry();
  await rollingApply(1);
  await flush();
  let rolling = await rollingGeometry();
  assert.ok(Math.abs(rolling.center - 320) < 1);
  assert.ok(Math.abs(rolling.bottom - (420 - 360 * 0.08)) < 1, 'bottom inset uses the displayed image, excluding letterbox bars');
  assert.equal(rolling.overflowY, 'hidden', 'previous rolling rows remain clipped');
  assert.equal(rolling.rows, originalRolling.rows, 'the App does not append caption text');
  assert.equal(rolling.scrollTransform, originalRolling.scrollTransform);
  assert.equal(rolling.internalStyle, originalRolling.internalStyle, 'inner scrolling layer stays untouched');
  assert.equal(rolling.layerHeight, originalRolling.layerHeight, 'full-player container is not collapsed into a caption box');
  const baseline = rolling.bottom;
  await rollingApply(2);
  await flush();
  rolling = await rollingGeometry();
  assert.equal(rolling.font, 20, 'box scaling leaves player-readable font metrics unmultiplied');
  assert.equal(rolling.baseHeight, 24, 'cached clipping height remains in player coordinates');
  assert.equal(rolling.height, 48, 'visible caption window scales exactly once despite overlapping selectors');
  assert.ok(Math.abs(rolling.bottom - baseline) < 1, '200% grows upward, without losing the bottom gap');
  assert.ok(Math.abs(rolling.center - 320) < 1);
  await execute(`document.getElementById('rolling-window').style.transition='translate 160ms linear, scale 160ms linear';`);
  await flush();
  await execute(`document.querySelector('#rolling-lines .ytp-caption-segment').textContent='Transition regression';`);
  await flush();
  assert.equal(await execute(`document.getElementById('rolling-window').getAnimations().filter(animation =>
    animation instanceof CSSTransition && ['translate','scale'].includes(animation.transitionProperty)).length`), 0,
  'partial caption updates must not restart placement/scale transitions and flicker');
  rolling = await rollingGeometry();
  assert.ok(Math.abs(rolling.center - 320) < 1, 'caption center stays stable through player CSS transitions');
  await execute(`document.getElementById('rolling-window').style.transition='';`);
  await flush();
  await execute(`window.captionLayoutReads=0;
    const originalRect=Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect=function(){
      if(this.id==='rolling-window') window.captionLayoutReads++;
      return originalRect.call(this);
    };
    const captionWindow=document.getElementById('rolling-window');
    for(let index=0;index<20;index++) captionWindow.style.setProperty('height','24px');`);
  await flush();
  assert.equal(await execute('captionLayoutReads'), 0, 'identical source inline writes cannot trigger caption layout feedback');
  await execute(`window.captionStyleWrites=0;
    window.captionDiscoveryQueries=0;
    const originalCaptionQuery=Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll=function(selector){
      if(selector.includes('caption-window')) window.captionDiscoveryQueries++;
      return originalCaptionQuery.call(this,selector);
    };
    const originalSetProperty=CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty=function(...args){
      if(this===document.getElementById('rolling-window').style) window.captionStyleWrites++;
      return originalSetProperty.apply(this,args);
    };
    captionLayoutReads=0;(async()=>{
    for(let index=0;index<6;index++) {
      document.querySelector('#rolling-lines .ytp-caption-segment').textContent='Earlier '+index;
      await Promise.resolve();
    }
  })()`);
  await flush();
  assert.ok(await execute('captionLayoutReads') <= 3, 'microtask caption bursts coalesce into one layout before paint');
  assert.equal(await execute('captionStyleWrites'), 0, 'text-only updates do not rewrite unchanged placement/scale properties');
  assert.equal(await execute('captionDiscoveryQueries'), 0, 'native text updates do not trigger App caption discovery/layout passes');
  await rollingApply(3);
  await flush();
  rolling = await rollingGeometry();
  assert.equal(rolling.height, 72, '300% scales the visible caption window exactly once');
  assert.equal(rolling.font, 20, '300% leaves source font metrics unmultiplied');
  assert.equal(rolling.baseHeight, 24);
  assert.ok(Math.abs(rolling.center - 320) < 1, '300% stays horizontally centered');
  assert.ok(Math.abs(rolling.bottom - baseline) < 1, '300% retains the image-relative bottom gap');
  stage = 'PiP size, font, and source-anchor alignment matrix';
  let alignmentCases = 0;
  let maximumCenterError = 0;
  for (const [width,height] of [[320,180],[384,216],[512,288],[640,360],[960,540],[640,480],[480,480],[432,768]]) {
    win.setContentSize(width,height);
    await flush();
    for (const font of [12,20,32]) {
      for (const multiplier of [0.5,1,1.5,2,2.5,3]) {
        await execute(`(() => {
          const box=document.getElementById('rolling-window');
          // Native players can cache a negative half-width margin, and switch
          // their percentage transform reference while fonts/viewports change.
          box.style.cssText='width:280px;height:${font*1.2}px;left:50%;margin-left:-140px;margin-right:19px;'+
            'padding:3px 12px;border:2px solid transparent;transform-box:content-box';
          for(const row of document.querySelectorAll('#rolling-lines .line')) {
            row.style.fontSize='${font}px';row.style.lineHeight='${font*1.2}px';
          }
          document.getElementById('rolling-lines').style.transform='translateY(-${font*2.4}px)';
          // Keep this glyph probe within even the smallest content box. Long
          // native lines remain clipped/wrapped by the player, not rewritten.
          document.querySelector('#rolling-lines .line:last-child .ytp-caption-segment').textContent='Hi';
        })()`);
        await rollingApply(multiplier);
        await flush();
        const sample=await execute(`(() => {
          const box=document.getElementById('rolling-window'),rect=box.getBoundingClientRect();
          const glyph=document.querySelector('#rolling-lines .line:last-child .ytp-caption-segment').getBoundingClientRect();
          const imageWidth=Math.min(innerWidth,innerHeight*16/9);
          return {center:rect.left+rect.width/2,glyphCenter:glyph.left+glyph.width/2,left:rect.left,right:rect.right,
            imageLeft:(innerWidth-imageWidth)/2,imageRight:(innerWidth+imageWidth)/2};
        })()`);
        const error=Math.abs(sample.center-width/2);
        maximumCenterError=Math.max(maximumCenterError,error);
        assert.ok(error<1 && Math.abs(sample.glyphCenter-width/2)<1,
          `caption/glyph center drift at ${width}x${height}, font ${font}px, scale ${multiplier}: ${JSON.stringify(sample)}`);
        assert.ok(sample.left>=sample.imageLeft-1 && sample.right<=sample.imageRight+1,
          `scaled caption must fit the displayed image: ${JSON.stringify(sample)}`);
        alignmentCases++;
      }
    }
  }
  console.log(JSON.stringify({alignmentCases,maximumCenterError}));
  stage = 'responsive geometry without a subtitle RAF';
  await rollingApply(3);
  await flush();
  await execute(`window.savedCaptionRaf=requestAnimationFrame;
    window.heldCaptionFrames=[];window.heldCaptionFrameId=100000;
    window.requestAnimationFrame=callback=>{heldCaptionFrames.push(callback);return ++heldCaptionFrameId};`);
  for (const [width,height] of [[320,180],[960,180],[432,768],[480,480],[640,360],[640,480]]) {
    win.setContentSize(width,height);
    await execute('new Promise(resolve=>setTimeout(resolve,30))');
    const sample=await execute(`(() => {
      const rect=document.getElementById('rolling-window').getBoundingClientRect();
      const imageWidth=Math.min(innerWidth,innerHeight*16/9),imageHeight=Math.min(innerHeight,innerWidth*9/16);
      const imageBottom=(innerHeight+imageHeight)/2;
      const gap=Math.max(imageHeight*.08,Math.min(imageHeight*.25,12));
      return {width:innerWidth,height:innerHeight,center:rect.left+rect.width/2,left:rect.left,right:rect.right,
        bottom:rect.bottom,expectedBottom:imageBottom-gap,imageLeft:(innerWidth-imageWidth)/2,imageRight:(innerWidth+imageWidth)/2};
    })()`);
    assert.equal(sample.width,width);assert.equal(sample.height,height);
    assert.ok(Math.abs(sample.center-width/2)<1 && Math.abs(sample.bottom-sample.expectedBottom)<1,
      `native resizing must not retain stale pixel anchors when App RAF is held: ${JSON.stringify(sample)}`);
    assert.ok(sample.left>=sample.imageLeft-1 && sample.right<=sample.imageRight+1);
  }
  await execute(`window.requestAnimationFrame=savedCaptionRaf;delete window.heldCaptionFrames;`);
  win.setContentSize(640,480);
  await execute(`document.getElementById('rolling-window').style.cssText='';
    for(const row of document.querySelectorAll('#rolling-lines .line')) row.style.cssText='';
    document.getElementById('rolling-lines').style.cssText='';`);
  await rollingApply(3);
  await flush();
  stage = 'CSS video box resize without a window/intrinsic resize';
  await execute(`document.getElementById('rolling-video').style.cssText=
    'left:40px;top:60px;right:auto;bottom:auto;width:320px;height:180px';`);
  await flush();await flush();
  rolling=await rollingGeometry();
  assert.ok(Math.abs(rolling.center-200)<1 && Math.abs(rolling.bottom-(240-180*.08))<1,
    'ResizeObserver tracks an offset video CSS box even when intrinsic dimensions and window size are unchanged');
  await execute(`document.getElementById('rolling-video').style.cssText=''`);
  await flush();await flush();
  const paintSamples = [];
  for (let index = 0; index < 6; index++) {
    paintSamples.push(await execute(`new Promise(resolve=>requestAnimationFrame(()=>{
      const box=document.getElementById('rolling-window');
      // YouTube may rewrite the entire inline layout during a caption/player RAF.
      // Sample after the mutation microtask, but before the next rendering frame.
      box.style.cssText='height:24px;left:${90 + index * 13}px;bottom:2px;transform:translate(17px,10px)';
      queueMicrotask(()=>{
        const rect=box.getBoundingClientRect();
        resolve({center:rect.left+rect.width/2,bottom:rect.bottom,height:rect.height});
      });
    }))`));
    await flush();
  }
  assert.ok(paintSamples.every(sample=>Math.abs(sample.center-320)<1 &&
    Math.abs(sample.bottom-baseline)<1 && Math.abs(sample.height-72)<1),
  `source layout rewrites must not expose an unscaled/misaligned frame: ${JSON.stringify(paintSamples)}`);
  assert.equal(await execute(`document.getElementById('rolling-window').style.scale`), '',
    'the App never writes caption-window inline scale');
  await execute(`document.getElementById('rolling-window').style.opacity='0.4'`);
  await flush();
  assert.equal(await execute(`getComputedStyle(document.getElementById('rolling-window')).opacity`), '0.4',
    'player-owned opacity/appearance is not replaced by an App fade');
  await execute(`document.getElementById('rolling-window').style.opacity=''`);
  if (process.argv.includes('--screenshot')) {
    const screenshot = path.join(profile, 'youtube-rolling-captions.png');
    writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    console.log(`Screenshot: ${screenshot}`);
  }
  for (let index = 0; index < 8; index++) {
    await execute(`(() => {
      const lines=document.getElementById('rolling-lines'),row=document.createElement('div');row.className='line';
      row.innerHTML='<span class="ytp-caption-segment">Partial cue ${index}</span>';lines.appendChild(row);
      const lineHeight=parseFloat(getComputedStyle(row).lineHeight);
      document.getElementById('rolling-window').style.height=lineHeight+'px';
      lines.style.transform='translateY(-'+((lines.children.length-1)*lineHeight)+'px)';
    })()`);
    await flush();
    rolling = await rollingGeometry();
    assert.equal(rolling.height, 72, 'partial auto-captions cannot enlarge the visible buffer at 300%');
    assert.equal(rolling.font, 20, 'source read-back cannot compound the font multiplier');
    assert.equal(rolling.overflowY, 'hidden');
    assert.ok(Math.abs(rolling.bottom - baseline) < 1);
  }
  const replacementFirstFrame = await execute(`new Promise(resolve=>requestAnimationFrame(()=>{
    window.detachedRolling=document.getElementById('rolling-window');
    const replacement=detachedRolling.cloneNode(true);replacement.style.cssText='height:24px';
    detachedRolling.replaceWith(replacement);
    queueMicrotask(()=>{
      const rect=replacement.getBoundingClientRect();
      resolve({center:rect.left+rect.width/2,bottom:rect.bottom,height:rect.height});
    });
  }))`);
  assert.equal(replacementFirstFrame.height, 72, 'new windows are scaled before the next App RAF');
  assert.ok(Math.abs(replacementFirstFrame.center - 320) < 1);
  assert.ok(Math.abs(replacementFirstFrame.bottom - baseline) < 1);
  await flush();
  rolling = await rollingGeometry();
  assert.equal(rolling.height, 72, 'replacement caption windows retain 300%');
  assert.ok(Math.abs(rolling.center - 320) < 1);
  assert.ok(Math.abs(rolling.bottom - baseline) < 1);
  assert.equal(await execute('detachedRolling.style.scale'), '', 'detached caption windows release retained App styles');
  await execute(`document.getElementById('rolling-window').style.height='48px';
    const box=document.getElementById('rolling-window');box.style.color='rgb(0,0,255)';
    box.style.transform='translate(21px,11px)';box.style.bottom='9px';box.style.left='190px';box.style.scale='1.2';`);
  await flush();
  rolling = await rollingGeometry();
  assert.equal(rolling.height, 144, 'a real player change to two visible rows is preserved at 300%');
  assert.ok(Math.abs(rolling.bottom - baseline) < 1, 'multiple rows grow upward from the same baseline');
  win.setContentSize(480, 480);
  await flush();
  rolling = await rollingGeometry();
  assert.ok(Math.abs(rolling.center - 240) < 1);
  assert.ok(Math.abs(rolling.bottom - (375 - 270 * 0.08)) < 1, 'window resize retains the image-relative inset');
  const nativeBottomSupported = await execute('nativeBottomSupported');
  assert.equal(await execute('rollingNativeCue.snapToLines'), !nativeBottomSupported);
  assert.equal(await execute('rollingNativeCue.lineAlign'),
    nativeBottomSupported ? 'end' : await execute('originalNativeLineAlign'));
  assert.equal(await execute('rollingNativeCue.line'), nativeBottomSupported ? 92 : 3,
    'native bottom alignment requires an actual end-anchor API, not an expando property');
  await execute(createPictureInPictureSubtitleScript({ id: 'rollingprobe' }));
  assert.equal(await execute('rollingNativeCue.line'), 3, 'native vertical placement is restored');
  assert.equal(await execute('rollingNativeCue.snapToLines'), true);
  assert.equal(await execute('rollingNativeCue.lineAlign'), await execute('originalNativeLineAlign'));
  assert.equal(await execute(`document.getElementById('rolling-window').style.scale`), '1.2', 'latest source scale is restored');
  assert.equal(await execute(`document.getElementById('rolling-window').style.bottom`), '9px', 'latest source bottom anchor is restored');
  assert.equal(await execute(`document.getElementById('rolling-window').style.left`), '190px', 'latest source horizontal anchor is restored');
  assert.equal(await execute(`document.getElementById('rolling-window').style.height`), '48px', 'live player-owned clipping height survives cleanup');
  assert.equal(await execute(`document.getElementById('rolling-window').style.color`), 'rgb(0, 0, 255)');
  assert.equal(await execute(`getComputedStyle(document.getElementById('rolling-window')).transform`), 'matrix(1, 0, 0, 1, 21, 11)', 'latest source transform is restored');
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'customalignment', scale: 1,
    alignment: { vertical: 'bottom', bottomInsetRatio: 0.15, minimumBottomInsetPx: 0 } }));
  assert.ok(Math.abs((await rollingGeometry()).bottom - (375 - 270 * 0.15)) < 1, 'Provider overrides the App defaults');
  await execute(createPictureInPictureSubtitleScript({ id: 'customalignment' }));
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'minimuminset', scale: 2,
    alignment: { vertical: 'bottom', bottomInsetRatio: 0, minimumBottomInsetPx: 20 } }));
  assert.ok(Math.abs((await rollingGeometry()).bottom - 355) < 1, 'minimum gap is independent of caption scale');
  await execute(createPictureInPictureSubtitleScript({ id: 'minimuminset' }));
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'invalidinset', scale: 1,
    alignment: { vertical: 'bottom', bottomInsetRatio: null, minimumBottomInsetPx: -50 } }));
  assert.ok(Math.abs((await rollingGeometry()).bottom - (375 - 270 * 0.08)) < 1, 'invalid ratio uses the default and negative pixel values cannot invert the gap');
  await execute(createPictureInPictureSubtitleScript({ id: 'invalidinset' }));
  const originalHorizontal = (await rollingGeometry()).center;
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'preservehorizontal', scale: 2,
    alignment: { horizontal: 'preserve', vertical: 'bottom' } }));
  assert.ok(Math.abs((await rollingGeometry()).center - originalHorizontal) < 1, 'vertical-only alignment retains the original horizontal anchor');
  await execute(createPictureInPictureSubtitleScript({ id: 'preservehorizontal' }));
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'preservealignment', scale: 1,
    alignment: { horizontal: 'preserve', vertical: 'preserve' } }));
  assert.equal(await execute(`document.getElementById('rolling-window').style.position`), '', 'explicit preserve opts out of App positioning');
  await execute(createPictureInPictureSubtitleScript({ id: 'preservealignment' }));
  stage = 'box scaling across composed caption ancestors';
  await execute(`window.nestedCaptionShadow=document.getElementById('rolling-window').attachShadow({mode:'open'});
    nestedCaptionShadow.innerHTML='<style>.caption-window{height:20px;width:60px}</style>'+
      '<div class="caption-window" id="nested-caption">Nested caption</div>';
    document.getElementById('rolling-window').style.scale='';`);
  await execute(createPictureInPictureSubtitleScript({ ...youtubeOptions, id: 'shadowbox', scale: 3 }));
  await flush();
  assert.equal(await execute(`getComputedStyle(document.getElementById('rolling-window')).scale`), '3');
  assert.equal(await execute(`getComputedStyle(nestedCaptionShadow.getElementById('nested-caption')).scale`), 'none',
    'matching caption descendants across Shadow DOM do not scale twice');
  assert.equal(await execute(`nestedCaptionShadow.getElementById('nested-caption').getBoundingClientRect().height`), 60);
  await execute(createPictureInPictureSubtitleScript({ id: 'shadowbox' }));
  assert.equal(await execute(`nestedCaptionShadow.querySelector('[data-kawaikara-subtitle-style]')`), null,
    'box-mode shadow styles are removed on exit');
  await execute(`rollingStream.getTracks().forEach(track=>track.stop())`);
  win.destroy();
  console.log('PASS: Chromium subtitle scaling, App-default alignment, Provider bottom gaps, 200%/300% rolling buffers, no style-reset/replacement frame drift or restarted CSS transitions, native opacity, letterbox-aware resizing, native cues, SPA, Shadow DOM, iframe isolation, and restoration.');
}

main().then(() => { clearTimeout(watchdog); app.exit(0); }, (error) => { clearTimeout(watchdog); console.error(error); app.exit(1); });
