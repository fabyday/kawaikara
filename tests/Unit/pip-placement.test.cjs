const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');
const path = require('node:path');
const vm = require('node:vm');
const displays = [
    { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: 2, workArea: { x: -1600, y: -200, width: 1600, height: 900 } },
];
function load(file, extra = {}) {
    const source = buildSync({
        entryPoints: [path.resolve(__dirname, '../..', file)],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        external: ['electron'],
    }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module,
        exports: module.exports,
        process,
        console,
        setTimeout,
        clearTimeout,
        require: (id) =>
            id === 'electron'
                ? {
                      screen: {
                          getAllDisplays: () => displays,
                          getPrimaryDisplay: () => displays[0],
                          getDisplayMatching: (bounds) =>
                              bounds.x < 0 ? displays[1] : displays[0],
                          getDisplayNearestPoint: (point) =>
                              point.x < 0 ? displays[1] : displays[0],
                      },
                  }
                : require(id),
        ...extra,
    });
    return module.exports;
}
const common = load('src/Common/PictureInPicture.ts');
const runtime = load(
    'src/Main/Functional/Window/PictureInPicture/PictureInPictureRuntime.ts',
);
const internal = load('src/Main/Functional/Window/WindowOperations.ts');

test('five monitor policies distinguish exact position, last display, current and primary', () => {
    const viewer = { x: -1500, y: 0, width: 800, height: 600 };
    const lastPlacement = {
        displayId: '1',
        xRatio: 0.5,
        yRatio: 0.5,
        x: 400,
        y: 250,
    };
    for (const [mode, expected] of [
        ['current', 2],
        ['last-position', 1],
        ['last', 1],
        ['primary', 1],
        ['display', 1],
    ]) {
        const preference = {
            position: 'bottom-right',
            monitor: { mode, displayId: '1' },
            lastPlacement,
        };
        const display = runtime.resolvePictureInPictureDisplay(
            viewer,
            preference,
        );
        assert.equal(display.id, expected);
        const bounds = runtime.resolvePictureInPictureBounds(
            display.workArea,
            400,
            225,
            preference,
        );
        assert.equal(
            bounds.x,
            mode === 'last-position'
                ? 400
                : display.workArea.x + display.workArea.width - 420,
        );
        assert.deepEqual(
            JSON.parse(
                JSON.stringify(
                    internal.resolveInternalVideoPictureInPictureBounds(
                        viewer,
                        { width: 400, height: 225 },
                        preference,
                    ),
                ),
            ),
            JSON.parse(JSON.stringify(bounds)),
            'Local and web PiP share placement',
        );
    }
    const disconnected = {
        position: 'top-right',
        monitor: { mode: 'display', displayId: 'missing' },
    };
    assert.equal(
        runtime.resolvePictureInPictureDisplay(viewer, disconnected).id,
        2,
    );
    assert.equal(
        runtime.resolvePictureInPictureDisplay(viewer, {
            ...disconnected,
            monitor: { mode: 'last' },
            lastPlacement: { displayId: 'missing' },
        }).id,
        2,
    );
});

test('old preferences migrate and last coordinates are clamped to the work area', () => {
    const migrated = common.validatePictureInPicturePlacement({
        position: 'last',
        monitor: { mode: 'video' },
        align: 'true',
    });
    assert.equal(migrated.position, 'top-right');
    assert.equal(migrated.monitor.mode, 'last-position');
    assert.equal(migrated.align, false);
    assert.equal(
        common.validatePictureInPicturePlacement({ monitor: { mode: 'video' } })
            .monitor.mode,
        'current',
    );
    const bounds = runtime.resolvePictureInPictureBounds(
        displays[1].workArea,
        400,
        225,
        {
            position: 'top-right',
            monitor: { mode: 'last-position' },
            lastPlacement: { x: 10000, y: -10000, xRatio: 0, yRatio: 0 },
        },
    );
    assert.equal(bounds.x, -400);
    assert.equal(bounds.y, -200);
});

