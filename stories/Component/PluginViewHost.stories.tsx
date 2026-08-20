import type { Meta, StoryObj } from '@storybook/react-vite';
import { PluginViewHost } from '../../src/Renderer/View/Menu/PluginViewHost';
import { STORY_MESSAGES } from '../Mocks/KawaikaraMock';

const document = (title: string, accent: string) => `<!doctype html>
<html><head><style>:root{color-scheme:dark;font:14px system-ui;background:#18181b;color:#fafafa}
body{margin:0;padding:32px}.accent{width:44px;height:6px;border-radius:99px;background:${accent}}
h1{margin-top:20px}</style></head><body><div class="accent"></div><h1>${title}</h1>
<p>This content runs in a sandboxed PluginView document.</p></body></html>`;

const meta = {
  title: 'Component/PluginViewHost',
  component: PluginViewHost,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en-US',
    refreshKey: 0,
    videoLibraryLabels: STORY_MESSAGES.videoLibrary,
    onError: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 680, height: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PluginViewHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePanel = {
  args: {
    panels: [{
      id: 'provider:example.google:help',
      title: 'Help',
      order: 0,
      content: { kind: 'html', html: document('One panel', '#60a5fa') },
    }],
  },
} satisfies Story;

export const MultiplePanels = {
  args: {
    panels: [
      {
        id: 'provider:example.google:help',
        title: 'Provider',
        order: 0,
        content: { kind: 'html', html: document('Provider panel', '#60a5fa') },
      },
      {
        id: 'plugin:example.google.gallery:tools',
        title: 'Search tools',
        order: 10,
        content: { kind: 'html', html: document('Plugin panel', '#f472b6') },
      },
    ],
  },
} satisfies Story;
