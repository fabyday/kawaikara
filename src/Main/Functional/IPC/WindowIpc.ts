import { IPC_CHANNELS } from '../../../Common/IPC';
import { isDevToolsMode } from './Validation';
import type { WindowManager } from '../../Manager/WindowManager';
import type { UpdateManager } from '../../Manager/UpdateManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by window IPC only. */
interface WindowIpcDependencies {
    /** Application-scoped windows dependency. */
    readonly windows: WindowManager;
    /** Application-scoped updates dependency. */
    readonly updates: UpdateManager;
}

/** Connects window requests and events to their application services. */
export function connectWindowIpc({
    windows,
    updates,
}: WindowIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.on(
            IPC_CHANNELS.overlay.editingChanged,
            (event, editing: unknown) => {
                if (typeof editing !== 'boolean') return;
                windows.setEditingState(event.sender.id, editing);
            },
        );
        ipc.handle(IPC_CHANNELS.application.listDisplays, () =>
            windows.listDisplays(),
        );
        ipc.handle(
            IPC_CHANNELS.application.openDevTools,
            (_event, mode: unknown) => {
                if (!isDevToolsMode(mode)) {
                    throw new TypeError('Unknown DevTools placement.');
                }
                windows.openDevTools(mode);
            },
        );
        ipc.handle(IPC_CHANNELS.media.togglePictureInPicture, () =>
            windows.togglePictureInPicture(),
        );
        ipc.handle(IPC_CHANNELS.media.toggleGamePictureInPicture, () =>
            windows.toggleGamePictureInPicture(),
        );
        ipc.handle(IPC_CHANNELS.overlay.close, () => {
            windows.hideOverlay();
        });
        ipc.handle(
            IPC_CHANNELS.overlay.setView,
            (_event, view: unknown) => {
                if (view === 'menu') {
                    windows.showOverlay();
                    return;
                }
                if (view === 'preference') {
                    windows.showPreferencesOverlay();
                    return;
                }
                if (view === 'update') {
                    const state = updates.getState();
                    if (!state)
                        throw new Error('No update panel state is available.');
                    windows.showUpdateOverlay(state);
                    return;
                }
                throw new TypeError(
                    'Overlay view must be menu, preference, or update.',
                );
            },
        );
        ipc.handle(IPC_CHANNELS.application.isFullScreen, () =>
            windows.isAppFullScreen(),
        );
        ipc.handle(IPC_CHANNELS.application.exitFullScreen, () =>
            windows.exitAppFullScreen(),
        );
    });
}
