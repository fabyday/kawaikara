import type { Meta, StoryObj } from '@storybook/react-vite';
import { YouTubeDownloaderPanel } from '../../src/Renderer/View/Video/YouTubeDownloaderPanel';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/YouTube Downloader Panel',
  /** The component value. */
  component: YouTubeDownloaderPanel,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen',
  },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-downloader-frame">
        <Story />
      </div>
    ),
  ],
  /** The tags value. */
  tags: ['autodocs'],
} satisfies Meta<typeof YouTubeDownloaderPanel>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default: Story = {
  /** The args value. */
  args: {
    /** The initial URL value. */
    initialUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
};
