/** A Provider-owned adapter, created once per active PiP player frame. */
export interface PictureInPictureSubtitleController {
  /** Apply an absolute multiplier (1 = the player's original subtitle size). */
  setScale(scale: number): Promise<void> | void;
  /** Restore changed styles and release observers/listeners. Must be idempotent. */
  dispose(): Promise<void> | void;
}

/** Provider-owned placement; omitted axes retain the App's default alignment. */
export interface PictureInPictureSubtitleAlignment {
  /** Center on the displayed video image by default, or retain player placement. */
  readonly horizontal?: 'center' | 'preserve';
  /** Retain player placement by default, or anchor above the displayed image's bottom. */
  readonly vertical?: 'preserve' | 'bottom';
  /** Bottom gap as a fraction of displayed image height (default: 0.08, bounded to 0–0.4). */
  readonly bottomInsetRatio?: number;
  /** Minimum bottom gap in CSS pixels (default: 12, never more than 25% of image height). */
  readonly minimumBottomInsetPx?: number;
}

/** Optional convenience adapter for DOM captions; custom controllers need not use it. */
export interface PictureInPictureDomSubtitleOptions {
  /** Caption layers to retain in PiP, in addition to standard player selectors. */
  readonly overlaySelectors?: readonly string[];
  /** Explicit text targets, instead of automatically discovering caption text. */
  readonly textSelectors?: readonly string[];
  /** @deprecated Use alignment; retained for older bundles and layout opt-outs. */
  readonly layout?: 'horizontal-center' | 'preserve';
  /** Override only the specified axes; absent means the existing App alignment. */
  readonly alignment?: PictureInPictureSubtitleAlignment;
  /** Actual caption windows to position, without rewriting their internal scrolling/clipping layers. */
  readonly alignmentSelectors?: readonly string[];
  /** Resize text by default; box mode scales whole caption windows and preserves rolling buffers. */
  readonly scaleMode?: 'text' | 'box';
  /** Also resize/center native WebVTT cues on the active video (default: true). */
  readonly nativeCues?: boolean;
  /** Native cue base size in CSS units; Chromium's default is approximately 5vh. */
  readonly nativeCueFontSize?: string;
}

/** App-owned, frame-scoped capabilities. No Electron or remote-page DOM handles. */
export interface ProviderPictureInPictureSession {
  /** URL of the actual player frame, which may differ from the viewer URL. */
  readonly url: string;
  /** Create the standard reversible DOM/WebVTT adapter. */
  createDomSubtitleController(
    options?: PictureInPictureDomSubtitleOptions,
  ): PictureInPictureSubtitleController;
  /** Custom page scripts require the existing script-injection permission. */
  readonly page?: {
    /** Execute only in this player frame; unavailable after session disposal. */
    execute<T = unknown>(source: string): Promise<T>;
  };
}
