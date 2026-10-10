const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Real React + KawaiUI controls, with Main-shaped fixture data and an isolated profile.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const { builtinBundle } = require('@kawaikara/builtin-sites');
const { getPluginMetadata } = require('@kawaikara/site-api');
const root = path.resolve(__dirname, '../..');
app.setPath(
    'userData',
    mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-effect-settings-')),
);
const plugin = builtinBundle.providers
    .find((p) => p.manifest.id === 'kawaikara.chzzk')
    .plugins.find((p) => p.manifest.id.endsWith('.upscaling'));
const metadata = getPluginMetadata(plugin.plugin);
const browser = buildSync({
    stdin: {
        resolveDir: root,
        loader: 'tsx',
        contents: `
  import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
  import {KawaiProvider} from '@kawaikara/kawai-ui';
  import {BundlesTab} from './src/Renderer/View/Preference/Tabs/BundlesTab';
  import {installKawaikaraMock,STORY_MESSAGES} from './stories/Mocks/KawaikaraMock';
  (async()=>{const api=installKawaikaraMock({preferences:{appLocale:'ko-KR'}});
    const preferences=await api.preferences.get(), bundles=await api.bundles.list(), runtime=await api.bundles.runtime();
    const metadata=window.metadata;
    runtime[0].providers=[{id:'kawaikara.chzzk',title:'CHZZK',settings:[{id:'plugin.'+metadata.id,title:metadata.activation.title,settings:[metadata.activation,...metadata.settings]}]}];
    function Fixture(){const [state,setState]=useState(preferences);window.saved=state;
      return <KawaiProvider><BundlesTab activationToken={0} bundles={bundles} runtimeBundles={runtime}
        preferences={state} messages={STORY_MESSAGES.app} installing={false} saving={false}
        onInstall={()=>{}} onRemoveBundle={()=>{}} onUpdateBundle={()=>{}}
        onUpdate={patch=>setState(current=>({...current,...patch}))}/></KawaiProvider>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  })();
`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome134',
    alias: {
        react: path.dirname(require.resolve('react/package.json')),
        'react-dom': path.dirname(require.resolve('react-dom/package.json')),
    },
}).outputFiles[0].text;
const timeout = setTimeout(() => {
    console.error('Settings test timed out');
    app.exit(1);
}, 30000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
            },
        });
        await win.loadURL('data:text/html,<div id="root"></div>');
        const execute = (code) => win.webContents.executeJavaScript(code);
        await execute(`window.metadata=${JSON.stringify(metadata)};`);
        await execute(browser);
        const result =
            await execute(`(async()=>{const wait=()=>new Promise(r=>setTimeout(r,100));
    for(let i=0;i<30&&!document.querySelector('button');i++)await wait();
    await wait();await wait();
    const entry=Array.from(document.querySelectorAll('[role=button]')).find(b=>b.textContent.includes('Kawaikara'));
    if(!entry)throw Error('No bundle entry: '+document.body.innerText);entry.click();await wait();
    const toggle=document.querySelector('[role=switch],input[type=checkbox]');
    if(!toggle)throw Error('No activation control: '+document.body.innerText);
    const initial=toggle.getAttribute('aria-checked')??String(toggle.checked);toggle.click();await wait();
    const selector=document.querySelector('[role=combobox]');selector.click();await wait();
    const options=Array.from(document.querySelectorAll('[role=option]'));const labels=options.map(o=>o.textContent);
    options.find(o=>o.textContent.includes('FSR 1')).click();await wait();
    const selected=window.saved.providerSettings['kawaikara.chzzk'];
    const label=selector.getAttribute('data-selected-label');
    selector.click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent.includes('Anime4K')).click();await wait();
    const selectors=Array.from(document.querySelectorAll('[role=combobox]'));
    const defaults=selectors.slice(1,3).map(s=>s.getAttribute('data-selected-label'));
    selectors[1].click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent==='또렷하게').click();await wait();
    selectors[2].click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent==='보통').click();await wait();
    selectors[1].click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent==='강하게 · 흐림 제거').click();await wait();
    selectors[3].click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent==='균형 · GPU 부하 낮음').click();await wait();
    selectors[4].click();await wait();Array.from(document.querySelectorAll('[role=option]')).find(o=>o.textContent==='강하게').click();await wait();
    return {initial,selected,labels,label,defaults,graph:window.saved.providerSettings['kawaikara.chzzk']};})()`);
        console.log(result);
        assert.equal(result.initial, 'false');
        assert.equal(result.selected['plugins.upscaling'], true);
        assert.equal(result.selected['upscaling.engine'], 'fsr1');
        assert.equal(result.labels.length, 4);
        assert.match(result.label, /공간 업스케일링/);
        assert.deepEqual(result.defaults, ['부드럽게', '약하게']);
        assert.equal(result.graph['upscaling.engine'], 'anime4k');
        assert.equal(result.graph['upscaling.anime4k.restore'], 'strong');
        assert.equal(result.graph['upscaling.anime4k.denoise'], 'medium');
        assert.equal(result.graph['upscaling.anime4k.quality'], 'balanced');
        assert.equal(result.graph['upscaling.fsr1.sharpness'], 'strong');
        win.destroy();
        clearTimeout(timeout);
        console.log(
            'Plugin switch, engine Select and restoration/denoise controls passed',
        );
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(timeout);
        app.exit(1);
    });
