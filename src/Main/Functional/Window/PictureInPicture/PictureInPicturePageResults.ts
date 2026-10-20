import { PIP_VIDEO_SIZE_MESSAGE } from './PictureInPictureConstants';

/** Parses a trusted in-page video-size notification into an aspect ratio. */
export function parseVideoSizeMessage(message: string): number | undefined {
    const prefix = `${PIP_VIDEO_SIZE_MESSAGE}:`;
    if (!message.startsWith(prefix)) return undefined;
    const [widthValue, heightValue, extra] = message
        .slice(prefix.length)
        .split(':');
    if (extra !== undefined) return undefined;
    return createVideoAspectRatio(Number(widthValue), Number(heightValue));
}

/** Read page lifecycle status without trusting untyped remote values. */
export function readPageResultStatus(value: unknown): string | undefined {
    if (!value || typeof value !== 'object' || !('status' in value))
        return undefined;
    return typeof value.status === 'string' ? value.status : undefined;
}

/** Reads an aspect ratio from a page-script result. */
export function readVideoAspectRatio(value: unknown): number | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as { videoHeight?: unknown; videoWidth?: unknown };
    return createVideoAspectRatio(
        Number(candidate.videoWidth),
        Number(candidate.videoHeight),
    );
}

/** Creates a bounded video aspect ratio from intrinsic dimensions. */
function createVideoAspectRatio(
    width: number,
    height: number,
): number | undefined {
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return undefined;
    }
    const aspectRatio = width / height;
    return aspectRatio >= 0.1 && aspectRatio <= 10 ? aspectRatio : undefined;
}
