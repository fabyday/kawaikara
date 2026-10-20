import { ipcMain } from 'electron';
import type { IpcChannel } from '../../../Common/IPC';

/** Releases one group of IPC handlers, events, and subscriptions. */
export type DisposeIpc = () => void;

/** Registration scope that keeps cleanup alongside the resource it owns. */
export interface IpcBindings {
    /** Registers a request handler and records its matching removal. */
    handle(channel: IpcChannel, listener: Parameters<typeof ipcMain.handle>[1]): void;
    /** Registers an event listener and records that exact listener for removal. */
    on(channel: IpcChannel, listener: Parameters<typeof ipcMain.on>[1]): void;
    /** Owns another subscription or timer created by this group. */
    addCleanup(dispose: DisposeIpc): void;
}

/** Releases all resources in reverse order, even if one cleanup fails. */
export function disposeIpcBindings(disposers: DisposeIpc[]): void {
    const failures: unknown[] = [];
    for (const dispose of disposers.splice(0).reverse()) {
        try {
            dispose();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length) throw new AggregateError(failures, 'IPC cleanup failed.');
}

/** Registers one feature atomically and returns an idempotent cleanup function. */
export function registerIpcBindings(register: (ipc: IpcBindings) => void): DisposeIpc {
    const disposers: DisposeIpc[] = [];
    try {
        register({
            /** Removes a handler only after its registration succeeds. */
            handle(channel, listener) {
                ipcMain.handle(channel, listener);
                disposers.push(() => ipcMain.removeHandler(channel));
            },
            /** Tracks the exact listener without affecting other subscribers. */
            on(channel, listener) {
                ipcMain.on(channel, listener);
                disposers.push(() => ipcMain.off(channel, listener));
            },
            /** Adds feature-owned resources to the same cleanup scope. */
            addCleanup(dispose) {
                disposers.push(dispose);
            },
        });
    } catch (error) {
        try {
            disposeIpcBindings(disposers);
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'IPC registration and rollback failed.');
        }
        throw error;
    }
    return () => disposeIpcBindings(disposers);
}
