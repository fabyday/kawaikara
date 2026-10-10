import {
    screen,
    type BrowserWindow,
    type Rectangle,
    type WebContents,
} from 'electron';
import {
    isPointInside,
    resolveGlobalMousePoint,
    resolvePictureInPictureBounds,
} from './PictureInPictureRuntime';

/** Selects the corner using the PiP center, not the nearest edge or primary monitor. */
export function resolvePictureInPictureAlignment(
    bounds: Rectangle,
    workArea: Rectangle,
): Rectangle {
    const left = bounds.x + bounds.width / 2 < workArea.x + workArea.width / 2;
    const top = bounds.y + bounds.height / 2 < workArea.y + workArea.height / 2;
    return resolvePictureInPictureBounds(
        workArea,
        bounds.width,
        bounds.height,
        {
            /** Alignment is always local to this monitor. */
            monitor: {
                /** Use the current work area, never the initial PiP display preference. */
                mode: 'current',
            },
            /** Quadrant maps directly to a corner. */
            position: top
                ? left
                    ? 'top-left'
                    : 'top-right'
                : left
                  ? 'bottom-left'
                  : 'bottom-right',
        },
    );
}

/** Long trips settle sooner; nearby corrections settle more gently. */
export function alignmentDuration(
    distance: number,
    workArea: Rectangle,
): number {
    return (
        420 -
        200 *
            Math.min(
                1,
                distance /
                    Math.max(
                        1,
                        Math.hypot(workArea.width, workArea.height) / 3,
                    ),
            )
    );
}

/** Shared cancellable, critically damped motion for web and local-video PiP. */
export class PictureInPictureAlignment {
    /** Only one scheduled frame can own the window at a time. */
    private timer?: ReturnType<typeof setTimeout>;

    /** Creates a window-scoped controller without any permanent polling. */
    constructor(
        /** Window being aligned. */
        private readonly window: BrowserWindow,
        /** Reads the latest saved toggle for each frame. */
        private readonly enabled: () => boolean,
    ) {}

    /** Interrupts immediately on drag, resize, preference change, or teardown. */
    cancel(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = undefined;
    }

    /** Aligns within the monitor containing the center of the released window. */
    snap(): void {
        this.cancel();
        if (!this.enabled() || this.window.isDestroyed()) return;
        const initial = this.window.getBounds();
        const { workArea } = screen.getDisplayNearestPoint({
            x: Math.round(initial.x + initial.width / 2),
            y: Math.round(initial.y + initial.height / 2),
        });
        const target = resolvePictureInPictureAlignment(initial, workArea);
        const distance = Math.hypot(target.x - initial.x, target.y - initial.y);
        if (distance < 1) return;
        const duration = alignmentDuration(distance, workArea);
        const started = Date.now();
        /** A normalized critically damped spring cannot overshoot outside the work area. */
        const advance = () => {
            this.timer = undefined;
            if (!this.enabled() || this.window.isDestroyed()) return;
            const progress = Math.min(1, (Date.now() - started) / duration);
            const eased =
                (1 - (1 + 7 * progress) * Math.exp(-7 * progress)) /
                (1 - 8 * Math.exp(-7));
            this.window.setPosition(
                Math.round(initial.x + (target.x - initial.x) * eased),
                Math.round(initial.y + (target.y - initial.y) * eased),
                false,
            );
            if (progress < 1) this.timer = setTimeout(advance, 16);
        };
        this.timer = setTimeout(advance, 16);
    }
}

/** Local PiP uses explicit pointer release, avoiding macOS's continuous native moved event. */
export function attachVideoPictureInPictureDrag(
    window: BrowserWindow,
    contents: WebContents,
    enabled: () => boolean,
): () => void {
    const alignment = new PictureInPictureAlignment(window, enabled);
    let drag:
        | { cursorX: number; cursorY: number; windowX: number; windowY: number }
        | undefined;
    let moved = false;
    /** Handles video-surface dragging while leaving the two actual buttons to React. */
    const input = (_event: Electron.Event, event: Electron.InputEvent) => {
        if (window.isDestroyed()) return;
        const mouse = event as Electron.MouseInputEvent;
        if (event.type === 'mouseDown') {
            if (mouse.button && mouse.button !== 'left') return;
            const [width, height] = window.getContentSize();
            if (
                isPointInside(mouse, { x: 12, y: 12, width: 40, height: 40 }) ||
                isPointInside(mouse, {
                    x: (width - 54) / 2,
                    y: (height - 54) / 2,
                    width: 54,
                    height: 54,
                })
            )
                return;
            alignment.cancel();
            const cursor = resolveGlobalMousePoint(mouse);
            const [windowX, windowY] = window.getPosition();
            drag = { cursorX: cursor.x, cursorY: cursor.y, windowX, windowY };
            moved = false;
        } else if (event.type === 'mouseMove' && drag) {
            const cursor = resolveGlobalMousePoint(mouse);
            const dx = cursor.x - drag.cursorX,
                dy = cursor.y - drag.cursorY;
            moved ||= Math.hypot(dx, dy) >= 3;
            if (moved)
                window.setPosition(
                    Math.round(drag.windowX + dx),
                    Math.round(drag.windowY + dy),
                    false,
                );
        } else if (event.type === 'mouseUp') {
            if (drag && moved) alignment.snap();
            drag = undefined;
        } else if (event.type === 'mouseLeave') {
            drag = undefined;
        }
    };
    /** Resizing cancels position motion; programmatic movement does not reenter it. */
    const cancel = () => {
        drag = undefined;
        alignment.cancel();
    };
    contents.on('input-event', input);
    window.on('will-resize', cancel);
    window.on('closed', cancel);
    return () => {
        cancel();
        if (!contents.isDestroyed()) contents.off('input-event', input);
        window.off('will-resize', cancel);
        window.off('closed', cancel);
    };
}
