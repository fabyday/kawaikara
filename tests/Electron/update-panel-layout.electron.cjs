const { getTestTempRoot } = require('../Helpers/Paths.cjs');
// Real React/KawaiUI layout; no updater, downloads, installer, or user profile is touched.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
app.setPath(
    'userData',
    mkdtempSync(path.join(getTestTempRoot(), 'kawaikara-update-layout-')),
);
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const labels = Object.fromEntries(
    ['en', 'ko', 'ja'].map((locale) => [
        locale,
        JSON.parse(
            readFileSync(path.join(root, 'locales', `${locale}.json`), 'utf8'),
        ).update,
    ]),
);
const fixture = buildSync({
    stdin: {
        resolveDir: root,
        loader: 'tsx',
        contents: `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {flushSync} from 'react-dom';
  import {KawaiProvider} from '@kawaikara/kawai-ui';
  import {motion} from 'motion/react';
  import {UpdatePanel} from './src/Renderer/View/Update/UpdatePanel';
  const root=createRoot(document.getElementById('root')),labels=${JSON.stringify(labels)};
  window.updateActions=[];
  window.renderUpdate=(state,locale,theme,view='status')=>flushSync(()=>root.render(
    state ? <KawaiProvider><motion.div className={'update-motion-shell kawai-theme kawai-theme-'+theme}
      initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.2}}>
      <UpdatePanel state={state} labels={labels[locale]} locale={locale} view={view}
        onDismiss={()=>window.updateActions.push('dismiss')} onDownload={()=>window.updateActions.push('download')}
        onInstall={()=>window.updateActions.push('install')} onRetry={()=>window.updateActions.push('retry')} />
    </motion.div></KawaiProvider> : null));
`,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    loader: { '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;
const css = [
    require.resolve('@kawaikara/kawai-ui/styles.css'),
    path.join(root, 'src/Renderer/Styles/Overlay.css'),
    path.join(root, 'src/Renderer/Styles/LogViewer.css'),
    path.join(root, 'src/Renderer/Styles/Update.css'),
]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
const watchdog = setTimeout(() => {
    console.error('Update layout test timed out');
    app.exit(1);
}, 60000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
                backgroundThrottling: false,
                offscreen: true,
            },
        });
        await win.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(`<style>${css}</style><div id="root"></div>`)}`,
        );
        await win.webContents.executeJavaScript(fixture);
        for (const [width, height] of [
            [1100, 950],
            [800, 600],
            [360, 480],
        ]) {
            win.setContentSize(width, height);
            const results = await win.webContents.executeJavaScript(`(async()=>{
      // Hidden windows may suspend rAF. flushSync + layout reads do not require a compositor frame.
      const wait=()=>new Promise(r=>setTimeout(r,20));
      await wait();const results=[];
      for(const origin of ['automatic','manual'])for(const locale of ['en','ko','ja'])for(const theme of ['dark','light']){
        // Reopen from preferences: include the first layout before image decode/entry animation.
        renderUpdate(null,locale,theme);
        const phases=['checking','available','downloading','downloaded','preparing','installing','up-to-date','unsupported','error'];
        for(const phase of phases){
          renderUpdate({phase,origin,channel:'nightly',currentVersion:'3.0.0-nightly.20261009.1234.1.g01234567',
            latestVersion:phase==='checking'?undefined:'3.0.0-nightly.20261010.1235.1.g89abcdef',
            releaseNotes:['available','downloading','downloaded'].includes(phase)?'Release notes':undefined,
            progress:phase==='downloading'?{percent:63.4,transferred:63400000,total:100000000,bytesPerSecond:5800000}:undefined,
            canRetryInstall:phase==='error',
            error:phase==='error'?'Signature verification failed. '.repeat(150):undefined},locale,theme);
          const firstPaint=document.querySelector('.update-panel').getBoundingClientRect().toJSON();
          await wait();const panel=document.querySelector('.update-panel'),rect=panel.getBoundingClientRect();
          const image=panel.querySelector('img'),imageRect=image.getBoundingClientRect();
          const body=panel.querySelector('.update-status-body');
          const footer=panel.querySelector('.update-status-footer');
          const heading=panel.querySelector('.update-heading');
          const drag=new DragEvent('dragstart',{bubbles:true,cancelable:true});heading.dispatchEvent(drag);
          panel.scrollTop=panel.scrollHeight;const actions=panel.querySelector('.update-actions')?.getBoundingClientRect();
          results.push({origin,locale,theme,phase,width:rect.width,height:rect.height,x:rect.x,y:rect.y,
            firstPaint,
            bodyHeight:body.getBoundingClientRect().height,footerHeight:footer.getBoundingClientRect().height,
            viewport:[innerWidth,innerHeight],horizontalOverflow:panel.scrollWidth>panel.clientWidth+1,
            actionsReachable:!actions||actions.bottom<=rect.bottom+1,
            buttonsFit:[...panel.querySelectorAll('.update-status-footer button')].every(button=>{
              const bounds=button.getBoundingClientRect();return bounds.x>=rect.x&&bounds.right<=rect.right+1&&bounds.bottom<=rect.bottom+1;
            }),
            imageFits:Math.abs(imageRect.width-panel.clientWidth)<1&&Math.abs(imageRect.height-imageRect.width/2)<=1,
            imageUncropped:getComputedStyle(image).objectFit==='contain',
            selectionDisabled:getComputedStyle(heading).userSelect==='none',
            dragDisabled:drag.defaultPrevented&&!image.draggable,
            bodyHorizontalOverflow:body.scrollWidth>body.clientWidth+1,
            bodyVerticalOverflow:body.scrollHeight>body.clientHeight+1});panel.scrollTop=0;
        }
      }return results;
    })()`);
            for (const result of results) {
                const baseline = results.find(
                    (r) => r.origin === result.origin,
                );
                const label = `${width}x${height}/${result.origin}/${result.locale}/${result.theme}/${result.phase}`;
                for (const key of ['width', 'height', 'x', 'y'])
                    assert.ok(
                        Math.abs(result[key] - baseline[key]) < 1,
                        `${label}: ${key} ${result[key]} != ${baseline[key]}`,
                    );
                for (const key of ['width', 'height', 'x', 'y'])
                    assert.ok(
                        Math.abs(result.firstPaint[key] - baseline[key]) < 1,
                        `${label}: first paint ${key} changed`,
                    );
                for (const key of ['bodyHeight', 'footerHeight'])
                    assert.ok(
                        Math.abs(result[key] - baseline[key]) < 1,
                        `${label}: ${key} ${result[key]} != ${baseline[key]}`,
                    );
                assert.ok(
                    result.x >= 0 &&
                        result.y >= 0 &&
                        result.x + result.width <= result.viewport[0] + 1 &&
                        result.y + result.height <= result.viewport[1] + 1,
                    `${label}: panel outside viewport`,
                );
                assert.equal(
                    result.horizontalOverflow,
                    false,
                    `${label}: horizontal overflow`,
                );
                assert.equal(
                    result.actionsReachable,
                    true,
                    `${label}: actions unreachable`,
                );
                assert.equal(
                    result.buttonsFit,
                    true,
                    `${label}: footer buttons overflow`,
                );
                if (width === 1100)
                    assert.ok(
                        Math.abs(result.width - 640) < 1 &&
                            Math.abs(result.height - 600) < 1,
                        `${label}: original panel dimensions changed`,
                    );
                assert.equal(
                    result.imageFits && result.imageUncropped,
                    true,
                    `${label}: banner cropped or distorted`,
                );
                assert.equal(
                    result.selectionDisabled && result.dragDisabled,
                    true,
                    `${label}: text/image selectable or draggable`,
                );
                assert.equal(
                    result.bodyHorizontalOverflow,
                    false,
                    `${label}: body horizontal overflow`,
                );
                if (width === 1100 && result.phase !== 'error')
                    assert.equal(
                        result.bodyVerticalOverflow,
                        false,
                        `${label}: normal text does not fit`,
                    );
            }
            console.log(
                `${width}x${height}: ${results.length} state/locale/theme/origin layouts have stable bounds and reachable actions`,
            );
        }
        win.setContentSize(1100, 950);
        const clicked = await win.webContents.executeJavaScript(`(async()=>{
    renderUpdate({phase:'available',origin:'manual',channel:'nightly',currentVersion:'3.0.0-nightly.12',
      latestVersion:'3.0.0-nightly.13',releaseNotes:'Release notes'},'ko','dark');
    await document.querySelector('.update-kawaikara-image').decode();
    const button=document.querySelector('.update-actions button'),rect=button.getBoundingClientRect();
    if(!button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)))return false;
    button.click();return updateActions.includes('download');
  })()`);
        assert.equal(
            clicked,
            true,
            'Update now button blocked by drag/selection prevention',
        );
        for (const locale of ['en', 'ko', 'ja']) {
            const actions = await win.webContents.executeJavaScript(`(() => {
      const state={phase:'available',origin:'manual',channel:'nightly',currentVersion:'3.0.0-nightly.12'};
      renderUpdate(state,'${locale}','dark');
      const buttons=[...document.querySelectorAll('.update-actions button')];
      const labels=buttons.map(button=>button.textContent);
      window.updateActions=[];buttons[1].click();
      const deferred=[...updateActions];
      const busy=[];
      for(const origin of ['manual','automatic'])for(const phase of ['downloading','downloaded','preparing','installing']){
        renderUpdate({...state,origin,phase},'${locale}','dark');
        busy.push(document.querySelectorAll('.update-actions button').length);
      }
      renderUpdate({...state,origin:'automatic'},'${locale}','dark');
      return {labels,deferred,busy,automatic:document.querySelectorAll('.update-actions button').length};
    })()`);
            assert.deepEqual(actions.labels, [
                labels[locale].download,
                labels[locale].later,
            ]);
            assert.deepEqual(
                actions.deferred,
                ['dismiss'],
                'Later must not download or install',
            );
            assert.ok(
                actions.busy.every((count) => count === 0),
                'An accepted update has no second installation button',
            );
            assert.equal(
                actions.automatic,
                0,
                'Automatic updates do not ask for confirmation',
            );
        }
        const activity = await win.webContents.executeJavaScript(`(()=>{
    const state={phase:'installing',origin:'automatic',channel:'nightly',currentVersion:'3.0.0-nightly.12'};
    renderUpdate(state,'ko','dark');
    const current=document.querySelector('.update-phase-content:not([data-exiting])');
    const head=current.querySelector('.update-activity-head');
    const tail=current.querySelector('.update-activity-tail');
    const style=getComputedStyle(head);
    renderUpdate({...state,progress:{percent:100,total:100,transferred:100,bytesPerSecond:0}},'ko','dark');
    return {samePhasePreservesContent:current===document.querySelector('.update-phase-content:not([data-exiting])'),
      pathLength:head.getAttribute('pathLength'),animation:style.animationName,
      duration:style.animationDuration,loop:style.animationIterationCount,cap:style.strokeLinecap,
      tailAnimation:getComputedStyle(tail).animationName,
      oldContentHidden:[...document.querySelectorAll('.update-phase-content[data-exiting]')]
        .every(el=>el.getAttribute('aria-hidden')==='true'&&getComputedStyle(el).pointerEvents==='none')};
  })()`);
        assert.equal(
            activity.samePhasePreservesContent,
            true,
            'Progress ticks must not replay phase transitions',
        );
        assert.equal(activity.pathLength, '100');
        assert.equal(activity.animation, 'update-orbit');
        assert.equal(activity.tailAnimation, 'update-orbit-tail');
        assert.equal(activity.duration, '1.1s');
        assert.equal(activity.loop, 'infinite');
        assert.equal(activity.cap, 'round');
        assert.equal(activity.oldContentHidden, true);
        // Offscreen rendering advances Motion's compositor frames without opening a desktop window.
        await new Promise((resolve) => setTimeout(resolve, 400));
        const settled = await win.webContents.executeJavaScript(`(()=>{
    const content=document.querySelector('.update-phase-content:not([data-exiting])');
    return {opacity:Number(getComputedStyle(content).opacity),
      oldCount:document.querySelectorAll('.update-phase-content[data-exiting]').length};
  })()`);
        assert.equal(settled.opacity, 1, 'New phase must become fully visible');
        assert.equal(
            settled.oldCount,
            0,
            'Old phase must be removed after crossfade',
        );
        if (process.env.UPDATE_LAYOUT_SCREENSHOT) {
            // Sample the animation deterministically even when the fixture window is hidden.
            await win.webContents
                .executeJavaScript(`document.getAnimations().forEach(animation=>{
      if(animation.effect.getTiming().iterations===Infinity){animation.pause();animation.currentTime=450;}
      else animation.finish();
    })`);
            writeFileSync(
                process.env.UPDATE_LAYOUT_SCREENSHOT,
                (await win.webContents.capturePage()).toPNG(),
            );
        }
        win.webContents.debugger.attach('1.3');
        await win.webContents.debugger.sendCommand(
            'Emulation.setEmulatedMedia',
            {
                features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
            },
        );
        const reduced = await win.webContents
            .executeJavaScript(`getComputedStyle(document.querySelector(
    '.update-phase-content:not([data-exiting]) .update-activity-head')).animationName`);
        assert.equal(
            reduced,
            'none',
            'Reduced-motion preference must stop the orbit',
        );
        win.webContents.debugger.detach();
        win.destroy();
        clearTimeout(watchdog);
        console.log('Update panel layout tests passed');
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
