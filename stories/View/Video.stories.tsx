import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoView } from '../../src/Renderer/View/Video/App';

const meta = {
  title: 'View/Video',
  component: VideoView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="storybook-video-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VideoView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty = {} satisfies Story;
