import type { ReleaseChannel } from './BuildConfig';
import type { ApplicationLinkId } from './IPC';

/**
 * Webpack replaces these identifiers at each use site. Use them directly in
 * build-only conditions; runtime aliases can prevent dead-branch elimination.
 * They are not process.env values and must be defined by standalone test builds.
 */
declare global {
    /** Public project/community destinations resolved and validated during the build. */
    const __KAWAIKARA_SOCIAL_LINKS__: Readonly<Record<ApplicationLinkId, string>>;
    /** The immutable release/update channel selected by the packager. */
    const __KAWAIKARA_BUILD_CHANNEL__: ReleaseChannel;
    /** Whether this is an installable distribution rather than a local dev build. */
    const __KAWAIKARA_DISTRIBUTION_BUILD__: boolean;
    /** Public Discord application ID; an empty string disables Rich Presence. */
    const __KAWAIKARA_DISCORD_APP_ID__: string;
    /** Isolated update-test settings; always null in normal builds. */
    const __KAWAIKARA_UPDATE_TEST_PROFILE__: {
        /** Test-only application data root. */
        readonly stateRoot: string;
        /** Loopback feed retained across installer relaunches. */
        readonly feedUrl: string;
    } | null;
}
