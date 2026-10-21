// Isolated setup presentation: no real installers, Provider profiles, or network calls.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const root = path.resolve(__dirname, '../..');
const output = mkdtempSync(path.join(getTestTempRoot(), 'external-app-setup-'));
app.setPath('userData', output);
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const labels = Object.fromEntries(
    ['en', 'ko', 'ja'].map((locale) => [
        locale,
        JSON.parse(readFileSync(path.join(root, 'locales', locale + '.json')))
            .downloader,
    ]),
);
const distributionLabels = Object.fromEntries(
    ['en', 'ko', 'ja'].map((locale) => [
        locale,
        JSON.parse(readFileSync(path.join(root, 'locales', locale + '.json')))
            .app.externalApps.distribution,
    ]),
);
const script = buildSync({
    stdin: {
        resolveDir: root,
        loader: 'tsx',
        contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {KawaiProvider} from '@kawaikara/kawai-ui';
import {YouTubeDownloaderPanel} from './src/Renderer/View/Video/YouTubeDownloaderPanel';
import {DistributionLookup} from './src/Renderer/View/ExternalApps/DistributionControls';
const root=createRoot(document.getElementById('root')), labels=${JSON.stringify(labels)};
const distributionLabels=${JSON.stringify(distributionLabels)};
window.kawaikara={appDistribution:{preview:async(url)=>{window.calls.push(['manifest',url]);if(window.manifestDelay)await new Promise(r=>setTimeout(r,window.manifestDelay));return window.manifestFixture},act:async(token,action)=>{window.calls.push([token,action]);return 'installer-opened'}}};
window.renderLookup=(locale='en')=>{
 flushSync(()=>root.render(null));
 flushSync(()=>root.render(<KawaiProvider><div className="kawai-theme kawai-theme-dark"><DistributionLookup labels={distributionLabels[locale]} /></div></KawaiProvider>));
};
window.calls=[];
const api={getStatus:async()=>{window.calls.push('status');return window.statusFixture},
 install:async()=>{window.calls.push('install');return {status:window.statusFixture}},
 open:async(url)=>{window.calls.push(['open',url]);return {opened:true,status:window.statusFixture}},
 openReleasePage:async()=>{window.calls.push('releases')}};
window.renderPanel=(locale='en',theme='dark')=>{
 flushSync(()=>root.render(null));
 flushSync(()=>root.render(<KawaiProvider><div className={'kawai-theme kawai-theme-'+theme}>
 <YouTubeDownloaderPanel api={api} labels={labels[locale]} initialUrl="https://www.youtube.com/watch?v=retained"
 editableSource={false}
 distributionUrl={window.useDistribution?'https://provider.example/app.json':undefined}
 distributionApi={window.useDistribution?window.kawaikara.appDistribution:undefined}
 distributionLabels={distributionLabels[locale]} onClose={()=>{window.calls.push('close');root.render(null)}} />
 </div></KawaiProvider>));
};
`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    loader: { '.png': 'dataurl', '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = [
    require.resolve('@kawaikara/kawai-ui/styles.css'),
    path.join(root, 'src/Renderer/Styles/Overlay.css'),
    path.join(root, 'src/Renderer/Styles/ExternalAppSetup.css'),
]
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
const watchdog = setTimeout(() => app.exit(1), 60000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                offscreen: true,
                contextIsolation: true,
                backgroundThrottling: false,
            },
        });
        await win.loadURL(
            'data:text/html;charset=utf-8,' +
                encodeURIComponent(
                    '<style>body{margin:0;background:#303441}' +
                        css +
                        '</style><div id="root"></div>',
                ),
        );
        await win.webContents.executeJavaScript(script);
        for (const [width, height] of [
            [1100, 800],
            [720, 405],
            [360, 480],
        ]) {
            win.setContentSize(width, height);
            const layouts = await win.webContents.executeJavaScript(`(async()=>{
   const wait=()=>new Promise(r=>setTimeout(r,30)),results=[];await wait();
   for(const locale of ['en','ko','ja'])for(const theme of ['dark','light'])for(const development of [false,true]){
    window.statusFixture={installed:false,development,automaticInstallSupported:!development,platform:'darwin'};
    renderPanel(locale,theme);await wait();
    const panel=document.querySelector('dialog'),rect=panel.getBoundingClientRect();
    results.push({locale,theme,development,open:panel.open,inside:rect.x>=0&&rect.y>=0&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1,
      centered:Math.abs(rect.x+rect.width/2-innerWidth/2)<2,
      overflow:panel.scrollWidth>panel.clientWidth+1,
      image:panel.querySelector('img').complete,
      noSource:panel.querySelector('input')===null,
      scrollbar:getComputedStyle(panel).scrollbarWidth,
      closeSize:panel.querySelector('button').getBoundingClientRect().width,
      buttons:[...panel.querySelectorAll('button')].map(b=>b.textContent),
      status:panel.querySelector('[role=status]').textContent});
   }return results;})()`);
            for (const layout of layouts) {
                const label = JSON.stringify({ width, height, ...layout });
                assert.ok(
                    layout.open &&
                        layout.inside &&
                        layout.centered &&
                        !layout.overflow &&
                        layout.image &&
                        layout.noSource && layout.scrollbar==='none',
                    label,
                );
                assert.ok(layout.closeSize >= 44, label);
                assert.equal(
                    layout.buttons.includes(labels[layout.locale].install),
                    false,
                    label,
                );
                assert.equal(
                    layout.status,
                    layout.development
                        ? labels[layout.locale].developmentWaiting
                        : labels[layout.locale].notInstalled,
                    label,
                );
            }
        }
        // Only status queries were issued while displaying states.
        assert.ok(
            (await win.webContents.executeJavaScript('window.calls')).every(
                (call) => call === 'status',
            ),
        );
        const actions = await win.webContents.executeJavaScript(`(async()=>{
  const wait=()=>new Promise(r=>setTimeout(r,30));
  window.statusFixture={installed:false,development:true,automaticInstallSupported:false,platform:'darwin'};
  renderPanel();await wait();window.calls=[];
  window.statusFixture={...window.statusFixture,installed:true};
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Check again').click();await wait();
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Open in kawai-downloader').click();await wait();
  const actions=[...window.calls];
  renderPanel();await wait();document.querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));await wait();
  actions.push(document.querySelector('dialog')===null?'escape-closed':'escape-failed');
  renderPanel();await wait();document.querySelector('dialog').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:0,clientY:0}));await wait();
  actions.push(document.querySelector('dialog')===null?'outside-closed':'outside-failed');
  return actions;})()`);
        assert.deepEqual(actions, [
            'status',
            ['open', 'https://www.youtube.com/watch?v=retained'],
            'close',
            'escape-closed',
            'outside-closed',
        ]);
        win.setContentSize(720, 405);
        const manifestActions = await win.webContents
            .executeJavaScript(`(async()=>{
          const wait=()=>new Promise(r=>setTimeout(r,40));window.calls=[];
          const results=[];
          for(const action of ['install','download','guide','unsupported']) {
            window.manifestFixture={token:'approved-preview',sourceUrl:'https://example.com/app.json',cached:true,action,
              descriptor:{schemaVersion:1,id:'day.test.app',name:'Third-party app',guideUrl:'https://example.com/install',targets:[]},
              target:action==='unsupported'?undefined:{os:'darwin',arch:'arm64',version:'1.0',artifact:action==='guide'?undefined:{url:'https://example.com/app.zip',format:'zip',sha256:'a'.repeat(64)}}};
            renderLookup();await wait();
            const input=document.querySelector('input');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'https://example.com/app.json');
            input.dispatchEvent(new Event('input',{bubbles:true}));await wait();
            [...document.querySelectorAll('button')].find(b=>b.textContent==='Find app').click();await wait();
            const modal=document.querySelector('dialog'),r=modal.getBoundingClientRect();
            results.push({action,fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&modal.scrollWidth<=modal.clientWidth+1,
              install:[...modal.querySelectorAll('button')].some(b=>b.textContent==='Install')});
            if(action==='install') { [...modal.querySelectorAll('button')].find(b=>b.textContent==='Install').click();await wait();
              results.at(-1).notice=modal.textContent.includes('The OS installer has opened'); }
            modal.querySelector('[aria-label="Close"]').click();await wait();
            results.at(-1).closed=document.querySelector('dialog')===null;
          }
          return {results,calls:window.calls};})()`);
        for (const result of manifestActions.results) {
            assert.ok(result.fits && result.closed, JSON.stringify(result));
            assert.equal(result.install, result.action === 'install');
            if (result.action === 'install') assert.equal(result.notice, true);
        }
        assert.deepEqual(
            manifestActions.calls.filter(
                (call) => call[0] === 'approved-preview',
            ),
            [['approved-preview', 'install']],
        );
        win.setContentSize(720, 405);
        const coldFrames = await win.webContents.executeJavaScript(`(async()=>{
            window.useDistribution=true;window.manifestDelay=80;
            window.manifestFixture={token:'provider-preview',sourceUrl:'https://provider.example/app.json',cached:false,action:'install',
              descriptor:{schemaVersion:1,id:'day.faby.kawai-downloader',name:'kawai-downloader',targets:[]},
              target:{os:'darwin',arch:'arm64',version:'local-test',artifact:{url:'https://provider.example/app.dmg',format:'dmg',sha256:'a'.repeat(64)}}};
            window.statusFixture={installed:false,development:false,automaticInstallSupported:true,platform:'darwin'};
            const frames=[];
            for(let attempt=0;attempt<2;attempt++) {
                renderPanel('ko');
                for(let frame=0;frame<18;frame++) {
                    await new Promise(requestAnimationFrame);
                    const panel=document.querySelector('dialog'),style=getComputedStyle(panel);
                    frames.push({open:panel.open,bar:style.scrollbarWidth,url:panel.textContent.includes('https://')||!!panel.querySelector('input'),
                      horizontal:panel.scrollWidth>panel.clientWidth+1, scrollable:style.overflowY==='auto'});
                }
            }
            window.manifestDelay=0;
            return frames;
        })()`);
        assert.equal(coldFrames.length,36);
        for(const frame of coldFrames) assert.ok(frame.open && frame.bar==='none' && !frame.url && !frame.horizontal && frame.scrollable,JSON.stringify(frame));
        win.setContentSize(900, 700);
        await win.webContents.executeJavaScript(
            `window.statusFixture={installed:false,development:true,automaticInstallSupported:false,platform:'darwin'};renderPanel('ko')`,
        );
        await new Promise((r) => setTimeout(r, 150));
        writeFileSync(
            path.join(output, 'setup.png'),
            (await win.webContents.capturePage()).toPNG(),
        );
        console.log(
            'External app setup: 36 companion layouts, 36 cold/reopen frames and 4 distribution action modes; status, URL retry, close/Escape/backdrop passed. Screenshot:',
            path.join(output, 'setup.png'),
        );
        win.destroy();
        clearTimeout(watchdog);
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
