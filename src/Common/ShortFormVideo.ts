export interface ShortFormVideoShortcutDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultKey: string;
}

/** Mirrors the Provider API contract without importing CommonJS into Vite UI. */
export const SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING =
  'short-form-video.auto-advance';
export const SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING =
  'short-form-video.banned-publishers';

/**
 * These bindings target whichever supported short-form Provider is active.
 * They become global only while Kawaikara's unified PiP window is active.
 */
export const SHORT_FORM_VIDEO_SHORTCUTS = [
  {
    id: 'short-form-video.previous',
    title: 'Previous short video',
    defaultKey: 'CommandOrControl+Alt+Up',
  },
  {
    id: 'short-form-video.next',
    title: 'Next short video',
    defaultKey: 'CommandOrControl+Alt+Down',
  },
  {
    id: 'short-form-video.toggle-auto-advance',
    title: 'Toggle short video auto-advance',
    defaultKey: 'CommandOrControl+Alt+A',
  },
  {
    id: 'short-form-video.ban-current-publisher',
    title: 'Ban current short video publisher',
    defaultKey: 'CommandOrControl+Alt+B',
  },
] as const satisfies readonly ShortFormVideoShortcutDefinition[];
