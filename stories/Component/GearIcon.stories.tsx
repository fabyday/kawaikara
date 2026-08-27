import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Panel, Text } from '@kawaikara/kawai-ui';
import { GearIcon } from '../../src/Renderer/Component/GearIcon';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Gear Icon',
  /** The component value. */
  component: GearIcon,
  /** The tags value. */
  tags: ['autodocs'],
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
} satisfies Meta<typeof GearIcon>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the in preference button value. */
export const InPreferenceButton = {
  /** The render value. */
  render: () => (
    <Panel className="storybook-component-frame" padding="sm">
      <div className="storybook-icon-row">
        <Button aria-label="Open preferences" size="icon" variant="ghost">
          <GearIcon />
        </Button>
        <Text size="sm">Open preferences</Text>
      </div>
    </Panel>
  ),
} satisfies Story;
