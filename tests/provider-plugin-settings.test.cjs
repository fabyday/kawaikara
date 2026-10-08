const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const { builtinBundle, ChzzkProvider, YouTubeProvider, WavveProvider, AppleTvProvider } = require('@kawaikara/builtin-sites');
const { SHORT_FORM_VIDEO_ACTIONS, SHORT_FORM_PUBLISHER_CAPABILITY } = require('@kawaikara/site-api');

function loadSource(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => id === 'electron' ? { app: { getLocale: () => 'en-US' } } : Module.prototype.require.call(loaded, id);
  loaded._compile(buildSync({ entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: ['electron'], define: {
      __KAWAIKARA_BUILD_CHANNEL__: '"nightly"', __KAWAIKARA_DISTRIBUTION_BUILD__: 'false',
      __KAWAIKARA_DISCORD_APP_ID__: '""', __KAWAIKARA_UPDATE_TEST_PROFILE__: 'null',
    },
  }).outputFiles[0].text, filename);
  return loaded.exports;
}
const { SiteManager } = loadSource('src/Main/Manager/SiteManager.ts');
const { requiresProviderReload } = loadSource('src/Main/Functional/ProviderSettings.ts');
const { mergeValidatedPreferences } = loadSource('src/Main/Functional/Preferences.ts');

const { PluginRuntime } = loadSource('src/Main/Functional/PluginRuntime.ts');
const { AbstractPlugin, defineCapability, getPluginMetadata } = require('@kawaikara/site-api');

function runtimeFixture(permissions = ['script-injection', 'network-interception']) {
  const injections = new Map(), errors = [], events = [];
  const source = {
    logger: { info() {}, warn() {}, debug() {}, error(...args) { errors.push(args); } },
    viewer: { async loadURL(url) { events.push(url); }, async loadInternalView() {} },
    actions: { createUrl: id => `kawaikara:action/${id}` },
    page: {
      register(value) { injections.set(value.id, value); return { dispose() { injections.delete(value.id); } }; },
      on() { return { dispose() {} }; }, async refresh() {}, async execute() { return 'result'; },
      async executeInAllFrames() { return []; }, sendKeyPress(key) { events.push(key); },
      dispose() { throw new Error('A Plugin must not dispose its Provider pipeline'); },
    },
    browser: { useIdentity() { return { dispose() {} }; } },
    cookies: { async list() { return []; }, async clear() { return 0; } },
    externalBrowser: { async login() {}, async close() {} }, async openExternal() {},
  };
  return { source, runtime: new PluginRuntime(source, { id: 'fixture.provider', permissions }), injections, errors, events };
}

function registration(id, activate, extras = {}, deactivate) {
  return { bundleId: 'fixture', metadata: { id, activation: {
    type: 'boolean', key: `enabled.${id}`, title: id, defaultValue: true, reloadOnChange: false,
  }, ...extras }, constructor: class extends AbstractPlugin {
    activate() { return activate(this.context); }
    async deactivate() { if (deactivate) await deactivate(this.context); await super.deactivate(); }
  } };
}

test('host cleanup aborts pending work, revokes actions and never disposes a shared Provider page', async () => {
  const { runtime, injections, events, errors } = runtimeFixture();
  let first, second, release, cleaned = 0;
  const held = new Promise(resolve => { release = resolve; });
  const plugins = [registration('first', context => {
    first = context;
    context.page.register({ id: 'same', source: async () => { await held; return 'late-script'; } });
    context.actions.register('fixture:first', () => { events.push('first'); });
    context.lifetime.track({ dispose() { throw new Error('cleanup fixture'); } });
    context.lifetime.track({ dispose() { cleaned++; } });
  }), registration('second', context => {
    second = context; context.page.register({ id: 'same', source: 'second-script' });
  })];
  await runtime.sync(plugins, {});
  assert.equal(injections.size, 2);
  const pending = injections.get('first:same').source();
  await runtime.sync(plugins, { 'enabled.first': false });
  assert.equal(first.lifetime.signal.aborted, true); assert.equal(second.lifetime.signal.aborted, false);
  assert.equal(cleaned, 1); assert.equal(errors.length, 1); assert.equal(injections.size, 1);
  assert.equal(await runtime.handleAction('fixture:first'), false);
  assert.throws(() => first.page.sendKeyPress('late'), /no longer active/);
  await assert.rejects(first.provider.viewer.loadURL('late'), /no longer active/);
  release(); await assert.rejects(pending, /no longer active/);
  second.provider.page.dispose(); assert.equal(injections.size, 1);
  await runtime.retire(); assert.equal(injections.size, 0);
  await runtime.retire(); assert.equal(cleaned, 1);
});

