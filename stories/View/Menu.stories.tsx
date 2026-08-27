import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../../src/Renderer/View/Menu/App';
import { installKawaikaraMock } from '../Mocks/KawaikaraMock';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'View/Menu',
  /** The component value. */
  component: App,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-menu-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default = {} satisfies Story;

/** Stores the video library value. */
export const VideoLibrary = {
  /** The before each value. */
  beforeEach: () => {
    installKawaikaraMock({ currentSiteId: 'kawaikara.video' });
  },
} satisfies Story;

/** Stores the manual update available value. */
export const ManualUpdateAvailable = {
  /** The before each value. */
  beforeEach: () => {
    installKawaikaraMock({
      buildChannel: 'staging',
      updateAvailable: true,
    });
  },
} satisfies Story;
