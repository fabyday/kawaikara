import { IPC_CHANNELS } from '../../../Common/IPC';
import type { UpdateManager } from '../../Manager/UpdateManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by updates IPC only. */
interface UpdatesIpcDependencies {
    /** Application-scoped updates dependency. */
    readonly updates: UpdateManager;
}

/** Connects updates requests and events to their application services. */
export function connectUpdatesIpc({
    updates,
}: UpdatesIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(IPC_CHANNELS.application.checkForUpdates, () =>
            updates.checkForUpdates(),
        );
        ipc.handle(IPC_CHANNELS.application.getUpdateState, () =>
            updates.getState(),
        );
        ipc.handle(IPC_CHANNELS.application.downloadUpdate, () =>
            updates.downloadUpdate(),
        );
        ipc.handle(IPC_CHANNELS.application.installUpdate, () =>
            updates.installUpdate(),
        );
    });
}
