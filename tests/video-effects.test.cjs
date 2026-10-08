const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const { gzipSync } = require('node:zlib');
const { buildSync } = require('esbuild');
const { builtinBundle } = require('@kawaikara/builtin-sites');
const { VIDEO_CONTENT, getPluginMetadata } = require('@kawaikara/site-api');

function loadSource(relative) {
  const filename = path.resolve(__dirname, '..', relative), loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => id === 'electron' ? { app: { getLocale: () => 'en-US' } } : Module.prototype.require.call(loaded, id);
  loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['electron', '@kawaikara/site-api'], define: { __KAWAIKARA_BUILD_CHANNEL__: '"nightly"',
      __KAWAIKARA_DISTRIBUTION_BUILD__: 'false', __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null' },
  }).outputFiles[0].text, filename);
  return loaded.exports;
}
const { PluginRuntime } = loadSource('src/Main/Functional/PluginRuntime.ts');
const { validateProviderContributions } = loadSource('src/Main/Functional/SiteRuntime.ts');
const { requiresProviderReload } = loadSource('src/Main/Functional/ProviderSettings.ts');
const { createVideoEffectsHost } = loadSource('src/Main/Functional/VideoEffectsHost.ts');
const { createScopedSiteContext } = loadSource('src/Main/Functional/ScopedSiteContext.ts');
const { mergeValidatedPreferences } = loadSource('src/Main/Functional/Preferences.ts');
const { resolveChzzkVideoContent } = loadSource('packages/builtin-sites/src/Providers/Chzzk/Inject/VideoContent.ts');
const definition = builtinBundle.providers.find(p => p.manifest.id === 'kawaikara.chzzk')
  .plugins.find(p => p.manifest.id === 'kawaikara.chzzk.upscaling');
const metadata = getPluginMetadata(definition.plugin);
const registration = { bundleId: 'kawaikara', metadata, constructor: definition.plugin };
const select = metadata.settings[0];
const provider = settings => ({ id: 'fixture', menu: { category: 'Test' }, settings: { categories: [{ id: 'effects', title: 'Effects', settings }] } });

function fixture(permissions = ['script-injection']) {
  const effects = new Map(), logs = [], events = [];
  const source = {
    logger: Object.fromEntries(['info', 'warn', 'debug', 'error'].map(level => [level, (...args) => logs.push([level, ...args])])),
    actions: { createUrl: id => id }, viewer: { async loadURL() {}, async loadInternalView() {} },
    externalBrowser: { async close() {}, async login() {} }, async openExternal() {},
    videoEffects: { register(value) { effects.set(value.id, value); events.push(value);
      return { dispose() { effects.delete(value.id); } }; } },
  };
  const runtime = new PluginRuntime(source, { id: 'fixture', permissions });
  return { source, runtime, effects, events, logs };
}

test('four localized choices are opt-in, persist as strings and never require reloading', () => {
  assert.equal(metadata.activation.defaultValue, false);
  assert.equal(metadata.activation.reloadOnChange, false);
  assert.deepEqual(select.options.map(option => option.value), ['anime4k', 'websr', 'fsr1', 'realesrgan']);
  for (const option of select.options) for (const locale of ['en-US', 'ko-KR', 'ja-JP']) assert.ok(option.label[locale]);
  assert.equal(select.defaultValue, 'anime4k');
  validateProviderContributions(provider([select]));
  assert.equal(requiresProviderReload(provider([select]), {}, { [select.key]: 'fsr1' }), false);
  const saved = mergeValidatedPreferences({ providerSettings: { 'kawaikara.chzzk': { [select.key]: 'websr' } } });
  assert.equal(saved.providerSettings['kawaikara.chzzk'][select.key], 'websr');
});

test('restoration and denoising are localized, persisted independent live settings', () => {
  const [restore, denoise] = metadata.settings.slice(1);
  assert.equal(restore.defaultValue, 'soft'); assert.equal(denoise.defaultValue, 'light');
  assert.deepEqual(restore.options.map(o => o.value), ['off', 'soft', 'detail', 'strong']);
  assert.deepEqual(denoise.options.map(o => o.value), ['off', 'light', 'medium']);
  validateProviderContributions(provider(metadata.settings));
  for (const setting of metadata.settings.slice(1)) {
    for (const locale of ['en-US', 'ko-KR', 'ja-JP']) {
      assert.ok(setting.title[locale]); assert.ok(setting.description[locale]);
      for (const option of setting.options) assert.ok(option.label[locale]);
    }
    for (const option of setting.options) {
      assert.equal(requiresProviderReload(provider(metadata.settings), {}, { [setting.key]: option.value }), false);
      const saved=mergeValidatedPreferences({providerSettings:{'kawaikara.chzzk':{[setting.key]:option.value}}});
      assert.equal(saved.providerSettings['kawaikara.chzzk'][setting.key],option.value);
    }
  }
});

