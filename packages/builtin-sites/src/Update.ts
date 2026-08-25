import type {
  BundleReleaseChannel,
  BundleUpdateResolver,
} from '@kawaikara/site-api';

const UPDATE_REPOSITORIES: Readonly<Record<BundleReleaseChannel, string>> = {
  stable: 'fabyday/kawaikara',
  staging: 'Kawaikara/kawaikara-staging',
  nightly: 'Kawaikara/kawaikara-nightly',
};

const ARCHIVE_NAME = 'kawaikara.builtin-sites.kawai';

interface GitHubRelease {
  readonly draft?: boolean;
  readonly prerelease?: boolean;
  readonly assets?: readonly {
    readonly name?: string;
    readonly browser_download_url?: string;
  }[];
}

/** Resolve the newest official Bundle archive for the app's release channel. */
export const resolveBundleUpdate: BundleUpdateResolver = async ({ channel }) => {
  const repository = UPDATE_REPOSITORIES[channel];
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases?per_page=20`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Kawaikara-Bundle-Updater',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Unable to check built-in Bundle updates (HTTP ${String(response.status)}).`,
    );
  }
  const releases = (await response.json()) as GitHubRelease[];
  const release = releases.find(
    (candidate) =>
      !candidate.draft && (channel !== 'stable' || !candidate.prerelease),
  );
  const archive = release?.assets?.find((asset) => asset.name === ARCHIVE_NAME);
  if (!archive?.browser_download_url) {
    throw new Error(
      `The latest ${channel} release does not contain ${ARCHIVE_NAME}.`,
    );
  }
  return archive.browser_download_url;
};

export default resolveBundleUpdate;
