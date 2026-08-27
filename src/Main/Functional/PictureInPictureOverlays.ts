/**
 * DOM-rendered caption layers automatically retained in every unified PiP.
 * Native WebVTT cues painted by the video element do not need a selector.
 * Providers only declare selectors unique to their player.
 */
export const STANDARD_PICTURE_IN_PICTURE_OVERLAY_SELECTORS = [
  '.vjs-text-track-display',
  '.vjs-text-track-cue',
  '.shaka-text-container',
  '.shaka-text-wrapper',
  '.jw-captions',
  '.jw-text-track-container',
  '.jw-text-track-cue',
  '.theoplayer-texttracks',
  '.theoplayer-texttrack',
  '.theoplayer-cue',
  '.bmpui-ui-subtitle-overlay',
  '.bmpui-ui-subtitle-label',
  '.plyr__captions',
  'amp-caption',
  'amp-caption-layer',
  '.amp-caption',
  '[data-testid*="subtitle-container" i]',
  '[data-testid*="subtitle-overlay" i]',
  '[data-testid*="caption-container" i]',
  '[data-testid*="caption-overlay" i]',
  '[data-uia*="player-subtitle" i]',
  '[data-uia*="player-caption" i]',
  '[data-a-target*="player-caption" i]',
  '[class*="subtitle-container" i]',
  '[class*="subtitle_container" i]',
  '[class*="subtitle-layer" i]',
  '[class*="subtitle_layer" i]',
  '[class*="subtitle-overlay" i]',
  '[class*="subtitle_overlay" i]',
  '[class*="subtitle-renderer" i]',
  '[class*="subtitle_renderer" i]',
  '[class*="captions-container" i]',
  '[class*="captions_container" i]',
  '[class*="caption-layer" i]',
  '[class*="caption_layer" i]',
  '[class*="caption-overlay" i]',
  '[class*="caption_overlay" i]',
  '[class*="caption-renderer" i]',
  '[class*="caption_renderer" i]',
] as const;

/** Resolves the picture in picture overlay selectors. */
export function resolvePictureInPictureOverlaySelectors(
  providerSelectors: readonly string[] = [],
): readonly string[] {
  return [...new Set([
    ...STANDARD_PICTURE_IN_PICTURE_OVERLAY_SELECTORS,
    ...providerSelectors,
  ])];
}
