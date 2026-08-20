/** Provider action contract used by short-form video integrations. */
export const SHORT_FORM_VIDEO_ACTIONS = {
  previous: 'kawaikara:short-form-video:previous',
  next: 'kawaikara:short-form-video:next',
  announceAutoAdvance: 'kawaikara:short-form-video:announce-auto-advance',
  announcePublisherBan: 'kawaikara:short-form-video:announce-publisher-ban',
} as const;

/** Provider-local setting key. SiteManager namespaces it by Provider id. */
export const SHORT_FORM_VIDEO_AUTO_ADVANCE_SETTING =
  'short-form-video.auto-advance';

/** Provider-local list of publisher ids blocked from the short-form feed. */
export const SHORT_FORM_VIDEO_BANNED_PUBLISHERS_SETTING =
  'short-form-video.banned-publishers';

export interface ShortFormVideoPublisher {
  readonly id: string;
  readonly label: string;
  readonly handle?: string;
  readonly imageUrl?: string;
}

/**
 * Standard short-form capabilities understood by Kawaikara. Providers expose
 * these once and the app supplies local/PiP shortcuts and preference storage.
 */
export interface ShortFormVideoContribution {
  readonly previous?: boolean;
  readonly next?: boolean;
  readonly autoAdvance?: {
    readonly settingKey: string;
    readonly defaultValue: boolean;
  };
  readonly publisherBan?: {
    readonly settingKey: string;
  };
}

export type ShortFormVideoAction =
  (typeof SHORT_FORM_VIDEO_ACTIONS)[keyof typeof SHORT_FORM_VIDEO_ACTIONS];
