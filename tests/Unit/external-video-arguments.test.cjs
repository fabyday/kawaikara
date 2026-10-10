const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function load(file, mocks = {}, platform = process.platform) {
    const source = buildSync({
        entryPoints: [path.resolve(__dirname, '../..', file)],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
        external: [
            'electron',
            './UserDataPaths',
            '../../../Common/BuildConfig',
        ],
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module,
        exports: module.exports,
        URL,
        console,
        process: { ...process, platform },
        require: (id) => (id in mocks ? mocks[id] : require(id)),
    });
    return module.exports;
}
const parser = load('src/Main/Functional/External/ExternalOpen.ts');

test('OS video arguments accept spaces, Unicode and encoded file URLs, not executable/options/deep-linked files', () => {
    const filename = path.resolve('videos', '한글 sample.MP4');
    for (const value of [filename, pathToFileURL(filename).href]) {
        assert.equal(
            parser.parseExternalVideoFile(value).localVideoPath,
            filename,
        );
        assert.equal(
            parser.parseExternalOpenArguments(['app.exe', value])[0]
                .localVideoPath,
            filename,
        );
    }
    for (const value of [
        'movie.mp4',
        '--file=movie.mp4',
        'https://example.com/movie.mp4',
        path.resolve('app.exe'),
        '\\\\?\\C:\\movie.mp4',
        '\\\\.\\C:\\movie.mp4',
        'file:%broken',
    ]) {
        assert.equal(parser.parseExternalVideoFile(value), undefined, value);
    }
    assert.equal(
        parser.parseExternalOpenArguments([filename]).length,
        0,
        'argv[0] is never a file request',
    );
    assert.equal(
        parser.parseExternalOpenUrl(
            `kawaikara://open?url=${encodeURIComponent(pathToFileURL(filename).href)}`,
        ),
        undefined,
    );
    assert.equal(
        parser.parseExternalOpenUrl(
            'kawaikara://open?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dx',
        ).targetUrl,
        'https://youtube.com/watch?v=x',
    );
});
