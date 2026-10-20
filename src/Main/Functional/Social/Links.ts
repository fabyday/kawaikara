import type { ApplicationLinkId } from '../../../Common/IPC';
import { openInDefaultBrowser } from '../../Platform/DefaultBrowser';

/** Public destinations injected by Webpack; shared by buttons and Presence. */
export const APPLICATION_LINKS: Readonly<Record<ApplicationLinkId, string>> =
    __KAWAIKARA_SOCIAL_LINKS__;

/** Opens only known project/community links through the platform browser API. */
export async function openSocialLink(id: ApplicationLinkId): Promise<void> {
    if (!Object.hasOwn(APPLICATION_LINKS, id)) {
        throw new TypeError('Unknown application link.');
    }
    await openInDefaultBrowser(APPLICATION_LINKS[id]);
}
