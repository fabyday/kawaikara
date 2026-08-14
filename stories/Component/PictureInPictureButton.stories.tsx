import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel, Stack } from '@kawaikara/kawai-ui';
import { PictureInPictureButton } from '../../src/Renderer/Component/PictureInPictureButton';

const meta = {
  title: 'Component/Picture in Picture Button',
  component: PictureInPictureButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Panel padding="md">
        <Stack align="start">
          <Story />
        </Stack>
      </Panel>
    ),
  ],
  args: {
    label: 'Picture in Picture',
    onPress: () => undefined,
  },
} satisfies Meta<typeof PictureInPictureButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const Active = {
  args: { active: true },
} satisfies Story;

export const Loading = {
  args: { isLoading: true },
} satisfies Story;

export const GameCompatible = {
  args: {
    label: 'Game Picture in Picture',
    shortLabel: 'Game PiP',
  },
} satisfies Story;

export const Automatic = {
  args: {
    label: 'Automatic Picture in Picture',
    shortLabel: 'Auto PiP',
  },
} satisfies Story;
