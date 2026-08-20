import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../../src/Renderer/View/Menu/App';
import { installKawaikaraMock } from '../Mocks/KawaikaraMock';

const meta = {
  title: 'View/Menu',
  component: App,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="storybook-menu-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const VideoLibrary = {
  beforeEach: () => {
    installKawaikaraMock({ currentSiteId: 'kawaikara.video' });
  },
} satisfies Story;

export const ManualUpdateAvailable = {
  beforeEach: () => {
    installKawaikaraMock({
      buildChannel: 'staging',
      updateAvailable: true,
    });
  },
} satisfies Story;
