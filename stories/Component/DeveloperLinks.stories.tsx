import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeveloperLinks } from '../../src/Renderer/Component/DeveloperLinks';

/** Stores the messages value. */
const messages = {
  /** The website value. */
  website: 'Kawaikara 사이트',
  /** The github value. */
  github: 'GitHub',
  /** The discord value. */
  discord: '디스코드',
  /** The developer you tube value. */
  developerYouTube: '개발자 유튜브',
  /** The live now value. */
  liveNow: '지금 라이브 중',
  /** The offline value. */
  offline: '현재 오프라인',
  /** The live status unavailable value. */
  liveStatusUnavailable: '상태 확인 불가',
  /** The checking live value. */
  checkingLive: '라이브 확인 중…',
};

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