test('network ordering is stable, cancellation wins and hook failures are isolated', async () => {
  const { runtime, errors } = runtimeFixture();
  const plugins = [registration('low', context => context.network.onBeforeRequest(() => ({ redirectURL: 'https://low.example' }), 0)),
    registration('high', context => context.network.onBeforeRequest(() => ({ redirectURL: 'https://high.example' }), 10)),
    registration('broken', context => context.network.onBeforeRequest(() => { throw new Error('hook fixture'); }, 100)),
    registration('block', context => context.network.onBeforeRequest(() => ({ cancel: true }), -10))];
  await runtime.sync(plugins, { 'enabled.block': false });
  assert.deepEqual(runtime.transformRequest({ url: 'https://source.example', method: 'GET' }), { redirectURL: 'https://high.example' });
  assert.equal(runtime.listStates().find(state => state.id === 'broken').state, 'failed');
  assert.equal(errors.length, 1);
  await runtime.sync(plugins, {});
  assert.deepEqual(runtime.transformRequest({}, { redirectURL: 'https://provider.example' }), { cancel: true });
  await runtime.retire(); assert.equal(runtime.transformRequest({}), undefined);
});

test('capability facades enforce producer lifetime, consumer lifetime and exact version', async () => {
  const { runtime } = runtimeFixture();
  const token = defineCapability('fixture.service', 1);
  let producer, consumer, release;
  const held = new Promise(resolve => { release = resolve; });
  const plugins = [registration('producer', context => {
    producer = context;
    context.capabilities.provide(token, { read: () => 7, delayed: () => held });
  }), registration('consumer', context => { consumer = context; })];
  await runtime.sync(plugins, {});
  const service = consumer.capabilities.get(token), capturedRead = service.read;
  assert.equal(capturedRead(), 7);
  assert.equal(consumer.capabilities.get(defineCapability('fixture.service', 2)), undefined);
  assert.throws(() => producer.capabilities.provide(token, {}), /already registered/);
  const delayed = service.delayed();
  await runtime.sync(plugins, { 'enabled.producer': false });
  assert.throws(capturedRead, /retired/); release(9); await assert.rejects(delayed, /retired/);
  await runtime.sync(plugins, {});
  assert.equal(consumer.capabilities.get(token).read(), 7);
  assert.throws(capturedRead, /retired/);
  const latest = consumer.capabilities.get(token).read;
  await runtime.sync(plugins, { 'enabled.consumer': false });
  assert.throws(latest, /no longer active/);
  await runtime.retire();
});

test('permissions and declared settings are enforced per Plugin with detached snapshots', async () => {
  const { runtime } = runtimeFixture([]);
  let captured, changes = 0;
  const plugins = [registration('settings', context => {
    captured = context;
    assert.equal(context.page, undefined); assert.equal(context.network, undefined);
    assert.equal(context.provider.page, undefined); assert.equal(context.provider.browser, undefined);
    assert.equal(context.provider.cookies, undefined);
    context.settings.onChanged(() => { changes++; });
  }, { settings: [{ type: 'item-list', key: 'own-list', title: 'List' }] })];
  const values = { 'other-plugin-secret': 'hidden', 'own-list': [{ id: 'one', label: 'Original' }] };
  await runtime.sync(plugins, values);
  const snapshot = captured.settings.get(); assert.equal(snapshot['other-plugin-secret'], undefined);
  snapshot['own-list'][0].label = 'Mutation';
  assert.equal(captured.settings.get()['own-list'][0].label, 'Original');
  await runtime.sync(plugins, { ...values, unrelated: true }); assert.equal(changes, 0);
  await runtime.sync(plugins, { ...values, 'own-list': [] }); assert.equal(changes, 1);
  await runtime.retire(); assert.throws(() => captured.settings.get(), /no longer active/);
});

