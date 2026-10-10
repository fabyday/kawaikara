const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Real React/KawaiUI interactions in an isolated profile; native dialogs and restart are stubbed.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
app.setPath(
    'userData',
    mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-path-ui-')),
);
app.disableHardwareAcceleration();
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
const labels = Object.fromEntries(
    ['ko', 'en', 'ja'].map((locale) => [
        locale,
        JSON.parse(
            readFileSync(path.join(root, 'locales', `${locale}.json`), 'utf8'),
        ).app,
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
  import {AdvancedTab} from './src/Renderer/View/Preference/Tabs/AdvancedTab';
  import {ShortcutKeycaps} from './src/Renderer/Component/ShortcutKeycaps';
  const root=createRoot(document.getElementById('root'));
  window.labels=${JSON.stringify(labels)};
  window.calls=[];window.chosen=undefined;window.saveSucceeds=true;
  window.kawaikara={platform:'win32',data:{
    selectLocation:async()=>window.chosen,
    changeLocation:async(directory,locale)=>{window.calls.push(['change',directory,locale]);return {status:'cancelled'};}
  }};
  const preferences={appLocale:'en-US',kawaiShortcutEnabled:true,kawaiShortcutDelaySeconds:1};
  window.renderAdvanced=(locale='en',windows=true,installed=true)=>flushSync(()=>root.render(
    <KawaiProvider><main className="kawai-theme kawai-theme-light" style={{padding:24}}>
      <AdvancedTab key={locale+windows+installed} messages={labels[locale]} preferences={preferences} saving={false}
        onUpdate={()=>{}} dataLocation={windows?{currentPath:'C:\\\\Data\\\\Kawaikara Nightly',canChange:installed}:undefined}
        onSavePreferences={async()=>{window.calls.push(['save']);return window.saveSucceeds?preferences:undefined;}} />
      <ShortcutKeycaps accelerator="Control+Alt+N" />
    </main></KawaiProvider>));
`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = [
    require.resolve('@kawaikara/kawai-ui/styles.css'),
    path.join(root, 'src/Renderer/Styles/Overlay.css'),
]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
const watchdog = setTimeout(() => {
    console.error('Data location UI test timed out');
    app.exit(1);
}, 60000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            width: 900,
            height: 720,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
                offscreen: true,
            },
        });
        await win.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(`<style>${css}</style><div id="root"></div>`)}`,
        );
        await win.webContents.executeJavaScript(script);
        for (const locale of ['ko', 'en', 'ja']) {
            const result = await win.webContents.executeJavaScript(`(async()=>{
      renderAdvanced('${locale}');await new Promise(r=>setTimeout(r,20));
      const row=document.querySelector('.app-data-path-row'),input=row.querySelector('input');
      const label=document.getElementById(input.getAttribute('aria-labelledby')),browse=row.querySelector('button');
      const rectangles=[label,input,browse].map(el=>el.getBoundingClientRect());
      const apply=[...document.querySelectorAll('button')].find(el=>el.textContent===labels['${locale}'].appDataLocation.apply);
      const result={aligned:Math.max(...rectangles.map(r=>r.y+r.height/2))-Math.min(...rectangles.map(r=>r.y+r.height/2))<2,
        fits:row.scrollWidth<=row.clientWidth,initiallyDisabled:apply.disabled,
        caps:[...document.querySelectorAll('.shortcut-key-part kbd')].map(el=>el.textContent),
        separatorCount:document.querySelectorAll('.shortcut-key-part i').length};
      chosen='D:\\\\Picked';browse.click();await new Promise(r=>setTimeout(r,20));result.picked=input.value;
      chosen=undefined;browse.click();await new Promise(r=>setTimeout(r,20));result.cancelPreserved=input.value;
      calls=[];apply.click();await new Promise(r=>setTimeout(r,30));result.actions=[...calls];
      calls=[];saveSucceeds=false;apply.click();await new Promise(r=>setTimeout(r,30));result.failedSave=[...calls];saveSucceeds=true;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(input,'E:\\\\Typed');input.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,20));calls=[];apply.click();await new Promise(r=>setTimeout(r,30));result.typed=[...calls];
      return result;
    })()`);
            assert.ok(
                result.aligned && result.fits,
                `${locale}: path row must align without overlap`,
            );
            assert.equal(result.initiallyDisabled, true);
            assert.deepEqual(result.caps, ['Ctrl', 'Alt', 'N']);
            assert.equal(result.separatorCount, 0);
            assert.equal(result.picked, 'D:\\Picked');
            assert.equal(result.cancelPreserved, 'D:\\Picked');
            assert.deepEqual(result.actions, [
                ['save'],
                ['change', 'D:\\Picked', 'en-US'],
            ]);
            assert.deepEqual(result.failedSave, [['save']]);
            assert.deepEqual(result.typed, [
                ['save'],
                ['change', 'E:\\Typed', 'en-US'],
            ]);
        }
        const capability = await win.webContents.executeJavaScript(`(()=>{
    renderAdvanced('en',false);const macHidden=!document.querySelector('#preference-app-data-path');
    renderAdvanced('en',true,false);const devDisabled=document.querySelector('#preference-app-data-path').disabled;
    return {macHidden,devDisabled};
  })()`);
        assert.deepEqual(capability, { macHidden: true, devDisabled: true });
        if (process.env.DATA_LOCATION_SCREENSHOT) {
            await win.webContents.executeJavaScript(`renderAdvanced('ko')`);
            await new Promise((r) => setTimeout(r, 100));
            writeFileSync(
                process.env.DATA_LOCATION_SCREENSHOT,
                (await win.webContents.capturePage()).toPNG(),
            );
        }
        win.destroy();
        clearTimeout(watchdog);
        console.log(
            'Data location UI: 3 locales, picker/cancel/manual entry, save failure, platform gating and keycaps passed',
        );
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