test('select rejects empty/duplicate/invalid options and defaults outside its list', () => {
  for (const changed of [{ options: [] }, { defaultValue: 'missing' }, { options: [select.options[0], select.options[0]] },
    { options: [{ value: '../escape', label: 'Bad' }], defaultValue: '../escape' },
    { options: [{ value: 'a', label: '' }], defaultValue: 'a' }]) {
    assert.throws(() => validateProviderContributions(provider([{ ...select, ...changed }])));
  }
  const reload = { ...select, reloadOnChange: true };
  assert.equal(requiresProviderReload(provider([reload]), {}, { [select.key]: 'bad' }), false);
  assert.equal(requiresProviderReload(provider([reload]), {}, { [select.key]: 'websr' }), true);
});

test('Plugin live switching owns one registration; disabling and retirement release it', async () => {
  const { runtime, effects, events, logs } = fixture();
  runtime.capabilities.provide(VIDEO_CONTENT, { resolver: () => '() => window.fixtureContent' });
  await runtime.sync([registration], {}); assert.equal(effects.size, 0);
  await runtime.sync([registration], { 'plugins.upscaling': true }); assert.equal(effects.size, 1);
  const initial = events[0];
  assert.deepEqual(initial.options, { restore: 'soft', denoise: 'light', quality: 'high' });
  assert.equal(initial.factory.execution, 'worker');
  assert.equal(initial.factory.scale, 2);
  for (const kind of ['live', 'vod', 'short', 'unknown']) {
    const video = {};
    const resolve = vm.runInNewContext(`(${initial.resolveVideo})`, { window: { fixtureContent: { video, kind } } });
    assert.equal(resolve(), ['live', 'vod'].includes(kind) ? video : null);
  }
  await runtime.sync([registration], { 'plugins.upscaling': true, [select.key]: 'fsr1' });
  assert.equal(effects.size, 1); assert.notEqual(events[1].factory.gzipBase64, initial.factory.gzipBase64);
  assert.deepEqual(events[1].options, { sharpness: 'normal' }, 'FSR receives only its own options');
  await runtime.sync([registration], { 'plugins.upscaling': true, [select.key]: 'invalid' });
  assert.equal(events[2].factory.gzipBase64, initial.factory.gzipBase64);
  await runtime.sync([registration], { 'plugins.upscaling': true, [select.key]: 'anime4k',
    'upscaling.anime4k.restore': 'detail', 'upscaling.anime4k.denoise': 'off' });
  assert.equal(effects.size, 1); assert.deepEqual(events.at(-1).options, {restore:'detail',denoise:'off',quality:'high'});
  await runtime.sync([registration], { 'plugins.upscaling': true, [select.key]: 'anime4k',
    'upscaling.anime4k.restore': 'invalid', 'upscaling.anime4k.denoise': 'invalid' });
  assert.deepEqual(events.at(-1).options, {restore:'soft',denoise:'light',quality:'high'});
  const count = events.length;
  await runtime.sync([registration], { 'plugins.upscaling': true, 'unrelated': true });
  assert.equal(events.length, count, 'Unrelated changes must not restart GPU compilation');
  await runtime.sync([registration], { 'plugins.upscaling': true, 'upscaling.anime4k.restore': 'strong', 'upscaling.anime4k.quality': 'balanced' });
  assert.deepEqual(events.at(-1).options, {restore:'strong',denoise:'light',quality:'balanced'});
  await runtime.sync([registration], { 'plugins.upscaling': false }); assert.equal(effects.size, 0);
  await runtime.sync([registration], { 'plugins.upscaling': true, [select.key]: 'websr' });
  await runtime.retire(); assert.equal(effects.size, 0); assert.deepEqual(logs.filter(([level])=>level!=='debug'), []);
});

test('missing App support, missing Provider contract or missing permission quietly does nothing', async () => {
  for (const condition of ['app', 'provider', 'permission']) {
    const setup = fixture(condition === 'permission' ? [] : undefined);
    if (condition === 'app') setup.source.videoEffects = undefined;
    if (condition !== 'provider') setup.runtime.capabilities.provide(VIDEO_CONTENT, { resolver: () => '() => null' });
    await setup.runtime.sync([registration], { 'plugins.upscaling': true });
    assert.equal(setup.effects.size, 0);
    assert.equal(setup.runtime.listStates()[0].state, 'active');
    assert.equal(setup.logs[0][0], 'debug'); await setup.runtime.retire();
  }
});

