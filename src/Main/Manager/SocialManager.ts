import type { AppLocale, ApplicationLinkId, DeveloperYouTubeStatus } from '../../Common/IPC';
import { APPLICATION_LINKS, openSocialLink } from '../Functional/Social/Links';
import { createYouTubeLiveStatusLookup } from '../Functional/Social/YouTubeLiveStatus';
import { createDiscordPresence, type DiscordPresence } from '../Functional/Social/DiscordPresence';

/** App-scoped entry point for community links, live status, and social presence. */
export class SocialManager {
    /** Cached channel lookup shared by all Views. */
    private readonly youtubeStatus = createYouTubeLiveStatusLookup(APPLICATION_LINKS.developerYouTube);
    /** Owns the active Discord connection for this application session. */
    private readonly presence: DiscordPresence;

    /** Resolves language when publishing activity rather than capturing startup preferences. */
    constructor(getLocale: () => AppLocale = () => 'system') {
        this.presence = createDiscordPresence(getLocale);
    }

    /** Starts enabled social integrations after application initialization. */
    async start(): Promise<void> {
        if (!__KAWAIKARA_DISCORD_APP_ID__) {
            console.info('Discord Rich Presence is disabled: DISCORD_APP_ID is not set.');
            return;
        }
        await this.presence.start(__KAWAIKARA_DISCORD_APP_ID__);
    }

    /** Opens a fixed project/community destination requested by a View. */
    openLink(id: ApplicationLinkId): Promise<void> {
        return openSocialLink(id);
    }

    /** Returns the developer channel's cached or refreshed live state. */
    getDeveloperYouTubeStatus(): Promise<DeveloperYouTubeStatus> {
        return this.youtubeStatus();
    }

    /** Clears activity and releases social integration resources on shutdown. */
    dispose(): Promise<void> {
        return this.presence.dispose();
    }
}
