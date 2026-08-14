import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../../src/Renderer/View/Menu/App';

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
