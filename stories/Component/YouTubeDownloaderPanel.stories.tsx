import type { Meta, StoryObj } from '@storybook/react-vite';
import { YouTubeDownloaderPanel } from '../../src/Renderer/Component/YouTubeDownloaderPanel';

const meta = {
  title: 'Component/YouTube Downloader Panel',
  component: YouTubeDownloaderPanel,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="storybook-downloader-frame">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof YouTubeDownloaderPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
};
