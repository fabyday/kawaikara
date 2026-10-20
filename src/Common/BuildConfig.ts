/** Defines the release channel type. */
export type ReleaseChannel = 'stable' | 'staging' | 'nightly';

/** Defines the shared update repositories constant. */
export const UPDATE_REPOSITORIES: Readonly<
  Record<ReleaseChannel, {
    /** The owner value. */
    readonly owner: string;
    /** The repo value. */
    readonly repo: string;
  }>
> = {
  /** The stable value. */
  stable: {
    /** The owner value. */
    owner: 'fabyday',
    /** The repo value. */
    repo: 'kawaikara',
  },
  /** The staging value. */
  staging: {
    /** The owner value. */
    owner: 'Kawaikara',
    /** The repo value. */
    repo: 'kawaikara-staging',
  },
  /** The nightly value. */
  nightly: {
    /** The owner value. */
    owner: 'Kawaikara',
    /** The repo value. */
    repo: 'kawaikara-nightly',
  },
};

/** Determines whether the release channel condition applies. */
export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return ['stable', 'staging', 'nightly'].includes(String(value));
}

/** Performs the to updater channel operation. */
export function toUpdaterChannel(channel: ReleaseChannel): string {
  return channel === 'stable' ? 'latest' : channel;
}