test('duplicate actions roll back only the failing activation', async () => {
  const { runtime, injections } = runtimeFixture(); let handled = 0;
  const plugins = [registration('good', context => context.actions.register('fixture:shared', () => { handled++; })),
    registration('duplicate', context => {
      context.page.register({ id: 'temporary', source: '' });
      context.actions.register('fixture:shared', () => {});
    })];
  await runtime.sync(plugins, {}); assert.equal(injections.size, 0);
  assert.equal(runtime.listStates().find(state => state.id === 'duplicate').state, 'failed');
  assert.equal(await runtime.handleAction('fixture:shared'), true); assert.equal(handled, 1);
  assert.equal(runtime.listStates().find(state => state.id === 'good').state, 'active');
  await runtime.retire();
});

test('reverse teardown follows immediate revocation, even during pending activation', async () => {
  const { runtime } = runtimeFixture(); const order = [];
  const plugins = ['a', 'b'].map(id => registration(id, () => {}, {}, async context => {
    assert.equal(context.lifetime.signal.aborted, true); order.push(id);
  }));
  await runtime.sync(plugins, {}); await runtime.retire(); assert.deepEqual(order, ['b', 'a']);
  const other = runtimeFixture(); let release, captured;
  const held = new Promise(resolve => { release = resolve; });
  const pending = other.runtime.sync([registration('slow', async context => {
    captured = context; await held; context.page.register({ id: 'late', source: '' });
  })], {});
  assert.ok(captured); await other.runtime.retire(); release(); await pending;
  assert.equal(other.injections.size, 0); assert.equal(captured.lifetime.signal.aborted, true);
});

test('distribution manifests load the same seven real Provider-owned Plugins', async () => {
  const { inspectBundle, readBundleManifest, loadBundleDefinition } = loadSource('src/Main/Functional/BundleRuntime.ts');
  const directory = path.resolve(__dirname, '../packages/builtin-sites/dist');
  const inspected = await inspectBundle(directory, await readBundleManifest(directory));
  const packaged = loadBundleDefinition(inspected);
  const ids = bundle => bundle.providers.flatMap(provider => provider.plugins.map(plugin => plugin.manifest.id)).sort();
  assert.equal(ids(packaged).length, 7); assert.deepEqual(ids(packaged), ids(builtinBundle));
  const manager = new SiteManager(() => {}, () => ({ providerSettings: {} }), () => '');
  manager.registerBundle(packaged); assert.equal(manager.listBundles()[0].pluginCount, 7);
  for (const provider of packaged.providers) for (const plugin of provider.plugins) {
    assert.equal(getPluginMetadata(plugin.plugin).id, plugin.manifest.id);
    assert.ok(manager.pluginsFor(provider.manifest.id).some(entry => entry.metadata.id === plugin.manifest.id));
  }
});

test('App settings save recreates enabled Plugins, preserves the URL and removes the previous hooks', async () => {
  const preferences = { appLocale: 'ko-KR', providerSettings: {} }, contexts = [];
  const manager = new SiteManager(async () => {
    const fixture = runtimeFixture(); contexts.push(fixture);
    fixture.source.page.dispose = () => fixture.injections.clear();
    return fixture.source;
  }, () => preferences, () => 'https://chzzk.naver.com/live/fixture');
  manager.resolveLocales = () => ({ app: 'ko-KR', site: 'ko-KR' });
  manager.resolveBrowserProfile = registration => ({ siteId: registration.metadata.id, partition: 'fixture' });
  manager.registerBundle(builtinBundle);
  await manager.load('kawaikara.chzzk');
  const original = manager.currentPluginRuntime;
  assert.equal(original.listStates().filter(state => state.state === 'active').length, 3);
  assert.deepEqual(manager.transformRequest({ method: 'GET', url: 'https://pubads.g.doubleclick.net/gampad/ads' }), { cancel: true });
  preferences.providerSettings['kawaikara.chzzk'] = { 'plugins.ad-blocking': false };
  await manager.applyCurrentProviderSettings();
  assert.notEqual(manager.currentPluginRuntime, original);
  assert.equal(contexts[0].injections.size, 0);
  assert.equal(contexts.at(-1).events.at(-1), 'https://chzzk.naver.com/live/fixture');
  assert.equal(await original.handleAction('chzzk:quality:enable-720'), false);
  assert.equal(manager.transformRequest({ method: 'GET', url: 'https://pubads.g.doubleclick.net/gampad/ads' }), undefined);
  const active = manager.currentPluginRuntime;
  preferences.providerSettings['kawaikara.chzzk']['short-form-video.auto-advance'] = false;
  await manager.applyCurrentProviderSettings(); assert.equal(manager.currentPluginRuntime, active);
  await manager.handleAction('chzzk:quality:enable-720');
  assert.deepEqual(manager.transformRequest({ method: 'GET', url: 'https://media.example/480p.m3u8' }), { redirectURL: 'https://media.example/720p.m3u8' });
  const chzzkState = manager.listBundles()[0].providers.find(provider => provider.id === 'kawaikara.chzzk');
  assert.equal(chzzkState.plugins.find(plugin => plugin.id === 'kawaikara.chzzk.ad-block').state, 'disabled');
  await manager.dispose();
  assert.ok(contexts.every(context => context.injections.size === 0));
});

