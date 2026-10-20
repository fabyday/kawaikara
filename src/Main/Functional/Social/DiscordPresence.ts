import { app } from 'electron';
import * as DiscordRpc from 'discord-rpc';
import type { AppLocale } from '../../../Common/IPC';
import { getLocaleMessages } from '../Localization/Locale';
import { APPLICATION_LINKS } from './Links';

/** Lifecycle owned by SocialManager; no RPC client is exposed to Views. */
export interface DiscordPresence {
    /** Connects once and shares a pending login between callers. */
    start(clientId: string): Promise<void>;
    /** Clears activity and destroys the current client, including pending logins. */
    dispose(): Promise<void>;
}

/** Builds localized activity using the same canonical URLs as the app's links. */
export function createDiscordActivity(
    locale: AppLocale,
    startedAt: Date,
): DiscordRpc.Presence {
    const labels = getLocaleMessages(locale, app.getLocale());
    return {
        /** Localized activity description. */
        details: labels.presence.details,
        /** Localized viewing status. */
        state: labels.presence.watching,
        /** Stable start time for this application session. */
        startTimestamp: startedAt,
        /** Registered Discord application artwork. */
        largeImageKey: 'discord1024',
        /** Localized application name. */
        largeImageText: labels.app.title,
        /** Registered viewer artwork. */
        smallImageKey: 'discord512',
        /** Localized viewer label. */
        smallImageText: labels.presence.viewer,
        /** Canonical project and community links. */
        buttons: [
            {
                /** Localized application label. */
                label: labels.app.title,
                /** Project homepage. */
                url: APPLICATION_LINKS.website,
            },
            {
                /** Localized community label. */
                label: labels.app.discord,
                /** Project Discord invitation. */
                url: APPLICATION_LINKS.discord,
            },
        ],
    };
}

/** Creates an isolated RPC lifecycle without connecting until start is called. */
export function createDiscordPresence(getLocale: () => AppLocale): DiscordPresence {
    const startedAt = new Date();
    let connection: {
        client: DiscordRpc.Client;
        ready: () => void;
        login: Promise<void>;
    } | undefined;

    /** Releases resources even if Discord has already rejected clearActivity. */
    const close = async (current: NonNullable<typeof connection>): Promise<void> => {
        current.client.removeListener('ready', current.ready);
        try {
            await current.client.clearActivity();
        } catch {
            // Discord may already be closed.
        }
        try {
            await current.client.destroy();
        } catch {
            // The IPC transport may already be gone.
        }
    };

    return {
        /** Starts at most one pending RPC connection. */
        start(clientId) {
            if (!clientId) return Promise.resolve();
            if (connection) return connection.login;
            const client = new DiscordRpc.Client({ transport: 'ipc' });
            const current = {
                client,
                ready: () => {
                    if (connection !== current) return;
                    void client
                        .setActivity(createDiscordActivity(getLocale(), startedAt))
                        .catch((error: unknown) => {
                            console.warn('Discord Rich Presence activity failed.', error);
                        });
                },
                login: Promise.resolve(),
            };
            connection = current;
            client.on('ready', current.ready);
            current.login = Promise.resolve()
                .then(() => {
                    if (connection === current) return client.login({ clientId });
                })
                .then(() => undefined)
                .catch(async (error: unknown) => {
                    console.info('Discord Rich Presence is unavailable.', error);
                    if (connection !== current) return;
                    connection = undefined;
                    await close(current);
                });
            return current.login;
        },
        /** Detaches callbacks before releasing the current connection. */
        async dispose() {
            const current = connection;
            connection = undefined;
            if (current) await close(current);
        },
    };
}
