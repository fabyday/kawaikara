import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeveloperLinks } from '../../src/Renderer/Component/DeveloperLinks';

const messages = {
  website: 'Kawaikara 사이트',
  github: 'GitHub',
  discord: '디스코드',
  developerYouTube: '개발자 유튜브',
  liveNow: '지금 라이브 중',
  offline: '현재 오프라인',
  liveStatusUnavailable: '상태 확인 불가',
  checkingLive: '라이브 확인 중…',
};

const meta = {
  title: 'Component/DeveloperLinks',
  component: DeveloperLinks,
  args: {
    messages,
    onOpen: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="storybook-component-frame" style={{ width: 680 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeveloperLinks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live = {
  args: {
    youtubeStatus: {
      isLive: true,
      checkedAt: new Date().toISOString(),
    },
  },
} satisfies Story;

export const Offline = {
  args: {
    youtubeStatus: {
      isLive: false,
      checkedAt: new Date().toISOString(),
    },
  },
} satisfies Story;

export const Checking = {} satisfies Story;
