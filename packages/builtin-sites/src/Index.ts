import {
  defineBundle,
  defineProvider,
  definePlugin,
  type PluginDefinition,
  type PluginConstructor,
  type PluginManifest,
  type ProviderConstructor,
  type ProviderManifest,
  type ProviderLocaleResource,
  type SitePermission,
} from '@kawaikara/site-api';
import ChzzkAdBlockPlugin from './Providers/Chzzk/Plugins/AdBlock/Plugin';
import ChzzkAdBlockManifest from './Providers/Chzzk/Plugins/AdBlock/manifest.json';
import ChzzkQualityPlugin from './Providers/Chzzk/Plugins/Quality/Plugin';
import ChzzkQualityManifest from './Providers/Chzzk/Plugins/Quality/manifest.json';
import ChzzkClipsPlugin from './Providers/Chzzk/Plugins/Clips/Plugin';
import ChzzkUpscalingPlugin from './Providers/Chzzk/Plugins/Upscaling/Plugin';
import ChzzkUpscalingManifest from './Providers/Chzzk/Plugins/Upscaling/manifest.json';
import ChzzkClipsManifest from './Providers/Chzzk/Plugins/Clips/manifest.json';
import YouTubeShortsPlugin from './Providers/YouTube/Plugins/Shorts/Plugin';
import YouTubeShortsManifest from './Providers/YouTube/Plugins/Shorts/manifest.json';
import WavveResponsiveViewportPlugin from './Providers/Wavve/Plugins/ResponsiveViewport/Plugin';
import WavveResponsiveViewportManifest from './Providers/Wavve/Plugins/ResponsiveViewport/manifest.json';
import AppleTvStorefrontPlugin from './Providers/AppleTv/Plugins/Storefront/Plugin';
import AppleTvStorefrontManifest from './Providers/AppleTv/Plugins/Storefront/manifest.json';
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
import appleTvLocalization from './Providers/AppleTv/locale.json';
import wavveLocalization from './Providers/Wavve/locale.json';
import videoLocalization from './Providers/Video/locale.json';
import youTubeLocalization from './Providers/YouTube/locale.json';

/** Performs the provider operation. */
const provider = (
  manifest: ProviderManifest,
  constructor: ProviderConstructor,
  localization?: ProviderLocaleResource,
  plugins: readonly PluginDefinition[] = [],
) => defineProvider({ manifest, provider: constructor, localization, plugins
});

/** Explicit executable Plugin definitions mirror the packaged child manifests. */
const builtinPlugin = (manifest: PluginManifest, plugin: PluginConstructor): PluginDefinition => definePlugin({
  /** Canonical distribution identity. */
  manifest,
  /** Decorated implementation. */
  plugin,
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
      [builtinPlugin(YouTubeShortsManifest as PluginManifest, YouTubeShortsPlugin)],
    ),
    provider(primeVideoManifest as ProviderManifest, PrimeVideoProvider),
    provider(wavveManifest as ProviderManifest, WavveProvider, wavveLocalization, [builtinPlugin(WavveResponsiveViewportManifest as PluginManifest, WavveResponsiveViewportPlugin)]),
    provider(watchaManifest as ProviderManifest, WatchaProvider),
    provider(coupangPlayManifest as ProviderManifest, CoupangPlayProvider),
    provider(tvingManifest as ProviderManifest, TvingProvider),
    provider(appleTvManifest as ProviderManifest, AppleTvProvider, appleTvLocalization, [builtinPlugin(AppleTvStorefrontManifest as PluginManifest, AppleTvStorefrontPlugin)]),
    provider(crunchyrollManifest as ProviderManifest, CrunchyrollProvider),
    provider(chzzkManifest as ProviderManifest, ChzzkProvider, chzzkLocalization, [builtinPlugin(ChzzkAdBlockManifest as PluginManifest, ChzzkAdBlockPlugin), builtinPlugin(ChzzkQualityManifest as PluginManifest, ChzzkQualityPlugin), builtinPlugin(ChzzkClipsManifest as PluginManifest, ChzzkClipsPlugin), builtinPlugin(ChzzkUpscalingManifest as PluginManifest, ChzzkUpscalingPlugin)]),
    provider(twitchManifest as ProviderManifest, TwitchProvider),
    provider(appleMusicManifest as ProviderManifest, AppleMusicProvider),
    provider(spotifyManifest as ProviderManifest, SpotifyProvider),
    provider(youTubeMusicManifest as ProviderManifest, YouTubeMusicProvider),
    provider(ridiBooksManifest as ProviderManifest, RidiBooksProvider),
  ],
});

export * from './Providers/Index';
