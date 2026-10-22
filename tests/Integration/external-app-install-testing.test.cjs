const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Module=require('node:module');
const {execFileSync}=require('node:child_process');
const {buildSync}=require('esbuild');
const appId='day.faby.kawai-downloader';
function load(root, file='src/Main/Functional/ExternalApps/Distribution/InstallTesting.ts') {
 const filename=path.resolve(file), m=new Module(filename,module);m.paths=module.paths;
 m.require=id=>id==='electron'?{app:{getPath:()=>{throw new Error('Native discovery must not run');}},net:{}}:Module.prototype.require.call(m,id);
 m._compile(buildSync({entryPoints:[filename],bundle:true,write:false,platform:'node',format:'cjs',external:['electron'],define:{__KAWAIKARA_EXTERNAL_APP_TESTING__:'true',__KAWAIKARA_EXTERNAL_APP_INSTALL_TEST_ROOT__:JSON.stringify(root)}}).outputFiles[0].text,filename);
 return m.exports;
}
test('test discovery never falls back to native registrations; only explicit test mode opts in',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'external-install-'));const previous=process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST;
 t.after(async()=>{if(previous===undefined)delete process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST;else process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST=previous;await fs.rm(root,{recursive:true,force:true});});
 const service=load(root);delete process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST;
 assert.equal(service.installationTestPaths(appId),undefined);
 process.env.KAWAIKARA_EXTERNAL_APP_INSTALL_TEST='1';
 assert.equal(service.installationTestPaths(appId).installed,path.join(root,appId,'installed'));
 assert.throws(()=>service.installationTestPaths('../escape'),/identity/);
 assert.equal(await load(root,'src/Main/Platform/ExternalDownloader.ts').findInstalledExternalDownloaderApp(),null);
 await assert.rejects(service.installTestApplication(appId,'unused','exe'),/portable/);
 if(process.platform!=='darwin')return;
 const source=path.join(root,'fixture','kawai-downloader.app');await fs.mkdir(path.join(source,'Contents'),{recursive:true});
 await fs.writeFile(path.join(source,'Contents','Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${appId}</string><key>CFBundleShortVersionString</key><string>0.1.0</string></dict></plist>`);
 const paths=service.installationTestPaths(appId);await fs.mkdir(paths.downloads,{recursive:true});
 const zip=path.join(paths.downloads,'test.zip');execFileSync('/usr/bin/ditto',['-c','-k','--keepParent',source,zip]);
 await service.installTestApplication(appId,zip,'zip');
 assert.equal((await service.findTestApplication(appId)).path,path.join(paths.installed,'kawai-downloader.app'));
 await fs.rm(paths.installed,{recursive:true});
 assert.equal(await service.findTestApplication(appId),null,'removing test install restores missing status despite fixture app remaining');
});
