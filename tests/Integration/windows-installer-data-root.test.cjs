const { getTestTempRoot } = require('../Helpers/Paths.cjs');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    existsSync,
} = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
    readWindowsDataRoot,
} = require('../../src/Main/Platform/Windows/DataLocation.ts');
const projectRoot = path.resolve(__dirname, '../..');
const fixtureRoot = mkdtempSync(
    path.join(getTestTempRoot(), 'kawaikara-installer-test-'),
);

function locator(rootText, name = 'profile') {
    const appData = path.join(fixtureRoot, name);
    const directory = path.join(appData, 'Kawaikara Installations');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
        path.join(directory, 'day.faby.kawaikara.nightly.ini'),
        Buffer.from(`\ufeff[storage]\r\nroot=${rootText}\r\n`, 'utf16le'),
    );
    return appData;
}
const read = (appData) =>
    readWindowsDataRoot(
        appData,
        'day.faby.kawaikara.nightly',
        'Kawaikara Nightly',
        'C:\\Apps\\Kawaikara Nightly\\Kawaikara Nightly.exe',
    );

test('installer locations preserve Unicode and isolate each channel', () => {
    const selected = 'D:\\사용자 자료\\Kawaikara Nightly';
    const appData = locator(selected);
    assert.equal(read(appData), selected);
    assert.equal(
        readWindowsDataRoot(
            appData,
            'day.faby.kawaikara',
            'Kawaikara',
            'C:\\Apps\\Kawaikara\\Kawaikara.exe',
        ),
        undefined,
    );
    assert.equal(read(fixtureRoot), undefined);
    // Reinstall/relaunch reads the same locator independently of install location.
    assert.equal(
        readWindowsDataRoot(
            appData,
            'day.faby.kawaikara.nightly',
            'Kawaikara Nightly',
            'C:\\Reinstalled\\app.exe',
        ),
        selected,
    );
});

test('unsafe/malformed locations never silently select an empty fallback profile', () => {
    for (const value of [
        'D:\\',
        'relative\\Kawaikara Nightly',
        '\\\\server\\share\\Kawaikara Nightly',
        '\\\\?\\D:\\data\\Kawaikara Nightly',
        'D:\\data\\Kawaikara',
        'C:\\Apps\\Kawaikara Nightly',
        'C:\\Apps\\Kawaikara Nightly\\data\\Kawaikara Nightly',
        'D:\\bad:stream\\Kawaikara Nightly',
        'D:\\data\\Kawaikara Nightly\r\nother=bad',
    ]) {
        assert.throws(() => read(locator(value)), /Unsafe|Invalid/);
    }
    const appData = locator('D:\\data\\Kawaikara Nightly');
    writeFileSync(
        path.join(
            appData,
            'Kawaikara Installations/day.faby.kawaikara.nightly.ini',
        ),
        'x'.repeat(9000),
    );
    assert.throws(() => read(appData), /too large/);
});

test('selecting AppData again clears the override rather than moving old data', () => {
    const appData = locator(
        'D:\\old-profile\\Kawaikara Nightly',
        'restore-default',
    );
    writeFileSync(
        path.join(
            appData,
            'Kawaikara Installations/day.faby.kawaikara.nightly.ini',
        ),
        Buffer.from(
            `\ufeff[storage]\r\nroot=${path.win32.join(appData, 'Kawaikara Nightly')}\r\n`,
            'utf16le',
        ),
    );
    assert.equal(read(appData), undefined);
});
