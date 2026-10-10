const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { readFileSync } = require('node:fs');
test('Explorer registrations are channel-owned candidates, never user defaults', () => {
    const script = readFileSync(
        path.resolve(__dirname, '../../packaging/nsis/video-associations.nsh'),
        'utf8',
    );
    assert.match(script, /OpenWithProgids/);
    assert.match(script, /SystemFileAssociations/);
    assert.doesNotMatch(script, /UserChoice|SetUserFTA/);
    assert.match(script, /ReadRegStr \$0 SHCTX .*\$\{APP_ID\}\.Video/);
    assert.match(script, /\$\{If\} \$0 ==/);
    assert.doesNotMatch(
        script,
        /WriteRegStr SHCTX "Software\\Classes\\\.\$\{EXT\}"/,
    );
    assert.doesNotMatch(script, /kawaiVideoExtension "ts"/);
});
