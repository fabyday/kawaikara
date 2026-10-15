const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const { chromium } = require('patchright');
function load(file) {
    const filename = path.resolve(__dirname, '../..', file);
    const mod = new Module(filename, module);
    mod.paths = module.paths;
    mod._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            platform: 'node',
            format: 'cjs',
            write: false,
        }).outputFiles[0].text,
        filename,
    );
    return mod.exports;
}
const shorts = load(
    'packages/builtin-sites/src/Providers/YouTube/Inject/Shorts.ts',
);
const controls = load('src/Main/Inject/PictureInPictureControls.ts');
const options = (autoAdvance = true) => ({
    autoAdvance,
    bannedPublishers: [],
    announce: false,
    labels: {
        enabled: 'On',
        disabled: 'Off',
        banned: 'Banned',
        next: 'Next',
        previous: 'Previous',
    },
});
let browser;
before(async () => {
    browser = await chromium.launch({ headless: true });
});
after(async () => {
    await browser?.close();
});
async function fixture(t) {
    const page = await browser.newPage({
        viewport: { width: 900, height: 600 },
    });
    t.after(() => page.close());
    await page.route('https://shorts.test/**', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: `
<style>body{margin:0}#shorts-container{height:100vh;overflow:auto}.slot{height:100vh}video{display:block;width:300px;height:100vh}button{position:fixed;right:0;top:0}</style>
<ytd-shorts><div id="shorts-container">${['a', 'b', 'c', 'd'].map((id) => `<div class="slot"><div><ytd-reel-video-renderer video-id="${id}"><video></video></ytd-reel-video-renderer></div></div>`).join('')}</div><div id="navigation-button-down"><button>Next</button></div></ytd-shorts>
<script>
window.moves=0; window.index=1;
window.select=(i)=>{ index=i; document.querySelectorAll('ytd-reel-video-renderer').forEach((r,n)=>r.toggleAttribute('is-active', n===i)); history.replaceState({},'', '/shorts/'+['a','b','c','d'][i]); document.querySelector('#shorts-container').scrollTop=document.querySelectorAll('.slot')[i].offsetTop; };
window.media = new Map(); document.querySelectorAll('video').forEach(v=>{ const m={time:5,ended:false,paused:false};media.set(v,m);Object.defineProperties(v,{readyState:{get:()=>4},videoWidth:{get:()=>300},videoHeight:{get:()=>600},duration:{get:()=>10},currentTime:{get:()=>m.time},ended:{get:()=>m.ended},paused:{get:()=>m.paused}}); });
window.current=()=>document.querySelector('ytd-reel-video-renderer[is-active] video');
window.start=()=>document.dispatchEvent(new CustomEvent('kawaikara:picture-in-picture-transition',{detail:{phase:'start'}}));
window.tick=(time)=>{media.get(current()).time=time;current().dispatchEvent(new Event('timeupdate'));};
window.end=()=>{media.get(current()).ended=true;current().dispatchEvent(new Event('ended'));};
document.querySelector('button').onclick=()=>{ moves++; select(Math.min(3,index+1)); };
select(1);
</script>`,
        }),
    );
    await page.goto('https://shorts.test/shorts/b');
    await page.evaluate(await page.locator('script').textContent());
    await page.evaluate(shorts.createYouTubeShortsInjectionScript(options()));
    return page;
}
async function finish(page) {
    await page.evaluate(
        controls.createFinishPictureInPictureTransitionScript(),
    );
    await page.waitForTimeout(190);
}
async function snapshot(page) {
    return page.evaluate(() => ({
        url: location.pathname,
        moves,
        top: document.querySelector('#shorts-container').scrollTop,
        expected: document.querySelectorAll('.slot')[index].offsetTop,
    }));
}
test('entry/exit resize keeps the current Shorts slot instead of its obsolete pixel offset', async (t) => {
    const p = await fixture(t);
    for (const height of [270, 600]) {
        await p.evaluate(() => start());
        await p.setViewportSize({ width: 400, height });
        await p.evaluate(() => {
            document.querySelector('#shorts-container').scrollTop = 0;
        });
        await finish(p);
        const s = await snapshot(p);
        assert.equal(s.top, s.expected);
        assert.equal(s.url, '/shorts/b');
        assert.equal(s.moves, 0);
    }
});
test('ended while the video is invisible during transfer advances exactly once after settling', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        current().style.visibility = 'hidden';
        current().style.height = '0px';
        end();
        end();
    });
    assert.equal((await snapshot(p)).moves, 0);
    await finish(p);
    assert.equal((await snapshot(p)).moves, 1);
    await p.waitForTimeout(700);
    assert.equal((await snapshot(p)).moves, 1);
});
test('loop completion survives transition, but merely being near the end does not advance', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        tick(9.8);
        start();
    });
    await finish(p);
    assert.equal((await snapshot(p)).moves, 0);
    await p.evaluate(() => {
        start();
        tick(0.1);
    });
    await finish(p);
    assert.equal((await snapshot(p)).moves, 1);
});
test('turning auto-advance off while completion is pending preserves the current Short', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        end();
    });
    await p.evaluate(shorts.createYouTubeShortsInjectionScript(options(false)));
    await finish(p);
    assert.equal((await snapshot(p)).moves, 0);
});
test('manual next during transition wins and does not also consume pending completion', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        end();
    });
    await p.evaluate(shorts.createYouTubeShortsCommandScript('next'));
    await finish(p);
    await p.waitForTimeout(700);
    const s = await snapshot(p);
    assert.equal(s.moves, 1);
    assert.equal(s.url, '/shorts/c');
    assert.equal(s.top, s.expected);
});
test('trusted browser navigation cancels the old anchor and pending completion', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        end();
    });
    await p.locator('button').click();
    await finish(p);
    assert.equal((await snapshot(p)).url, '/shorts/c');
    assert.equal((await snapshot(p)).moves, 1);
});
test('Plugin cleanup cancels timers/listeners/queued completion and allows a single fresh installation', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        end();
    });
    await p.evaluate(shorts.createYouTubeShortsCleanupScript());
    await finish(p);
    await p.evaluate(() => {
        end();
        start();
        document.querySelector('#shorts-container').scrollTop = 0;
    });
    await p.waitForTimeout(750);
    assert.equal(
        await p.evaluate(() => !!globalThis.__kawaikaraYouTubeShorts),
        false,
    );
    assert.equal((await snapshot(p)).top, 0);
    assert.equal((await snapshot(p)).moves, 0);
    await p.evaluate(() => {
        select(1);
        media.get(current()).ended = false;
    });
    await p.evaluate(shorts.createYouTubeShortsInjectionScript(options()));
    await p.evaluate(() => end());
    assert.equal((await snapshot(p)).moves, 1);
});
test('a recycled renderer/video source is not restored as the old Short', async (t) => {
    const p = await fixture(t);
    await p.evaluate(() => {
        start();
        current().parentElement.setAttribute('video-id', 'recycled');
        document.querySelector('#shorts-container').scrollTop = 0;
    });
    await finish(p);
    assert.equal((await snapshot(p)).top, 0);
    assert.equal((await snapshot(p)).moves, 0);
});

