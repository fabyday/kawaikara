#!/usr/bin/env node

const http = require('node:http');
const { createReadStream, readdirSync, realpathSync, statSync } = require('node:fs');
const path = require('node:path');

const CONTENT_TYPES = {
  '.yml': 'application/yaml; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.exe': 'application/octet-stream',
  '.zip': 'application/zip',
  '.dmg': 'application/x-apple-diskimage',
  '.blockmap': 'application/octet-stream',
};

function parseOptions(args) {
  let root;
  let port = 18080;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--root') root = args[++index];
    else if (option === '--port') port = Number(args[++index]);
    else throw new Error(`Unknown option: ${option}`);
  }
  if (!root) throw new Error('Pass --root <electron-builder artifact directory>.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('--port must be an integer from 0 to 65535.');
  }
  return { root, port };
}

function createLocalUpdateServer(root) {
  const resolvedRoot = realpathSync(root);
  if (!statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Not an artifact directory: ${root}`);
  }

  return http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }

    let name;
    try {
      name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname.slice(1));
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    // electron-builder uses flat filenames. Never expose nested files,
    // symlinks outside the selected folder, or private build inputs.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) {
      response.writeHead(404);
      response.end();
      return;
    }

    let file;
    let size;
    try {
      file = realpathSync(path.join(resolvedRoot, name));
      if (path.dirname(file) !== resolvedRoot) throw new Error('Outside artifact directory.');
      const entry = statSync(file);
      if (!entry.isFile()) throw new Error('Not a file.');
      size = entry.size;
    } catch {
      response.writeHead(404);
      response.end();
      return;
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': CONTENT_TYPES[path.extname(name)] || 'application/octet-stream',
    };
    const range = request.headers.range;
    let start = 0;
    let end = size - 1;
    if (range !== undefined) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
        response.end();
        return;
      }
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      } else {
        const suffix = Number(match[2]);
        start = Math.max(0, size - suffix);
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start > end || start >= size) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
        response.end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = size === 0 ? 0 : end - start + 1;
    response.writeHead(range === undefined ? 200 : 206, headers);
    if (request.method === 'HEAD' || size === 0) {
      response.end();
      return;
    }
    createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response);
  });
}

if (require.main === module) {
  try {
    const { root, port } = parseOptions(process.argv.slice(2));
    if (!readdirSync(root).some((name) => /^(latest|staging|nightly)(?:-mac)?\.yml$/.test(name))) {
      throw new Error('No electron-builder update metadata found in --root.');
    }
    const server = createLocalUpdateServer(root);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      console.log(`Local electron-updater feed: http://127.0.0.1:${address.port}/`);
      console.log(`Artifacts: ${realpathSync(root)}`);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { createLocalUpdateServer, parseOptions };
