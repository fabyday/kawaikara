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
import {ProviderAppRequirement} from './src/Renderer/View/ExternalApps/ProviderAppRequirement';
import {DistributionLookup} from './src/Renderer/View/ExternalApps/DistributionControls';
import {ExternalAppApproval} from './src/Renderer/View/Preference/ExternalAppApproval';
const root=createRoot(document.getElementById('root'));
const distributionLabels=${JSON.stringify(distributionLabels)};
window.kawaikara={appDistribution:{preview:async(url)=>{window.calls.push(['manifest',url]);if(window.manifestDelay)await new Promise(r=>setTimeout(r,window.manifestDelay));return window.manifestFixture},act:async(token,action)=>{window.calls.push([token,action]);return 'installer-opened'}}};
window.renderLookup=(locale='en')=>{
 flushSync(()=>root.render(null));
 flushSync(()=>root.render(<KawaiProvider><div className="kawai-theme kawai-theme-dark"><DistributionLookup labels={distributionLabels[locale]} /></div></KawaiProvider>));
};
window.calls=[];
window.permissionMessages=${JSON.stringify(Object.fromEntries(['en','ko','ja'].map(locale=>[locale,JSON.parse(readFileSync(path.join(root,'locales',locale+'.json'))).app.externalApps])))};
window.renderApproval=(locale='ko')=>{
 flushSync(()=>root.render(null));
 window.kawaikara.application={externalApps:async(operation,id,grants)=>{
   if(operation==='status') return window.approvalFixture;
   window.calls.push([operation,id,grants]);return {registrations:[]};
 }};
 flushSync(()=>root.render(<KawaiProvider><div className="kawai-theme kawai-theme-dark"><ExternalAppApproval messages={window.permissionMessages[locale]} /></div></KawaiProvider>));
};
window.kawaikara.providerActions={request:async(url,id)=>{window.calls.push(['request',url,id]);return window.requestResult??{accepted:false,code:'unavailable',recoverable:true}}};
window.renderPanel=(locale='en',theme='dark')=>{
 flushSync(()=>root.render(null));
 flushSync(()=>root.render(<KawaiProvider><div className={'kawai-theme kawai-theme-'+theme}>
 <ProviderAppRequirement labels={distributionLabels[locale]}
 request={{appId:'example.editor',providerId:'example.provider',sourceUrl:'https://example.com/document',distributionUrl:window.useDistribution?'https://provider.example/app.json':undefined}}
 onClose={()=>{window.calls.push('close');root.render(null)}} />
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
    path.join(root, 'src/Renderer/View/Preference/Tabs/WebExtensionControl.css'),
    path.join(root, 'src/Renderer/View/Preference/ExternalAppRegistrations.css'),
    path.join(root, 'src/Renderer/View/Preference/ExternalAppPermissionCards.css'),
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
      image:!panel.querySelector('img')||panel.querySelector('img').complete,
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
                    layout.buttons.includes(distributionLabels[layout.locale].install),
                    false,
                    label,
                );
                assert.equal(
                    layout.status,
                    distributionLabels[layout.locale].missing,
                    label,
                );
            }
        }
        // Only status queries were issued while displaying states.
        assert.ok(
            (await win.webContents.executeJavaScript('window.calls')).every(
                (call) => false,
            ),
        );
        const actions = await win.webContents.executeJavaScript(`(async()=>{
  const wait=()=>new Promise(r=>setTimeout(r,30));
  window.requestResult={accepted:true};
  renderPanel();await wait();window.calls=[];
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Check again').click();await wait();
  const actions=[...window.calls];
  renderPanel();await wait();document.querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));await wait();
  actions.push(document.querySelector('dialog')===null?'escape-closed':'escape-failed');
  renderPanel();await wait();document.querySelector('dialog').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:0,clientY:0}));await wait();
  actions.push(document.querySelector('dialog')===null?'outside-closed':'outside-failed');
  return actions;})()`);
        assert.deepEqual(actions, [
            ['request', 'https://example.com/document', 'example.provider'],
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
              download:[...modal.querySelectorAll('button')].some(b=>b.textContent==='Download'),
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
            assert.equal(result.download, result.action === 'download');
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
        const developmentLookups = await win.webContents.executeJavaScript(`(async()=>{
            window.calls=[];window.useDistribution=true;window.requestResult={accepted:false,code:'unavailable',recoverable:true};
            renderPanel('ko');await new Promise(r=>setTimeout(r,80));
            const refresh=[...document.querySelectorAll('button')].find(button=>button.textContent.includes(${JSON.stringify(distributionLabels.ko.refresh)}));
            refresh.click();await new Promise(r=>setTimeout(r,80));
            return window.calls.filter(call=>Array.isArray(call)&&call[0]==='manifest');
        })()`);
        assert.ok(developmentLookups.length >= 2, 'manifest lookup and refresh remain independent of connection transport');
        const hasDownload = await win.webContents.executeJavaScript(`document.querySelector('dialog').textContent.includes(${JSON.stringify(distributionLabels.ko.install)})`);
        assert.equal(hasDownload, true, 'server artifact installation must remain available in development transport');
        writeFileSync(
            path.join(output, 'setup.png'),
            (await win.webContents.capturePage()).toPNG(),
        );
        console.log(
            'External app setup: 36 companion layouts, 36 cold/reopen frames and 4 distribution action modes; status, URL retry, close/Escape/backdrop passed. Screenshot:',
            path.join(output, 'setup.png'),
        );
        win.setContentSize(720, 600);
        const cards = await win.webContents.executeJavaScript(`(async()=>{
            window.calls=[];
            window.approvalFixture={registrations:[],approval:{id:'grouped-approval',provider:{id:'youtube',name:'YouTube'},descriptor:{schemaVersion:1,id:'test.app',name:'kawai-downloader',revision:'1',actions:[],permissions:[
              {id:'url-a',kind:'resource.url',origins:['https://www.youtube.com','https://chzzk.naver.com']},
              {id:'url-b',kind:'resource.url',origins:['https://www.youtube.com','https://music.youtube.com']},
              {id:'cookies',kind:'cookies.read',origins:['https://www.youtube.com']}
            ]}}};
            const results=[];
            for(const locale of ['ko','en','ja']) {
              renderApproval(locale);await new Promise(r=>setTimeout(r,80));
              const cards=[...document.querySelectorAll('.external-permission-card')];
              const box=document.querySelector('dialog').getBoundingClientRect();
              const heading=cards[0].querySelector('.external-permission-copy').getBoundingClientRect(),choice=cards[0].querySelector('.external-permission-choice').getBoundingClientRect();
              results.push({rightAligned:choice.left>=heading.right,bounds:box.left>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,count:cards.length,sites:cards[0].querySelectorAll('li').length,
                fits:cards.every(card=>card.scrollWidth<=card.clientWidth+1),
                denied:cards.every(card=>card.textContent.includes(window.permissionMessages[locale].denied))});
            }
            renderApproval('ko');await new Promise(r=>setTimeout(r,80));
            const combo=document.querySelector('.external-permission-choice [role="combobox"]');
            combo.click();await new Promise(r=>setTimeout(r,30));
            const option=[...document.querySelectorAll('[role="option"]')].find(item=>item.textContent.trim()===window.permissionMessages.ko.once);
            if(!option) throw new Error('Custom permission option missing');
            option.click();await new Promise(r=>setTimeout(r,30));
            [...document.querySelectorAll('button')].find(b=>b.textContent===window.permissionMessages.ko.approve).click();
            await new Promise(r=>setTimeout(r,40));
            return {results,decision:window.calls.find(call=>call[0]==='approve-choices')};
        })()`);
        for(const result of cards.results) assert.deepEqual(result,{rightAligned:true,bounds:true,count:2,sites:3,fits:true,denied:true});
        assert.deepEqual(cards.decision,['approve-choices','grouped-approval',{'url-a':'once','url-b':'once'}]);
        const cookieDecision=await win.webContents.executeJavaScript(`(async()=>{
            window.calls=[];window.approvalFixture.approval.id='cookie-prompt';window.approvalFixture.approval.cookiePermission='cookies';
            renderApproval('en');await new Promise(r=>setTimeout(r,80));
            if(document.querySelectorAll('.external-permission-card').length!==1) throw new Error('Cookie prompt scope widened');
            document.querySelector('[role="combobox"]').click();await new Promise(r=>setTimeout(r,30));
            [...document.querySelectorAll('[role="option"]')].find(item=>item.textContent.trim()===window.permissionMessages.en.always).click();
            await new Promise(r=>setTimeout(r,30));
            [...document.querySelectorAll('button')].find(b=>b.textContent===window.permissionMessages.en.confirmChoice).click();
            await new Promise(r=>setTimeout(r,40));
            delete window.approvalFixture.approval.cookiePermission;
            return window.calls.find(call=>call[0]==='allow-always');
        })()`);
        assert.deepEqual(cookieDecision,['allow-always','cookie-prompt',['cookies']]);
        await win.webContents.executeJavaScript(`window.approvalFixture.approval.id='permission-screenshot';renderApproval('ko')`);
        await new Promise(r=>setTimeout(r,100));
        writeFileSync(path.join(output,'permissions.png'),(await win.webContents.capturePage()).toPNG());
        console.log('Grouped permission cards: localized layouts, exact grouped consent and custom selector passed.',path.join(output,'permissions.png'));
        for (const height of [440, 600]) {
            win.setContentSize(720, height);
            const dropdown = await win.webContents.executeJavaScript(`(async()=>{
                const dialog=document.querySelector('dialog');dialog.scrollTop=0;
                const combo=[...document.querySelectorAll('[role="combobox"]')].at(-1);
                combo.scrollIntoView({block:'end'});combo.click();
                await new Promise(r=>setTimeout(r,180));
                const list=document.querySelector('[role="listbox"]');
                const rect=list.getBoundingClientRect(), trigger=combo.getBoundingClientRect();
                const options=[...list.querySelectorAll('[role="option"]')];
                const result={topLayer:list.matches(':popover-open'),count:options.length,
                    visible:rect.top>=0&&rect.bottom<=innerHeight,
                    upward:rect.bottom<=trigger.top,
                    clickable:options.every(option=>{const b=option.getBoundingClientRect();return option.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));})};
                combo.click();await new Promise(r=>setTimeout(r,180));return result;
            })()`);
            assert.equal(dropdown.topLayer,true);
            assert.equal(dropdown.count,3);
            assert.equal(dropdown.visible,true);
            assert.equal(dropdown.clickable,true, 'all options remain hit-testable outside card clipping');
            if(height===440) assert.equal(dropdown.upward,true,'small window exercises upward placement');
        }
        const preloadSource=readFileSync(path.join(root,'src/Preload/ViewerPreload.ts'),'utf8');
        const start=preloadSource.indexOf('        .ytp-contextmenu, .ytp-contextmenu * {');
        const end=preloadSource.indexOf('        *::-webkit-scrollbar {',start);
        assert.ok(start>=0&&end>start);
        const firstMenu=await win.webContents.executeJavaScript(`(()=>{
            const style=document.createElement('style');style.textContent=${JSON.stringify(preloadSource.slice(start,end))};document.head.append(style);
            const menu=document.createElement('div');menu.className='ytp-contextmenu';menu.style.cssText='height:100px;overflow:auto';
            document.body.append(menu);const before=getComputedStyle(menu).scrollbarWidth;
            const item=document.createElement('div');item.style.height='200px';menu.append(item);
            const after=getComputedStyle(menu).scrollbarWidth;menu.scrollTop=30;
            return {before,after,scrollable:menu.scrollTop===30};
        })()`);
        assert.deepEqual(firstMenu,{before:'none',after:'none',scrollable:true});
        win.destroy();
        clearTimeout(watchdog);
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
