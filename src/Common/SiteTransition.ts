/** Application-owned feedback for queued Provider activation and native handoff. */
export interface SiteTransitionState {
  /** Requested Provider, independent of the page URL or browser session. */
  readonly siteId: string;
  /** Human-readable Provider title. */
  readonly title: string;
  /** Loading lifecycle, without pretending a network percentage is known. */
  readonly phase: 'loading' | 'ready' | 'failed';
  /** A failed transition's displayable error, rendered as inert text. */
  readonly error?: string;
}
