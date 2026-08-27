/** Provider action contract used by short-form video integrations. */
export const SHORT_FORM_VIDEO_ACTIONS = {
  /** The previous value. */
  previous: 'kawaikara:short-form-video:previous',
  /** The next value. */
  next: 'kawaikara:short-form-video:next',
  /** The announce auto advance value. */
  announceAutoAdvance: 'kawaikara:short-form-video:announce-auto-advance',
  /** The announce publisher ban value. */
  announcePublisherBan: 'kawaikara:short-form-video:announce-publisher-ban',
} as const;

/** Provider-local setting key. SiteManager namespaces it by Provider id. */
export const SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING =
  'short-form-video.auto-advance';

/** Provider-local list of publisher ids blocked from the short-form feed. */
export const SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING =
  'short-form-video.banned-publishers';

/** Describes the short form video publisher contract. */
export interface ShortFormVideoPublisher {
  /** The ID value. */
  readonly id: string;
  /** The label value. */
  readonly label: string;
  /** The handle value. */
  readonly handle?: string;
  /** The image URL value. */
  readonly imageUrl?: string;
}

/**
 * Standard short-form capabilities understood by Kawaikara. Providers expose
 * these once and the app supplies local/PiP shortcuts and preference storage.
 */
export interface ShortFormVideoContribution {
  /** Whether the previous option is enabled. */
  readonly previous?: boolean;
  /** Whether the next option is enabled. */
  readonly next?: boolean;
  /** The auto advance value. */
  readonly autoAdvance?: {
    /** The setting key value. */
    readonly settingKey: string;
    /** Whether the default value option is enabled. */
    readonly defaultValue: boolean;
  };
  /** The publisher ban value. */
  readonly publisherBan?: {
    /** The setting key value. */
    readonly settingKey: string;
  };
}

/** Defines the short form video action type. */
export type ShortFormVideoAction =
  (typeof SHORT_FORM_VIDEO_ACTIONS)[keyof typeof SHORT_FORM_VIDEO_ACTIONS];

/** Defines the short form video command type. */
export type ShortFormVideoCommand = 'previous' | 'next' | 'announce' | 'ban';

/** Resolves the short form video command. */
export function resolveShortFormVideoCommand(
  action: string,
): ShortFormVideoCommand | undefined {
  if (action === SHORT_FORM_VIDEO_ACTIONS.previous) return 'previous';
  if (action === SHORT_FORM_VIDEO_ACTIONS.next) return 'next';
  if (action === SHORT_FORM_VIDEO_ACTIONS.announceAutoAdvance) return 'announce';
  if (action === SHORT_FORM_VIDEO_ACTIONS.announcePublisherBan) return 'ban';
  return undefined;
}

/** Reads the short form video auto advance. */
export function readShortFormVideoAutoAdvance(
  settings: ProviderSettings,
  defaultValue = true,
): boolean {
  const value = settings[SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING];
  return typeof value === 'boolean' ? value : defaultValue;
}

/** Reads the short form video banned publishers. */
export function readShortFormVideoBannedPublishers(
  settings: ProviderSettings,
): readonly ProviderSettingListItem[] {
  const value = settings[SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING];
  return Array.isArray(value)
    ? value as readonly ProviderSettingListItem[]
    : [];
}

/** Normalizes the short form video publisher. */
export function normalizeShortFormVideoPublisher(
  value: unknown,
): ShortFormVideoPublisher | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return undefined;
  const id = candidate.id.trim();
  return {
    /** The ID value. */
    id,
    /** The label value. */
    label: typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label.trim()
      : id,
    /** The handle value. */
    handle: typeof candidate.handle === 'string' && candidate.handle.trim()
      ? candidate.handle.trim()
      : undefined,
    /** The image URL value. */
    imageUrl: typeof candidate.imageUrl === 'string' &&
      candidate.imageUrl.startsWith('https://')
      ? candidate.imageUrl
      : undefined,
  };
}
import type {
  ProviderSettingListItem,
  ProviderSettings,
} from './Provider';
