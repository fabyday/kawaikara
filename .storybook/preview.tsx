import type { Preview } from '@storybook/react-vite';
import { KawaiProvider } from '@kawaikara/kawai-ui';
import '@kawaikara/kawai-ui/styles.css';
import '../src/Renderer/Styles/Overlay.css';
import '../src/Renderer/Styles/Video.css';
import '../src/Renderer/Styles/ExternalLogin.css';
import '../src/Renderer/Styles/Update.css';
import './Preview.css';
import { installKawaikaraMock } from '../stories/Mocks/KawaikaraMock';

const preview: Preview = {
  beforeEach: () => {
    installKawaikaraMock();
  },
  decorators: [
    (Story) => (
      <KawaiProvider>
        <div className="kawai-theme-dark storybook-app-canvas">
          <Story />
        </div>
      </KawaiProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: 'Kawaikara',
      values: [{ name: 'Kawaikara', value: '#09090b' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
