import type { Rectangle } from 'electron';
import { clamp, lerp } from '../../../Math/Scalar';

/** Resolves resized PiP bounds while retaining the nearest screen edges. */
export function resolveAnchoredResizeBounds(
    current: Rectangle,
    workArea: Rectangle,
    width: number,
    height: number,
): Rectangle {
    const workRight = workArea.x + workArea.width;
    const workBottom = workArea.y + workArea.height;
    const currentRight = current.x + current.width;
    const currentBottom = current.y + current.height;
    const anchorRight =
        Math.abs(workRight - currentRight) < Math.abs(current.x - workArea.x);
    const anchorBottom =
        Math.abs(workBottom - currentBottom) < Math.abs(current.y - workArea.y);
    const maximumX = workRight - width;
    const maximumY = workBottom - height;
    return {
        /** The x value. */
        x: clampCoordinate(
            anchorRight ? currentRight - width : current.x,
            workArea.x,
            maximumX,
        ),
        /** The y value. */
        y: clampCoordinate(
            anchorBottom ? currentBottom - height : current.y,
            workArea.y,
            maximumY,
        ),
        /** The width value. */
        width,
        /** The height value. */
        height,
    };
}

/** Interpolates integer native window bounds for one animation frame. */
export function interpolateBounds(
    from: Rectangle,
    to: Rectangle,
    progress: number,
): Rectangle {
    /** Interpolates one rectangle field. */
    const interpolate = (start: number, end: number): number =>
        Math.round(lerp(start, end, progress));
    return {
        /** The x value. */
        x: interpolate(from.x, to.x),
        /** The y value. */
        y: interpolate(from.y, to.y),
        /** The width value. */
        width: interpolate(from.width, to.width),
        /** The height value. */
        height: interpolate(from.height, to.height),
    };
}

/** Determines whether two native window rectangles match. */
export function rectanglesMatch(left: Rectangle, right: Rectangle): boolean {
    return (
        left.x === right.x &&
        left.y === right.y &&
        left.width === right.width &&
        left.height === right.height
    );
}

/** Rounds after clamping; oversized windows retain the work-area origin. */
function clampCoordinate(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.round(clamp(value, minimum, Math.max(minimum, maximum)));
}
