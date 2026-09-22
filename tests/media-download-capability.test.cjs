const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');

function loadSource(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id)
    ? mocks[id]
    : Module.prototype.require.call(loaded, id);
  const code = buildSync({
    entryPoints: [filename], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: Object.keys(mocks),
  }).outputFiles[0].text;
  loaded._compile(code, filename);
  return loaded.exports;
}

const {
  requireExternalDownloaderSourceUrl,
} = loadSource('src/Main/Functional/ExternalDownloader.ts', { electron: {} });

test('Kawaikara forwards safe HTTPS sources without deciding downloader support', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=fixture',
    'https://laftel.net/item/12345',
    'https://netflix.com/watch/12345',
    'https://example.com/media/fixture',
  ]) {
    assert.equal(requireExternalDownloaderSourceUrl(url), url);
  }
});

test('Kawaikara rejects only unsafe or malformed transport values', () => {
  for (const url of [
    'not a url',
    'http://youtube.com/watch?v=fixture',
    'https://user:password@youtube.com/watch?v=fixture',
    'https://youtube.com:444/watch?v=fixture',
  ]) {
    assert.throws(() => requireExternalDownloaderSourceUrl(url), /safe HTTPS source URL/);
  }
});
