import { STORY_MESSAGES } from '../Mocks/KawaikaraMock';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProviderAppRequirement } from '../../src/Renderer/View/ExternalApps/ProviderAppRequirement';

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/Provider App Requirement',
  /** The component value. */
  component: ProviderAppRequirement,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'fullscreen',
  },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div className="storybook-downloader-frame">
        <Story />
      </div>
    ),
  ],
  /** The tags value. */
  tags: ['autodocs'],
} satisfies Meta<typeof ProviderAppRequirement>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default value. */
export const Default: Story = {
  /** The args value. */
  args: {
    /** Main-resolved downloader labels. */
    labels: STORY_MESSAGES.app.externalApps.distribution,
    /** The initial URL value. */
    request: {
      /** The app ID value. */
      appId: 'example.editor',
      /** The provider ID value. */
      providerId: 'example.provider',
      /** The source URL value. */
      sourceUrl: 'https://example.com/document' },
    /** The on close value. */
    onClose: () => undefined,
  },
};
