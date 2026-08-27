import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@kawaikara/kawai-ui';
import { PictureInPictureSizeControl } from '../../src/Renderer/Component/PictureInPictureSizeControl';
import type { PictureInPictureSizePreference } from '../../src/Common/PictureInPicture';
import {
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_LIMITS,
  PICTURE_IN_PICTURE_PORTRAIT_SIZE_PRESETS,
} from '../../src/Common/PictureInPicture';

/** Stores the messages value. */
const messages = {
  /** The compact value. */
  compact: 'Compact',
  /** The custom value. */
  custom: 'Custom',
  /** The description value. */
  description:
    'Presets follow the video aspect ratio. Custom uses the exact size.',
  /** The height value. */
  height: 'Height',
  /** The large value. */
  large: 'Large',
  /** The medium value. */
  medium: 'Medium',
  /** The pixels value. */
  pixels: 'px',
  /** The size value. */
  size: 'Default PiP size',
  /** The width value. */
  width: 'Width',
};

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Picture in Picture Size Control',
  /** The component value. */
  component: PictureInPictureSizeControl,
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
    /** The messages value. */
    messages,
    /** The value value. */
    value: {
      /** The preset value. */
      preset: 'medium',
      /** The width value. */
      width: 512,
      /** The height value. */
      height: 288 },
    /** The on change value. */
    onChange: () => undefined,
  },
} satisfies Meta<typeof PictureInPictureSizeControl>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the preset value. */
export const Preset = {} satisfies Story;

/** Stores the custom value. */
export const Custom = {
  /** The render value. */
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

/** Stores the portrait value. */
export const Portrait = {
  /** The render value. */
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
