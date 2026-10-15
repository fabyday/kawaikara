import {
    UnsupportedExternalFullscreenMonitor,
    type ExternalFullscreenMonitor,
} from '../FullscreenMonitor';

/** Native window policy currently needs no explicit fullscreen monitor. */
export function createExternalFullscreenMonitor(): ExternalFullscreenMonitor {
    return new UnsupportedExternalFullscreenMonitor();
}
