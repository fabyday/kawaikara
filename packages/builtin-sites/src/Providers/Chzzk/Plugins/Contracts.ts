import { defineCapability } from '@kawaikara/site-api';

/** Optional coordination between Clips and ad blocking, without class references. */
export const CHZZK_AD_BLOCKING = defineCapability<{
  /** App-routed fallback available while the ad-blocking Plugin is active. */
  skipActionUrl(): string;
}>('kawaikara.chzzk.ad-blocking', 1);
