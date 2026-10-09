// Exercises the real preference screen with an isolated, in-memory IPC bridge.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildSync}=require('esbuild');
const root=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kawaikara-graphics-ui-'));
app.setPath('userData',profile); app.disableHardwareAcceleration();
const script=buildSync({stdin:{resolveDir:root,loader:'jsx',contents:`
  import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
  import {App} from './src/Renderer/View/Menu/App';
  import {GraphicsModeControl} from './src/Renderer/View/Preference/GraphicsModeControl';
  import {getRendererMessages} from './src/Main/Functional/RendererMessages';
  import {installKawaikaraMock,STORY_MESSAGES} from './stories/Mocks/KawaikaraMock';
  const api=installKawaikaraMock(); window.labels=STORY_MESSAGES; window.graphicsUpdates=[];
  const updatePreferences=api.preferences.update;
  api.preferences.update=async(patch,options)=>{
    window.graphicsUpdates.push({patch,options});return updatePreferences(patch,options);
  };
  window.errors=[]; window.addEventListener('error',e=>errors.push(e.message));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  window.clickLabel=(label,scope=document)=>{
    const button=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent.trim()===label);
    if(!button)throw Error('Missing button: '+label);button.click();
  };
  const root=createRoot(document.getElementById('root'));
  flushSync(()=>root.render(<App/>));
  window.renderControl=(locale,width)=>flushSync(()=>root.render(<div style={{width,padding:16}}>
    <GraphicsModeControl disabled={false} value="capture" onChange={()=>{}} messages={getRendererMessages(locale,'en-US').app}/>
  </div>));
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.png':'dataurl'},
  define:{'process.env.NODE_ENV':'"production"'}}).outputFiles[0].text;
const css=[require.resolve('@kawaikara/kawai-ui/styles.css'),path.join(root,'src/Renderer/Styles/Overlay.css')]
  .map(file=>fs.readFileSync(file,'utf8')).join('\n');
const fixture=path.join(profile,'fixture.html');
fs.writeFileSync(fixture,'<style>'+css+'</style><div id="root"></div><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
const watchdog=setTimeout(()=>{console.error('Graphics UI timed out');app.exit(1)},30000);
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{backgroundThrottling:false}});
  const evaluate=expression=>win.webContents.executeJavaScript(expression);
  const waitFor=async expression=>{
    const deadline=Date.now()+4000;
    while(Date.now()<deadline){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25))}
    throw Error('Timed out: '+expression);
  };
  await win.loadFile(fixture);
  await waitFor('document.querySelector(".menu-panel")');
  await evaluate('clickLabel(labels.app.openPreferences)');
  await waitFor('document.querySelectorAll(".preference-tab-list [role=tab]").length >= 7');

      await evaluate('clickLabel(labels.app.general)');
      const selectedMode = () => evaluate('[...document.querySelectorAll(".graphics-mode-control [role=radio]")].findIndex(button => button.getAttribute("aria-checked") === "true")');
      const originalMode = await selectedMode();
      const beforeUpdates = await evaluate('graphicsUpdates.length');
      const cancelledMode = (originalMode + 1) % 3;
      await evaluate(`document.querySelectorAll('.graphics-mode-control [role=radio]')[${cancelledMode}].click()`);
      await waitFor('document.querySelector("#graphics-restart-title")');
      await evaluate('clickLabel(labels.app.cancel, document.querySelector("#graphics-restart-title").closest("[role=dialog]"))');
      await waitFor('!document.querySelector("#graphics-restart-title")');
      assert.equal(await selectedMode(), originalMode);
      assert.equal(await evaluate('graphicsUpdates.length'), beforeUpdates);
      for (let offset = 1; offset <= 3; offset++) {
        const index = (originalMode + offset) % 3;
        await evaluate(`document.querySelectorAll('.graphics-mode-control [role=radio]')[${index}].click()`);
        await waitFor('document.querySelector("#graphics-restart-title")');
        await evaluate('clickLabel(labels.app.applyAndRestart, document.querySelector("#graphics-restart-title").closest("[role=dialog]"))');
        await waitFor('!document.querySelector("#graphics-restart-title")');
        assert.equal(await selectedMode(), index);
        assert.deepEqual(await evaluate('({mode:graphicsUpdates.at(-1).patch.graphicsMode,options:graphicsUpdates.at(-1).options})'),
          {mode:['native','capture','software'][index],options:{restartForGraphicsChange:true}});
      }

  for(const locale of ['ko-KR','en-US','ja-JP']) for(const width of [300,420,600]) {
    await evaluate(`renderControl(${JSON.stringify(locale)},${width})`);
    assert.equal(await evaluate(`(()=>{
      const control=document.querySelector('.graphics-mode-control'),bounds=control.getBoundingClientRect();
      return [...control.querySelectorAll('button')].every(button=>{
        const rect=button.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(button);
        const text=range.getBoundingClientRect();
        return rect.left>=bounds.left-1&&rect.right<=bounds.right+1&&text.top>=rect.top&&text.bottom<=rect.bottom&&button.scrollWidth<=button.clientWidth;
      });
    })()`),true,locale+' width '+width);
  }
  assert.deepEqual(await evaluate('errors'),[]);
  console.log('Graphics mode UI: cancel preserves mode; all three apply with explicit restart confirmation.');
  clearTimeout(watchdog);win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1)});
