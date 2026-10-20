import { IPC_CHANNELS } from '../../../Common/IPC';
import type { UpdateManager } from '../../Manager/UpdateManager';
import { type ViewerRuntime } from '../Viewer/ViewerRuntime';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';
import { isDevToolsMode } from './Validation';

/** Dependencies used by window IPC only. */
interface WindowIpcDependencies {
    /** Application-scoped viewerRuntime dependency. */
    readonly viewerRuntime: Pick<
        ViewerRuntime,
        'diagnostics' | 'input' | 'pip' | 'viewer' | 'windows'
    >;
    /** Application-scoped updates dependency. */
    readonly updates: UpdateManager;
}

/** Connects window requests and events to their application services. */
export function connectWindowIpc({
    viewerRuntime,
    updates,
}: WindowIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.on(
            IPC_CHANNELS.overlay.editingChanged,
            (event, editing: unknown) => {
                if (typeof editing !== 'boolean') return;
                viewerRuntime.input.setEditingState(event.sender.id, editing);
            },
        );
        ipc.handle(IPC_CHANNELS.application.listDisplays, () =>
            viewerRuntime.viewer.listDisplays(),
        );
        ipc.handle(
            IPC_CHANNELS.application.openDevTools,
            (_event, mode: unknown) => {
                if (!isDevToolsMode(mode)) {
                    throw new TypeError('Unknown DevTools placement.');
                }
                viewerRuntime.diagnostics.openDevTools(mode);
            },
        );
        ipc.handle(IPC_CHANNELS.media.togglePictureInPicture, () =>
            viewerRuntime.pip.togglePictureInPicture(),
        );
        ipc.handle(IPC_CHANNELS.media.toggleGamePictureInPicture, () =>
            viewerRuntime.pip.toggleGamePictureInPicture(),
        );
        ipc.handle(IPC_CHANNELS.overlay.close, () => {
            viewerRuntime.viewer.hideOverlay();
        });
        ipc.handle(IPC_CHANNELS.overlay.setView, (_event, view: unknown) => {
            if (view === 'menu') {
                viewerRuntime.viewer.showOverlay();
                return;
            }
            if (view === 'preference') {
                viewerRuntime.viewer.showPreferencesOverlay();
                return;
            }
            if (view === 'update') {
                const state = updates.getState();
                if (!state)
                    throw new Error('No update panel state is available.');
                viewerRuntime.viewer.showUpdateOverlay(state);
                return;
            }
            throw new TypeError(
                'Overlay view must be menu, preference, or update.',
            );
        });
        ipc.handle(IPC_CHANNELS.application.isFullScreen, () =>
            viewerRuntime.viewer.isAppFullScreen(),
        );
        ipc.handle(IPC_CHANNELS.application.exitFullScreen, () =>
            viewerRuntime.windows.exitAppFullScreen(),
        );
    });
}
