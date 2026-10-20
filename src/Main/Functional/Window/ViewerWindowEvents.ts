import { ownEventConnections } from './EventConnections';
import type { BrowserWindow, WebContents } from 'electron';
import { resolveBrowserNavigation } from './WindowInput';

/** State transitions requested by the viewer's native lifecycle. */
export interface ViewerWindowEvents {
    /** Reconciles retained surface bounds. */
    layout(): void;
    /** Reconciles stacking, forcing a refresh after the native move loop. */
    refreshStacking(force?: boolean): void;
    /** Records external topmost state changes. */
    topmostChanged(value: boolean): void;
    /** Publishes native fullscreen state to the active content. */
    fullScreenChanged(value: boolean): void;
    /** Refreshes the active compositor surface after becoming visible. */
    visible(reason: string): void;
    /** Restores focus to the manager's active surface. */
    focused(): void;
    /** Routes native back/forward buttons without exposing native command strings. */
    navigate(direction: 'back' | 'forward'): void;
    /** Returns whether asynchronous shutdown preparation must defer closing. */
    shouldDeferClose(): boolean;
    /** Prepares shutdown after native closing has been prevented. */
    prepareClose(): void;
    /** Releases state owned by the closed viewer. */
    closed(): void;
}

/** Connects native viewer events to explicit window-state transitions. */
export function bindViewerWindowEvents(
    viewer: BrowserWindow,
    events: ViewerWindowEvents,
): () => void {
    return ownEventConnections(viewer, 'closed', () => {
        viewer.on('move', events.layout);
        viewer.on('moved', () => events.refreshStacking(true));
        viewer.on('always-on-top-changed', (_event, value) =>
            events.topmostChanged(value),
        );
        /** Publishes the current state after either native fullscreen transition. */
        const fullScreenChanged = () =>
            events.fullScreenChanged(viewer.isFullScreen());
        viewer.on('enter-full-screen', fullScreenChanged);
        viewer.on('leave-full-screen', fullScreenChanged);
        viewer.on('resize', () => {
            events.layout();
            events.refreshStacking();
        });
        viewer.on('show', () => events.visible('viewer-show'));
        viewer.on('restore', () => events.visible('viewer-restore'));
        viewer.on('focus', events.focused);
        viewer.on('app-command', (_event, command) => {
            const direction = resolveBrowserNavigation(command);
            if (direction) events.navigate(direction);
        });
        viewer.on('close', (event) => {
            if (!events.shouldDeferClose()) return;
            event.preventDefault();
            events.prepareClose();
        });
        viewer.on('closed', events.closed);
    });
}

/** Connects an app-owned renderer's editing, title, and teardown lifecycle. */
export function bindAppSurfaceEvents(
    contents: WebContents,
    events: {
        /** Clears editor state when a new document starts loading. */
        loading(): void;
        /** Reasserts an application-owned native title when needed. */
        titleChanged?(): void;
        /** Clears state owned by this renderer. */
        destroyed?(): void;
    },
): () => void {
    return ownEventConnections(contents, 'destroyed', () => {
        contents.on('did-start-loading', events.loading);
        contents.on('page-title-updated', (event) => {
            event.preventDefault();
            events.titleChanged?.();
        });
        if (events.destroyed) contents.once('destroyed', events.destroyed);
    });
}