test('manual resource release and host retirement dispose a handle only once', async () => {
  const { runtime } = runtimeFixture(); let count = 0, handle;
  await runtime.sync([registration('handles', context => {
    handle = context.lifetime.track({ dispose() { count++; } });
  })], {});
  handle.dispose(); handle.dispose(); await runtime.retire(); assert.equal(count, 1);
});

test('a late action result from an old Plugin cannot fail its re-enabled replacement', async () => {
  const { runtime } = runtimeFixture(); let release, calls = 0;
  const held = new Promise(resolve => { release = resolve; });
  const plugins = [registration('action', context => {
    context.actions.register('fixture:delayed', async () => { calls++; if (calls === 1) await held; });
  })];
  await runtime.sync(plugins, {});
  const pending = runtime.handleAction('fixture:delayed');
  await runtime.sync(plugins, { 'enabled.action': false });
  await runtime.sync(plugins, {});
  release(); await pending;
  assert.equal(runtime.listStates()[0].state, 'active');
  assert.equal(await runtime.handleAction('fixture:delayed'), true); assert.equal(calls, 2);
  await runtime.retire();
});

test('Bundle-global settings are composed for all matching Providers and removed on unregister', () => {
  const { defineBundle, defineProvider, definePlugin, plugin, provider, AbstractProvider } = require('@kawaikara/site-api');
  const create = (id, plugins = []) => {
    const Provider = provider()(class extends AbstractProvider { async load() {} });
    return defineBundle({ id, name: id, version: '1.0.0', apiVersion: 1, permissions: [], plugins,
      providers: [defineProvider({ manifest: { schemaVersion: 1, id: `${id}.provider`, name: id,
        version: '1.0.0', apiVersion: 1, main: 'Provider.js', permissions: [],
        contributes: { menu: { category: 'fixture' } } }, provider: Provider })] });
  };
  const Plugin = plugin({ id: 'fixture.global' })(class extends AbstractPlugin { activate() {} });
  const global = definePlugin({ manifest: { schemaVersion: 1, id: 'fixture.global', name: 'Global fixture',
    version: '1.0.0', apiVersion: 1, main: 'Plugin.js' }, plugin: Plugin });
  const preferences = { providerSettings: { 'first.provider': { 'plugins.fixture.global.enabled': false } } };
  const manager = new SiteManager(() => {}, () => preferences, () => '');
  manager.registerBundle(create('first')); manager.registerBundle(create('second', [global]));
  const providers = manager.listBundles().flatMap(bundle => bundle.providers);
  assert.ok(providers.every(provider => provider.settings.some(category => category.id === 'plugin.fixture.global')));
  assert.equal(providers.find(provider => provider.id === 'first.provider').plugins[0].enabled, false);
  assert.equal(providers.find(provider => provider.id === 'second.provider').plugins[0].enabled, true);
  manager.rollbackBundleRegistration('second');
  assert.equal(manager.listBundles()[0].providers[0].settings.length, 0);
});

test('page frame iteration stops when the Plugin aborts without retiring its Provider', async () => {
  const { EventEmitter } = require('node:events');
  const { createSitePagePipeline } = loadSource('src/Main/Functional/SitePagePipeline.ts');
  const controller = new AbortController(); let release, second = 0;
  const held = new Promise(resolve => { release = resolve; });
  const contents = new EventEmitter(); contents.isDestroyed = () => false;
  contents.mainFrame = { framesInSubtree: [
    { isDestroyed: () => false, executeJavaScript: () => held },
    { isDestroyed: () => false, executeJavaScript: async () => { second++; } },
  ] };
  const pipeline = createSitePagePipeline(contents, { debug() {}, warn() {} });
  const pending = pipeline.executeInAllFrames('fixture', '', controller.signal);
  controller.abort(); release(); await assert.rejects(pending, /abort/i); assert.equal(second, 0);
  pipeline.dispose();
});

