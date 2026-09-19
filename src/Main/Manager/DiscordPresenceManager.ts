import { app } from 'electron';
import type { AppLocale } from '../../Common/IPC';
import { getLocaleMessages } from '../Functional/Locale';
import * as DiscordRpc from 'discord-rpc';
import { DISCORD_APP_ID } from '../../Common/BuildConfig';

/** Publishes Kawaikara's current viewing state through Discord Rich Presence. */
export class DiscordPresenceManager {
  /** Selects activity copy when Discord connects. */
  constructor(
    /** Current app language, supplied by the preference manager. */
    private readonly getLocale: () => AppLocale = () => 'system',
  ) {}

  /** Discord RPC client used to publish and clear the current activity. */
  private client?: DiscordRpc.Client;
  /** Stable activity start time reused for the lifetime of this manager. */
  private startedAt = new Date();

  /** Connects to Discord and publishes the Kawaikara viewing activity. */
  async start(): Promise<void> {
    if (!DISCORD_APP_ID || this.client) {
      if (!DISCORD_APP_ID) {
        console.info('Discord Rich Presence is disabled: DISCORD_APP_ID is not set.');
      }
      return;
    }

    const client = new DiscordRpc.Client({ transport: 'ipc'
    });
    this.client = client;
    client.on('ready', () => {
      const labels = getLocaleMessages(this.getLocale(), app.getLocale());
      void client.setActivity({
        details: labels.presence.details,
        state: labels.presence.watching,
        startTimestamp: this.startedAt,
        largeImageKey: 'discord1024',
        largeImageText: labels.app.title,
        smallImageKey: 'discord512',
        smallImageText: labels.presence.viewer,
        buttons: [
          { label: labels.app.title, url: 'https://kawaikara.github.io/'
          },
          { label: labels.app.discord, url: 'https://discord.gg/JJs974BX45'
          },
        ],
      }).catch((error: unknown) => {
        console.warn('Discord Rich Presence activity failed.', error);
      });
    });

    try {
      await client.login({ clientId: DISCORD_APP_ID
      });
    } catch (error) {
      console.info('Discord Rich Presence is unavailable.', error);
      await this.dispose();
    }
  }

  /** Clears the published activity and closes the Discord RPC connection. */
  async dispose(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (!client) return;
    try {
      await client.clearActivity();
      await client.destroy();
    } catch {
      // Discord can close its IPC connection before Kawaikara exits.
    }
  }
}
