import { definePlugin } from '@kawaikara/site-api';
import {
  AppleMusicSite,
  AppleTvSite,
  ChzzkSite,
  CoupangPlaySite,
  CrunchyrollSite,
  DisneyPlusSite,
  LaftelSite,
  NetflixSite,
  PrimeVideoSite,
  RidiBooksSite,
  SpotifySite,
  TwitchSite,
  TvingSite,
  VideoSite,
  WavveSite,
  WatchaSite,
  YouTubeMusicSite,
  YouTubeSite,
} from './Sites/Index';

export const builtinSitesPlugin = definePlugin({
  id: 'kawaikara.builtin-sites',
  name: 'Kawaikara Built-in Sites',
  description: 'Official site descriptors bundled with Kawaikara.',
  version: '3.0.0-dev.0',
  apiVersion: 1,
  locale: {
    supportedLocales: ['ko-KR', 'en-US', 'ja-JP'],
    defaultLocale: 'inherit',
  },
  browserProfiles: [
    {
      id: 'google',
      name: 'Google',
      description: 'Shares Google sign-in between YouTube integrations.',
      persistent: true,
    },
  ],
  sites: [
    NetflixSite,
    LaftelSite,
    DisneyPlusSite,
    VideoSite,
    YouTubeSite,
    PrimeVideoSite,
    WavveSite,
    WatchaSite,
    CoupangPlaySite,
    TvingSite,
    AppleTvSite,
    CrunchyrollSite,
    ChzzkSite,
    TwitchSite,
    AppleMusicSite,
    SpotifySite,
    YouTubeMusicSite,
    RidiBooksSite,
  ],
});

export * from './Sites/Index';
