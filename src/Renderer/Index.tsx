import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@kawaikara/kawai-ui/styles.css';
import './Styles.css';
import { App } from './View/Menu/App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Renderer root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
