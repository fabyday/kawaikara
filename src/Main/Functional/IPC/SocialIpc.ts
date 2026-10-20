import { IPC_CHANNELS } from '../../../Common/IPC';
import { isApplicationLinkId } from './Validation';
import type { SocialManager } from '../../Manager/SocialManager';
import { registerIpcBindings, type DisposeIpc } from './IpcBindings';

/** Dependencies used by social IPC only. */
interface SocialIpcDependencies {
    /** Application-scoped social dependency. */
    readonly social: SocialManager;
}

/** Connects social requests and events to their application services. */
export function connectSocialIpc({
    social,
}: SocialIpcDependencies): DisposeIpc {
    return registerIpcBindings((ipc) => {
        ipc.handle(
            IPC_CHANNELS.social.openLink,
            async (_event, id: unknown) => {
                if (!isApplicationLinkId(id)) {
                    throw new TypeError('Unknown application link.');
                }
                await social.openLink(id);
            },
        );
        ipc.handle(IPC_CHANNELS.social.developerYouTubeStatus, () =>
            social.getDeveloperYouTubeStatus(),
        );
    });
}
