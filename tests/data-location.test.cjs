const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { resolveWindowsDataRootSelection, writeWindowsDataRoot, readWindowsDataRoot } = require('../src/Main/Functional/WindowsDataLocation.ts');
const product='Kawaikara Nightly', executable='C:\\Apps\\Kawaikara Nightly\\app.exe', active='C:\\Profiles\\Kawaikara Nightly';

test('folder picker and manual entry resolve the same channel root without nesting it twice',()=>{
  for(const entry of ['D:\\새 폴더', 'D:\\새 폴더\\Kawaikara Nightly']) {
    assert.equal(resolveWindowsDataRootSelection(entry,product,executable,active),'D:\\새 폴더\\Kawaikara Nightly');
  }
  for(const entry of ['relative','\\\\host\\folder','D:\\bad\nfolder', 'C:\\Apps',`${active}\\child`]) {
    assert.throws(()=>resolveWindowsDataRootSelection(entry,product,executable,active));
  }
});

test('path changes preserve old data and can reopen an existing root without replacing its files',async t=>{
  if(process.platform!=='win32') return t.skip('Real Windows path filesystem semantics');
  const fixture=mkdtempSync(path.join(tmpdir(),'kawaikara-data-location-'));
  const appData=path.join(fixture,'appData'), old=path.join(fixture,'old',product), target=path.join(fixture,'new',product);
  const install=path.join(fixture,'install');mkdirSync(install,{recursive:true});mkdirSync(old,{recursive:true});
  writeFileSync(path.join(old,'retain'),'old');mkdirSync(target,{recursive:true});writeFileSync(path.join(target,'retain'),'new');
  const exe=path.join(install,'app.exe');
  await writeWindowsDataRoot(appData,'day.faby.kawaikara.nightly',target,old,exe);
  assert.equal(readWindowsDataRoot(appData,'day.faby.kawaikara.nightly',product,exe),target);
  assert.equal(readFileSync(path.join(old,'retain'),'utf8'),'old');
  assert.equal(readFileSync(path.join(target,'retain'),'utf8'),'new');
  assert.deepEqual(readdirSync(target),['retain']);
  await assert.rejects(writeWindowsDataRoot(appData,'day.faby.kawaikara.nightly',path.join(old,'child',product),old,exe),/overlap/i);
  assert.equal(existsSync(path.join(old,'child')),false,'Reject overlapping roots before creating any folders');
  assert.equal(readWindowsDataRoot(appData,'day.faby.kawaikara.nightly',product,exe),target);
});

