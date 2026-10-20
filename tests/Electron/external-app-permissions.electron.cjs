const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
const catalogs = Object.fromEntries(
    ['en', 'ko', 'ja'].map((locale) => [
        locale,
        require(`../../locales/${locale}.json`).app.externalApps,
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
import {ExternalAppApproval} from './src/Renderer/View/Preference/ExternalAppApproval';
const catalogs=${JSON.stringify(catalogs)};
const root=createRoot(document.getElementById('root'));
window.calls=[];window.state={registrations:[]};
window.kawaikara={application:{externalApps:async(operation,id,grants)=>{
 if(operation!=='status'){window.calls.push({operation,id,grants});if(operation==='automatic')window.state.connectionAutomatic=id==='true';else if(operation!=='connect')window.state={registrations:[]};}
 return structuredClone(window.state);
}}};
window.show=locale=>{
 window.calls=[];
 window.state={registrations:[],approval:{id:locale,descriptor:{schemaVersion:1,id:'test.app',name:'Adapter <script>',revision:'1',
 permissions:[{id:'url',kind:'resource.url',origins:['https://www.youtube.com']},{id:'cookies',kind:'cookies.read',origins:['https://www.youtube.com']}],
 actions:[{id:'open',permissions:['url']},{id:'authenticated',permissions:['cookies']}]}}};
 window.original=structuredClone(window.state);
 flushSync(()=>root.render(<KawaiProvider><ExternalAppApproval key={locale} messages={catalogs[locale]}/></KawaiProvider>));
 };
window.showSettings=locale=>{
 const descriptor={schemaVersion:1,id:'test.app',name:'Test App',revision:'1',permissions:[{id:'url',kind:'resource.url',origins:['https://www.youtube.com']},{id:'cookies',kind:'cookies.read',origins:['https://www.youtube.com']}],actions:[{id:'open',permissions:['url']}]};
 window.calls=[];
 window.state={registrations:[{appId:'test.app',name:'Test App',fingerprint:'test',grants:['url'],providers:[{providerId:'youtube',enabled:true,grants:['url'],cookies:{cookies:'ask'}}]}],descriptors:[descriptor],providers:[{id:'youtube',name:'YouTube',appIds:['test.app']},{id:'unrelated',name:'Unrelated Provider',appIds:['other.app']}]};
 flushSync(()=>root.render(<KawaiProvider><ExternalAppApproval key={'settings-'+locale+'-'+Math.random()} messages={catalogs[locale]} showRegistrations/></KawaiProvider>));
};
`,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    loader: { '.css': 'empty' },
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = [
    require.resolve('@kawaikara/kawai-ui/styles.css'),
    path.join(root, 'src/Renderer/Styles/Overlay.css'),
    path.join(
        root,
        'src/Renderer/View/Preference/Tabs/WebExtensionControl.css',
    ),
    path.join(root, 'src/Renderer/View/Preference/ExternalAppRegistrations.css'),
]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
const timer = setTimeout(() => app.exit(1), 30000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            width: 780,
            height: 660,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
                offscreen: true,
            },
        });
        await win.loadURL(
            'data:text/html;charset=utf-8,' +
                encodeURIComponent(
                    '<style>' + css + '</style><div id="root" class="kawai-theme kawai-theme-dark" style="padding:16px;box-sizing:border-box"></div>',
                ),
        );
        await win.webContents.executeJavaScript(script);
        for (const locale of ['en', 'ko', 'ja']) {
            await win.webContents.executeJavaScript(
                `window.show(${JSON.stringify(locale)});new Promise(resolve=>setTimeout(resolve,100))`,
            );
            const snapshot = await win.webContents.executeJavaScript(
                `(()=>{const d=document.querySelector('dialog');return {open:d.open,checked:[...d.querySelectorAll('input')].map(i=>i.checked),text:d.textContent,overflow:d.scrollWidth>d.clientWidth};})()`,
            );
            assert.equal(snapshot.open, true);
            assert.deepEqual(snapshot.checked, [false, false]);
            assert.equal(snapshot.overflow, false);
            assert.ok(snapshot.text.includes('Adapter <script>'));
            await win.webContents.executeJavaScript(
                `document.querySelector('input').click();new Promise(resolve=>setTimeout(resolve,30))`,
            );
            await win.webContents.executeJavaScript(
                `document.querySelectorAll('dialog button')[1].click();new Promise(resolve=>setTimeout(resolve,30))`,
            );
            const calls =
                await win.webContents.executeJavaScript('window.calls');
            assert.deepEqual(calls, [
                { operation: 'approve', id: locale, grants: ['url'] },
            ]);
            assert.equal(
                await win.webContents.executeJavaScript(
                    'document.querySelector("dialog").open',
                ),
                false,
            );
        await win.webContents.executeJavaScript(`window.state=window.original;new Promise(resolve=>setTimeout(resolve,600))`);
        assert.equal(await win.webContents.executeJavaScript('document.querySelector("dialog").open'), false, 'A stale status response must not reopen a decided prompt');
        await win.webContents.executeJavaScript('window.state={registrations:[]}');
        }
        // Fresh valid locale; Escape cancellation is tested through the dialog cancel event.
        await win.webContents.executeJavaScript(
            `window.show('en');new Promise(resolve=>setTimeout(resolve,100))`,
        );
        await win.webContents.executeJavaScript(
            `document.querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));new Promise(resolve=>setTimeout(resolve,30))`,
        );
        assert.equal(
            (await win.webContents.executeJavaScript('window.calls'))[0]
                .operation,
            'deny',
        );
        for (const locale of ['en', 'ko', 'ja']) {
            await win.webContents.executeJavaScript(`
                window.show(${JSON.stringify(locale)});
                window.state.approval.id='cookie-'+${JSON.stringify(locale)};
                window.state.approval.provider={id:'test.youtube',name:'YouTube'};
                window.state.approval.cookiePermission='cookies';
                new Promise(resolve=>setTimeout(resolve,650));
            `);
            const cookie = await win.webContents.executeJavaScript(`(()=>{const d=document.querySelector('dialog');return {open:d.open, buttons:d.querySelectorAll('button').length, inputs:d.querySelectorAll('input').length, text:d.textContent, overflow:d.scrollWidth>d.clientWidth};})()`);
            assert.equal(cookie.open, true);
            assert.equal(cookie.buttons, 3);
            assert.equal(cookie.inputs, 0);
            assert.equal(cookie.overflow, false);
            assert.ok(cookie.text.includes('YouTube'));
            await win.webContents.executeJavaScript(`document.querySelectorAll('dialog button')[2].click();new Promise(resolve=>setTimeout(resolve,30))`);
            const remembered = await win.webContents.executeJavaScript('window.calls.at(-1)');
            assert.equal(remembered.operation, 'allow-always');
            assert.deepEqual(remembered.grants, ['cookies']);
        }
        for (const locale of ['en', 'ko', 'ja']) {
            await win.webContents.executeJavaScript(`window.showSettings(${JSON.stringify(locale)});new Promise(resolve=>setTimeout(resolve,100))`);
            assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('fieldset').length`), 0);
            await win.webContents.executeJavaScript(`document.querySelector('.external-app-actions button').click();new Promise(resolve=>setTimeout(resolve,40))`);
            const settings = await win.webContents.executeJavaScript(`({text:document.body.textContent,fields:document.querySelectorAll('fieldset').length,native:document.querySelectorAll('select').length,open:document.querySelector('.external-app-permissions').open,mode:document.querySelector('[role="combobox"]').textContent})`);
            assert.equal(settings.fields, 1);
            assert.equal(settings.native, 0);
            assert.equal(settings.open, true);
            assert.ok(settings.mode.includes(catalogs[locale].ask));
            assert.equal(settings.text.includes('Unrelated Provider'), false);
            await win.webContents.executeJavaScript(`document.querySelector('[role="combobox"]').click();new Promise(resolve=>setTimeout(resolve,250))`);
            const optionCount = await win.webContents.executeJavaScript(`document.querySelectorAll('[role="option"]').length`);
            assert.equal(optionCount, 3);
            if (locale === 'en') writeFileSync('/tmp/external-app-permissions-ui.png', (await win.webContents.capturePage()).toPNG());
            await win.webContents.executeJavaScript(`document.querySelectorAll('[role="option"]')[1].click();new Promise(resolve=>setTimeout(resolve,40))`);
            const cookieChange = await win.webContents.executeJavaScript('window.calls.at(-1)');
            assert.equal(cookieChange.grants.cookies.cookies, 'allow');
            await win.webContents.executeJavaScript(`window.showSettings(${JSON.stringify(locale)});new Promise(resolve=>setTimeout(resolve,100))`);
            await win.webContents.executeJavaScript(`document.querySelector('.external-app-actions button').click();new Promise(resolve=>setTimeout(resolve,40))`);

            win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' });
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.external-app-permissions').open`), false);
            await win.webContents.executeJavaScript(`document.querySelector('.external-app-actions button').click();new Promise(resolve=>setTimeout(resolve,60))`);
            const outside = await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.external-app-actions button').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
            win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...outside });
            win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...outside });
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.external-app-permissions').open`), false, 'outside click must not reopen the popup through the underlying button');
            await win.webContents.executeJavaScript(`document.querySelector('.external-app-actions button').click();new Promise(resolve=>setTimeout(resolve,60))`);
            await win.webContents.executeJavaScript(`document.querySelector('fieldset input').click();new Promise(resolve=>setTimeout(resolve,30))`);
            const decision = await win.webContents.executeJavaScript('window.calls.at(-1)');
            assert.equal(decision.operation, 'configure');
            assert.equal(decision.grants.providerId, 'youtube');
            assert.equal(decision.grants.enabled, false);
        }
        await win.webContents.executeJavaScript(`
            window.showSettings('en');
            window.state.registrations=[];
            window.state.development=[];
            window.state.connectionAutomatic=true;
            window.state.connectionCandidates=[{appId:'test.app',clientId:'00000000-0000-0000-0000-000000000000'}];
            new Promise(resolve=>setTimeout(resolve,650));
        `);
        const manual = await win.webContents.executeJavaScript(`(async()=>{
            const wait=()=>new Promise(resolve=>setTimeout(resolve,60));
            document.querySelector('input').click();await wait();
            const automatic=window.calls.at(-1);
            [...document.querySelectorAll('button')].find(b=>b.textContent==='Connect manually').click();await wait();
            const candidate=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Test App ·'));
            const overflow=document.querySelector('#root').scrollWidth>document.querySelector('#root').clientWidth;
            candidate.click();await wait();
            return {automatic,connect:window.calls.at(-1),overflow,text:document.body.textContent};
        })()`);
        assert.equal(manual.automatic.operation,'automatic');
        assert.equal(manual.automatic.id,'false');
        assert.equal(manual.connect.operation,'connect');
        assert.equal(manual.connect.id,'00000000-0000-0000-0000-000000000000');
        assert.equal(manual.overflow,false);
        assert.ok(manual.text.includes('Connection requested'));
        writeFileSync('/tmp/external-app-connection-controls.png', (await win.webContents.capturePage()).toPNG());
        win.destroy();
        clearTimeout(timer);
        console.log(
            'External app registration popup: partial approval, cancel, escaped app text, per-use cookie decisions and three locales passed.',
        );
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(timer);
        app.exit(1);
    });
