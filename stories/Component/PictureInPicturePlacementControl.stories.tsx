import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { PictureInPicturePlacementControl } from '../../src/Renderer/Component/PictureInPicturePlacementControl';
import type { PictureInPicturePlacementPreference } from '../../src/Common/PictureInPicture';

const messages = {
  bottomLeft: 'Bottom left',
  bottomRight: 'Bottom right',
  currentDisplay: 'Current Kawaikara display',
  display: 'Display',
  lastDisplay: 'Last used PiP display',
  lastPosition: 'Last position',
  monitor: 'PiP display',
  monitorDescription: 'Choose the display where window PiP opens.',
  position: 'Default position',
  positionDescription: 'Choose a corner or reuse the last position.',
  primary: 'Primary',
  topLeft: 'Top left',
  topRight: 'Top right',
  unavailableDisplay: 'Unavailable display',
  videoDisplay: 'Video PiP display',
};

const displays = [
  {
    id: '1',
    label: 'Built-in Retina Display',
    width: 2560,
    height: 1440,
    scaleFactor: 2,
    primary: true,
    current: true,
  },
  {
    id: '2',
    label: 'Studio Display',
    width: 2560,
    height: 1440,
    scaleFactor: 2,
    primary: false,
    current: false,
  },
];

const meta = {
  title: 'Component/Picture in Picture Placement Control',
  component: PictureInPicturePlacementControl,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Panel className="storybook-pip-size" padding="md">
        <Story />
      </Panel>
    ),
  ],
  args: {
    displays,
    messages,
    value: {
      position: 'top-right',
      monitor: { mode: 'current' },
    },
    onChange: () => undefined,
  },
} satisfies Meta<typeof PictureInPicturePlacementControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentDisplay = {} satisfies Story;

export const LastPosition = {
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
