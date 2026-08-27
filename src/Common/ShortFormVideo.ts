/** Describes the short form video shortcut definition contract. */
export interface ShortFormVideoShortcutDefinition {
  /** The ID value. */
  readonly id: string;
  /** The title value. */
  readonly title: string;
  /** The default key value. */
  readonly defaultKey: string;
}

/** Mirrors the Provider API contract without importing CommonJS into Vite UI. */
export const SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING =
  'short-form-video.auto-advance';
/** Defines the shared short form video banned publishers setting constant. */
export const SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING =
  'short-form-video.banned-publishers';

/**
 * These bindings target whichever supported short-form Provider is active.
 * They become global only while Kawaikara's unified PiP window is active.
 */
export const SHORT_FORM_VIDEO_SHORTCUTS = [
  {
    /** The ID value. */
    id: 'short-form-video.previous',
    /** The title value. */
    title: 'Previous short video',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Alt+Up',
  },
  {
    /** The ID value. */
    id: 'short-form-video.next',
    /** The title value. */
    title: 'Next short video',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Alt+Down',
  },
  {
    /** The ID value. */
    id: 'short-form-video.toggle-auto-advance',
    /** The title value. */
    title: 'Toggle short video auto-advance',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Alt+A',
  },
  {
    /** The ID value. */
    id: 'short-form-video.ban-current-publisher',
    /** The title value. */
    title: 'Ban current short video publisher',
    /** The default key value. */
    defaultKey: 'CommandOrControl+Alt+B',
  },
] as const satisfies readonly ShortFormVideoShortcutDefinition[];
