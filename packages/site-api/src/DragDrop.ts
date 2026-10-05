/** Where a registered Provider accepts an OS file drop. */
export type FileDropScope = 'global' | 'local';

/** Declarative routing; matching must not instantiate or navigate a Provider. */
export interface ProviderFileDropContribution {
  /** Global works over any Provider; local only over this Provider. */
  readonly scope: FileDropScope;
  /** Lowercase extensions including the dot; MIME alone is not trusted. */
  readonly extensions: readonly string[];
  /** App-owned Video handoff; additional payloads/actions are not implemented yet. */
  readonly action: 'open-local-video';
}
