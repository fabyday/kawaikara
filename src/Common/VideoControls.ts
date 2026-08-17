export interface VideoShortcutDefinition {
  readonly id: string;
  readonly title: string;
  readonly defaultKey: string;
}

export const DEFAULT_VIDEO_SEEK_SECONDS = 10;
export const MIN_VIDEO_SEEK_SECONDS = 1;
export const MAX_VIDEO_SEEK_SECONDS = 3600;

export const VIDEO_SHORTCUTS = [
  {
    id: 'video.frame-backward',
    title: 'Previous video frame',
    defaultKey: 'Comma',
  },
  {
    id: 'video.frame-forward',
    title: 'Next video frame',
    defaultKey: '.',
  },
  {
    id: 'video.seek-backward',
    title: 'Seek video backward',
    defaultKey: 'Left',
  },
  {
    id: 'video.seek-forward',
    title: 'Seek video forward',
    defaultKey: 'Right',
  },
] as const satisfies readonly VideoShortcutDefinition[];

export type VideoShortcutId = (typeof VIDEO_SHORTCUTS)[number]['id'];
