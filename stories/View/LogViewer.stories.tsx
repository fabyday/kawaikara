import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@kawaikara/kawai-ui';
import { LogViewer } from '../../src/Renderer/View/LogViewer/App';
import {
  installKawaikaraMock,
  STORY_MESSAGES,
} from '../Mocks/KawaikaraMock';

/** Stores the log viewer story metadata. */
const meta = {
  /** The story title value. */
  title: 'View/LogViewer',
  /** The rendered component value. */
  component: LogViewer,
  /** The shared story parameters value. */
  parameters: {
    /** The full-screen layout value. */
    layout: 'fullscreen',
  },
  /** Reproduces the fixed-height application overlay in Storybook. */
  decorators: [
    (Story) => (
      <Box style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <Story />
      </Box>
    ),
  ],
  /** The shared story arguments value. */
  args: {
    /** The localized messages value. */
    messages: STORY_MESSAGES.logViewer,
    /** The resolved locale value. */
    locale: 'en-US',
    /** The close callback value. */
    onClose: () => undefined,
  },
} satisfies Meta<typeof LogViewer>;

export default meta;
/** Defines the log viewer story type. */
type Story = StoryObj<typeof meta>;

/** Stores the default log viewer story. */
export const Default = {} satisfies Story;

/** Stores and verifies a long, independently scrollable history. */
export const ScrollableHistory = {
  /** Installs enough history items to require the custom scrollbar. */
  beforeEach: () => {
    installKawaikaraMock({ logFileCount: 48 });
  },
  /** Verifies that the history can reach a non-zero scroll position. */
  play: async ({ canvasElement }) => {
    const deadline = Date.now() + 3_000;
    let scrollArea: HTMLElement | null = null;
    while (Date.now() < deadline) {
      scrollArea = canvasElement.querySelector<HTMLElement>(
        '.log-viewer-file-scroll',
      );
      if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight) break;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    if (!scrollArea || scrollArea.scrollHeight <= scrollArea.clientHeight) {
      throw new Error('Log history did not become scrollable.');
    }
    scrollArea.scrollTop = scrollArea.scrollHeight;
    scrollArea.dispatchEvent(new Event('scroll', { bubbles: true
    }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    if (scrollArea.scrollTop <= 0) {
      throw new Error('Log history scrollbar did not move.');
    }
  },
} satisfies Story;
