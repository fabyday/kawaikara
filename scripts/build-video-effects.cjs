// Build-only model acquisition; no CDN code, runtime network fetches, or authentication.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '..');
const plugin = path.join(root, 'packages/builtin-sites/src/Providers/Chzzk/Plugins/Upscaling');
const cache = path.join(root, '.cache/video-effects');
const lock = require('./video-effects-assets.lock.json');

async function main() {
  await fs.mkdir(cache, { recursive: true });
  const assets = {};
  for (const [name, asset] of Object.entries(lock)) {
    const target = path.join(cache, `${asset.sha256}-${name}`);
    let bytes = await fs.readFile(target).catch(() => null);
    if (!bytes) {
      const response = await fetch(asset.url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Video-effect asset unavailable (${response.status}); no automatic retry: ${name}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Asset SHA-256 mismatch: ${name}`);
    await fs.writeFile(target, bytes); assets[name] = target;
  }
  const ort = path.dirname(require.resolve('onnxruntime-web'));
  const fsr = path.join(root, 'node_modules/@pmndrs/upscaler/src/shaders');
  const aliases = {
    'websr-weights': assets['websr-weights.json'],
    'realesrgan-model': assets['realesrgan.onnx'],
    'ort-wasm': path.join(ort, 'ort-wasm-simd-threaded.asyncify.wasm'),
    'ort-bundled': path.join(ort, 'ort.webgpu.bundle.min.mjs'),
    'fsr-easu': path.join(fsr, 'easu.ts'), 'fsr-rcas': path.join(fsr, 'rcas.ts'),
  };
  const engines = {};
  const notices = {
    anime4k: [assets['anime4k-license.txt'], path.join(root, 'node_modules/anime4k-webgpu/LICENSE.md')],
    websr: [assets['anime4k-license.txt'], path.join(root, 'node_modules/@websr/websr/LICENSE')],
    fsr1: [path.join(root, 'node_modules/@pmndrs/upscaler/LICENSE')],
    realesrgan: [assets['realesrgan-license.txt'], assets['onnxruntime-license.txt'], assets['onnxruntime-notices.txt']],
  };
  for (const [id, entry] of Object.entries({ anime4k: 'Anime4k', websr: 'Websr', fsr1: 'Fsr1', realesrgan: 'Realesrgan' })) {
    const result = await build({ entryPoints: [path.join(plugin, 'Browser', `${entry}.mts`)],
      bundle: true, write: false, format: 'iife', globalName: 'KawaikaraUpscaler', platform: 'browser', target: 'chrome134',
      minify: true, legalComments: 'inline', alias: aliases, loader: { '.wasm': 'binary', '.onnx': 'binary' },
    });
    // Retain complete upstream notices even when the package is no longer in production node_modules.
    const license = (await Promise.all(notices[id].map(file => fs.readFile(file, 'utf8')))).join('\n\n');
    const factory = `async (video, canvas, options) => { /* LICENSES\n${license.replaceAll('*/', '* /')}\n*/\n${result.outputFiles[0].text}; return KawaikaraUpscaler.create(video, canvas, options); }`;
    engines[id] = gzipSync(factory, { level: 9 }).toString('base64');
    console.log(`Video-effect ${id}: ${Math.round(engines[id].length / 1024)} KiB compressed`);
  }
  await fs.mkdir(path.join(plugin, 'Generated'), { recursive: true });
  await fs.writeFile(path.join(plugin, 'Generated/engines.json'), JSON.stringify(engines));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
