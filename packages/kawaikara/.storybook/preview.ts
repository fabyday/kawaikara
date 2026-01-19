
import type { Preview } from '@storybook/react-webpack5'
import "../src/renderer/index.css"
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;
