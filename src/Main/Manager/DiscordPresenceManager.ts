import * as DiscordRpc from 'discord-rpc';
import { DISCORD_APP_ID } from '../../Common/BuildConfig';

export class DiscordPresenceManager {
  private client?: DiscordRpc.Client;
  private startedAt = new Date();

  async start(): Promise<void> {
    if (!DISCORD_APP_ID || this.client) {
      if (!DISCORD_APP_ID) {
        console.info('Discord Rich Presence is disabled: DISCORD_APP_ID is not set.');
      }
      return;
    }

    const client = new DiscordRpc.Client({ transport: 'ipc' });
    this.client = client;
    client.on('ready', () => {
      void client.setActivity({
        details: 'Kawaikara OTT Viewer',
        state: 'Watching…',
        startTimestamp: this.startedAt,
        largeImageKey: 'discord1024',
        largeImageText: 'Kawaikara',
        smallImageKey: 'discord512',
        smallImageText: 'Kawaikara Viewer',
        buttons: [
          { label: 'Kawaikara', url: 'https://kawaikara.github.io/' },
          { label: 'Discord', url: 'https://discord.gg/JJs974BX45' },
        ],
      }).catch((error: unknown) => {
        console.warn('Discord Rich Presence activity failed.', error);
      });
    });

    try {
      await client.login({ clientId: DISCORD_APP_ID });
    } catch (error) {
      console.info('Discord Rich Presence is unavailable.', error);
      await this.dispose();
    }
  }

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
