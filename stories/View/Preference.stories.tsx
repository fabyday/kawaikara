import type { Meta, StoryObj } from '@storybook/react-vite';
import { PreferenceView } from '../../src/Renderer/View/Preference/App';
import {
  installKawaikaraMock,
  STORY_SITES,
} from '../Mocks/KawaikaraMock';

const meta = {
  title: 'View/Preference',
  component: PreferenceView,
  parameters: { layout: 'fullscreen' },
  args: {
    sites: STORY_SITES,
    onBack: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="storybook-preference-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreferenceView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const Nightly = {
  decorators: [
    (Story) => {
      installKawaikaraMock({ buildChannel: 'nightly' });
      return <Story />;
    },
  ],
} satisfies Story;

export const UpdateAvailable = {
  decorators: [
    (Story) => {
      installKawaikaraMock({ buildChannel: 'staging', updateAvailable: true });
      return <Story />;
    },
  ],
} satisfies Story;
