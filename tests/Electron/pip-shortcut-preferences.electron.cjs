const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
const catalogs = Object.fromEntries(
    ['en', 'ko', 'ja'].map((locale) => [
        locale,
        require(`../../locales/${locale}.json`).app,
    ]),
);
const script = buildSync({
    stdin: {
        resolveDir: root,
        loader: 'tsx',
        contents: `
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {KawaiProvider} from '@kawaikara/kawai-ui';
import {AdvancedTab} from './src/Renderer/View/Preference/Tabs/AdvancedTab';
import {PictureInPicturePlacementControl} from './src/Renderer/View/Preference/PictureInPicturePlacementControl';
import {useMenuShortcuts} from './src/Renderer/View/Menu/Hooks/useMenuShortcuts';
const catalogs=${JSON.stringify(catalogs)};
const root=createRoot(document.getElementById('root'));
function Controls({locale}){
 const m=catalogs[locale];const [preferences,setPreferences]=useState({kawaiShortcutEnabled:true,kawaiShortcutUnlimitedWait:false,kawaiShortcutDelaySeconds:1});
 const [placement,setPlacement]=useState({position:'top-right',monitor:{mode:'current'}});
 return <KawaiProvider><AdvancedTab messages={m} preferences={preferences} saving={false} onUpdate={p=>setPreferences({...preferences,...p})}/>
 <PictureInPicturePlacementControl value={placement} onChange={setPlacement}
 displays={[{id:'1',label:'Display one',width:1920,height:1080,current:true,primary:true}]}
 messages={{bottomLeft:m.pipPositionBottomLeft,bottomRight:m.pipPositionBottomRight,currentDisplay:m.pipMonitorCurrent,
 display:m.pipMonitorDisplay,lastDisplay:m.pipMonitorLast,lastPosition:m.pipMonitorLastPosition,monitor:m.pictureInPictureMonitor,
 monitorDescription:m.pictureInPictureMonitorDescription,position:m.pictureInPicturePosition,positionDescription:m.pictureInPicturePositionDescription,
 primary:m.primaryDisplay,topLeft:m.pipPositionTopLeft,topRight:m.pipPositionTopRight,align:m.pipAlign,alignDescription:m.pipAlignDescription}}/>
 </KawaiProvider>;
}
function Shortcuts({unlimited}){
 const [category,setCategory]=useState(),[page,setPage]=useState(0),[visible,setVisible]=useState(true);
 const timer=useRef(),active=useRef(false),elements=useRef(new Map()),address=useRef(null);
 useMenuShortcuts({menuVisible:visible,view:'menu',preferences:{kawaiShortcutEnabled:true,kawaiShortcutUnlimitedWait:unlimited,
 kawaiShortcutDelaySeconds:0.1,shortcuts:{}},shortcutTargetCategory:category,kawaiShortcutPage:page,
 groups:[['video',[{id:'test.video'}]]],categoryElements:elements,reduceMotion:true,setShortcutTargetCategory:setCategory,
 setKawaiShortcutPage:setPage,shortcutHighlightTimer:timer,kawaiShortcutActiveRef:active,addressInputRef:address,
 openSite:id=>window.opened=id});
 window.snapshot=()=>({category,page,timer:timer.current,active:active.current});
 window.hideMenu=()=>flushSync(()=>setVisible(false));
 return null;
}
window.controls=locale=>flushSync(()=>root.render(<Controls key={locale} locale={locale}/>));
window.shortcuts=unlimited=>flushSync(()=>root.render(<Shortcuts key={String(unlimited)} unlimited={unlimited}/>));
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
    console.error('PiP/shortcut UI test timed out');
    app.exit(1);
}, 60000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            width: 900,
            height: 900,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
                offscreen: true,
            },
        });
        await win.loadURL(
            'data:text/html;charset=utf-8,' +
                encodeURIComponent(
                    '<style>' + css + '</style><div id="root"></div>',
                ),
        );
        await win.webContents.executeJavaScript(script);
        for (const locale of ['en', 'ko', 'ja']) {
            const result = await win.webContents.executeJavaScript(`(async()=>{
   controls('${locale}');await new Promise(r=>setTimeout(r,30));
   const switches=[...document.querySelectorAll('[role="switch"]')];
   const number=document.querySelector('.number-preference-control input');
   const enabled=!number.disabled;switches[1].click();await new Promise(r=>setTimeout(r,30));
   const disabled=number.disabled,grey=number.closest('.number-preference-control').classList.contains('is-disabled');
   switches[1].click();await new Promise(r=>setTimeout(r,30));
   const restored=!number.disabled&&number.value==='1';
   const selects=[...document.querySelectorAll('[role="combobox"]')],options=[];
   for(const select of selects){
     select.click();await new Promise(r=>setTimeout(r,30));
     const list=document.getElementById(select.getAttribute('aria-controls'));
     options.push([...list.querySelectorAll('[role="option"]')].map(o=>o.textContent));
     select.click();await new Promise(r=>setTimeout(r,180));
   }
   return {switches:switches.length,enabled,disabled,grey,restored,options};
  })()`);
            assert.equal(result.switches, 3);
            assert.equal(result.enabled, true);
            assert.equal(result.disabled, true);
            assert.equal(result.grey, true);
            assert.equal(result.restored, true);
            const m = catalogs[locale];
            assert.deepEqual(result.options[0], [
                m.pipPositionTopLeft,
                m.pipPositionTopRight,
                m.pipPositionBottomLeft,
                m.pipPositionBottomRight,
            ]);
            assert.deepEqual(result.options[1].slice(0, 4), [
                m.pipMonitorCurrent,
                m.pipMonitorLastPosition,
                m.pipMonitorLast,
                m.primaryDisplay,
            ]);
            assert.equal(result.options[1].length, 5);
            assert.ok(result.options[1][4].includes('Display one'));
        }
        const result = await win.webContents.executeJavaScript(`(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));const key=k=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  shortcuts(true);key('1');await wait(250);const held=snapshot();key('q');key('9');await wait(20);const unrelated=snapshot();
  key('Escape');await wait(20);const cancelled=snapshot();key('1');await wait(20);key('1');await wait(20);const chosen=window.opened;
  key('1');await wait(20);hideMenu();await wait(20);const hidden=snapshot();
  shortcuts(false);key('1');await wait(250);const timed=snapshot();
  return {held,unrelated,cancelled,chosen,hidden,timed};
 })()`);
        assert.equal(result.held.category, 'video');
        assert.equal(result.held.timer, undefined);
        assert.equal(result.unrelated.category, 'video');
        assert.equal(result.cancelled.category, undefined);
        assert.equal(result.chosen, 'test.video');
        assert.equal(result.hidden.active, false);
        assert.equal(result.timed.category, undefined);
        win.destroy();
        clearTimeout(watchdog);
        console.log(
            'PiP controls and unlimited/timed shortcut behavior passed in Electron (3 locales).',
        );
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