test('only Provider resolver classifies CHZZK routes; clips and advertisement targets are separate', () => {
  const main = { clientWidth: 640, clientHeight: 360, closest: () => null,
    getBoundingClientRect: () => ({ width: 640, height: 360 }) };
  const ad = { ...main, closest: () => ({}) };
  for (const [pathname, kind] of [['/live/abc', 'live'], ['/video/123', 'vod'], ['/clips/123', 'short'], ['/', 'unknown']]) {
    const resolve = vm.runInNewContext(`(${resolveChzzkVideoContent.toString()})`, {
      location: { pathname }, document: { querySelectorAll: () => [ad, main] },
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    });
    assert.equal(resolve().video, main); assert.equal(resolve().kind, kind); assert.equal(resolve().key, pathname);
  }
});

test('App factory decoding is lazy, scoped, and cancelled before a pending injection can execute', async () => {
  const injections = new Map(), cleanup = [], logs = [];
  const page = { register(value) { injections.set(value.id, value); return { dispose() { injections.delete(value.id); } }; } };
  const host = createVideoEffectsHost({ isDestroyed: () => false, executeJavaScript: async code => cleanup.push(code) }, page, { debug: (...args) => logs.push(args) });
  const handle = host.register({ id: 'test', resolveVideo: '() => null', factory: {
    gzipBase64: gzipSync('async () => ({render: async()=>{},dispose(){}})').toString('base64'),
  } });
  const injection = [...injections.values()][0], pending = injection.source();
  handle.dispose(); handle.dispose();
  assert.equal(await pending, ''); assert.equal(injections.size, 0); assert.equal(cleanup.length, 1);
  const invalid = host.register({ id: 'bad', resolveVideo: '() => null', factory: { gzipBase64: 'invalid' } });
  const broken = [...injections.values()][0];
  assert.equal(await broken.source(), ''); assert.equal(await broken.source(), ''); assert.equal(logs.length, 1); invalid.dispose();
});

test('effect options cross the factory boundary as a bounded immutable JSON snapshot', async () => {
  let injection;
  const page={register(value){injection=value;return{dispose(){}}}};
  const host=createVideoEffectsHost({isDestroyed:()=>true},page,{debug(){}});
  const contribution={id:'options',resolveVideo:'()=>null',factory:'async(_video,_canvas,options)=>options'};
  for (const options of [null, [], new Date(), {nested:{}}, {bad:NaN}, {bad:Infinity}, {bad:undefined},
    {bad:()=>{}}, {bad:'x'.repeat(8193)}, Object.fromEntries(Array.from({length:33},(_,i)=>[`key${i}`,true]))]) {
    assert.throws(()=>host.register({...contribution,options}), /options/);
  }
  const options={restore:'detail',enabled:true,amount:0.5,text:'\");globalThis.injected=true;//'};
  Object.defineProperty(options,'__proto__',{value:'plain data',enumerable:true});
  const expected={...options}; const handle=host.register({...contribution,options});
  options.restore='off';
  const code=await injection.source();
  // Extract the actual factory argument without executing the unrelated DOM host.
  const ast=ts.createSourceFile('effect.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const factoryCode=ast.statements[0].expression.arguments[2].getText(ast);
  const context=vm.createContext({});
  const factory=vm.runInContext(`(${factoryCode})`,context);
  const received=await factory(null,null);
  assert.deepEqual(JSON.parse(JSON.stringify(received)),expected);
  assert.equal(Object.isFrozen(received),true);assert.equal(context.injected,undefined);
  handle.dispose();
});

test('worker factories remain compressed across Main and page, with validated output scale', async () => {
  let injection;
  const host=createVideoEffectsHost({isDestroyed:()=>true},{register(value){injection=value;return{dispose(){}}}},{debug(){}});
  const source='async()=>({render:async()=>{console.info("MODEL_SENTINEL")},dispose(){}})';
  const contribution={id:'worker',resolveVideo:'()=>null',factory:{execution:'worker',gzipBase64:gzipSync(source).toString('base64')}};
  for(const scale of [0,5,NaN,Infinity]) assert.throws(()=>host.register({...contribution,factory:{...contribution.factory,scale}}),/scale/);
  assert.throws(()=>host.register({...contribution,factory:{...contribution.factory,execution:'bad'}}),/execution/);
  const handle=host.register(contribution); const code=await injection.source();
  assert.ok(code.includes(contribution.factory.gzipBase64));assert.ok(!code.includes('MODEL_SENTINEL'));
  assert.ok(code.includes('import(url)'));assert.ok(code.includes('transferControlToOffscreen'));
  handle.dispose();assert.equal(await injection.source(),'');
});

test('Provider retirement releases outstanding effects and revokes captured registrations', async () => {
  const setup = fixture(), scoped = createScopedSiteContext(setup.source);
  const api = scoped.context.videoEffects;
  const released = api.register({ id: 'first' }); released.dispose(); released.dispose();
  api.register({ id: 'second' }); assert.equal(setup.effects.size, 1);
  await scoped.retire(); await scoped.retire(); assert.equal(setup.effects.size, 0);
  assert.throws(() => api.register({ id: 'late' }), /no longer active/);
});
