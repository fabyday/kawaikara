import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { PictureInPicturePlacementControl } from '../../src/Renderer/Component/PictureInPicturePlacementControl';
import type { PictureInPicturePlacementPreference } from '../../src/Common/PictureInPicture';

/** Stores the messages value. */
const messages = {
  /** The bottom left value. */
  bottomLeft: 'Bottom left',
  /** The bottom right value. */
  bottomRight: 'Bottom right',
  /** The current display value. */
  currentDisplay: 'Current Kawaikara display',
  /** The display value. */
  display: 'Display',
  /** The last display value. */
  lastDisplay: 'Last used PiP display',
  /** The last position value. */
  lastPosition: 'Last position',
  /** The monitor value. */
  monitor: 'PiP display',
  /** The monitor description value. */
  monitorDescription: 'Choose the display where window PiP opens.',
  /** The position value. */
  position: 'Default position',
  /** The position description value. */
  positionDescription: 'Choose a corner or reuse the last position.',
  /** The primary value. */
  primary: 'Primary',
  /** The top left value. */
  topLeft: 'Top left',
  /** The top right value. */
  topRight: 'Top right',
  /** The unavailable display value. */
  unavailableDisplay: 'Unavailable display',
  /** The video display value. */
  videoDisplay: 'Video PiP display',
};

/** Stores the displays value. */
const displays = [
  {
    /** The ID value. */
    id: '1',
    /** The label value. */
    label: 'Built-in Retina Display',
    /** The width value. */
    width: 2560,
    /** The height value. */
    height: 1440,
    /** The scale factor value. */
    scaleFactor: 2,
    /** The primary value. */
    primary: true,
    /** The current value. */
    current: true,
  },
  {
    /** The ID value. */
    id: '2',
    /** The label value. */
    label: 'Studio Display',
    /** The width value. */
    width: 2560,
    /** The height value. */
    height: 1440,
    /** The scale factor value. */
    scaleFactor: 2,
    /** The primary value. */
    primary: false,
    /** The current value. */
    current: false,
  },
];

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Picture in Picture Placement Control',
  /** The component value. */
  component: PictureInPicturePlacementControl,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <Panel className="storybook-pip-size" padding="md">
        <Story />
      </Panel>
    ),
  ],
  /** The args value. */
  args: {
    /** The displays value. */
    displays,
    /** The messages value. */
    messages,
    /** The value value. */
    value: {
      /** The position value. */
      position: 'top-right',
      /** The monitor value. */
      monitor: {
        /** The mode value. */
        mode: 'current' },
    },
    /** The on change value. */
    onChange: () => undefined,
  },
} satisfies Meta<typeof PictureInPicturePlacementControl>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the current display value. */
export const CurrentDisplay = {} satisfies Story;

/** Stores the last position value. */
export const LastPosition = {
  /** The render value. */
  render: () => {
    const [value, setValue] = useState<PictureInPicturePlacementPreference>({
      position: 'last',
      monitor: { mode: 'last' },
      lastPlacement: { displayId: '2', xRatio: 0.74, yRatio: 0.18 },
    });
    return (
      <PictureInPicturePlacementControl
        displays={displays}
        messages={messages}
        value={value}
        onChange={setValue}
      />
    );
  },
} satisfies Story;
