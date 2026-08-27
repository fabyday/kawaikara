import type {
  BundleReleaseChannel,
  BundleUpdateResolver,
} from './Plugin';

/** Describes the git hub release bundle update options contract. */
export interface GitHubReleaseBundleUpdateOptions {
  /** The repositories value. */
  readonly repositories: Readonly<Record<BundleReleaseChannel, string>>;
  /** The asset name value. */
  readonly assetName: string;
  /** The user agent value. */
  readonly userAgent?: string;
}

/** Describes the git hub release response contract. */
interface GitHubReleaseResponse {
  /** Whether the draft option is enabled. */
  readonly draft?: boolean;
  /** Whether the prerelease option is enabled. */
  readonly prerelease?: boolean;
  /** The assets value. */
  readonly assets?: readonly {
    /** The name value. */
    readonly name?: string;
    /** The browser download URL value. */
    readonly browser_download_url?: string;
  }[];
}

/** Create a credential-free GitHub Releases Bundle update resolver. */
export function createGitHubReleaseBundleUpdateResolver(
  options: GitHubReleaseBundleUpdateOptions,
): BundleUpdateResolver {
  return async ({ channel }) => {
    const repository = options.repositories[channel];
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      throw new Error(`Invalid GitHub update repository for ${channel}.`);
    }
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases?per_page=20`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': options.userAgent ?? 'Kawaikara-Bundle-Updater',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Unable to check Bundle updates (HTTP ${response.status}).`);
    }
    const releases = await response.json() as GitHubReleaseResponse[];
    const release = releases.find(
      (candidate) =>
        !candidate.draft && (channel !== 'stable' || !candidate.prerelease),
    );
    const archive = release?.assets?.find(
      (asset) => asset.name === options.assetName,
    );
    if (!archive?.browser_download_url) {
      throw new Error(
        `The latest ${channel} release does not contain ${options.assetName}.`,
      );
    }
    return archive.browser_download_url;
  };
}
