import ko from '../../locales/ko.json';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeveloperLinks } from '../../src/Renderer/Component/DeveloperLinks';

/** Uses the same Korean catalog as Main instead of maintaining sample translations. */
const messages = ko.app;

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/DeveloperLinks',
  /** The component value. */
  component: DeveloperLinks,
  /** The args value. */
  args: {
    /** The messages value. */
    messages,
    /** The on open value. */
    onOpen: () => undefined,
  },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-component-frame" style={{ width: 680 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeveloperLinks>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the live value. */
export const Live = {
  /** The args value. */
  args: {
    /** The YouTube status value. */
    youtubeStatus: {
      /** Whether the live option is enabled. */
      isLive: true,
      /** The checked at value. */
      checkedAt: new Date().toISOString(),
    },
  },
} satisfies Story;

/** Stores the offline value. */
export const Offline = {
  /** The args value. */
  args: {
    /** The YouTube status value. */
    youtubeStatus: {
      /** Whether the live option is enabled. */
      isLive: false,
      /** The checked at value. */
      checkedAt: new Date().toISOString(),
    },
  },
} satisfies Story;

/** Stores the checking value. */
export const Checking = {} satisfies Story;

/** Preview a failed live-status request without changing the link destination. */
export const Unavailable = {
  /** Failed YouTube status. */
  args: {
    /** Status error returned by the developer-links service. */
    youtubeStatus: {
      /** No live stream could be confirmed. */
      isLive: false,
      /** Last attempted status refresh. */
      checkedAt: new Date().toISOString(),
      /** Safe status failure message. */
      error: 'Live status unavailable',
    },
  },
} satisfies Story;

/** Exercise the actual light-theme selectors inside the default dark canvas. */
const lightThemeDecorators: NonNullable<Story['decorators']> = [
  (Story) => (
    <div
      className="kawai-theme-light"
      style={{ background: '#f5f5f5', color: 'var(--kawai-color-foreground)', padding: 16 }}
    >
      <Story />
    </div>
  ),
];

/** Light theme with the YouTube live highlight and readable GitHub mark. */
export const LightLive = {
  ...Live,
  /** Scoped light-theme preview. */
  decorators: lightThemeDecorators,
} satisfies Story;

/** Light theme with an offline YouTube channel. */
export const LightOffline = {
  ...Offline,
  /** Scoped light-theme preview. */
  decorators: lightThemeDecorators,
} satisfies Story;

/** Light theme while the YouTube status is loading. */
export const LightChecking = {
  ...Checking,
  /** Scoped light-theme preview. */
  decorators: lightThemeDecorators,
} satisfies Story;

/** Light theme when the YouTube status request fails. */
export const LightUnavailable = {
  ...Unavailable,
  /** Scoped light-theme preview. */
  decorators: lightThemeDecorators,
} satisfies Story;
