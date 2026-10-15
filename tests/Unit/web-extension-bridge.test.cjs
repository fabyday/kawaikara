const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.resolve(__dirname, '../../src/Main/Functional/ExternalApps/WebExtensionBridge.ts')], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', code)(require, moduleValue, moduleValue.exports);
const { WebExtensionBridge } = moduleValue.exports;
const client = `chrome-extension://${'a'.repeat(32)}`;
const initial = [{ version: 2, actionDefinitions: { open: {title:'Open',handler:'open'}, 'copy-link': {title:'Copy',handler:'share-link',clipboard:true}, download: {title:'Download',handler:'download'} }, settings: [{id:'show',title:'Show UI',defaultValue:true}], id: 'example.video', title: 'Video', domains: ['example.com'], actions: ['open', 'copy-link', 'download'] }];
async function fixture(t, confirm = async () => true, extraOptions = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kawaikara-bridge-test-'));
  let providers = structuredClone(initial);
  const executed = [];
  const bridge = new WebExtensionBridge({ statePath: path.join(directory, 'state.json'), providers: () => providers,
    ...extraOptions, confirm, execute: extraOptions.execute ?? (async (...args) => { executed.push(args); }) });
  await bridge.start();
  t.after(async () => { await bridge.dispose(); await rm(directory, { recursive: true, force: true }); });
  const setup = JSON.parse(await bridge.createConnectionCode());
  let token = setup.token;
  async function call(route, body, extra = {}) {
    const response = await fetch(`${setup.url}/v1/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: {
      'X-Kawaikara-Client': client, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: response.status === 304 ? null : await response.json(), etag: response.headers.get('etag') };
  }
  async function pair() { const result = await call('pair', { adapterVersion: 2 }); assert.equal(result.status, 200); assert.equal(result.data.launchUrl, 'kawaikara://bridge/wake'); token = result.data.token; }
  return { bridge, call, pair, setup, executed, setProviders: (value) => { providers = value; }, getToken: () => token };
}

test('pairing, explicit grants, conditional sync and authenticated dispatch use actual HTTP', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('catalog')).status, 401);
  await f.pair();
  const catalog = await f.call('catalog');
  assert.equal((await f.call('catalog', undefined, { 'If-None-Match': catalog.etag })).status, 304);
  const request = { providerId: 'example.video', revision: catalog.data.revision, action: 'open', url: 'https://example.com/watch?v=1', requestId: '1234567890123456' };
  assert.equal((await f.call('invoke', request)).status, 403);
  assert.equal((await f.call('grant', { providerId: 'example.video', revision: catalog.data.revision, actions: initial[0].actions })).status, 200);
  request.revision = (await f.call('catalog')).data.revision;
  assert.equal((await f.call('invoke', { ...request, action: 'unknown' })).status, 403);
  assert.equal((await f.call('invoke', { ...request, url: 'https://example.com.evil.test' })).status, 403);
  assert.equal((await f.call('invoke', { ...request, url: 'file:///tmp/x' })).status, 403);
  assert.equal((await f.call('invoke', request)).status, 200);
  assert.deepEqual(f.executed, [['example.video', 'open', 'https://example.com/watch?v=1', {show:true}]]);
  assert.equal((await f.call('invoke', request)).status, 409);
  assert.equal((await f.call('catalog', undefined, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await f.call('catalog', undefined, { 'X-Kawaikara-Client': `chrome-extension://${'b'.repeat(32)}` })).status, 401);
  await f.bridge.revoke();
  assert.equal((await f.call('catalog')).status, 401);
});

test('scope expansion, uninstall and stale revisions invalidate consent', async (t) => {
  const f = await fixture(t); await f.pair();
  let catalog = (await f.call('catalog')).data;
  await f.call('grant', { providerId: 'example.video', revision: catalog.revision, actions: initial[0].actions });
  catalog = (await f.call('catalog')).data;
  f.setProviders([{ ...initial[0], domains: ['example.com', 'other.test'] }]);
  await f.bridge.invalidateCatalog();
  assert.equal((await f.call('catalog')).data.grants.length, 0);
  assert.equal((await f.call('invoke', { providerId: 'example.video', revision: catalog.revision })).status, 409);
  f.setProviders([]); await f.bridge.invalidateCatalog();
  f.setProviders(initial); await f.bridge.invalidateCatalog();
  assert.equal((await f.call('catalog')).data.grants.length, 0);
});

test('revocation while consent is pending cannot resurrect a pairing', async (t) => {
  let release; let entered;
  const wait = new Promise((resolve) => { entered = resolve; });
  const f = await fixture(t, () => { entered(); return new Promise((resolve) => { release = resolve; }); });
  const pending = f.call('pair', { adapterVersion: 2 });
  await wait; await f.bridge.revoke(); release(true);
  assert.equal((await pending).status, 403);
  assert.equal((await f.call('catalog')).status, 401);
});

test('credentials reconnect after restart on the retained port', async (t) => {
  const f = await fixture(t); await f.pair();
  await f.bridge.dispose(); await f.bridge.start();
  assert.equal((await f.call('catalog')).status, 200);
  assert.equal((await f.call('pair', {}, { Authorization: `Bearer ${f.setup.token}` })).status, 401);
});

test('overlapping Providers each retain their own authorization and dispatch identity', async (t) => {
  const f = await fixture(t);
  f.setProviders([...initial, { ...initial[0], id: 'another.video' }]);
  await f.pair();
  const revision = (await f.call('catalog')).data.revision;
  assert.equal((await f.call('grant', { providerId: 'example.video', revision, actions: initial[0].actions })).status, 200);
  const current = (await f.call('catalog')).data.revision;
  const invocation = { providerId: 'example.video', revision: current, action: 'open', url: 'https://example.com/watch', requestId: 'overlap-request-1234' };
  assert.equal((await f.call('invoke', invocation)).status, 200);
  assert.equal((await f.call('invoke', { ...invocation, providerId: 'another.video', requestId: 'overlap-request-5678' })).status, 403);
  assert.equal(f.executed[0][0], 'example.video');
});

test('Provider settings are validated, persisted and delivered with custom action IDs', async (t) => {
  const f = await fixture(t); const p = { ...initial[0], actions: ['bookmark'], actionDefinitions: { bookmark: {title:'Bookmark',handler:'provider'} } };
  f.setProviders([p]); await f.pair();
  let catalog=(await f.call('catalog')).data;
  assert.equal((await f.call('grant',{providerId:p.id,revision:catalog.revision,actions:['bookmark']})).status,200);
  catalog=(await f.call('catalog')).data;
  assert.equal((await f.call('settings',{providerId:p.id,revision:catalog.revision,settings:{unknown:true}})).status,400);
  assert.equal((await f.call('settings',{providerId:p.id,revision:catalog.revision,settings:{show:false}})).status,200);
  catalog=(await f.call('catalog')).data;
  assert.equal(catalog.grants[0].settings.show,false);
  assert.equal((await f.call('invoke',{providerId:p.id,revision:catalog.revision,action:'bookmark',url:'https://example.com/watch',requestId:'third-party-request-123'})).status,200);
  assert.deepEqual(f.executed[0],[p.id,'bookmark','https://example.com/watch',{show:false}]);
  await f.bridge.dispose(); await f.bridge.start();
  assert.equal((await f.call('catalog')).data.grants[0].settings.show,false);
});

test('pairing negotiates adapter version before granting a browser connection',async(t)=>{
  const f=await fixture(t);
  assert.equal((await f.call('pair',{})).data.error,'unsupported-adapter-version');
  await f.pair();
  assert.equal((await f.call('catalog')).data.version,2);
});

test('automatic discovery exposes no secrets and connection requires desktop consent', async (t) => {
  let allow = false;
  let confirmations = 0;
  const f = await fixture(t, async () => { confirmations++; return allow; });
  const discovery = await f.call('discover', undefined, { Authorization: '' });
  assert.deepEqual(discovery.data, { protocol: 'kawaikara-web-extension', adapterVersion: 2, development: false, url: f.setup.url });
  assert.equal((await f.call('discover', undefined, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.call('connect', {adapterVersion:2}, {Origin:'https://evil.test'})).status,403);
  assert.equal(confirmations, 0);
  assert.equal((await f.call('connect', {adapterVersion:1}, {Authorization:''})).status,400);
  assert.equal((await f.call('connect', {adapterVersion:2}, {Authorization:''})).status,403);
  assert.equal(confirmations, 1);
  assert.equal((await f.call('connect', {adapterVersion:2}, {Authorization:''})).status,429);
  assert.equal((await f.call('catalog', undefined, {Authorization:''})).status,401);
});

test('automatic connection issues origin-bound credentials and replaces setup codes', async (t) => {
  const f = await fixture(t);
  const result = await f.call('connect', {adapterVersion:2}, {Authorization:''});
  assert.equal(result.data.launchUrl, 'kawaikara://bridge/wake');
  assert.equal(result.status,200);
  assert.match(result.data.token,/^[a-f0-9]{64}$/);
  const auth = {Authorization:`Bearer ${result.data.token}`};
  assert.equal((await f.call('catalog',undefined,auth)).status,200);
  assert.equal((await f.call('catalog',undefined,{...auth,'X-Kawaikara-Client':`chrome-extension://${'b'.repeat(32)}`})).status,401);
  assert.equal((await f.call('pair',{adapterVersion:2})).status,401);
  await f.bridge.revoke();
  assert.equal((await f.call('catalog',undefined,auth)).status,401);
});

test('revocation during automatic consent cannot create a credential', async(t)=>{
  let release, enter;
  const entered=new Promise(resolve=>{enter=resolve;});
  const f=await fixture(t,()=>{enter();return new Promise(resolve=>{release=resolve;});});
  const pending=f.call('connect',{adapterVersion:2},{Authorization:''});
  await entered; await f.bridge.revoke(); release(true);
  assert.equal((await pending).status,403);
});

test('discovery listener advertises the retained bridge address and closes with it', async(t)=>{
  const {WEB_EXTENSION_DISCOVERY_PORTS}=require('@kawaikara/site-api');
  const f=await fixture(t);
  const results=await Promise.all(WEB_EXTENSION_DISCOVERY_PORTS.map(async(port)=>{
    try {
      const response=await fetch(`http://127.0.0.1:${port}/v1/discover`,{headers:{'X-Kawaikara-Client':client},signal:AbortSignal.timeout(500)});
      const data=await response.json();
      return data.url===f.setup.url ? port : undefined;
    } catch {return undefined;}
  }));
  const port=results.find(Boolean); assert.ok(port);
  await f.bridge.dispose();
  await assert.rejects(fetch(`http://127.0.0.1:${port}/v1/discover`,{headers:{'X-Kawaikara-Client':client},signal:AbortSignal.timeout(500)}));
});

test('rediscovery proves pairing without revealing its token',async t=>{
  const f=await fixture(t);await f.pair();
  const nonce='c'.repeat(64);const result=await f.call('discover?nonce='+nonce);
  const expected=require('node:crypto').createHmac('sha256',f.getToken()).update(nonce+'\n'+f.setup.url+'\n'+client).digest('hex');
  assert.equal(result.data.proof,expected);assert.equal(JSON.stringify(result.data).includes(f.getToken()),false);
  const other=await f.call('discover?nonce='+nonce,undefined,{'X-Kawaikara-Client':`chrome-extension://${'b'.repeat(32)}`});
  assert.equal(other.data.proof,undefined);
});

test('app-initiated handoff pairs once without another prompt and serves a secret-free onboarding page', async (t) => {
  let prompts = 0;
  const f = await fixture(t, async () => { prompts++; return true; });
  const link = new URL(f.bridge.createConnectionUrl());
  const page = await fetch(link.origin + link.pathname);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await page.text();
  assert.match(html, /connection-status/);
  assert.equal(html.includes(link.hash.slice(1).split(':')[0]), false);
  const result = await f.call('connect', {adapterVersion:2, handoff:link.hash.slice(1).split(':')[0]});
  assert.equal(result.status,200);
  assert.equal(prompts,0);
  assert.equal((await f.call('catalog',undefined,{Authorization:`Bearer ${result.data.token}`})).status,200);
  assert.equal((await f.call('connect',{adapterVersion:2,handoff:link.hash.slice(1).split(':')[0]})).status,403);
});
test('creating, replacing and cancelling handoff does not revoke the existing connection', async (t) => {
  const f=await fixture(t);await f.pair();
  const first=new URL(f.bridge.createConnectionUrl());
  const second=new URL(f.bridge.createConnectionUrl());
  assert.equal((await f.call('catalog')).status,200);
  assert.equal((await f.call('connect',{adapterVersion:2,handoff:first.hash.slice(1).split(':')[0]})).status,403);
  assert.equal((await f.call('catalog')).status,200);
  await f.bridge.revoke();
  assert.equal((await f.call('connect',{adapterVersion:2,handoff:second.hash.slice(1).split(':')[0]}, {Authorization:'Bearer '+ '0'.repeat(64)})).status,403);
});
test('app-approved handoff adds another browser without replacing existing permissions',async(t)=>{
  let prompts=0;
  const f=await fixture(t,async()=>{prompts++;return prompts===1;});await f.pair();
  const link=new URL(f.bridge.createConnectionUrl());
  const result=await f.call('connect',{adapterVersion:2,handoff:link.hash.slice(1).split(':')[0]},{'X-Kawaikara-Client':`chrome-extension://${'b'.repeat(32)}`});
  assert.equal(result.status,200);assert.equal(prompts,1);
  assert.equal(f.bridge.connectionStatus().connections.length,2);
  assert.equal((await f.call('catalog')).status,200);
});

test('development launcher is unavailable while authenticated wake focuses the running app',async(t)=>{
  let focused=0;const f=await fixture(t,async()=>true,{launchUrl:null,focus:()=>focused++});
  assert.equal((await f.call('wake',{})).status,401);
  const link=new URL(f.bridge.createConnectionUrl());
  const paired=await f.call('connect',{adapterVersion:2,handoff:link.hash.slice(1).split(':')[0]});
  assert.equal(paired.data.launchUrl,null);
  const headers={Authorization:`Bearer ${paired.data.token}`};
  assert.equal((await f.call('catalog',undefined,headers)).data.launchUrl,null);
  assert.equal((await f.call('wake',{},headers)).status,200);assert.equal(focused,1);
  const status=await fetch(f.setup.url+'/extension-connect-status.js');
  assert.match(await status.text(),/10000/);
});

test('instance details require authentication and identify the desktop without credentials',async(t)=>{
  const desktop={name:'Kawaikara Test',version:'3.0.0',channel:'nightly',runtime:'development',appPath:'/test/app',profileId:'test-profile'};
  const f=await fixture(t,async()=>true,{desktop});
  assert.equal((await f.call('catalog')).status,401);
  assert.equal((await f.call('discover')).data.desktop,undefined);
  await f.pair();const result=await f.call('catalog');assert.deepEqual(result.data.desktop,desktop);
  assert.equal(JSON.stringify(result.data.desktop).includes(f.getToken()),false);
});

 test('automatic handoff selects one extension channel without consuming the ticket on mismatch', async t => {
  const f = await fixture(t, async () => true, { development: true });
  assert.equal(f.bridge.connectionStatus().useDevelopment, true);
  const link = new URL(f.bridge.createConnectionUrl());
  assert.match(link.hash, /:development$/);
  const handoff = link.hash.slice(1).split(':')[0];
  assert.equal((await f.call('connect', { adapterVersion: 2, handoff, extension: {development:false,version:'0.1.0'} })).status, 409);
  const result = await f.call('connect', { adapterVersion: 2, handoff, extension: {development:true,version:'0.1.0'} });
  assert.equal(result.status, 200);
  assert.deepEqual(f.bridge.connectionStatus().extension, {connectionMode:'development',development:true,version:'0.1.0',browser:'Chrome'});
  assert.equal(JSON.stringify(f.bridge.connectionStatus()).includes(result.data.token), false);
  await f.bridge.setDevelopment(false);
  assert.match(new URL(f.bridge.createConnectionUrl()).hash, /:production$/);
  assert.equal(f.bridge.connectionStatus().useDevelopment, false);
 });
 test('manual code accepts a development extension even when production selection is active', async t => {
  const f = await fixture(t);
  const result = await f.call('pair', { adapterVersion: 2, extension: {development:true,version:'0.1.0'} });
  assert.equal(result.status, 200);
  assert.equal(f.bridge.connectionStatus().useDevelopment, false);
  assert.equal(f.bridge.connectionStatus().extension.development, true);
 });

test('configure batches enable, settings and disable under one approval and one commit', async t => {
  const prompts=[]; const f=await fixture(t,async detail=>{prompts.push(detail);return true;});
  f.setProviders([...initial,{...initial[0],id:'second.provider',title:'Second'}]); await f.pair(); prompts.length=0;
  let catalog=(await f.call('catalog')).data;
  let result=await f.call('configure',{revision:catalog.revision,changes:catalog.providers.map(p=>({providerId:p.id,enabled:true,settings:{show:false}}))});
  assert.equal(result.status,200); assert.equal(prompts.length,1);assert.match(prompts[0],/2 Provider changes/);assert.match(prompts[0],/second.provider/);
  catalog=(await f.call('catalog')).data;assert.equal(catalog.grants.length,2);assert.equal(catalog.grants[0].settings.show,false);
  result=await f.call('configure',{revision:catalog.revision,changes:[{providerId:initial[0].id,enabled:false,settings:{}},{providerId:'second.provider',enabled:true,settings:{show:true}}]});
  assert.equal(result.status,200);assert.equal(prompts.length,2);
  catalog=(await f.call('catalog')).data;assert.equal(catalog.grants.length,1);assert.equal(catalog.grants[0].id,'second.provider');assert.equal(catalog.grants[0].settings.show,true);
});
test('denied or stale batches never partially change grants', async t => {
  let approve=true;
  const f=await fixture(t,async()=>approve);await f.pair();approve=false;
  const catalog=(await f.call('catalog')).data;
  const changes=[{providerId:initial[0].id,enabled:true,settings:{show:true}}];
  assert.equal((await f.call('configure',{revision:catalog.revision,changes})).status,403);
  assert.deepEqual((await f.call('catalog')).data.grants,[]);
  approve=true;
  assert.equal((await f.call('configure',{revision:'stale',changes})).status,409);
  assert.equal((await f.call('configure',{revision:catalog.revision,changes:[...changes,...changes]})).status,400);
  assert.equal((await f.call('configure',{revision:catalog.revision,changes:[{...changes[0],settings:{undeclared:true}}]})).status,400);
  assert.deepEqual((await f.call('catalog')).data.grants,[]);
});
test('catalog mutation or revocation during batch approval cancels the whole transaction', async t => {
  let onConfirm=async()=>true;
  const f=await fixture(t,()=>onConfirm());await f.pair();
  const catalog=(await f.call('catalog')).data;
  onConfirm=async()=>{f.setProviders([{...initial[0],domains:['changed.example']}]);return true;};
  const payload={revision:catalog.revision,changes:[{providerId:initial[0].id,enabled:true,settings:{}}]};
  assert.equal((await f.call('configure',payload)).status,409);
  assert.deepEqual((await f.call('catalog')).data.grants,[]);
  const fresh=(await f.call('catalog')).data;
  onConfirm=async()=>{await f.bridge.revoke();return true;};
  assert.equal((await f.call('configure',{...payload,revision:fresh.revision})).status,409);
  assert.equal(f.bridge.connectionStatus().connected,false);
});
test('onboarding serves the updater-style image panel and local-only assets', async t => {
  const f=await fixture(t,async()=>true,{pageImage:async()=>Buffer.from('test-image')});
  const html=await (await fetch(f.setup.url+'/extension-connect')).text();
  assert.match(html,/<img src="\/extension-connect.png"/);assert.match(html,/extension-connect.css/);
  const image=await fetch(f.setup.url+'/extension-connect.png');assert.equal(image.headers.get('content-type'),'image/png');assert.equal(await image.text(),'test-image');
});


test('N browser profiles have independent grants, discovery proofs and signed revocation', async t => {
  const {randomUUID, createHmac} = require('node:crypto');
  const f = await fixture(t); await f.pair();
  const profiles = [];
  for (let i=0;i<4;i++) {
    const instance = randomUUID();
    const code = JSON.parse(await f.bridge.createConnectionCode());
    const profileClient = i === 3 ? 'moz-extension://11111111-1111-4111-8111-111111111111' : client;
    const result = await f.call('pair', {adapterVersion:2}, {Authorization:`Bearer ${code.token}`, 'X-Kawaikara-Instance':instance,'X-Kawaikara-Client':profileClient});
    assert.equal(result.status,200);
    const headers = {Authorization:`Bearer ${result.data.token}`, 'X-Kawaikara-Instance':instance,'X-Kawaikara-Client':profileClient};
    profiles.push({instance, token:result.data.token, headers});
  }
  assert.equal(f.bridge.connectionStatus().connections.length,5);
  assert.equal((await f.call('catalog')).status,200, 'creating codes preserves original authorization');
  const a = profiles[0], b=profiles[1];
  const catalog = (await f.call('catalog',undefined,a.headers)).data;
  assert.equal((await f.call('grant',{providerId:'example.video',revision:catalog.revision,actions:initial[0].actions},a.headers)).status,200);
  assert.equal((await f.call('catalog',undefined,a.headers)).data.grants.length,1);
  assert.equal((await f.call('catalog',undefined,b.headers)).data.grants.length,0);
  const nonce='d'.repeat(64);
  const discovery = await fetch(`${f.setup.url}/v1/discover?nonce=${nonce}`,{headers:{'X-Kawaikara-Client':client,'X-Kawaikara-Instance':a.instance}}).then(r=>r.json());
  assert.equal(discovery.proof,createHmac('sha256',a.token).update(`${nonce}\n${f.setup.url}\n${client}`).digest('hex'));
  const id=f.bridge.connectionStatus().connections[1].id;
  await f.bridge.revoke(id);
  const revokedDiscovery = await fetch(`${f.setup.url}/v1/discover?nonce=${nonce}`,{headers:{'X-Kawaikara-Client':client,'X-Kawaikara-Instance':a.instance}}).then(r=>r.json());
  assert.equal(revokedDiscovery.proof,discovery.proof,'Revoked profile can locate the trusted listener without gaining authority');
  const requestNonce=randomUUID();
  const revoked=await f.call('catalog',undefined,{...a.headers,'X-Kawaikara-Nonce':requestNonce});
  assert.equal(revoked.status,401);
  assert.equal(revoked.data.proof,createHmac('sha256',a.token).update(`revoked\n${requestNonce}\n${client}`).digest('hex'));
  assert.equal((await f.call('catalog',undefined,b.headers)).status,200);
  assert.equal(f.bridge.connectionStatus().connections.length,4);
  await f.call('disconnect',{},b.headers);
  assert.equal(f.bridge.connectionStatus().connections.length,3);
  await f.bridge.dispose(); await f.bridge.start();
  assert.equal(f.bridge.connectionStatus().connections.length,3,'All active clients survive restart');
  assert.equal((await f.call('catalog',undefined,profiles[2].headers)).status,200);
  assert.equal((await f.call('catalog',undefined,a.headers)).status,401);
  assert.equal((await f.call('catalog')).status,200);
  // Reconnection restores only this profile and cannot resurrect its old grants.
  const code=JSON.parse(await f.bridge.createConnectionCode());
  const reconnected=await f.call('pair',{adapterVersion:2},{Authorization:`Bearer ${code.token}`,'X-Kawaikara-Instance':a.instance});
  assert.equal(reconnected.status,200);
  assert.equal((await f.call('catalog',undefined,{...a.headers,Authorization:`Bearer ${reconnected.data.token}`})).data.grants.length,0);
});

test('explicit handoff mode is independent per connection and does not change the saved default', async t => {
  const f = await fixture(t);
  await f.bridge.setDevelopment(true);
  for (const development of [false, true]) {
    const link = new URL(f.bridge.createConnectionUrl(development));
    assert.equal(link.hash.endsWith(':development'), development);
    const result = await f.call('connect', {adapterVersion: 2, handoff: link.hash.slice(1).split(':')[0], extension: {development}}, {'X-Kawaikara-Client': `chrome-extension://${(development ? 'b' : 'c').repeat(32)}`});
    assert.equal(result.status, 200);
  }
  assert.deepEqual(f.bridge.connectionStatus().connections.map(c => c.extension.connectionMode).sort(), ['development', 'production']);
  assert.equal(f.bridge.connectionStatus().useDevelopment, true);
});

test('desktop rejects Provider results containing undeclared browser commands', async t => {
  const f = await fixture(t, async () => true, {execute: async () => ({script:'alert(1)'})});
  await f.pair();
  const catalog = await f.call('catalog');
  assert.equal((await f.call('grant', {providerId:'example.video', revision:catalog.data.revision, actions:initial[0].actions})).status, 200);
  const result = await f.call('invoke', {providerId:'example.video', revision:(await f.call('catalog')).data.revision, action:'open', url:'https://example.com/watch', requestId:'command-result-test-1'});
  assert.equal(result.status, 400);
  assert.equal(result.data.error, 'invalid-browser-effect');
});
