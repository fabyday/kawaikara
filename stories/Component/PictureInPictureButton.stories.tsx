import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel, Stack } from '@kawaikara/kawai-ui';
import { PictureInPictureButton } from '../../src/Renderer/Component/PictureInPictureButton';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Picture in Picture Button',
  /** The component value. */
  component: PictureInPictureButton,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <Panel padding="md">
        <Stack align="start">
          <Story />
        </Stack>
      </Panel>
    ),
  ],
  /** The args value. */
  args: {
    /** The label value. */
    label: 'Picture in Picture',
    /** The on press value. */
    onPress: () => undefined,
  },
} satisfies Meta<typeof PictureInPictureButton>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default = {} satisfies Story;

/** Stores the active value. */
export const Active = {
  /** The args value. */
  args: {
    /** Whether the active option is enabled. */
    active: true },
} satisfies Story;

/** Stores the loading value. */
export const Loading = {
  /** The args value. */
  args: {
    /** Whether the loading option is enabled. */
    isLoading: true },
} satisfies Story;

/** Stores the game compatible value. */
export const GameCompatible = {
  /** The args value. */
  args: {
    /** The label value. */
    label: 'Game Picture in Picture',
    /** The short label value. */
    shortLabel: 'Game PiP',
  },
} satisfies Story;

/** Stores the automatic value. */
export const Automatic = {
  /** The args value. */
  args: {
    /** The label value. */
    label: 'Automatic Picture in Picture',
    /** The short label value. */
    shortLabel: 'Auto PiP',
  },
} satisfies Story;
