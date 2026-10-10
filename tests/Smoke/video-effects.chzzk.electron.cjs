const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Optional online smoke test: anonymous, muted, isolated profile. Never reads user cookies.
// CHZZK_VIDEO_URL may target a public CHZZK live/VOD URL; otherwise discover a public live link.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync } = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
app.setPath(
    'userData',
    mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-chzzk-effects-')),
);
const engines = require('../../packages/builtin-sites/src/Providers/Chzzk/Plugins/Upscaling/Generated/engines.json');
const source = (file, name) =>
    buildSync({
        entryPoints: [path.join(root, file)],
        bundle: true,
        write: false,
        format: 'iife',
        globalName: name,
        target: 'chrome134',
    }).outputFiles[0].text;
const host = source('src/Main/Inject/VideoEffect.ts', 'Effects');
const content = source(
    'packages/builtin-sites/src/Providers/Chzzk/Inject/VideoContent.ts',
    'Content',
);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timeout = setTimeout(() => {
    console.error('Online smoke test timed out');
    app.exit(1);
}, 120000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: true,
            width: 1280,
            height: 800,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false,
            },
        });
        win.webContents.setAudioMuted(true);
        const manifest = require('../../packages/builtin-sites/src/Providers/Chzzk/manifest.json');
        win.webContents.setUserAgent(
            manifest.contributes.browserIdentity.userAgent,
        );
        const logs = [];
        win.webContents.on('console-message', (event) => {
            if (event.message.includes('[video-effects]')) {
                logs.push(event.message);
                console.log(event.message);
            } else if (
                event.level === 'error' ||
                event.message.startsWith('Uncaught')
            )
                console.log('page error:', event.message.slice(0, 500));
        });
        const execute = (code) =>
            win.webContents.executeJavaScript(code, true).catch((error) => {
                console.error('Failed probe:', code.slice(0, 130));
                throw error;
            });
        let url = process.env.CHZZK_VIDEO_URL;
        if (!url) {
            await win.loadURL('https://chzzk.naver.com/');
            for (let i = 0; i < 20 && !url; i++) {
                await wait(500);
                url = await execute(
                    `Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).find(href=>{const u=new URL(href);return u.origin==='https://chzzk.naver.com'&&u.pathname.startsWith('/live/')&&!u.search})`,
                );
            }
        }
        if (
            !url ||
            !/^https:\/\/chzzk\.naver\.com\/(live|video)\/[a-zA-Z0-9]+$/.test(
                url,
            )
        )
            throw Error('No public CHZZK live/VOD URL available');
        await win.loadURL(url);
        let state;
        for (let i = 0; i < 50; i++) {
            await wait(500);
            state = await execute(
                `(async()=>{const v=document.querySelector('video');if(!v)return null;v.muted=true;try{await v.play()}catch{}return {width:v.videoWidth,height:v.videoHeight,ready:v.readyState,paused:v.paused,drm:!!v.mediaKeys}})()`,
            );
            if (state?.width && state.ready >= 2 && !state.paused) break;
        }
        console.log('anonymous source', state);
        if (!state?.width)
            console.log(
                'unavailable page',
                await execute(
                    `({title:document.title,summary:document.body.innerText.slice(0,350)})`,
                ),
            );
        if (!state?.width || state.ready < 2 || state.paused)
            throw Error(
                'Anonymous stream unavailable; no GPU integration claim can be made',
            );
        await execute(content);
        await execute(host);
        for (const [name, compressed] of Object.entries(engines)) {
            const factory = gunzipSync(
                Buffer.from(compressed, 'base64'),
            ).toString('utf8');
            await execute(
                `Effects.installVideoEffect(${JSON.stringify(name)},()=>{const t=Content.resolveChzzkVideoContent();return ['live','vod'].includes(t.kind)?t.video:null},(${factory}));`,
            );
            await wait(5000);
            const result = await execute(
                `(()=>{const c=document.querySelector('[data-kawaikara-video-effect]');return {applied:!!c&&!c.hidden,width:c?.width,height:c?.height,videoPlaying:!document.querySelector('video')?.paused,status:window.__kawaikaraEffectStatus?.get(${JSON.stringify(name)})}})()`,
            );
            console.log(name, result);
            if (!result.applied && name !== 'realesrgan')
                throw Error(
                    `${name} did not become visible on public CHZZK video`,
                );
            await execute(
                `window.__kawaikaraEffects.get(${JSON.stringify(name)})?.()`,
            );
            await wait(200);
        }
        win.destroy();
        clearTimeout(timeout);
        console.log('CHZZK smoke completed');
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(timeout);
        app.exit(1);
    });
