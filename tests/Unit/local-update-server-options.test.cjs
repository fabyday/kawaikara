const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseOptions } = require('../../scripts/local-update-server.cjs');
test('requires an explicit artifact folder and valid port', () => {
    assert.deepEqual(parseOptions(['--root', 'builds/nightly/win']), {
        root: 'builds/nightly/win',
        port: 18080,
    });
    assert.throws(() => parseOptions([]), /--root/);
    assert.throws(
        () => parseOptions(['--root', '.', '--port', '65536']),
        /--port/,
    );
});
