import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { PictureInPictureSizeControl } from '../../src/Renderer/Component/PictureInPictureSizeControl';
import type { PictureInPictureSizePreference } from '../../src/Common/PictureInPicture';
import {
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS,
} from '../../src/Common/PictureInPicture';

const messages = {
  compact: 'Compact',
  custom: 'Custom',
  description:
    'Presets follow the video aspect ratio. Custom uses the exact size.',
  height: 'Height',
  large: 'Large',
  medium: 'Medium',
  pixels: 'px',
  size: 'Default PiP size',
  width: 'Width',
};

const meta = {
  title: 'Component/Picture in Picture Size Control',
  component: PictureInPictureSizeControl,
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
    messages,
    value: { preset: 'medium', width: 512, height: 288 },
    onChange: () => undefined,
  },
} satisfies Meta<typeof PictureInPictureSizeControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preset = {} satisfies Story;

export const Custom = {
  render: () => {
    const [value, setValue] = useState<PictureInPictureSizePreference>({
      preset: 'custom',
      width: 720,
      height: 405,
    });
    return (
      <PictureInPictureSizeControl
        messages={messages}
        value={value}
        onChange={setValue}
      />
    );
  },
} satisfies Story;

export const Portrait = {
  render: () => {
    const [value, setValue] = useState<PictureInPictureSizePreference>({
      preset: 'medium',
      width: 288,
      height: 512,
    });
    return (
      <PictureInPictureSizeControl
        limits={PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS}
        messages={{
          ...messages,
          description: 'Used when video height exceeds width.',
          size: 'Portrait video PiP size',
        }}
        presets={PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS}
        value={value}
        onChange={setValue}
      />
    );
  },
} satisfies Story;
