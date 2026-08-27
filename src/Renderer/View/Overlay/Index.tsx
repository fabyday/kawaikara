import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import '../../Styles/Overlay.css';
import '../../Styles/Update.css';
import { App } from '../Menu/App';

/** Stores the root value. */
const root = document.getElementById('root');
if (!root) {
  throw new Error('Renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
