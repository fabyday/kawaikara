// Exercises the real native bridge and restore lifecycle without loading a site.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const assert=require('node:assert/strict');
app.on('window-all-closed',()=>{});
const root=path.resolve(__dirname,'../..');
const bridge=require(path.join(root,'dist/native/kawaikara_macos_window_spaces.node'));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,frame:false,fullscreenable:false});
 const handle=win.getNativeWindowHandle();
 const read=()=>JSON.parse(bridge.getWindowSpaceState(handle));
 const original=read().behavior;
 bridge.setFullScreenAuxiliary(handle);
 let state=read();
 assert.equal(state.watching,true);
 assert.equal(state.behavior & (2|128|512),0,'mutually exclusive Space/fullscreen flags must be cleared');
 assert.equal(state.behavior & (1|256),1|256);
 bridge.setFullScreenAuxiliary(handle);
 assert.equal(read().behavior,state.behavior,'reassertion is idempotent');
 bridge.clearFullScreenAuxiliary(handle);
 assert.equal(read().watching,false);
 assert.equal(read().behavior,original & ~256,'exit restores prior non-PiP policy');
 bridge.setFullScreenAuxiliary(handle);
 win.destroy();
 await new Promise(resolve=>setTimeout(resolve,1100));
 console.log('Native PiP policy, idempotent entry, exit restoration and close cleanup passed.');
 app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
