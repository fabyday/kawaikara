const { mkdirSync, mkdtempSync } = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../..');
const testTempRoot = path.join(projectRoot, 'tests', 'tmp');

/** Use one project-local scratch root, also when tests are launched directly. */
function getTestTempRoot() {
    mkdirSync(testTempRoot, { recursive: true });
    return testTempRoot;
}

/** Allocate a unique child so parallel tests never share fixtures. */
function createTestTempDirectory(prefix) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(prefix)) {
        throw new Error('Test directory prefixes must be simple names.');
    }
    return mkdtempSync(path.join(getTestTempRoot(), prefix));
}

module.exports = { projectRoot, getTestTempRoot, createTestTempDirectory };
