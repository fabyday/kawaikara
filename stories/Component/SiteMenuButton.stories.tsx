import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { SiteMenuButton } from '../../src/Renderer/Component/SiteMenuButton';
import { STORY_SITES } from '../Mocks/KawaikaraMock';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Site Menu Button',
  /** The component value. */
  component: SiteMenuButton,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <Panel className="storybook-component-frame" padding="sm">
        <Story />
      </Panel>
    ),
  ],
  /** The args value. */
  args: {
    /** The site value. */
    site: STORY_SITES[0],
    /** The selected label value. */
    selectedLabel: 'Selected',
    /** The on open value. */
    onOpen: () => undefined,
  },
} satisfies Meta<typeof SiteMenuButton>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default = {} satisfies Story;

/** Stores the selected value. */
export const Selected = {
  /** The args value. */
  args: {
    /** Whether the selected option is enabled. */
    isSelected: true },
} satisfies Story;

/** Stores the fallback icon value. */
export const FallbackIcon = {
  /** The args value. */
  args: {
    /** The site value. */
    site: {
      /** The ID value. */
      id: 'kawaikara.video',
      /** The bundle ID value. */
      bundleId: 'kawaikara.builtin-sites',
      /** The title value. */
      title: 'Video',
      /** The address hosts value. */
      addressHosts: [],
      /** The category value. */
      category: 'Video',
      /** The panels value. */
      panels: [],
      /** The order value. */
      order: 0,
      /** The default shortcut value. */
      defaultShortcut: '',
      /** The action shortcuts value. */
      actionShortcuts: [],
      /** The supported locales value. */
      supportedLocales: [],
      /** The default locale value. */
      defaultLocale: 'inherit',
      /** The DRM value. */
      drm: false,
      /** The picture in picture enabled value. */
      pictureInPictureEnabled: true,
      /** Whether the current option is enabled. */
      isCurrent: false,
    },
  },
} satisfies Story;

/** Stores the broken icon value. */
export const BrokenIcon = {
  /** The args value. */
  args: {
    /** The site value. */
    site: {
      /** The ID value. */
      id: 'kawaikara.broken-icon',
      /** The bundle ID value. */
      bundleId: 'example.bundle',
      /** The title value. */
      title: 'Fallback after error',
      /** The address hosts value. */
      addressHosts: ['example.com'],
      /** The category value. */
      category: 'Test',
      /** The panels value. */
      panels: [],
      /** The icon value. */
      icon: '/missing-site-icon.png',
      /** The order value. */
      order: 0,
      /** The default shortcut value. */
      defaultShortcut: '',
      /** The action shortcuts value. */
      actionShortcuts: [],
      /** The supported locales value. */
      supportedLocales: [],
      /** The default locale value. */
      defaultLocale: 'inherit',
      /** The DRM value. */
      drm: false,
      /** The picture in picture enabled value. */
      pictureInPictureEnabled: true,
      /** Whether the current option is enabled. */
      isCurrent: false,
    },
  },
} satisfies Story;
