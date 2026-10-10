const { app, BrowserWindow, screen } = require('electron');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const file = path.resolve(
    __dirname,
    '../../src/Main/Functional/Window/PictureInPicture/PictureInPictureAlignment.ts',
);
const loaded = new Module(file, module);
loaded.paths = module.paths;
loaded._compile(
    buildSync({
        entryPoints: [file],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        external: ['electron'],
        write: false,
    }).outputFiles[0].text,
    file,
);
const { PictureInPictureAlignment, resolvePictureInPictureAlignment } =
    loaded.exports;
const watchdog = setTimeout(() => {
    console.error('PiP native alignment timed out');
    app.exit(1);
}, 60000);
app.whenReady()
    .then(async () => {
        const win = new BrowserWindow({
            show: false,
            frame: false,
            width: 320,
            height: 180,
            webPreferences: { offscreen: true },
        });
        const alignment = new PictureInPictureAlignment(win, () => true);
        let checked = 0;
        for (const display of screen.getAllDisplays()) {
            const area = display.workArea;
            for (const [x, y] of [
                [0.2, 0.2],
                [0.8, 0.2],
                [0.2, 0.8],
                [0.8, 0.8],
            ]) {
                win.setBounds(
                    {
                        x: Math.round(area.x + (area.width - 320) * x),
                        y: Math.round(area.y + (area.height - 180) * y),
                        width: 320,
                        height: 180,
                    },
                    false,
                );
                const before = win.getBounds(),
                    target = resolvePictureInPictureAlignment(before, area);
                alignment.snap();
                await new Promise((r) => setTimeout(r, 520));
                const actual = win.getBounds();
                assert.ok(
                    Math.abs(actual.x - target.x) <= 1 &&
                        Math.abs(actual.y - target.y) <= 1,
                    JSON.stringify({ display: display.id, target, actual }),
                );
                assert.equal(actual.width, before.width);
                assert.equal(actual.height, before.height);
                checked++;
            }
        }
        alignment.cancel();
        win.destroy();
        clearTimeout(watchdog);
        console.log(
            'Native PiP alignment passed for ' +
                checked +
                ' quadrants on ' +
                screen.getAllDisplays().length +
                ' connected display(s).',
        );
        app.exit(0);
    })
    .catch((error) => {
        console.error(error);
        clearTimeout(watchdog);
        app.exit(1);
    });
