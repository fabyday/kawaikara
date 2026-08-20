export type ReleaseChannel = 'stable' | 'staging' | 'nightly';

declare const __KAWAIKARA_BUILD_CHANNEL__: ReleaseChannel;
declare const __KAWAIKARA_DISCORD_APP_ID__: string;

export const BUILD_CHANNEL = __KAWAIKARA_BUILD_CHANNEL__;
export const DISCORD_APP_ID = __KAWAIKARA_DISCORD_APP_ID__;

export const UPDATE_REPOSITORIES: Readonly<
  Record<ReleaseChannel, { readonly owner: string; readonly repo: string }>
> = {
  stable: { owner: 'fabyday', repo: 'kawaikara' },
  staging: { owner: 'Kawaikara', repo: 'kawaikara-staging' },
  nightly: { owner: 'Kawaikara', repo: 'kawaikara-nightly' },
};

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return ['stable', 'staging', 'nightly'].includes(String(value));
}

export function toUpdaterChannel(channel: ReleaseChannel): string {
  return channel === 'stable' ? 'latest' : channel;
}
