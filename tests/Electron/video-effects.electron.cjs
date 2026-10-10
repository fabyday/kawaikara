const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Isolated synthetic video, real GPU pipelines. Never loads user profiles, streams or cookies.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
const profile = fs.mkdtempSync(
    path.join(getTestTempRoot(), 'kawaikara-effects-test-'),
);
app.setPath('userData', profile);
const engines = require('../../packages/builtin-sites/src/Providers/Chzzk/Plugins/Upscaling/Generated/engines.json');
const hostCode = buildSync({
    entryPoints: [path.join(root, 'src/Main/Inject/VideoEffect.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'EffectHost',
    target: 'chrome134',
}).outputFiles[0].text;
const workerCode = buildSync({
    entryPoints: [path.join(root, 'src/Main/Inject/VideoEffectWorker.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'EffectWorker',
    target: 'chrome134',
}).outputFiles[0].text;
const pipCode = buildSync({
    entryPoints: [
        path.join(root, 'src/Main/Inject/UnifiedPictureInPicturePage.ts'),
    ],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'PipPage',
    target: 'chrome134',
}).outputFiles[0].text;
const timeout = setTimeout(() => {
    console.error('Video effect tests timed out');
    app.exit(1);
}, 180000);
app.whenReady()
    .then(async () => {
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.end(
                '<!doctype html><main style="position:relative;width:640px;height:360px"><video muted autoplay style="width:100%;height:100%"></video></main>',
            );
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                backgroundThrottling: false,
                contextIsolation: true,
            },
        });
        win.webContents.on('console-message', (event) =>
            console.log('page:', event.message),
        );
        await win.loadURL(`http://127.0.0.1:${server.address().port}`);
        await win.webContents.executeJavaScript(workerCode);
        console.log(
            'GPU platform',
            JSON.stringify({
                platform: process.platform,
                arch: process.arch,
                electron: process.versions.electron,
                ...(await win.webContents
                    .executeJavaScript(`(async()=>{const a=await navigator.gpu?.requestAdapter();return a?{
      vendor:a.info.vendor,architecture:a.info.architecture,description:a.info.description,
      maxBufferSize:a.limits.maxBufferSize,maxTextureDimension2D:a.limits.maxTextureDimension2D}:{};})()`)),
            }),
        );
        await win.webContents.executeJavaScript(`(async () => {
    window.errors=[]; window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
    window.fixture=document.createElement('canvas'); fixture.width=64; fixture.height=36;
    const ctx=fixture.getContext('2d');
    let tick=0;function draw(){const w=fixture.width,h=fixture.height;ctx.fillStyle='#c03060';ctx.fillRect(0,0,w,h);ctx.fillStyle='#20e080';ctx.fillRect(w/8,h*8/36,w*24/64,h*20/36);ctx.fillStyle='rgb('+(tick++%255)+',0,0)';ctx.fillRect(0,0,1,1)} draw();setInterval(draw,20);
    window.video=document.querySelector('video');video.srcObject=fixture.captureStream(30);await video.play();
    await new Promise(resolve=>video.requestVideoFrameCallback(resolve));
  })()`);
        const cpuFactory =
            gzipSync(`async(input,canvas)=>{const end=performance.now()+500;while(performance.now()<end){};
    const ctx=canvas.getContext('2d');return{async render(){ctx.drawImage(input.frame,0,0,canvas.width,canvas.height)},dispose(){}}}`).toString(
                'base64',
            );
        const stalledFactory = gzipSync(
            'async()=>{const end=performance.now()+10000;while(performance.now()<end){};return{render:async()=>{},dispose(){}}}',
        ).toString('base64');
        const transport = await win.webContents.executeJavaScript(`(async()=>{
    const NativeWorker=window.Worker;let active=0;
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);active++;this.closed=false}
      terminate(){if(!this.closed){this.closed=true;active--}super.terminate()}};
    const bootstrap='('+EffectWorker.runVideoEffectWorker.toString()+')(url=>import(url));';
    const canvas=document.createElement('canvas');document.body.append(canvas);
    let ticks=0,last=performance.now(),maxGap=0;
    const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++},10);
    try{
      const engine=await EffectWorker.createVideoEffectWorker(video,canvas,new AbortController().signal,bootstrap,${JSON.stringify(cpuFactory)},2,{});
      clearInterval(timer);await engine.render();await engine.dispose();
      const pendingCanvas=document.createElement('canvas'),controller=new AbortController(),start=performance.now();
      const pending=EffectWorker.createVideoEffectWorker(video,pendingCanvas,controller.signal,bootstrap,${JSON.stringify(stalledFactory)},2,{}).then(()=>false,()=>true);
      setTimeout(()=>controller.abort(),100);const cancelled=await pending;
      const cancelMs=performance.now()-start;
      let invalidRejected=false;
      try{await EffectWorker.createVideoEffectWorker(video,document.createElement('canvas'),new AbortController().signal,bootstrap,'invalid',2,{})}
      catch{invalidRejected=true}
      return {ticks,maxGap,cancelled,cancelMs,active,invalidRejected,playing:!video.paused,errors};
    }finally{clearInterval(timer);canvas.remove();window.Worker=NativeWorker}
  })()`);
        console.log('worker responsiveness and cancellation', transport);
        assert.ok(
            transport.ticks >= 20,
            'UI timers must continue through 500ms synchronous worker startup',
        );
        assert.ok(
            transport.maxGap < 250,
            'Model compilation must not monopolize the UI event loop',
        );
        assert.ok(
            transport.cancelled &&
                transport.cancelMs < 1000 &&
                transport.invalidRejected &&
                transport.playing,
        );
        assert.equal(
            transport.active,
            0,
            'Disposal, cancellation and initialization failures must terminate workers',
        );
        assert.deepEqual(transport.errors, []);
        for (const [name, compressed] of Object.entries(engines)) {
            const result = await win.webContents
                .executeJavaScript(`(async () => {
      const canvas=document.createElement('canvas'); document.body.append(canvas);
      let renderer; const times=[];
      try {
        renderer=await EffectWorker.createVideoEffectWorker(video,canvas,new AbortController().signal,
          '('+EffectWorker.runVideoEffectWorker.toString()+')(url=>import(url));',${JSON.stringify(compressed)},${name === 'realesrgan' ? 4 : 2},{});
        for(let i=0;i<3;i++){const t=performance.now();await renderer.render();times.push(performance.now()-t)}
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const check=document.createElement('canvas');check.width=canvas.width;check.height=canvas.height;
        const ctx=check.getContext('2d');ctx.drawImage(canvas,0,0);
        const pixel=Array.from(ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data);
        return {width:canvas.width,height:canvas.height,pixel,times};
      } catch(e) { return {error:String(e),stack:e.stack}; }
      finally { if(renderer)await renderer.dispose();canvas.remove(); }
    })()`);
            console.log(name, JSON.stringify(result));
            assert.equal(result.error, undefined, `${name}: ${result.error}`);
            assert.equal(result.width, name === 'realesrgan' ? 256 : 128);
            assert.equal(result.height, name === 'realesrgan' ? 144 : 72);
            assert.ok(
                result.pixel.slice(0, 3).some((channel) => channel > 10),
                `${name} black output`,
            );
        }
        const combinations = await win.webContents
            .executeJavaScript(`(async()=>{
    const source=document.createElement('canvas');source.width=64;source.height=36;
    const ctx=source.getContext('2d'),pixels=ctx.createImageData(64,36);
    let seed=17;
    for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;
      const value=128+(seed%17)-8;pixels.data.set([value,value,value,255],i)}
    ctx.putImageData(pixels,0,0);ctx.fillStyle='#eeeeee';ctx.fillRect(8,7,20,21);
    ctx.fillStyle='#171717';ctx.font='bold 16px sans-serif';ctx.fillText('Aa',30,25);
    const stream=source.captureStream(30),input=document.createElement('video');input.muted=true;input.srcObject=stream;
    document.body.append(input);const firstFrame=new Promise(r=>input.requestVideoFrameCallback(r));await input.play();await firstFrame;input.pause();
    const create=(v,c,options)=>EffectWorker.createVideoEffectWorker(v,c,new AbortController().signal,
      '('+EffectWorker.runVideoEffectWorker.toString()+')(url=>import(url));',${JSON.stringify(engines.anime4k)},2,options);
    const fsr=(v,c,options)=>EffectWorker.createVideoEffectWorker(v,c,new AbortController().signal,
      '('+EffectWorker.runVideoEffectWorker.toString()+')(url=>import(url));',${JSON.stringify(engines.fsr1)},2,options);
    const capture=async (options,factory=create)=>{
      const output=document.createElement('canvas');document.body.append(output);let renderer;
      try{renderer=await factory(input,output,options);await renderer.render();await renderer.render();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const readback=document.createElement('canvas');readback.width=output.width;readback.height=output.height;
        const read=readback.getContext('2d');read.drawImage(output,0,0);
        return {width:output.width,height:output.height,data:read.getImageData(0,0,output.width,output.height).data};
      }finally{await renderer?.dispose();output.remove()}
    };
    try{
      const baseline=await capture({restore:'off',denoise:'off'}),results=[];
      for(const restore of ['off','soft','detail','strong']) for(const denoise of ['off','light','medium']){
        const result=await capture({restore,denoise});let difference=0,min=255,max=0,opaque=true;
        for(let i=0;i<result.data.length;i++){if(i%4===3){opaque&&=result.data[i]===255;continue}
          difference+=Math.abs(result.data[i]-baseline.data[i]);min=Math.min(min,result.data[i]);max=Math.max(max,result.data[i])}
        results.push({restore,denoise,width:result.width,height:result.height,opaque,range:max-min,
          meanDifference:difference/(result.data.length/4*3)});
      }
      const balanced=await capture({restore:'strong',denoise:'light',quality:'balanced'});
      if(!balanced.data.some((v,i)=>i%4!==3&&v>30))throw Error('Balanced model returned black output');
      const fsrSoft=await capture({sharpness:'soft'},fsr),fsrStrong=await capture({sharpness:'strong'},fsr);
      if(!fsrSoft.data.some((value,index)=>value!==fsrStrong.data[index]))throw Error('FSR sharpness must change pixels');
      return results;
    }finally{stream.getTracks().forEach(t=>t.stop());input.remove()}
  })()`);
        for (const result of combinations) {
            assert.equal(result.width, 128);
            assert.equal(result.height, 72);
            assert.equal(result.opaque, true);
            assert.ok(
                result.range > 40,
                'Graph must preserve non-constant image content',
            );
            if (result.restore === 'off' && result.denoise === 'off')
                assert.equal(
                    result.meanDifference,
                    0,
                    'Fixed-frame baseline must be stable',
                );
            else
                assert.ok(
                    result.meanDifference > 0.01,
                    `${result.restore}/${result.denoise} must actually alter the processed pixels`,
                );
        }
        console.log(
            'Anime4K graph combinations (same frame)',
            JSON.stringify(combinations),
        );
        if (process.env.EFFECT_BENCHMARK === '1') {
            const cases = Object.entries(engines).map(([name, compressed]) => ({
                name,
                compressed,
                options: {},
            }));
            cases.push(
                {
                    name: 'anime4k',
                    compressed: engines.anime4k,
                    options: { restore: 'strong', quality: 'high' },
                },
                {
                    name: 'anime4k',
                    compressed: engines.anime4k,
                    options: { restore: 'strong', quality: 'balanced' },
                },
            );
            for (const { name, compressed, options } of cases) {
                const height =
                    name === 'realesrgan'
                        ? 180
                        : Number(process.env.EFFECT_BENCHMARK_HEIGHT ?? 720);
                const width = Math.round((height * 16) / 9);
                const result = await win.webContents
                    .executeJavaScript(`(async()=>{
        fixture.width=${width};fixture.height=${height};
        while(video.videoWidth!==${width}) await new Promise(r=>video.requestVideoFrameCallback(r));
        const canvas=document.createElement('canvas');document.body.append(canvas);let renderer;const times=[];
        let ticks=0,last=performance.now(),maxGap=0;const start=last;
        const heartbeat=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++},10);
        try { renderer=await EffectWorker.createVideoEffectWorker(video,canvas,new AbortController().signal,
          '('+EffectWorker.runVideoEffectWorker.toString()+')(url=>import(url));',${JSON.stringify(compressed)},${name === 'realesrgan' ? 4 : 2},${JSON.stringify(options)});
          const initializationMs=performance.now()-start;
          for(let i=0;i<6;i++){const start=performance.now();await renderer.render();times.push(performance.now()-start)}
          return {width:video.videoWidth,height:video.videoHeight,initializationMs,ticks,maxGap,times};
        } catch(e){return {error:String(e)}} finally{clearInterval(heartbeat);if(renderer)await renderer.dispose();canvas.remove()}
      })()`);
                console.log(
                    'benchmark',
                    name,
                    JSON.stringify(options),
                    JSON.stringify(result),
                );
                assert.equal(
                    result.error,
                    undefined,
                    `${name} benchmark: ${result.error}`,
                );
            }
            await win.webContents.executeJavaScript(
                `(async()=>{fixture.width=64;fixture.height=36;while(video.videoWidth!==64)await new Promise(r=>video.requestVideoFrameCallback(r))})()`,
            );
        }
        const blocked = new BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
            },
        });
        await blocked.loadURL(
            'data:text/html,<meta http-equiv="Content-Security-Policy" content="worker-src \'none\'"><canvas></canvas>',
        );
        await blocked.webContents.executeJavaScript(workerCode);
        const blockedResult = await blocked.webContents
            .executeJavaScript(`(async()=>{
    try{await EffectWorker.createVideoEffectWorker({videoWidth:64,videoHeight:36},document.querySelector('canvas'),
      new AbortController().signal,'',${JSON.stringify(cpuFactory)},2,{});return false}catch{return true}
  })()`);
        assert.equal(
            blockedResult,
            true,
            'Page worker policy must be respected, not weakened',
        );
        blocked.destroy();
        await win.webContents.executeJavaScript(hostCode);
        const lifecycle = await win.webContents
            .executeJavaScript(`(async () => {
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    window.allowed=true;window.counts={created:0,disposed:0};
    const factory=async(v,c)=>{counts.created++;c.width=64;c.height=36;return {render:async()=>c.getContext('2d').drawImage(v,0,0,64,36),dispose(){counts.disposed++}}};
    EffectHost.installVideoEffect('test',()=>allowed?video:null,factory);await wait(650);
    EffectHost.installVideoEffect('test',()=>allowed?video:null,factory);await wait(100);
    const idempotent=counts.created===1;
    const applied=!!document.querySelector('[data-kawaikara-video-effect]:not([hidden])');
    allowed=false;await wait(500);const excluded=!document.querySelector('[data-kawaikara-video-effect]');
    allowed=true;await wait(500);window.__kawaikaraEffects.get('test')();await wait(50);
    const stopped=!document.querySelector('[data-kawaikara-video-effect]');
    const before=video.currentTime;await wait(100);
    EffectHost.installVideoEffect('fail',()=>video,async()=>{throw new Error('fixture failure')});await wait(750);
    const fallback=!document.querySelector('[data-kawaikara-video-effect]');window.__kawaikaraEffects.get('fail')();
    return {applied,excluded,stopped,fallback,idempotent,counts,playing:!video.paused&&video.currentTime>before,errors};
  })()`);
        console.log('lifecycle', lifecycle);
        assert.ok(
            lifecycle.applied &&
                lifecycle.excluded &&
                lifecycle.stopped &&
                lifecycle.fallback &&
                lifecycle.playing &&
                lifecycle.idempotent,
        );
        assert.equal(lifecycle.counts.created, lifecycle.counts.disposed);
        assert.deepEqual(lifecycle.errors, []);
        const resumed = await win.webContents.executeJavaScript(`(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const request=video.requestVideoFrameCallback,cancel=video.cancelVideoFrameCallback;
    video.requestVideoFrameCallback=()=>123;video.cancelVideoFrameCallback=()=>{};
    Object.defineProperty(video,'seeking',{configurable:true,value:true});
    EffectHost.installVideoEffect('stalled',()=>video,async(v,c)=>({render:async()=>{
      c.width=64;c.height=36;c.getContext('2d').drawImage(v,0,0,64,36);
    },dispose(){}}));await wait(100);
    const before=window.__kawaikaraEffectStatus.get('stalled');
    const initializedOnly=before.state==='suspended'&&before.presentedFrames===0;
    delete video.seeking;await wait(650);
    const after=window.__kawaikaraEffectStatus.get('stalled');
    const recovered=after.state==='applied'&&after.presentedFrames>0;
    window.__kawaikaraEffects.get('stalled')();
    video.requestVideoFrameCallback=request;video.cancelVideoFrameCallback=cancel;
    return {initializedOnly,recovered,released:!window.__kawaikaraEffectStatus.has('stalled')};
  })()`);
        console.log('stalled MSE callback recovery', resumed);
        assert.ok(
            resumed.initializedOnly && resumed.recovered && resumed.released,
        );
        const safety = await win.webContents.executeJavaScript(`(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));let disposed=0,release,started=false;
    video.volume=.37;const volume=video.volume;
    EffectHost.installVideoEffect('pending',()=>video,async()=>{
      started=true;await new Promise(r=>release=r);return {render:async()=>{},dispose(){disposed++}};
    });while(!started)await wait(10);
    window.__kawaikaraEffects.get('pending')();release();await wait(50);
    const pendingDisposed=disposed===1&&!document.querySelector('[data-kawaikara-video-effect]');
    let draws=0,closed=0,inDraw=false;
    EffectHost.installVideoEffect('drawing',()=>video,async()=>({render:async()=>{draws++;inDraw=true;await new Promise(r=>release=r);inDraw=false},dispose(){if(inDraw)throw Error('disposed during render');closed++}}));
    while(!inDraw)await wait(10);await wait(150);const oneFrame=draws===1;
    window.__kawaikaraEffects.get('drawing')();const hiddenImmediately=!document.querySelector('[data-kawaikara-video-effect]')&&closed===0;
    release();await wait(50);const waitedForRender=closed===1;
    let drmStarts=0;
    Object.defineProperty(video,'mediaKeys',{configurable:true,value:{}});
    EffectHost.installVideoEffect('drm',()=>video,async()=>{drmStarts++;throw Error('must not start')});await wait(100);
    const drmProtected=drmStarts===0&&!document.querySelector('[data-kawaikara-video-effect]');
    window.__kawaikaraEffects.get('drm')();delete video.mediaKeys;
    let slowStarts=0,slowCalls=0;
    EffectHost.installVideoEffect('slow',()=>video,async()=>{slowStarts++;return {render:()=>{slowCalls++;return wait(275)},dispose(){}}});
    for(let i=0;i<100;i++){await wait(50);if(slowCalls>=2&&!document.querySelector('[data-kawaikara-video-effect]'))break;}
    const slowFallback=slowStarts===1&&!document.querySelector('[data-kawaikara-video-effect]');window.__kawaikaraEffects.get('slow')();
    let failedStarts=0;
    EffectHost.installVideoEffect('security',()=>video,async()=>{failedStarts++;return {render:async()=>{throw new DOMException('fixture','SecurityError')},dispose(){}}});await wait(800);
    const frameDenied=failedStarts===1&&!document.querySelector('[data-kawaikara-video-effect]');window.__kawaikaraEffects.get('security')();
    return {pendingDisposed,oneFrame,hiddenImmediately,waitedForRender,drmProtected,slowFallback,frameDenied,untouched:video.volume===volume&&!video.paused,errors};
  })()`);
        console.log('safety', safety);
        for (const [name, value] of Object.entries(safety))
            if (name !== 'errors') assert.equal(value, true, name);
        assert.deepEqual(safety.errors, []);
        await win.webContents.executeJavaScript(pipCode);
        const pip = await win.webContents.executeJavaScript(`(async()=>{
    EffectHost.installVideoEffect('pip',()=>video,async(v,c)=>({render:async()=>{c.width=64;c.height=36;c.getContext('2d').drawImage(v,0,0,64,36)},dispose(){}}));
    await new Promise(r=>setTimeout(r,500));
    (0,eval)(PipPage.createEnterUnifiedPictureInPictureScript({labels:{play:'Play',pause:'Pause',returnToApp:'Return'},contentOverlaySelectors:[],playbackButtonSize:36,playbackMessage:'test:playback',restoreMessage:'test:restore',videoSizeMessage:'test:size'}));
    await new Promise(r=>setTimeout(r,200));
    const canvas=document.querySelector('[data-kawaikara-video-effect]'),style=getComputedStyle(canvas),bounds=canvas.getBoundingClientRect();
    const result={shown:!canvas.hidden&&style.visibility==='visible',pointerEvents:style.pointerEvents,width:bounds.width,height:bounds.height,viewport:[innerWidth,innerHeight]};
    window.__kawaikaraEffects.get('pip')();return result;
  })()`);
        console.log('pip', pip);
        assert.ok(pip.shown);
        assert.equal(pip.pointerEvents, 'none');
        assert.equal(pip.width, pip.viewport[0]);
        assert.equal(pip.height, pip.viewport[1]);
        win.destroy();
        server.close();
        clearTimeout(timeout);
        console.log('All four GPU and lifecycle tests passed');
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(timeout);
        app.exit(1);
    });
