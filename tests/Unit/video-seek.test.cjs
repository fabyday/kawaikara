const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const { buildSync } = require('esbuild');
const filename = path.resolve(
    __dirname,
    '../../src/Renderer/View/Video/Playback/MpvSeekQueue.ts',
);
const loaded = new Module(filename, module);
loaded._compile(
    buildSync({
        entryPoints: [filename],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
    }).outputFiles[0].text,
    filename,
);
const { MpvSeekQueue, seekMpvAndWait } = loaded.exports;
module.exports = { MpvSeekQueue, seekMpvAndWait };
const tick = () => new Promise((resolve) => setImmediate(resolve));
class Player extends EventTarget {
    calls = [];
    observers = 0;
    addEventListener(...args) {
        this.observers++;
        super.addEventListener(...args);
    }
    removeEventListener(...args) {
        this.observers--;
        super.removeEventListener(...args);
    }
    async pause() {
        this.calls.push('pause');
    }
    async play() {
        this.calls.push('play');
    }
    async seek(seconds) {
        this.calls.push(seconds);
    }
    event(type) {
        this.dispatchEvent(new CustomEvent('mpv-event', { detail: { type } }));
    }
    complete() {
        this.event('seek');
        this.event('playback-restart');
    }
}
test('IPC acknowledgement does not release the next seek; latest target wins', async () => {
    const player = new Player(),
        errors = [];
    const queue = new MpvSeekQueue(
        () => player,
        () => true,
        () => true,
        (error) => errors.push(error),
    );
    queue.request(10, true);
    await tick();
    queue.request(20, true);
    queue.request(30, true);
    queue.request(40, false);
    await tick();
    assert.deepEqual(player.calls, ['pause', 10]);
    player.event('playback-restart');
    await tick();
    assert.deepEqual(
        player.calls,
        ['pause', 10],
        'Ignore a restart unrelated to this seek',
    );
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10, 40]);
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10, 40, 'play']);
    assert.equal(player.observers, 0);
    assert.deepEqual(errors, []);
});
test('pointer-up at the preview target does not seek the same fragment twice', async () => {
    const player = new Player();
    const queue = new MpvSeekQueue(
        () => player,
        () => true,
        () => true,
        assert.fail,
    );
    queue.request(12, true);
    await tick();
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 12]);
    queue.request(12, false);
    await tick();
    assert.deepEqual(player.calls, ['pause', 12, 'play']);
});
test('a paused video stays paused and navigation never resumes hidden playback', async () => {
    for (const [playing, visible] of [
        [false, true],
        [true, false],
    ]) {
        const player = new Player();
        const queue = new MpvSeekQueue(
            () => player,
            () => playing,
            () => visible,
            assert.fail,
        );
        queue.request(12, false);
        await tick();
        player.complete();
        await tick();
        assert.deepEqual(player.calls, ['pause', 12]);
    }
});
test('cancel removes observers, discards queued requests and cannot resume the outgoing source', async () => {
    const player = new Player(),
        errors = [];
    const queue = new MpvSeekQueue(
        () => player,
        () => true,
        () => true,
        (error) => errors.push(error),
    );
    queue.request(10, true);
    await tick();
    queue.request(20, false);
    queue.cancel();
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10]);
    assert.equal(player.observers, 0);
    assert.deepEqual(errors, []);
    queue.request(30, false);
    await tick();
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10, 'pause', 30, 'play']);
});
test('canceling a gesture resumes only after its already issued preview completes', async () => {
    const player = new Player();
    const queue = new MpvSeekQueue(
        () => player,
        () => true,
        () => true,
        assert.fail,
    );
    queue.request(10, true);
    await tick();
    queue.finish();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10]);
    player.complete();
    await tick();
    assert.deepEqual(player.calls, ['pause', 10, 'play']);
});
test('a timeout or rejected native command releases all observers', async () => {
    const player = new Player();
    await assert.rejects(
        seekMpvAndWait(player, 2, new AbortController().signal, 10),
        /timed out/,
    );
    assert.equal(player.observers, 0);
    player.seek = async () => {
        throw new Error('native failure');
    };
    await assert.rejects(
        seekMpvAndWait(player, 2, new AbortController().signal),
        /native failure/,
    );
    assert.equal(player.observers, 0);
});
