const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function load() {
    const filename = path.resolve(
        __dirname,
        '../../src/Main/Functional/Bundle/Provider/BrowserIdentityExemption.ts',
    );
    const code = buildSync({
        entryPoints: [filename],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module,
        exports: module.exports,
        require,
        URL,
    });
    return module.exports;
}

const exemption = load();

const chzzkExemptHosts = require('../../packages/builtin-sites/src/Providers/Chzzk/manifest.json')
    .descriptors.browserIdentity.exemptHosts;

test('CHZZK declares the Naver login host as identity-exempt', () => {
    assert.deepEqual(chzzkExemptHosts, ['nid.naver.com']);
});

test('Naver login pages suspend the CHZZK browser identity', () => {
    for (const url of [
        'https://nid.naver.com/nidlogin.login?mode=form',
        'https://nid.naver.com/nidlogin.rcaptcha',
        'https://NID.naver.com/',
    ]) {
        assert.equal(
            exemption.isBrowserIdentityExemptUrl(url, chzzkExemptHosts),
            true,
            url,
        );
    }
});

test('Provider pages keep their browser identity', () => {
    for (const url of [
        'https://chzzk.naver.com/live/abc',
        'https://m.naver.com/shorts/',
        'https://www.naver.com/',
        'https://nid.naver.com.example.com/',
        'https://example.com/?next=https://nid.naver.com/',
        'about:blank',
        '',
    ]) {
        assert.equal(
            exemption.isBrowserIdentityExemptUrl(url, chzzkExemptHosts),
            false,
            url,
        );
    }
});

test('Providers without exempt hosts never suspend their identity', () => {
    const url = 'https://nid.naver.com/nidlogin.login';
    assert.equal(exemption.isBrowserIdentityExemptUrl(url, undefined), false);
    assert.equal(exemption.isBrowserIdentityExemptUrl(url, []), false);
});

test('authentication UA reports the real platform and Chromium major', () => {
    assert.equal(
        exemption.createPlatformChromeUserAgent('144.0.7559.236', 'linux'),
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    );
    assert.match(
        exemption.createPlatformChromeUserAgent('144.0.1', 'win32'),
        /\(Windows NT 10\.0; Win64; x64\).* Chrome\/144\.0\.0\.0 /,
    );
    assert.match(
        exemption.createPlatformChromeUserAgent('144.0.1', 'darwin'),
        /\(Macintosh; Intel Mac OS X 10_15_7\).* Chrome\/144\.0\.0\.0 /,
    );
    assert.doesNotMatch(
        exemption.createPlatformChromeUserAgent('144.0.1', 'linux'),
        /Electron|kawaikara/i,
    );
});
