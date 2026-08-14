import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Panel, Text } from '@kawaikara/kawai-ui';
import { GearIcon } from '../../src/Renderer/Component/GearIcon';

const meta = {
  title: 'Component/Gear Icon',
  component: GearIcon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof GearIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InPreferenceButton = {
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