const compiled=buildSync({entryPoints:[path.resolve(__dirname,'../src/Main/Manager/ApplicationDataManager.ts')],
  bundle:true,write:false,platform:'node',format:'cjs',external:['electron','../Functional/UserDataPaths'],
}).outputFiles[0].text;
function managerFixture({supported=true,answer=1,fail=false}={}) {
  const calls=[],timers=[],module={exports:{}};
  vm.runInNewContext(compiled,{module,exports:module.exports,setTimeout:fn=>timers.push(fn),process,console,
    require(id){
      if(id==='electron') return {app:{getLocale:()=> 'ko-KR',relaunch:()=>calls.push('relaunch'),quit:()=>calls.push('quit')},
        dialog:{showMessageBox:async options=>{calls.push(options);return {response:answer};},
          showOpenDialog:async options=>{calls.push(options);return {canceled:true,filePaths:[]};}}};
      if(id==='../Functional/UserDataPaths') return {getApplicationDataLocation:()=>supported?{currentPath:active,canChange:true}:undefined,
        resolveApplicationDataLocation:input=>resolveWindowsDataRootSelection(input,product,executable,active),
        saveApplicationDataLocation:async target=>{if(fail)throw new Error('locked');calls.push(['save',target]);}};
      return require(id);
    }});
  return {manager:new module.exports.ApplicationDataManager({}),calls,timers};
}
test('native confirmation defaults to cancel; cancel and failures never change root or restart',async()=>{
  for(const options of [{answer:0},{fail:true}]) {
    const {manager,calls,timers}=managerFixture(options);
    if(options.fail) await assert.rejects(manager.changeLocation('D:\\Data','ko-KR'),/저장하지 못/);
    else assert.equal((await manager.changeLocation('D:\\Data','ko-KR')).status,'cancelled');
    assert.equal(calls[0].defaultId,0);assert.equal(calls[0].cancelId,0);
    assert.equal(timers.length,0);assert.equal(calls.some(call=>Array.isArray(call)&&call[0]==='save'),false);
  }
});
test('confirmed change saves the exact shown path then schedules one normal restart',async()=>{
  const {manager,calls,timers}=managerFixture();
  assert.equal((await manager.changeLocation('D:\\Data','ko-KR')).status,'restarting');
  assert.ok(calls[0].detail.startsWith('D:\\Data\\Kawaikara Nightly\n'));
  assert.deepEqual(calls[1],['save','D:\\Data\\Kawaikara Nightly']);
  await assert.rejects(manager.changeLocation('D:\\Other','ko-KR'),/진행 중/);
  assert.equal(timers.length,1);timers[0]();assert.deepEqual(calls.slice(-2),['relaunch','quit']);
});
test('macOS capability is absent and native picker/apply cannot be bypassed by IPC',async()=>{
  const {manager,calls}=managerFixture({supported:false});
  assert.equal(manager.getLocation(),undefined);
  await assert.rejects(manager.selectLocation('ko-KR'),/Windows/);
  await assert.rejects(manager.changeLocation('D:\\Data','ko-KR'),/Windows/);
  assert.equal(calls.length,0);
});
test('new auto-advance default avoids built-in provider navigation shortcuts; custom overrides stay explicit',()=>{
  const { SHORT_FORM_VIDEO_SHORTCUTS }=require('../src/Common/ShortFormVideo.ts');
  const selected=SHORT_FORM_VIDEO_SHORTCUTS.find(entry=>entry.id==='short-form-video.toggle-auto-advance');
  assert.equal(selected.defaultKey,'CommandOrControl+Alt+N');
  const directory=path.resolve(__dirname,'../packages/builtin-sites/src/Providers');
  for(const provider of readdirSync(directory)) {
    const file=path.join(directory,provider,'manifest.json');if(!existsSync(file))continue;
    const manifest=JSON.parse(readFileSync(file,'utf8'));
    assert.notEqual(manifest.contributes?.shortcut?.defaultKey?.replace('Control','CommandOrControl'),selected.defaultKey);
  }
});

test('an empty data root activates the packaged built-in bundle without copying its code there',async()=>{
  const Module=require('node:module');
  const {builtinBundle}=require('@kawaikara/builtin-sites');
  const filename=path.resolve(__dirname,'../src/Main/Manager/BundleManager.ts');
  const loaded=new Module(filename,module);loaded.paths=module.paths;
  loaded.require=id=>id==='electron'?{app:{getLocale:()=> 'en-US'}}:Module.prototype.require.call(loaded,id);
  loaded._compile(buildSync({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',
    external:['electron','extract-zip','@kawaikara/site-api'],define:{
      __KAWAIKARA_BUILD_CHANNEL__:'"nightly"',__KAWAIKARA_DISTRIBUTION_BUILD__:'true',
      __KAWAIKARA_DISCORD_APP_ID__:'""',__KAWAIKARA_UPDATE_TEST_PROFILE__:'null',
    },
  }).outputFiles[0].text,filename);
  const empty=mkdtempSync(path.join(tmpdir(),'kawaikara-empty-data-'));
  const directory=path.join(empty,'KawaiData','Bundles'),registered=[];
  const manager=new loaded.exports.BundleManager({registerBundle:bundle=>registered.push(bundle)},directory);
  manager.installBundled(builtinBundle);await manager.loadInstalled();
  assert.deepEqual(registered,[builtinBundle]);
  assert.equal(manager.list()[0].source,'built-in');assert.equal(manager.list()[0].status,'active');
  assert.deepEqual(readdirSync(directory),[],'Built-in code must remain in the application package');
});
