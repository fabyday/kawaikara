import {
  defineBundle,
  defineProvider,
  type ProviderConstructor,
  type ProviderManifest,
  type ProviderLocaleResource,
  type SitePermission,
} from '@kawaikara/site-api';
import bundleManifest from './manifest.json';
import { resolveBundleUpdate } from './Update';
import {
  AppleMusicProvider,
  AppleTvProvider,
  ChzzkProvider,
  CoupangPlayProvider,
  CrunchyrollProvider,
  DisneyPlusProvider,
  LaftelProvider,
  NetflixProvider,
  PrimeVideoProvider,
  RidiBooksProvider,
  SpotifyProvider,
  TwitchProvider,
  TvingProvider,
  VideoProvider,
  WavveProvider,
  WatchaProvider,
  YouTubeMusicProvider,
  YouTubeProvider,
} from './Providers/Index';

import appleMusicManifest from './Providers/AppleMusic/manifest.json';
import appleTvManifest from './Providers/AppleTv/manifest.json';
import chzzkManifest from './Providers/Chzzk/manifest.json';
import coupangPlayManifest from './Providers/CoupangPlay/manifest.json';
import crunchyrollManifest from './Providers/Crunchyroll/manifest.json';
import disneyPlusManifest from './Providers/DisneyPlus/manifest.json';
import laftelManifest from './Providers/Laftel/manifest.json';
import netflixManifest from './Providers/Netflix/manifest.json';
import primeVideoManifest from './Providers/PrimeVideo/manifest.json';
import ridiBooksManifest from './Providers/RidiBooks/manifest.json';
import spotifyManifest from './Providers/Spotify/manifest.json';
import twitchManifest from './Providers/Twitch/manifest.json';
import tvingManifest from './Providers/Tving/manifest.json';
import videoManifest from './Providers/Video/manifest.json';
import watchaManifest from './Providers/Watcha/manifest.json';
import wavveManifest from './Providers/Wavve/manifest.json';
import youTubeManifest from './Providers/YouTube/manifest.json';
import youTubeMusicManifest from './Providers/YouTubeMusic/manifest.json';
import chzzkLocalization from './Providers/Chzzk/locale.json';
import videoLocalization from './Providers/Video/locale.json';
import youTubeLocalization from './Providers/YouTube/locale.json';

/** Performs the provider operation. */
const provider = (
  manifest: ProviderManifest,
  constructor: ProviderConstructor,
  localization?: ProviderLocaleResource,
) => defineProvider({ manifest, provider: constructor, localization
});

/** Stores the builtin bundle value. */
export const builtinBundle = defineBundle({
  /** The ID value. */
  id: bundleManifest.id,
  /** The name value. */
  name: bundleManifest.name,
  /** The description value. */
  description: bundleManifest.description,
  /** The version value. */
  version: bundleManifest.version,
  /** The update value. */
  update: {
    /** The type value. */
    type: 'resolver',
    /** The resolve value. */
    resolve: resolveBundleUpdate,
  },
  /** The API version value. */
  apiVersion: 1,
  /** The permissions value. */
  permissions: bundleManifest.permissions as SitePermission[],
  /** The locale value. */
  locale: bundleManifest.locale,
  /** The browser profiles value. */
  browserProfiles: bundleManifest.browserProfiles,
  /** The plugins value. */
  plugins: [],
  /** The providers value. */
  providers: [
    provider(netflixManifest as ProviderManifest, NetflixProvider),
    provider(laftelManifest as ProviderManifest, LaftelProvider),
    provider(disneyPlusManifest as ProviderManifest, DisneyPlusProvider),
    provider(
      videoManifest as ProviderManifest,
      VideoProvider,
      videoLocalization,
    ),
    provider(
      youTubeManifest as ProviderManifest,
      YouTubeProvider,
      youTubeLocalization,
    ),
    provider(primeVideoManifest as ProviderManifest, PrimeVideoProvider),
    provider(wavveManifest as ProviderManifest, WavveProvider),
    provider(watchaManifest as ProviderManifest, WatchaProvider),
    provider(coupangPlayManifest as ProviderManifest, CoupangPlayProvider),
    provider(tvingManifest as ProviderManifest, TvingProvider),
    provider(appleTvManifest as ProviderManifest, AppleTvProvider),
    provider(crunchyrollManifest as ProviderManifest, CrunchyrollProvider),
    provider(chzzkManifest as ProviderManifest, ChzzkProvider, chzzkLocalization),
    provider(twitchManifest as ProviderManifest, TwitchProvider),
    provider(appleMusicManifest as ProviderManifest, AppleMusicProvider),
    provider(spotifyManifest as ProviderManifest, SpotifyProvider),
    provider(youTubeMusicManifest as ProviderManifest, YouTubeMusicProvider),
    provider(ridiBooksManifest as ProviderManifest, RidiBooksProvider),
  ],
});

export * from './Providers/Index';
