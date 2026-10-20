import { IPC_CHANNELS } from '../../../Common/IPC';
import { requireDevelopmentProjectId } from '../Bundle/DevelopmentValidation';
import { requireAppLocale } from './Validation';
import type { BundleManager } from '../../Manager/BundleManager';
import type { ProviderManager } from '../../Manager/ProviderManager';
import type { BundleDevelopmentManager } from '../../Manager/BundleDevelopmentManager';
import type { WindowManager } from '../../Manager/WindowManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by bundles IPC only. */
interface BundlesIpcDependencies {
    /** Application-scoped bundles dependency. */
    readonly bundles: BundleManager;
    /** Application-scoped sites dependency. */
    readonly sites: ProviderManager;
    /** Application-scoped development dependency. */
    readonly development: BundleDevelopmentManager;
    /** Application-scoped windows dependency. */
    readonly windows: WindowManager;
}

/** Connects bundles requests and events to their application services. */
export function connectBundlesIpc({
    bundles,
    sites,
    development,
    windows,
}: BundlesIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.addCleanup(development.subscribe(
            (state) => windows.notifyDevelopmentStateChanged(state),
        ));
        ipc.handle(IPC_CHANNELS.bundles.runtime, () =>
            sites.listBundles(),
        );
        ipc.handle(IPC_CHANNELS.bundles.list, () => bundles.list());
        ipc.handle(
            IPC_CHANNELS.bundles.install,
            (_event, locale: unknown) =>
                bundles.installFromDialog(requireAppLocale(locale)),
        );
        ipc.handle(
            IPC_CHANNELS.bundles.update,
            (_event, id: unknown, locale: unknown) => {
                if (typeof id !== 'string')
                    throw new TypeError('Bundle id must be a string.');
                return bundles.update(id, requireAppLocale(locale));
            },
        );
        ipc.handle(
            IPC_CHANNELS.bundles.remove,
            (_event, id: unknown, locale: unknown) => {
                if (typeof id !== 'string')
                    throw new TypeError('Bundle id must be a string.');
                return bundles.remove(id, requireAppLocale(locale));
            },
        );
        ipc.handle(IPC_CHANNELS.development.state, () =>
            development.getState(),
        );
        ipc.handle(
            IPC_CHANNELS.development.attach,
            (_event, locale: unknown) =>
                development.attachFromDialog(requireAppLocale(locale)),
        );
        ipc.handle(
            IPC_CHANNELS.development.rebuild,
            (_event, projectId: unknown) =>
                development.rebuild(
                    requireDevelopmentProjectId(projectId),
                ),
        );
        ipc.handle(
            IPC_CHANNELS.development.setHotReload,
            (_event, projectId: unknown, enabled: unknown) => {
                if (typeof enabled !== 'boolean') {
                    throw new TypeError('Hot reload state must be a boolean.');
                }
                return development.setHotReload(
                    requireDevelopmentProjectId(projectId),
                    enabled,
                );
            },
        );
        ipc.handle(
            IPC_CHANNELS.development.detach,
            (_event, projectId: unknown) =>
                development.detach(requireDevelopmentProjectId(projectId)),
        );
        ipc.handle(IPC_CHANNELS.development.vscodeConfiguration, () =>
            development.createVsCodeConfiguration(),
        );
    });
}