test('all four quadrants on a negative-origin monitor map to their own corner', () => {
    const { resolvePictureInPictureAlignment, alignmentDuration } = load(
        'src/Main/Functional/Window/PictureInPicture/PictureInPictureAlignment.ts',
    );
    const area = displays[1].workArea;
    for (const [x, y, expectedX, expectedY] of [
        [-1500, -150, -1580, -180],
        [-500, -150, -420, -180],
        [-1500, 350, -1580, 455],
        [-500, 350, -420, 455],
    ]) {
        const target = resolvePictureInPictureAlignment(
            { x, y, width: 400, height: 225 },
            area,
        );
        assert.equal(target.x, expectedX);
        assert.equal(target.y, expectedY);
    }
    assert.ok(alignmentDuration(800, area) < alignmentDuration(30, area));
});

function animationFixture() {
    let now = 0,
        nextId = 0,
        enabled = true;
    const timers = new Map(),
        positions = [];
    const motion = load(
        'src/Main/Functional/Window/PictureInPicture/PictureInPictureAlignment.ts',
        {
            Date: { now: () => now },
            setTimeout: (fn) => {
                timers.set(++nextId, fn);
                return nextId;
            },
            clearTimeout: (id) => timers.delete(id),
        },
    );
    const win = new EventEmitter();
    let bounds = { x: -1300, y: 0, width: 400, height: 225 };
    Object.assign(win, {
        isDestroyed: () => false,
        getBounds: () => ({ ...bounds }),
        getPosition: () => [bounds.x, bounds.y],
        getContentSize: () => [bounds.width, bounds.height],
        setPosition: (x, y) => {
            bounds = { ...bounds, x, y };
            positions.push([x, y]);
        },
    });
    return {
        motion,
        win,
        timers,
        positions,
        setEnabled: (value) => (enabled = value),
        enabled: () => enabled,
        step: () => {
            now += 16;
            const jobs = [...timers.values()];
            timers.clear();
            jobs.forEach((fn) => fn());
        },
    };
}

test('spring settles exactly, never overshoots, cancels immediately and does not poll while idle', () => {
    const f = animationFixture(),
        alignment = new f.motion.PictureInPictureAlignment(f.win, f.enabled);
    alignment.snap();
    for (let i = 0; i < 40; i++) f.step();
    assert.deepEqual(f.positions.at(-1), [-1580, -180]);
    assert.equal(f.timers.size, 0);
    assert.ok(
        f.positions.every(
            ([x, y]) => x >= -1580 && x <= -1300 && y >= -180 && y <= 0,
        ),
    );
    f.win.setPosition(-1300, 0);
    alignment.snap();
    f.step();
    alignment.cancel();
    const count = f.positions.length;
    f.step();
    assert.equal(f.positions.length, count);
    assert.equal(f.timers.size, 0);
    f.setEnabled(false);
    alignment.snap();
    assert.equal(f.timers.size, 0);
});

test('local PiP only snaps after a moved left-button release and removes all listeners', () => {
    const f = animationFixture(),
        contents = new EventEmitter();
    contents.isDestroyed = () => false;
    const dispose = f.motion.attachVideoPictureInPictureDrag(
        f.win,
        contents,
        f.enabled,
    );
    const emit = (type, x, y) =>
        contents.emit(
            'input-event',
            {},
            { type, button: 'left', x: 100, y: 60, globalX: x, globalY: y },
        );
    emit('mouseDown', 0, 0);
    emit('mouseMove', 50, 30);
    assert.equal(f.timers.size, 0);
    emit('mouseUp', 50, 30);
    assert.equal(f.timers.size, 1);
    dispose();
    assert.equal(f.timers.size, 0);
    assert.equal(contents.listenerCount('input-event'), 0);
    assert.equal(f.win.listenerCount('closed'), 0);
});