test('disabling the Plugin during navigation cancels delayed scroll correction', async (t) => {
    const p = await fixture(t);
    await p.evaluate(shorts.createYouTubeShortsCommandScript('next'));
    await p.evaluate(shorts.createYouTubeShortsCleanupScript());
    await p.evaluate(() => {
        document.querySelector('#shorts-container').scrollTop = 0;
    });
    await p.waitForTimeout(800);
    assert.equal((await snapshot(p)).top, 0);
    assert.equal((await snapshot(p)).moves, 1);
});
test('a new PiP transition invalidates corrections left by the preceding navigation', async (t) => {
    const p = await fixture(t);
    await p.evaluate(shorts.createYouTubeShortsCommandScript('next'));
    await p.evaluate(() => start());
    await finish(p);
    // Simulate a stale active marker while the router settles. Old callbacks
    // must not realign to it after the new transition has already finished.
    await p.evaluate(() => {
        document
            .querySelectorAll('ytd-reel-video-renderer')
            .forEach((r, n) => r.toggleAttribute('is-active', n === 0));
    });
    await p.waitForTimeout(700);
    const s = await snapshot(p);
    assert.equal(s.top, s.expected);
    assert.equal(s.url, '/shorts/c');
    assert.equal(s.moves, 1);
});

test('real PiP page transforms preserve the Short and restore temporary scroll styles on exit', async t => {
    const p = await fixture(t);
    const pip = load('src/Main/Inject/UnifiedPictureInPicturePage.ts');
    await p.evaluate(() => { document.querySelector('#shorts-container').style.scrollSnapType='y mandatory'; });
    const result = await p.evaluate(pip.createEnterUnifiedPictureInPictureScript({
        labels: { play: 'Play', pause: 'Pause', returnToApp: 'Return' },
        contentOverlaySelectors: [], playbackButtonSize: 44,
        playbackMessage: 'play', restoreMessage: 'restore', videoSizeMessage: 'size',
    }));
    assert.equal(result.status, 'entered');
    await p.setViewportSize({ width: 300, height: 360 });
    await finish(p);
    assert.equal((await snapshot(p)).url, '/shorts/b');
    await p.evaluate(controls.createExitUnifiedPictureInPictureScript());
    await p.setViewportSize({ width: 900, height: 600 });
    await finish(p);
    const s = await snapshot(p);
    assert.equal(s.top, s.expected); assert.equal(s.moves, 0);
    assert.equal(await p.evaluate(() => document.querySelector('#shorts-container').style.scrollSnapType), 'y mandatory');
});
