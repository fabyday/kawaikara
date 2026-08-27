import type {
  BundleReleaseChannel,
} from '@kawaikara/site-api';
import { createGitHubReleaseBundleUpdateResolver } from '@kawaikara/site-api';

/** Defines the shared update repositories constant. */
const UPDATE_REPOSITORIES: Readonly<Record<BundleReleaseChannel, string>> = {
  /** The stable value. */
  stable: 'fabyday/kawaikara',
  /** The staging value. */
  staging: 'Kawaikara/kawaikara-staging',
  /** The nightly value. */
  nightly: 'Kawaikara/kawaikara-nightly',
};

/** Defines the shared archive name constant. */
const ARCHIVE_NAME = 'kawaikara.builtin-sites.kawai';

/** Resolve the newest official Bundle archive for the app's release channel. */
export const resolveBundleUpdate = createGitHubReleaseBundleUpdateResolver({
  /** The repositories value. */
  repositories: UPDATE_REPOSITORIES,
  /** The asset name value. */
  assetName: ARCHIVE_NAME,
});

export default resolveBundleUpdate;
