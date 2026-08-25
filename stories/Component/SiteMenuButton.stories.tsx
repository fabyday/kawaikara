import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { SiteMenuButton } from '../../src/Renderer/Component/SiteMenuButton';
import { STORY_SITES } from '../Mocks/KawaikaraMock';

const meta = {
  title: 'Component/Site Menu Button',
  component: SiteMenuButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Panel className="storybook-component-frame" padding="sm">
        <Story />
      </Panel>
    ),
  ],
  args: {
    site: STORY_SITES[0],
    selectedLabel: 'Selected',
    onOpen: () => undefined,
  },
} satisfies Meta<typeof SiteMenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const Selected = {
  args: { isSelected: true },
} satisfies Story;

export const FallbackIcon = {
  args: {
    site: {
      id: 'kawaikara.video',
      bundleId: 'kawaikara.builtin-sites',
      title: 'Video',
      addressHosts: [],
      category: 'Video',
      panels: [],
      order: 0,
      defaultShortcut: '',
      actionShortcuts: [],
      supportedLocales: [],
      defaultLocale: 'inherit',
      drm: false,
      pictureInPictureEnabled: true,
      isCurrent: false,
    },
  },
} satisfies Story;

export const BrokenIcon = {
  args: {
    site: {
      id: 'kawaikara.broken-icon',
      bundleId: 'example.bundle',
      title: 'Fallback after error',
      addressHosts: ['example.com'],
      category: 'Test',
      panels: [],
      icon: '/missing-site-icon.png',
      order: 0,
      defaultShortcut: '',
      actionShortcuts: [],
      supportedLocales: [],
      defaultLocale: 'inherit',
      drm: false,
      pictureInPictureEnabled: true,
      isCurrent: false,
    },
  },
} satisfies Story;
