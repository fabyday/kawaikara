const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..');
function load(relative, electron = {}) {
    const file = path.join(root, relative);
    const mod = new Module(file, module); mod.paths = module.paths;
    mod.require = id => id === 'electron' ? electron : require(id);
    mod._compile(buildSync({ entryPoints:[file], bundle:true, platform:'node', format:'cjs', write:false,
        external:['electron'], define:{__KAWAIKARA_BUILD_CHANNEL__:'"nightly"',__KAWAIKARA_DISTRIBUTION_BUILD__:'false',__KAWAIKARA_UPDATE_TEST_PROFILE__:'null'} }).outputFiles[0].text, file);
    return mod.exports;
}
const repo = load('src/Main/Functional/Logging/LogRepository.ts');
const files = load('src/Main/Functional/Files/FileRead.ts');
const json = load('src/Main/Functional/Files/JsonFile.ts');
const events = load('src/Main/Functional/Logging/RendererLoggingEvents.ts');
const parsing = load('src/Main/Functional/Logging/LogParsing.ts');
async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kawaikara-log-repository-'));
    t.after(() => fs.rm(directory, {recursive:true,force:true}));
    return {directory, logFileName:'active.log'};
}
const line = message => `[2026-10-21 12:00:00.000] [info] (Application) ${message}\n`;
test('common file reads preserve JSON failures, byte limits and explicit symlink policy', async t => {
    const {directory} = await fixture(t);const file=path.join(directory,'data.json');
    await fs.writeFile(file,'{"value":1}');
    assert.deepEqual(await json.readJsonFile(file),{value:1});
    await assert.rejects(files.readFileBytes(file,{maxBytes:2}),e=>e.reason==='too-large');
    const link=path.join(directory,'link.json');await fs.symlink(file,link);
    assert.deepEqual(await json.readJsonFile(link),{value:1});
    await assert.rejects(files.readFileBytes(link,{rejectSymbolicLinks:true}),e=>e.reason==='unsafe-file');
    await assert.rejects(files.readFileBytes(directory),e=>e.reason==='unsafe-file');
    await fs.writeFile(file,'broken');await assert.rejects(json.readJsonFile(file),SyntaxError);
    await assert.rejects(json.readJsonFile(path.join(directory,'missing')),e=>e.code==='ENOENT');
});
test('single-file reads reuse parsed data then invalidate on append; unsafe names and links are rejected', async t => {
    const state=await fixture(t);const file=path.join(state.directory,state.logFileName);
    await fs.writeFile(file,line('first'));
    const first=await repo.readLogDocument(state,'application',state.logFileName);
    assert.equal(await repo.readLogDocument(state,'application',state.logFileName),first);
    await fs.appendFile(file,line('second'));
    const second=await repo.readLogDocument(state,'application',state.logFileName);
    assert.notEqual(second,first);assert.equal(second.entries.length,2);
    await assert.rejects(repo.readLogDocument(state,'application','../active.log'));
    await fs.symlink(file,path.join(state.directory,'link.log'));
    await assert.rejects(repo.readLogDocument(state,'application','link.log'));
    const removed=await repo.deleteLogFiles(state,[{repository:'application',fileName:state.logFileName}]);
    assert.equal(removed.deleted,0);assert.equal(removed.skipped.length,1);
});
test('imports sanitize content, reject invalid inputs, preserve aliases and clean up empty groups',async t=>{
    const state=await fixture(t);const temp=state.directory;
    const transfer=load('src/Main/Functional/Logging/LogTransfer.ts',{app:{getPath:()=>temp}});
    const good=path.join(temp,'source.log');const bad=path.join(temp,'binary.log');
    await fs.writeFile(good,line('\x1b[31mhello\x1b[0m'));await fs.writeFile(bad,Buffer.from([255,254]));
    const result=await transfer.importFiles(state,[good,bad],' My group ');
    assert.equal(result.imported.length,1);assert.equal(result.rejected[0].reason,'invalid-encoding');
    assert.equal(result.group.alias,'My group');
    assert.equal((await repo.listLogGroups(state)).length,1);
    const ref=result.imported[0];const doc=await repo.readLogDocument(state,'external',ref.fileName,ref.groupId);
    assert.equal(doc.entries[0].message,'hello');
    const result2=await repo.deleteLogFiles(state,[ref]);assert.equal(result2.deleted,1);
    assert.deepEqual(await repo.listLogGroups(state),[]);
});
test('entry retention preserves multiline messages at the 5000-entry boundary',()=>{
    const document=parsing.parseLogEntries(Array.from({length:5002},(_,i)=>line(String(i))+'continuation\n').join(''));
    assert.equal(document.entries.length,5000);assert.equal(document.truncated,true);
    assert.equal(document.entries[0].message,'2\ncontinuation');
});
test('renderer event binding filters messages and removes every listener on dispose/destroy',()=>{
    const web=new EventEmitter();const calls=[];
    const getLogger=(_source,location)=>Object.fromEntries(['info','warn','error','debug'].map(level=>[level,message=>calls.push({level,message,location})]));
    const dispose=events.connectRendererLogging(getLogger,web,'application',m=>m!=='ignore','viewer');
    web.emit('console-message',{message:'ignore',level:'error',sourceId:'https://example.test/a.js',lineNumber:1});
    web.emit('console-message',{message:'accepted',level:'warning',sourceId:'https://example.test/a.js',lineNumber:1});
    assert.equal(calls.length,1);assert.equal(calls[0].level,'warn');
    dispose();dispose();assert.equal(web.eventNames().length,0);
    events.connectRendererLogging(getLogger,web,'application');web.emit('destroyed');
    assert.equal(web.eventNames().length,0);
});
test('export cancellation and archive round-trip preserve only selected logs',async t=>{
    const state=await fixture(t);let cancelled=true;const destination=path.join(state.directory,'export');
    const transfer=load('src/Main/Functional/Logging/LogTransfer.ts',{
        app:{getPath:()=>state.directory,getLocale:()=> 'en'},
        dialog:{showSaveDialog:async()=>({canceled:cancelled,filePath:destination})},
    });
    await fs.writeFile(path.join(state.directory,'saved.log'),line('archived'));
    const metadata={applicationName:'Test',version:'1.0.0',channel:'nightly',platform:'test',arch:'arm64',siteApiVersion:1,
        runtime:{electron:'1',chrome:'1',node:'1',v8:'1'}};
    const refs=[{repository:'application',fileName:'saved.log'}];
    assert.equal((await transfer.exportFiles(state,metadata,'KAWA-TEST-TEST',refs,'en')).status,'cancelled');
    cancelled=false;const exported=await transfer.exportFiles(state,metadata,'KAWA-TEST-TEST',refs,'en');
    assert.equal(exported.status,'exported');assert.ok(exported.path.endsWith('.kawailog'));
    const imported=await transfer.importFiles(state,[exported.path],'Round trip');
    assert.deepEqual(imported.rejected,[]);assert.equal(imported.imported.length,1);
    const ref=imported.imported[0];
    assert.equal((await repo.readLogDocument(state,'external',ref.fileName,ref.groupId)).entries[0].message,'archived');
});
