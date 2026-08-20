import {
  defineBundle,
  definePlugin,
  defineProvider,
  type PluginManifest,
  type ProviderConstructor,
  type ProviderManifest,
  type SitePermission,
} from '@kawaikara/site-api';
import bundleManifest from './manifest.json';
import { ProviderIdentityPlugin } from './Plugins/Index';
import providerIdentityManifest from './Plugins/ProviderIdentity/manifest.json';
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

const provider = (
  manifest: ProviderManifest,
  constructor: ProviderConstructor,
) => defineProvider({ manifest, provider: constructor });

export const builtinBundle = defineBundle({
  id: bundleManifest.id,
  name: bundleManifest.name,
  description: bundleManifest.description,
  version: bundleManifest.version,
  apiVersion: 1,
  permissions: bundleManifest.permissions as SitePermission[],
  locale: bundleManifest.locale,
  browserProfiles: bundleManifest.browserProfiles,
  plugins: [
    definePlugin({
      manifest: providerIdentityManifest as PluginManifest,
      plugin: ProviderIdentityPlugin,
    }),
  ],
  providers: [
    provider(netflixManifest as ProviderManifest, NetflixProvider),
    provider(laftelManifest as ProviderManifest, LaftelProvider),
    provider(disneyPlusManifest as ProviderManifest, DisneyPlusProvider),
    provider(videoManifest as ProviderManifest, VideoProvider),
    provider(youTubeManifest as ProviderManifest, YouTubeProvider),
    provider(primeVideoManifest as ProviderManifest, PrimeVideoProvider),
    provider(wavveManifest as ProviderManifest, WavveProvider),
    provider(watchaManifest as ProviderManifest, WatchaProvider),
    provider(coupangPlayManifest as ProviderManifest, CoupangPlayProvider),
    provider(tvingManifest as ProviderManifest, TvingProvider),
    provider(appleTvManifest as ProviderManifest, AppleTvProvider),
    provider(crunchyrollManifest as ProviderManifest, CrunchyrollProvider),
    provider(chzzkManifest as ProviderManifest, ChzzkProvider),
    provider(twitchManifest as ProviderManifest, TwitchProvider),
    provider(appleMusicManifest as ProviderManifest, AppleMusicProvider),
    provider(spotifyManifest as ProviderManifest, SpotifyProvider),
    provider(youTubeMusicManifest as ProviderManifest, YouTubeMusicProvider),
    provider(ridiBooksManifest as ProviderManifest, RidiBooksProvider),
  ],
});

export * from './Plugins/Index';
export * from './Providers/Index';