function fixture(Provider) {
  const injections = new Map(), refreshed = [], keys = [], navigations = [];
  const context = {
    page: {
      register(injection) { injections.set(injection.id, injection); return { dispose() { injections.delete(injection.id); } }; },
      on() { return { dispose() {} }; },
      async refresh(id) { refreshed.push(id); },
      async execute() { throw new Error('Disabled plugin executed a script'); },
      async executeInAllFrames() { throw new Error('Disabled plugin executed a script'); },
      sendKeyPress(key) { keys.push(key); },
    },
    viewer: { async loadURL(url) { navigations.push(url); } },
    actions: { createUrl: action => `kawaikara:action/${action}` },
    logger: { info() {}, warn() {}, debug() {}, error(...args) { assert.fail(args.join(' ')); } },
    locale: { site: 'ko-KR' },
  };
  const manager = new SiteManager(() => {}, () => ({}), () => '');
  manager.registerBundle(builtinBundle);
  const registration = [...manager.sites.values()].find(entry => entry.constructor === Provider);
  const registrations = manager.pluginsFor(registration.metadata.id);
  const runtime = new PluginRuntime(context, registration.metadata);
  const instance = new Provider({ ...context, capabilities: runtime.capabilities });
  let values = {};
  const provider = {
    async onSettingsChanged(settings) { values = settings; await instance.onSettingsChanged(settings);
      if (runtime.listStates().length) await runtime.sync(registrations, values); },
    async load() { await runtime.sync(registrations, values); await instance.load(); },
    async unload() { await runtime.retire(); await instance.unload(); },
    onBeforeRequest(details) { return runtime.transformRequest(details, instance.onBeforeRequest(details)); },
    onAction(action) { return runtime.handleAction(action); },
    getShortFormVideoPublisher() { return runtime.capabilities.get(SHORT_FORM_PUBLISHER_CAPABILITY)?.getPublisher(); },
  };
  return { provider, instance, runtime, injections, refreshed, keys, navigations };
}

test('Kawaikara bundle keeps six default-on plugins and one opt-in upscaling plugin', () => {
  const manager = new SiteManager(() => {}, () => ({}), () => '');
  manager.registerBundle(builtinBundle);
  const providers = manager.listBundles()[0].providers;
  const switches = providers.flatMap(provider => provider.settings.filter(category => category.id.startsWith('plugin.'))
    .map(category => category.settings[0]));
  assert.equal(switches.length, 7);
  for (const setting of switches) {
    assert.equal(setting.type, 'boolean'); assert.equal(setting.defaultValue, setting.key !== 'plugins.upscaling');
    for (const locale of ['ko-KR', 'en-US', 'ja-JP']) assert.ok(setting.title[locale]);
  }
  for (const registration of manager.sites.values()) {
    for (const category of registration.metadata.settings?.categories ?? []) {
      for (const setting of category.settings) {
        if (setting === category.settings[0] && category.id.startsWith('plugin.')) assert.equal(setting.reloadOnChange, setting.key !== 'plugins.upscaling');
      }
    }
  }
});

test('CHZZK defaults keep every injection, ad blocking and quality enhancement', async () => {
  const { provider, injections } = fixture(ChzzkProvider);
  await provider.onSettingsChanged({}); await provider.load();
  assert.equal(injections.size, 4);
  assert.deepEqual(provider.onBeforeRequest({ method: 'GET', url: 'https://pubads.g.doubleclick.net/gampad/ads?x=1' }), { cancel: true });
  assert.deepEqual(provider.onBeforeRequest({ method: 'GET', url: 'https://media.example/480p.m3u8' }), { redirectURL: 'https://media.example/1080p.m3u8' });
  await provider.unload(); assert.equal(injections.size, 0);
});

