// Render the real preference controls in isolated Chromium. No application
// entry point, user settings, streaming site, or IPC connection is loaded.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const profile = mkdtempSync(path.join(os.tmpdir(), 'kawaikara-subtitle-preferences-'));
mkdirSync(path.join(profile, 'session'));
app.setName('Kawaikara Subtitle Preferences Probe');
app.setPath('userData', profile);
app.setPath('sessionData', path.join(profile, 'session'));
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.disableHardwareAcceleration();
const watchdog = setTimeout(() => {
  console.error('Subtitle preferences Chromium probe timed out.');
  app.exit(1);
}, 30000);
const messages = Object.fromEntries(['ko', 'en', 'ja'].map(language => [
  language, JSON.parse(readFileSync(path.join(root, 'locales', `${language}.json`), 'utf8')).app,
]));
const fixture = buildSync({
  stdin: {
    contents: `
      import { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { SubtitleScaleControl } from './src/Renderer/Component/SubtitleScaleControl';
      import { NumberInput } from './src/Renderer/Component/NumberInput';
      const messages=${JSON.stringify(messages)};
      window.preferenceWrites=[];window.legacyWrites=[];
      function Fixture(){
        const [value,setValue]=useState(1),[language,setLanguage]=useState('ko'),[theme,setTheme]=useState('light');
        const [legacy,setLegacy]=useState(100);
        window.setProbeLanguage=setLanguage;window.setProbeTheme=setTheme;
        const text=messages[language];
        return <section className={'kawai-theme kawai-theme-'+theme}>
          <div id="subtitle-setting"><SubtitleScaleControl value={value}
            label={text.pictureInPictureSubtitleSize} description={text.pictureInPictureSubtitleSizeDescription}
            rangeMessage={text.pictureInPictureSubtitleSizeRange}
            onChange={next=>{window.preferenceWrites.push(next);setValue(next)}} /></div>
          <div id="legacy-setting"><NumberInput label="Legacy numeric setting" min={50} max={200} value={legacy}
            onValueChange={next=>{window.legacyWrites.push(next);setLegacy(next)}} /></div>
        </section>;
      }
      flushSync(()=>createRoot(document.getElementById('root')).render(<Fixture/>));
    `,
    loader: 'jsx', resolveDir: root,
  },
  bundle: true, platform: 'browser', format: 'iife', write: false,
  minify: process.argv.includes('--minified'), jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
}).outputFiles[0].text;
const css = readFileSync(path.join(root, 'src/Renderer/Styles/Overlay.css'), 'utf8');

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ width: 880, height: 600, show: false, webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
  } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<style>${css}</style><div id="root"></div>`)}`);
  const execute = source => win.webContents.executeJavaScript(source, true);
  const flush = () => execute('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await execute(fixture);
  await flush();
  const type = async (value, selector = '#subtitle-setting input') => {
    await execute(`(() => {
      const input=document.querySelector(${JSON.stringify(selector)});input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await flush();
  };
  const commit = async () => {
    // A hidden accessory test window does not receive native focus events.
    // Deliver the focusout that Enter/blur produces in a visible app window.
    await execute(`(() => {
      const input=document.querySelector('#subtitle-setting input');
      input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
    })()`);
    await flush();
  };
  const state = () => execute(`(() => {
    const input=document.querySelector('#subtitle-setting input'),alert=document.querySelector('#subtitle-setting [role=alert]');
    return {value:input.value,max:input.getAttribute('aria-valuemax'),invalid:input.getAttribute('aria-invalid'),
      description:input.getAttribute('aria-describedby'),alert:alert?.textContent,alertId:alert?.id,
      alertColor:alert?getComputedStyle(alert).color:undefined,writes:[...preferenceWrites],
      incrementDisabled:document.querySelector('#subtitle-setting button').disabled};
  })()`);
  assert.equal((await state()).value, '100');
  assert.equal((await state()).max, '300');
  await type('300');
  await commit();
  assert.deepEqual((await state()).writes, [3]);
  assert.equal((await state()).incrementDisabled, true, 'increment cannot exceed the maximum');
  await execute(`document.querySelector('#subtitle-setting input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}))`);
  await flush();
  assert.equal((await state()).invalid, null, 'stepping at the supported maximum does not flag a valid value');
  assert.deepEqual((await state()).writes, [3]);

  for (const language of ['ko', 'en', 'ja']) {
    await execute(`setProbeLanguage(${JSON.stringify(language)})`);
    await flush();
    await type('301');
    let result = await state();
    assert.equal(result.invalid, 'true');
    assert.ok(result.description.split(' ').includes(result.alertId), 'input describes its range warning');
    const expected = messages[language].pictureInPictureSubtitleSizeRange.replaceAll('{min}', '50').replaceAll('{max}', '300');
    assert.equal(result.alert, expected, 'localized warning uses the shared limits');
    await commit();
    result = await state();
    assert.equal(result.value, '301', 'invalid draft stays visible for correction');
    assert.deepEqual(result.writes, [3], 'invalid entry cannot write preferences or silently save 300%');
    await type('300');
    assert.equal((await state()).invalid, null, 'correcting the draft clears the warning');
  }
  await execute(`setProbeLanguage('ko')`);
  await type('999');
  assert.equal((await state()).alertColor, 'rgb(180, 35, 24)', 'light-theme warning stays readable');
  await execute(`setProbeTheme('dark')`);
  await flush();
  assert.equal((await state()).alertColor, 'rgb(253, 164, 175)', 'dark-theme warning stays readable');
  if (process.argv.includes('--screenshot')) {
    const screenshot = path.join(profile, 'subtitle-range-warning.png');
    writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    console.log(`Screenshot: ${screenshot}`);
  }
  await type('250');
  await commit();
  assert.deepEqual((await state()).writes, [3, 2.5], 'valid correction persists the new scale');
  await type('49');
  await commit();
  assert.equal((await state()).invalid, 'true');
  assert.deepEqual((await state()).writes, [3, 2.5], 'below-minimum input cannot change preferences');
  await type('');
  await commit();
  assert.equal((await state()).invalid, 'true', 'empty input is not saved as 0%');
  await execute(`document.querySelector('#subtitle-setting input').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
  await flush();
  assert.equal((await state()).value, '240', 'keyboard step recovers an empty draft from the saved scale');
  await type('50');
  await commit();
  assert.equal((await state()).value, '50');
  assert.equal(await execute(`document.querySelectorAll('#subtitle-setting button')[1].disabled`), true);
  await type('999', '#legacy-setting input');
  await execute(`document.querySelector('#legacy-setting input').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))`);
  await flush();
  assert.equal(await execute(`document.querySelector('#legacy-setting input').value`), '200', 'unrelated controls retain legacy normalization');
  assert.deepEqual(await execute('legacyWrites'), [200]);
  win.destroy();
  console.log('PASS: Real preference control accepts 50%–300%, rejects overflow/empty drafts without writes, exposes localized accessible warnings in both themes, supports correction/keyboard recovery, and preserves unrelated controls.');
}

main().then(() => { clearTimeout(watchdog); app.exit(0); }, error => {
  clearTimeout(watchdog); console.error(error); app.exit(1);
});
