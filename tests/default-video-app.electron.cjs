const { app, BrowserWindow } = require('electron');
const { buildSync } = require('esbuild');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const labels = Object.fromEntries(['en', 'ko', 'ja'].map(locale => [locale, require(`../locales/${locale}.json`).app]));
const script = buildSync({ stdin: { resolveDir: root, loader: 'tsx', contents: `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {flushSync} from 'react-dom';
  import {KawaiProvider} from '@kawaikara/kawai-ui';
  import {DefaultVideoAppControl} from './src/Renderer/View/Preference/Tabs/DefaultVideoAppControl';
  const root=createRoot(document.getElementById('root'));
  const labels=${JSON.stringify(labels)};
  window.calls=0;window.fail=false;
  window.kawaikara={application:{openDefaultVideoAppSettings:async()=>{
    window.calls++;await new Promise(resolve=>window.finish=resolve);if(window.fail)throw Error('failed');
  }}};
  window.renderControl=(locale,enabled=true)=>flushSync(()=>root.render(
    <KawaiProvider><DefaultVideoAppControl key={locale+enabled} locale="en-US" enabled={enabled}
      disabled={false} messages={labels[locale].defaultVideoApp}/></KawaiProvider>));
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
const css = readFileSync(require.resolve('@kawaikara/kawai-ui/styles.css'), 'utf8');
const watchdog = setTimeout(() => { console.error('Default video app UI test timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 600, height: 300,
    webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<style>${css}</style><div id="root"></div>`)}`);
  await win.webContents.executeJavaScript(script);
  for (const locale of ['en', 'ko', 'ja']) {
    const result = await win.webContents.executeJavaScript(`(async()=>{
      renderControl('${locale}');calls=0;fail=false;
      const button=document.querySelector('button');const text=button.textContent;
      button.click();await new Promise(r=>setTimeout(r,20));button.click();
      const disabled=button.disabled;finish();await new Promise(r=>setTimeout(r,20));
      const count=calls;fail=true;button.click();await new Promise(r=>setTimeout(r,20));finish();
      await new Promise(r=>setTimeout(r,20));const error=document.querySelector('[role="alert"]')?.textContent;
      renderControl('${locale}',false);
      return {text,disabled,count,error,unavailable:document.querySelector('button').disabled};
    })()`);
    assert.equal(result.text, labels[locale].defaultVideoApp.button);
    assert.equal(result.disabled, true);assert.equal(result.count, 1);
    assert.equal(result.error, labels[locale].defaultVideoApp.failed);
    assert.equal(result.unavailable, true);
  }
  clearTimeout(watchdog);win.destroy();console.log('Default video app: 3 locales, busy/error and unavailable states passed.');app.exit(0);
}).catch(error => { console.error(error);clearTimeout(watchdog);app.exit(1); });
