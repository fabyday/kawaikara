const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
function load(relative, mocks = {}) {
    const filename = path.resolve(__dirname, '../../src/Main', relative);
    const loaded = new Module(filename, module);
    loaded.paths = module.paths;
    loaded.require = (id) =>
        Object.hasOwn(mocks, id)
            ? mocks[id]
            : Module.prototype.require.call(loaded, id);
    loaded._compile(
        buildSync({
            entryPoints: [filename],
            bundle: true,
            platform: 'node',
            format: 'cjs',
            write: false,
            external: Object.keys(mocks),
        }).outputFiles[0].text,
        filename,
    );
    return loaded.exports;
}
const { clamp, lerp } = load('Math/Scalar.ts');
const geometry = load(
    'Functional/Window/PictureInPicture/PictureInPictureGeometry.ts',
);
const { createPictureInPictureInputListener } = load(
    'Functional/Window/PictureInPicture/PictureInPictureInput.ts',
    { electron: {} },
);
const { bindPictureInPictureWindowEvents } = load(
    'Functional/Window/PictureInPicture/PictureInPictureEvents.ts',
);

test('scalar helpers retain fractions, non-finite semantics and explicit extrapolation', () => {
    assert.equal(clamp(0.375, 0, 1), 0.375);
    assert.equal(clamp(-Infinity, 0, 1), 0);
    assert.equal(clamp(Infinity, 0, 1), 1);
    assert.ok(Number.isNaN(clamp(NaN, 0, 1)));
    assert.equal(clamp(4, 3, 3), 3);
    assert.equal(lerp(-20, 40, 0.25), -5);
    assert.equal(lerp(-20, 40, 1.5), 70);
});

test('PiP geometry preserves negative-monitor anchors and oversized-window fallback', () => {
    const area = { x: -1920, y: 24, width: 1920, height: 1056 };
    assert.deepEqual(
        geometry.resolveAnchoredResizeBounds(
            { x: -420, y: 780, width: 400, height: 280 },
            area,
            600,
            400,
        ),
        { x: -620, y: 660, width: 600, height: 400 },
    );
    assert.deepEqual(
        geometry.resolveAnchoredResizeBounds(
            { x: -420, y: 780, width: 400, height: 280 },
            area,
            2200,
            1200,
        ),
        { x: -1920, y: 24, width: 2200, height: 1200 },
    );
    assert.deepEqual(
        geometry.interpolateBounds(
            { x: -10, y: 0, width: 400, height: 200 },
            { x: 1, y: 11, width: 501, height: 301 },
            0.5,
        ),
        { x: -4, y: 6, width: 451, height: 251 },
    );
});

test('PiP keyboard adapter restores only on an unmodified, non-repeated Escape', () => {
    let restored = 0,
        prevented = 0;
    const input = createPictureInPictureInputListener(() => restored++);
    const event = { preventDefault: () => prevented++ };
    for (const extra of [
        { isAutoRepeat: true },
        { isComposing: true },
        { control: true },
        { meta: true },
        { alt: true },
        { shift: true },
    ])
        input(event, { type: 'keyDown', key: 'Escape', ...extra });
    input(event, { type: 'keyUp', key: 'Escape' });
    assert.equal(restored, 0);
    input(event, { type: 'keyDown', key: 'Escape' });
    input(event, { type: 'keyDown', key: 'Tab' });
    assert.equal(restored, 1);
    assert.equal(prevented, 2);
});

test('PiP native connections block remote close and dispose without removing unrelated listeners', () => {
    const pipWindow = new EventEmitter();
    pipWindow.webContents = new EventEmitter();
    let active = true,
        prevented = 0,
        closed = 0,
        resized = 0;
    const unrelated = () => {};
    pipWindow.on('resize', unrelated);
    const dispose = bindPictureInPictureWindowEvents(
        { pipWindow, inputListener() {} },
        {
            isCurrent: () => active,
            resizeStarted() {},
            resized: () => resized++,
            blurred() {},
            closeBlocked() {},
            closed: () => closed++,
        },
    );
    pipWindow.emit('close', { preventDefault: () => prevented++ });
    active = false;
    pipWindow.emit('close', { preventDefault: () => prevented++ });
    pipWindow.emit('closed');
    assert.equal(prevented, 1);
    assert.equal(closed, 0);
    dispose();
    dispose();
    pipWindow.emit('resize');
    assert.equal(resized, 0);
    assert.deepEqual(pipWindow.listeners('resize'), [unrelated]);
    assert.equal(pipWindow.webContents.listenerCount('before-input-event'), 0);
});
