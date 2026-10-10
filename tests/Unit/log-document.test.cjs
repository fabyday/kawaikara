const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const compiled = buildSync({
    entryPoints: [
        path.join(root, 'src/Renderer/View/LogViewer/LogDocumentUpdate.ts'),
    ],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
});
const implementation = new Module(__filename);
implementation._compile(compiled.outputFiles[0].text, __filename);
const { mergeLogDocument } = implementation.exports;
const row = {
    id: '1',
    timestamp: '12:00:00',
    level: 'info',
    source: 'application',
    location: 'Application',
    message: 'hello',
};
const doc = {
    file: {
        fileName: '2026-10-10-0.log',
        repository: 'application',
        active: true,
        size: 10,
        modifiedAt: 1,
    },
    entries: [row],
    truncated: false,
};

test('idle polling keeps the entire document and row identities', () => {
    assert.equal(mergeLogDocument(doc, structuredClone(doc)), doc);
});
test('append and multiline completion only replace changed rows', () => {
    const appended = mergeLogDocument(doc, {
        ...doc,
        entries: [structuredClone(row), { ...row, id: '2', message: 'next' }],
    });
    assert.equal(appended.entries[0], row);
    assert.equal(appended.entries.length, 2);
    const completed = mergeLogDocument(appended, {
        ...appended,
        entries: [row, { ...appended.entries[1], message: 'next\ncontinued' }],
    });
    assert.notEqual(completed.entries[1], appended.entries[1]);
    assert.equal(completed.entries[0], row);
});
test('metadata updates and repository changes are not hidden by row reuse', () => {
    const modified = { ...doc, file: { ...doc.file, size: 15 } };
    assert.equal(mergeLogDocument(doc, modified).file.size, 15);
    assert.equal(mergeLogDocument(doc, modified).entries, doc.entries);
    const external = {
        ...doc,
        file: { ...doc.file, repository: 'external', groupId: 'imported' },
        entries: [structuredClone(row)],
    };
    assert.equal(mergeLogDocument(doc, external), external);
});
