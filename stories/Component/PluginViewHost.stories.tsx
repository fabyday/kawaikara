import type { Meta, StoryObj } from '@storybook/react-vite';
import { PluginViewHost } from '../../src/Renderer/View/Menu/PluginViewHost';
import { STORY_MESSAGES } from '../Mocks/KawaikaraMock';

/** Performs the document operation. */
const document = (title: string, accent: string) => `<!doctype html>
<html><head><style>:root{color-scheme:dark;font:14px system-ui;background:#18181b;color:#fafafa}
body{margin:0;padding:32px}.accent{width:44px;height:6px;border-radius:99px;background:${accent}}
h1{margin-top:20px}</style></head><body><div class="accent"></div><h1>${title}</h1>
<p>This content runs in a sandboxed PluginView document.</p></body></html>`;

/** Stores the meta value. */
const meta = {
  /** The title value. */
  title: 'Component/PluginViewHost',
  /** The component value. */
  component: PluginViewHost,
  /** The parameters value. */
  parameters: {
    /** The layout value. */
    layout: 'centered' },
  /** The args value. */
  args: {
    /** The locale value. */
    locale: 'en-US',
    /** The refresh key value. */
    refreshKey: 0,
    /** The video library labels value. */
    videoLibraryLabels: STORY_MESSAGES.videoLibrary,
    /** The on error value. */
    onError: () => undefined,
  },
  /** The decorators value. */
  decorators: [
    (Story) => (
      <div style={{ width: 680, height: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PluginViewHost>;

export default meta;
/** Defines the story type. */
type Story = StoryObj<typeof meta>;

/** Stores the single panel value. */
export const SinglePanel = {
  /** The args value. */
  args: {
    /** The panels value. */
    panels: [{
      /** The ID value. */
      id: 'provider:example.google:help',
      /** The title value. */
      title: 'Help',
      /** The order value. */
      order: 0,
      /** The content value. */
      content: {
        /** The kind value. */
        kind: 'html',
        /** The HTML value. */
        html: document('One panel', '#60a5fa') },
    }],
  },
} satisfies Story;

/** Stores the multiple panels value. */
export const MultiplePanels = {
  /** The args value. */
  args: {
    /** The panels value. */
    panels: [
      {
        /** The ID value. */
        id: 'provider:example.google:help',
        /** The title value. */
        title: 'Provider',
        /** The order value. */
        order: 0,
        /** The content value. */
        content: {
          /** The kind value. */
          kind: 'html',
          /** The HTML value. */
          html: document('Provider panel', '#60a5fa') },
      },
      {
        /** The ID value. */
        id: 'plugin:example.google.gallery:tools',
        /** The title value. */
        title: 'Search tools',
        /** The order value. */
        order: 10,
        /** The content value. */
        content: {
          /** The kind value. */
          kind: 'html',
          /** The HTML value. */
          html: document('Plugin panel', '#f472b6') },
      },
    ],
  },
} satisfies Story;
