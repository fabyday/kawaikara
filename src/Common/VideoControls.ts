/** Describes the video shortcut definition contract. */
export interface VideoShortcutDefinition {
  /** The ID value. */
  readonly id: string;
  /** The default key value. */
  readonly defaultKey: string;
}

/** Defines the shared default video seek seconds constant. */
export const DEFAULT_VIDEO_SEEK_SECONDS = 10;
/** Defines the shared min video seek seconds constant. */
export const MIN_VIDEO_SEEK_SECONDS = 1;
/** Defines the shared max video seek seconds constant. */
export const MAX_VIDEO_SEEK_SECONDS = 3600;

/** Defines the shared video shortcuts constant. */
export const VIDEO_SHORTCUTS = [
  {
    /** The ID value. */
    id: 'video.frame-backward',
    /** The default key value. */
    defaultKey: 'Comma',
  },
  {
    /** The ID value. */
    id: 'video.frame-forward',
    /** The default key value. */
    defaultKey: '.',
  },
  {
    /** The ID value. */
    id: 'video.seek-backward',
    /** The default key value. */
    defaultKey: 'Left',
  },
  {
    /** The ID value. */
    id: 'video.seek-forward',
    /** The default key value. */
    defaultKey: 'Right',
  },
] as const satisfies readonly VideoShortcutDefinition[];

/** Defines the video shortcut ID type. */
export type VideoShortcutId = (typeof VIDEO_SHORTCUTS)[number]['id'];
