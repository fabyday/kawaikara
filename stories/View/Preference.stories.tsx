import type { Meta, StoryObj } from '@storybook/react-vite';
import { PreferenceView } from '../../src/Renderer/View/Preference/App';
import {
  installKawaikaraMock,
  STORY_MESSAGES,
  STORY_SITES,
} from '../Mocks/KawaikaraMock';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'View/Preference',
  /** The component value. */
  component: PreferenceView,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen' },
  /** The args value. */
  args: {
    /** The initial messages value. */
    initialMessages: STORY_MESSAGES.app,
    /** The sites value. */
    sites: STORY_SITES,
    /** The on back value. */
    onBack: () => undefined,
  },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-preference-frame">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreferenceView>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default = {} satisfies Story;

/** Stores the nightly value. */
export const Nightly = {
  /** The decorators value. */
  decorators: [
    (Story) => {
      installKawaikaraMock({ buildChannel: 'nightly' });
      return <Story />;
    },
  ],
} satisfies Story;

/** Stores the update available value. */
export const UpdateAvailable = {
  /** The decorators value. */
  decorators: [
    (Story) => {
      installKawaikaraMock({ buildChannel: 'staging', updateAvailable: true });
      return <Story />;
    },
  ],
} satisfies Story;
