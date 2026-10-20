import { ownEventConnections } from './EventConnections';
import { screen, type BrowserWindow } from 'electron';

/** Observes display topology only while the owning window policy is active. */
export function observeDisplayConfiguration(changed: () => void): () => void {
    screen.on('display-added', changed);
    screen.on('display-removed', changed);
    screen.on('display-metrics-changed', changed);
    return () => {
        screen.removeListener('display-added', changed);
        screen.removeListener('display-removed', changed);
        screen.removeListener('display-metrics-changed', changed);
    };
}

/** Waits for native fullscreen exit or teardown before applying normal bounds. */
export async function leaveViewerFullScreen(
    viewer: BrowserWindow,
): Promise<void> {
    if (!viewer.isFullScreen()) return;
    await new Promise<void>((resolve) => {
        /** Releases both listeners regardless of which native event completes first. */
        const finish = () => {
            viewer.removeListener('leave-full-screen', finish);
            viewer.removeListener('closed', finish);
            resolve();
        };
        viewer.once('leave-full-screen', finish);
        viewer.once('closed', finish);
        viewer.setFullScreen(false);
    });
}

/** Connects native PiP events to the existing placement and restore policies. */
export function bindVideoPictureInPictureEvents(
    pip: BrowserWindow,
    events: {
        /** Resizes the retained Video surface. */
        layout(): void;
        /** Reasserts the current platform presentation policy. */
        reassert(): void;
        /** Whether native close should restore the Video surface into the viewer. */
        shouldRestore(): boolean;
        /** Starts the existing asynchronous restore operation. */
        restore(): void;
    },
): () => void {
    return ownEventConnections(pip, 'closed', () => {
        pip.on('resize', events.layout);
        pip.on('blur', events.reassert);
        pip.on('show', events.reassert);
        pip.on('close', (event) => {
            if (!events.shouldRestore()) return;
            event.preventDefault();
            events.restore();
        });
    });
}

/** Tracks detached developer-tools placement for the next inspected site. */
export function bindDevToolsBoundsEvents(
    window: BrowserWindow,
    remember: () => void,
): () => void {
    return ownEventConnections(window, 'closed', () => {
        window.on('move', remember);
        window.on('resize', remember);
    });
}