test('CHZZK disabling every plugin leaves playback/navigation intact without injections or action effects', async () => {
  const { provider, injections, navigations, keys } = fixture(ChzzkProvider);
  await provider.onSettingsChanged({ 'plugins.ad-blocking': false, 'plugins.quality-enhancement': false, 'plugins.clips': false });
  await provider.load();
  assert.equal(injections.size, 0); assert.deepEqual(navigations, ['https://chzzk.naver.com/']);
  assert.equal(provider.onBeforeRequest({ method: 'GET', url: 'https://pubads.g.doubleclick.net/gampad/ads' }), undefined);
  assert.equal(provider.onBeforeRequest({ method: 'GET', url: 'https://media.example/480p.m3u8' }), undefined);
  for (const action of ['chzzk:quality:enable-1080', 'chzzk:quality:enable-720', 'chzzk:clips:skip-advertisement', SHORT_FORM_VIDEO_ACTIONS.next]) {
    assert.equal(await provider.onAction(action), false);
  }
  assert.deepEqual(keys, []); await provider.unload();
});

test('CHZZK ad blocking is independent from Clips and quality settings, including serialized clip ads', async () => {
  const { provider, injections, refreshed } = fixture(ChzzkProvider);
  await provider.onSettingsChanged({ 'plugins.ad-blocking': false }); await provider.load();
  assert.deepEqual([...injections.keys()], ['kawaikara.chzzk.quality:quality-enhancement', 'kawaikara.chzzk.clips:chzzk.clips']);
  const source = await injections.get('kawaikara.chzzk.clips:chzzk.clips').source();
  assert.match(source, /"skipAdvertisements":false/);
  assert.match(source, /options.skipAdvertisements === false/);
  await provider.onSettingsChanged({ 'plugins.ad-blocking': false, 'short-form-video.auto-advance': false });
  assert.deepEqual(refreshed, ['kawaikara.chzzk.clips:chzzk.clips']);
  assert.match(await injections.get('kawaikara.chzzk.clips:chzzk.clips').source(), /"autoAdvance":false/);
  await provider.unload();
});

for (const [Provider, key, injection] of [
  [YouTubeProvider, 'plugins.shorts', 'kawaikara.youtube.shorts:youtube.shorts'],
  [WavveProvider, 'plugins.responsive-viewport', 'kawaikara.wavve.responsive-viewport:ResponsiveViewport'],
  [AppleTvProvider, 'plugins.storefront-persistence', 'kawaikara.apple-tv.storefront:Storefront'],
]) {
  test(`${Provider.name} optional injection can be disabled and re-enabled on the next load`, async () => {
    for (const enabled of [false, true]) {
      const { provider, injections, navigations } = fixture(Provider);
      await provider.onSettingsChanged({ [key]: enabled }); await provider.load();
      assert.equal(injections.has(injection), enabled); assert.equal(navigations.length, 1);
      if (!enabled && Provider === YouTubeProvider) {
        assert.equal(await provider.onAction(SHORT_FORM_VIDEO_ACTIONS.next), false);
        assert.equal(await provider.getShortFormVideoPublisher(), undefined);
      }
      await provider.unload(); assert.equal(injections.size, 0);
    }
  });
}

test('reload comparison uses effective defaults and ignores live or unrelated preferences', () => {
  const metadata = { settings: { categories: [{ settings: [
    { type: 'boolean', key: 'plugin', defaultValue: true, reloadOnChange: true },
    { type: 'boolean', key: 'live', defaultValue: true },
  ] }] } };
  assert.equal(requiresProviderReload(metadata, {}, { plugin: true, live: false }), false);
  assert.equal(requiresProviderReload(metadata, {}, { plugin: 'invalid' }), false);
  assert.equal(requiresProviderReload(metadata, {}, { plugin: false }), true);
  assert.equal(requiresProviderReload(metadata, { plugin: false }, {}), true);
  assert.equal(requiresProviderReload(metadata, { plugin: false }, { plugin: false }), false);
});

test('false plugin values survive persisted preference validation and stay scoped to their Provider', () => {
  const saved = mergeValidatedPreferences({ providerSettings: {
    'kawaikara.chzzk': { 'plugins.ad-blocking': false, 'plugins.clips': false },
    'kawaikara.youtube': { 'plugins.shorts': true },
  } });
  const restored = mergeValidatedPreferences(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.providerSettings, saved.providerSettings);
  assert.equal(restored.providerSettings['kawaikara.chzzk']['plugins.ad-blocking'], false);
  assert.equal(restored.providerSettings['kawaikara.youtube']['plugins.shorts'], true);
});
