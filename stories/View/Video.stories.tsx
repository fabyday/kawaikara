import type { Meta, StoryObj } from '@storybook/react-vite';
import { VideoView } from '../../src/Renderer/View/Video/App';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'View/Video',
  /** The component value. */
  component: VideoView,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-video-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VideoView>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the empty value. */
export const Empty = {} satisfies Story;
