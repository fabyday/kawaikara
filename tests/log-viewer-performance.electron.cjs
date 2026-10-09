// Synthetic large-log diagnostic. Timings are evidence, not hardware-dependent pass thresholds.
const { app, BrowserWindow } = require('electron');
process.on('uncaughtException',error=>{console.error(error);app.exit(1)});
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaikara-log-perf-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
const defines = { __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
  __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null' };
const entry = path.join(root, 'src/Main/Manager/LoggingManager.ts');
const loaded = new Module(entry, module); loaded.paths = module.paths;
loaded._compile(buildSync({ entryPoints: [entry], bundle: true, packages: 'external', platform: 'node',
  format: 'cjs', write: false, define: defines }).outputFiles[0].text, entry);
const fileName = '2026-10-10-0.log';
const contents = Array.from({length:5000},(_,i) => '[2026-10-10 12:00:00.000] [info] (Application) frame ' + i + ' ' + 'fixture '.repeat(120)).join('\n');
fs.writeFileSync(path.join(profile,fileName), contents);
const reader = Object.assign(Object.create(loaded.exports.LoggingManager.prototype), {
  requireLogFile: async () => ({fileName,repository:'application',size:Buffer.byteLength(contents),active:true}),
  getLogDirectory: async () => profile,
});
const tablePath=path.join(root,'src/Renderer/View/LogViewer/LogTable.tsx');
const baselinePath=path.join(profile,'BaselineTable.tsx');
if(baseline){
  const source=require('node:child_process').execFileSync('git',['show','HEAD:src/Renderer/View/LogViewer/LogTable.tsx'],{cwd:root,encoding:'utf8'});
  fs.writeFileSync(baselinePath,source.replace(/from '(\.[^']+)'/g,(_match,name)=>'from '+JSON.stringify(path.resolve(path.dirname(tablePath),name))));
}
const script = buildSync({ stdin: { resolveDir: root, loader: 'jsx', contents: `
  import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom'; import {useRef} from 'react';
  import {LogTable} from 'log-table-probe';
  import {useLogFilters} from './src/Renderer/View/LogViewer/Hooks/useLogFilters';
  import labels from './locales/ko.json';
  import {useLogViewerKeyboard} from './src/Renderer/View/LogViewer/Hooks/useLogViewerKeyboard';
  window.kawaikara={};
  const root=createRoot(document.getElementById('root'));
  const levels=new Set(), sources=new Set(), groups=[], files=[], selectedFileNames=new Set();
  function Fixture({doc,query}) {
    const scrollRef=useRef(null), logEntriesRef=useRef(null), followLatestRef=useRef(true);
    const {visibleEntries}=useLogFilters({document:doc,locale:'ko-KR',query,excludedLevels:levels,excludedSources:sources,
      groupQuery:'',groups,files,selectedFileNames});
    useLogViewerKeyboard({contextMenu:undefined,setContextMenu:()=>{},deleteReferences:undefined,deleting:false,
      setDeleteReferences:()=>{},importSelection:undefined,onClose:()=>{},fileListRef:useRef(null),
      setSelectedFileNames:()=>{},files,logEntriesRef,visibleEntries,timestampMode:'full'});
    return <LogTable document={doc} messages={labels.logViewer} error={undefined} loading={false}
      scrollRef={scrollRef} followLatestRef={followLatestRef} tableStyle={{}} setTimestampMode={()=>{}}
      startColumnResize={()=>{}} visibleEntries={visibleEntries} logEntriesRef={logEntriesRef}
      locale="ko-KR" query={query} timestampMode="full" />;
  }
  window.renderProbe=async(doc,query)=>{
    const start=performance.now(); flushSync(()=>root.render(<Fixture doc={doc} query={query}/>));
    const height=document.querySelector('.log-viewer-entries')?.scrollHeight;
    const ms=performance.now()-start;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return {ms,paintMs:performance.now()-start,rows:document.querySelectorAll('.log-viewer-entry').length,height};
  };
` }, nodePaths:[path.join(root,'node_modules')], alias:{'log-table-probe':baseline?baselinePath:tablePath}, bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'} }).outputFiles[0].text;
const css=[require.resolve('@kawaikara/kawai-ui/styles.css'),path.join(root,'src/Renderer/Styles/LogViewer.css')].map(f=>fs.readFileSync(f,'utf8')).join('\n');
fs.writeFileSync(path.join(profile,'fixture.html'), '<style>'+css+' #root{display:flex;flex:1;min-height:0} .log-viewer-panel{display:flex;flex-direction:column} .log-viewer-log-panel{flex:1}</style><div class="log-viewer-panel" style="width:1200px;height:700px"><div id="root"></div></div><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
const watchdog=setTimeout(()=>{console.error('Log performance timed out');app.exit(1)},30000);
app.whenReady().then(async()=>{
  const reads=[]; let doc;
  for(let i=0;i<5;i++){const start=performance.now();doc=await reader.readFile('application',fileName);reads.push(performance.now()-start)}
  assert.equal(doc.entries.length,5000);
  const win=new BrowserWindow({show:false,width:1280,height:800,webPreferences:{backgroundThrottling:false}});
  win.webContents.on('console-message', event => { if(event.level === 'error') console.error(event.message); });
  await win.loadFile(path.join(profile,'fixture.html')); win.showInactive();
  await win.webContents.executeJavaScript('window.fixtureDoc='+JSON.stringify(doc));
  const results={bytes:Buffer.byteLength(contents),readAndParseMs:reads};
  for(const [label,query] of [['initial',''],['searchAll','frame'],['searchOne','frame 4999 '],['clear','']]){
    results[label]=await win.webContents.executeJavaScript('renderProbe(fixtureDoc,'+JSON.stringify(query)+')');
  }
  assert.equal(results.searchOne.rows,1);
  if(baseline) assert.equal(results.initial.rows,5000);
  else {
    assert.ok(results.initial.rows>0&&results.initial.rows<100);
    assert.ok(results.searchAll.rows>0&&results.searchAll.rows<100);
    const behavior=await win.webContents.executeJavaScript(`(async()=>{
      const pause=()=>new Promise(r=>setTimeout(r,180));
      const scroll=document.querySelector('.log-viewer-log-scroll');
      const firstVisible=()=>[...document.querySelectorAll('.log-viewer-entry')].find(el=>el.getBoundingClientRect().bottom>scroll.getBoundingClientRect().top+1);
      const checkRows=()=>{
        const rows=[...document.querySelectorAll('.log-viewer-entry')];
        if(rows.length===0||rows.length>=100)throw Error('Unbounded or empty viewport');
        for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].getBoundingClientRect().top-rows[i-1].getBoundingClientRect().bottom)>1)throw Error('Gap/overlap');
        return rows.length;
      };
      await pause(); checkRows();
      const atEnd=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<40;
      scroll.dispatchEvent(new WheelEvent('wheel',{bubbles:true}));scroll.scrollTop=0;await pause();
      const top=firstVisible().querySelector('.log-viewer-message').textContent;
      scroll.scrollTop=scroll.scrollHeight/2;await pause();checkRows();
      const anchor=firstVisible().querySelector('.log-viewer-message').textContent;
      const anchorTop=firstVisible().getBoundingClientRect().top;
      const appended={...fixtureDoc,entries:[...fixtureDoc.entries.slice(20),...Array.from({length:20},(_,i)=>({...fixtureDoc.entries[0],id:'append'+i,message:'appended '+i}))]};
      await renderProbe(appended,'');await pause();checkRows();
      const retained=firstVisible().querySelector('.log-viewer-message').textContent===anchor;
      const anchorDrift=Math.abs(firstVisible().getBoundingClientRect().top-anchorTop);
      document.querySelector('.log-viewer-panel').style.width='1000px';await pause();checkRows();
      const resizeRetained=firstVisible().querySelector('.log-viewer-message').textContent===anchor;
      scroll.scrollTop=scroll.scrollHeight;await pause();
      const grown={...appended,entries:[...appended.entries,{...fixtureDoc.entries[0],id:'tail',message:'latest\\n'.repeat(30)}]};
      await renderProbe(grown,'');await pause();checkRows();
      const following=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<40;
      document.querySelector('.log-viewer-panel').style.width='780px';await pause();checkRows();
      document.querySelector('.log-viewer-table').style.setProperty('--log-location-width','400px');await pause();checkRows();
      window.getSelection().removeAllRanges();
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true,cancelable:true}));
      const clipboard=new DataTransfer();document.body.dispatchEvent(new ClipboardEvent('copy',{clipboardData:clipboard,bubbles:true,cancelable:true}));
      const copied=clipboard.getData('text/plain');
      const allCopied=copied.includes('frame 20 ')&&copied.includes('frame 4999 ')&&copied.includes('appended 19')&&copied.includes('latest\\nlatest');
      await renderProbe(fixtureDoc,'no such message');await pause();
      const empty=document.querySelectorAll('.log-viewer-entry').length===0;
      await renderProbe(fixtureDoc,'frame 4999 ');await pause();
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true,cancelable:true}));
      const filtered=new DataTransfer();document.body.dispatchEvent(new ClipboardEvent('copy',{clipboardData:filtered,bubbles:true,cancelable:true}));
      const filteredCopy=filtered.getData('text/plain').includes('frame 4999 ')&&!filtered.getData('text/plain').includes('frame 20 ');
      return {atEnd,top:top.startsWith('frame 0 '),retained,resizeRetained,anchorDrift,following,allCopied,empty,filteredCopy};
    })()`);
    console.log('Virtual log behavior',JSON.stringify(behavior));
    for(const [key,value] of Object.entries(behavior))if(key!=='anchorDrift')assert.equal(value,true,key);
    assert.ok(behavior.anchorDrift<2);
  }
  console.log(JSON.stringify(results));clearTimeout(watchdog);win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1)});
