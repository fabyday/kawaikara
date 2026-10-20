import { IPC_CHANNELS } from '../../../Common/IPC';
import { requireSettingsSender } from './SettingsSender';
import type { WebExtensionManager } from '../../Manager/WebExtensionManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by webextension IPC only. */
interface WebExtensionIpcDependencies {
    /** Resolves the optional bridge when a request arrives. */
    readonly getWebExtension: () => WebExtensionManager | undefined;
}

/** Connects webextension requests and events to their application services. */
export function connectWebExtensionIpc({
    getWebExtension,
}: WebExtensionIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.application.webExtensionConnection,
            async (event, operation: unknown, requestId: unknown) => {
                requireSettingsSender(event);
                const webExtension = getWebExtension();
                if (!webExtension)
                    throw new Error('Browser bridge is unavailable.');
                if (operation === 'connect')
                    await webExtension.useExtension();
                else if (operation === 'connect-development') await webExtension.useExtension(undefined, true);
                else if (operation === 'connect-development-custom') await webExtension.chooseBrowser(true);
                else if (operation === 'connect-development-browser') {
                    if (typeof requestId !== 'string') throw new Error('Invalid browser ID.');
                    await webExtension.useExtension(requestId, true);
                }
                else if (operation === 'connect-custom') await webExtension.chooseBrowser();
                else if (operation === 'browsers')
                    return {...webExtension.status(), browsers: await webExtension.browsers()};
                else if (operation === 'connect-browser') {
                    if (typeof requestId !== 'string') throw new Error('Invalid browser ID.');
                    await webExtension.useExtension(requestId);
                } else if (operation === 'revoke-client') {
                    if (typeof requestId !== 'string' || !webExtension.status().connections.some(c => c.id === requestId)) throw new Error('Invalid connection ID.');
                    await webExtension.revoke(requestId);
                }
                else if (operation === 'copy')
                    await webExtension.copyConnectionCode();
                else if (operation === 'revoke')
                    await webExtension.revoke();
                else if (operation === 'development-on' || operation === 'development-off')
                    await webExtension.setDevelopment(operation === 'development-on');
                else if (operation === 'approve' || operation === 'deny') {
                    if (typeof requestId !== 'string') throw new Error('Invalid approval ID.');
                    webExtension.decide(requestId, operation === 'approve');
                }
                else if (operation !== 'status') throw new Error('Unknown browser connection operation.');
                return webExtension.status();
            },
        );
    });
}
