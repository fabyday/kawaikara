#!/usr/bin/env node
// Serves only a chosen test artifact, optional icon, and generated data-only manifest.
const { createServer } = require('node:http');
const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { parseArgs } = require('node:util');

async function createFixture(options) {
    const artifact = path.resolve(options.artifact);
    const formats = ['tar.gz', 'appimage', 'dmg', 'pkg', 'zip', 'exe', 'msi', 'deb', 'rpm'];
    const format = formats.find(value => artifact.toLowerCase().endsWith('.' + value));
    const os = options.os ?? process.platform, arch = options.arch ?? process.arch;
    if (!format || !['darwin', 'win32', 'linux'].includes(os) || !['arm64', 'x64', 'ia32', 'arm', 'universal'].includes(arch))
        throw new Error('Choose a supported artifact, --os and --arch.');
    const id = options.id ?? 'day.faby.kawai-downloader';
    if (!/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/.test(id)) throw new Error('Invalid app ID.');
    if (!(await stat(artifact)).isFile()) throw new Error('Artifact must be a file.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(artifact)) hash.update(chunk);
    const files = new Map([[`/artifact.${format}`, artifact]]);
    if (options.icon) {
        const icon = path.resolve(options.icon);
        if (!(await stat(icon)).isFile()) throw new Error('Icon must be a file.');
        files.set('/icon.png', icon);
    }
    const manifest = {
        schemaVersion: 1, id, name: options.name ?? 'kawai-downloader',
        ...(options.icon ? { icon: './icon.png' } : {}),
        targets: [{ os, arch, version: options.version ?? 'local-test',
            artifact: { url: `./artifact.${format}`, format, sha256: hash.digest('hex') } }],
    };
    const server = createServer((request, response) => {
        if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
        if (request.url === '/kawaikara.manifest.json') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(manifest)); return;
        }
        const file = files.get(request.url);
        if (!file) { response.writeHead(404); response.end(); return; }
        response.setHeader('Content-Type', request.url === '/icon.png' ? 'image/png' : 'application/octet-stream');
        const stream = createReadStream(file);
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response);
    });
    return { server, manifest };
}
module.exports = { createFixture };
if (require.main === module) {
    const { values } = parseArgs({ options: { ...Object.fromEntries(
        ['artifact', 'icon', 'id', 'name', 'os', 'arch', 'version', 'port'].map(key => [key, { type: 'string' }])), help: { type: 'boolean', short: 'h' } } });
    (async () => {
        const usage = 'Usage: pnpm external-app:serve --artifact /path/app.dmg [--icon /path/icon.png] [--os darwin|win32|linux] [--arch arm64|x64] [--port 8765]';
        if (values.help) { console.log(usage); return; }
        if (!values.artifact) throw new Error(usage);
        const port = Number(values.port ?? 8765);
        if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port between 1024 and 65535.');
        const { server, manifest } = await createFixture(values);
        server.on('error', error => { console.error(error.message); process.exitCode = 1; });
        server.listen(port, '127.0.0.1', () => {
            console.log('Local fixture ready. In a separate terminal:');
            console.log(`KAWAIKARA_EXTERNAL_APP_TEST_MANIFEST='${manifest.id}=http://127.0.0.1:${port}/kawaikara.manifest.json' KAWAIKARA_EXTERNAL_APP_MODE=installed pnpm start`);
            console.log('For a packaged Kawaikara, use the same environment variables and launch its executable directly.');
            console.log('Only the manifest, selected artifact and optional icon are served. Ctrl+C stops the fixture.');
        });
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
